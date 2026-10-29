const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const session = require("express-session");
const { createApp } = require("../app");
const { getConfig } = require("../utils/config");
const User = require("../models/user");

const production = { NODE_ENV: "production", SECRET: "test-only-production-session-secret-42" };
const tokenFrom = html => html.match(/name="_csrf"\s+value="([a-f0-9]{64})"/)?.[1];

async function serve(t, env) {
    const app = createApp({ sessionStore: new session.MemoryStore(), config: getConfig(env), rateLimits: false });
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}

function client(base, proto = "https") {
    let cookie = "";
    return async (route, body) => {
        const response = await fetch(base + route, {
            method: body ? "POST" : "GET", redirect: "manual",
            headers: { cookie, "x-forwarded-proto": proto, "content-type": "application/x-www-form-urlencoded" },
            body: body ? new URLSearchParams(body) : undefined,
        });
        const setCookie = response.headers.getSetCookie().find(value => value.startsWith("wanderlust.sid="));
        if (setCookie) cookie = setCookie.split(";")[0];
        return { response, setCookie, cookie, html: await response.text() };
    };
}

test("Render HTTPS preserves login sessions and CSRF protection through Passport rotation", async t => {
    const user = new User({ username: "proxy_test_guest", email: "proxy-test@example.com" });
    const password = "Test-only-login-42";
    await user.setPassword(password);
    t.mock.method(User, "findByUsername", async username => username === user.username ? user : null);
    const base = await serve(t, { ...production, RENDER: "true" });
    const request = client(base);
    const form = await request("/login");
    assert.equal(form.response.status, 200);
    assert.ok(form.setCookie, "HTTPS through Render must set the session cookie");
    assert.match(form.setCookie, /; Secure/);
    assert.match(form.setCookie, /; HttpOnly/);
    assert.match(form.setCookie, /; SameSite=Lax/);
    const token = tokenFrom(form.html);
    assert.ok(token);
    assert.equal(tokenFrom((await request("/login")).html), token, "refresh keeps the same session");

    const invalid = await request("/login", { username: user.username, password, _csrf: "0".repeat(64) });
    assert.equal(invalid.response.status, 403, "mismatched tokens remain rejected");
    assert.equal((await request("/login", { username: user.username, password })).response.status, 403);

    const loggedIn = await request("/login", { username: user.username, password, _csrf: token });
    assert.equal(loggedIn.response.status, 302);
    assert.equal(loggedIn.response.headers.get("location"), "/listings");
    assert.notEqual(loggedIn.cookie, form.cookie, "Passport rotates the session on login");
    const protectedPage = await request("/listings/new");
    assert.equal(protectedPage.response.status, 200, "authentication survives the next request");
    const newToken = tokenFrom(protectedPage.html);
    assert.ok(newToken);
    assert.notEqual(newToken, token, "authenticated forms receive a fresh CSRF token");
    assert.equal((await request("/logout", { _csrf: token })).response.status, 403, "old forms cannot log out a new session");
    assert.equal((await request("/logout", { _csrf: newToken })).response.status, 302);
    assert.equal((await request("/listings/new")).response.headers.get("location"), "/login");
});

test("proxy configuration supports explicit settings without trusting arbitrary production proxies", () => {
    assert.equal(getConfig(production).trustProxy, false);
    assert.equal(getConfig({ ...production, RENDER: "true" }).trustProxy, true);
    for (const value of ["1", "true"]) assert.equal(getConfig({ ...production, TRUST_PROXY: value }).trustProxy, true);
    for (const value of ["0", "false"]) assert.equal(getConfig({ ...production, RENDER: "true", TRUST_PROXY: value }).trustProxy, false);
});

test("secure cookies are never issued for HTTP or untrusted forwarded headers", async t => {
    const direct = client(await serve(t, production));
    const form = await direct("/login");
    assert.equal(form.setCookie, undefined);
    const posted = await direct("/login", { _csrf: tokenFrom(form.html), username: "", password: "" });
    assert.equal(posted.response.status, 403, "reproduces the failure when proxy trust is absent");
    const renderHttp = client(await serve(t, { ...production, RENDER: "true" }), "http");
    assert.equal((await renderHttp("/login")).setCookie, undefined);
});

test("CSP allows source maps for the shipped libraries without opening connections to all hosts", async t => {
    const request = client(await serve(t, { ...production, RENDER: "true" }));
    const { response } = await request("/login");
    const policy = response.headers.get("content-security-policy");
    const connectSources = policy.split(";").find(value => value.startsWith("connect-src ")).split(/\s+/).slice(1);
    const sourceMaps = [
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css.map",
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js.map",
        "https://cdn.jsdelivr.net/npm/tom-select/dist/css/tom-select.css.map",
        "https://cdn.jsdelivr.net/npm/tom-select/dist/js/tom-select.complete.min.js.map",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js.map",
    ];
    for (const url of sourceMaps) assert.ok(connectSources.includes(new URL(url).origin), `source map permitted: ${url}`);
    assert.ok(connectSources.includes("'self'"));
    assert.ok(connectSources.includes("https://nominatim.openstreetmap.org"));
    assert.ok(connectSources.every(source => !source.includes("*") && source !== "https:"));
    assert.match(policy, /frame-ancestors 'none'/);
});
