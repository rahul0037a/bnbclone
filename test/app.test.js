const test = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const { getConfig } = require("../utils/config");
const { csrfProtection } = require("../utils/security");
const { createApp } = require("../app");

test("preview configuration cannot point at the original database", () => {
    assert.throws(() => getConfig({ PREVIEW_MODE: "true", DB_NAME: "wanderlust", ATLASDB_URL: "mongodb://localhost/wanderlust" }));
    assert.throws(() => getConfig({ PREVIEW_MODE: "true", DB_NAME: "wanderlust_preview_test", ATLASDB_URL: "mongodb://localhost/wanderlust" }));
    const config = getConfig({ PREVIEW_MODE: "true", DB_NAME: "wanderlust_preview_test", ATLASDB_URL: "mongodb://localhost/wanderlust_preview_test" });
    assert.equal(config.port, 8081);
    assert.equal(config.previewMode, true);
});
test("production requires a strong configured session secret", () => {
    assert.throws(() => getConfig({ NODE_ENV: "production", SECRET: "short" }));
});
test("CSRF issues tokens and rejects missing or mismatched mutation tokens", () => {
    const req = { method: "GET", session: {}, query: {}, get: () => undefined };
    const res = { locals: {} };
    let error;
    csrfProtection(req, res, err => { error = err; });
    assert.equal(error, undefined);
    assert.match(res.locals.csrfToken, /^[a-f0-9]{64}$/);
    req.method = "POST";
    csrfProtection(req, res, err => { error = err; });
    assert.equal(error.statusCode, 403);
    req.body = { _csrf: req.session.csrfToken, title: "Preserved" };
    csrfProtection(req, res, err => { error = err; });
    assert.equal(error, undefined);
    assert.deepEqual(req.body, { title: "Preserved" });
});
test("multipart CSRF can be verified before the body is parsed", () => {
    const token = "a".repeat(64);
    const req = { method: "PUT", session: { csrfToken: token }, query: { _csrf: token }, get: () => undefined };
    let error;
    csrfProtection(req, { locals: {} }, err => { error = err; });
    assert.equal(error, undefined);
});
test("public pages render and mutation endpoints reject absent CSRF", async t => {
    const app = createApp({ sessionStore: new session.MemoryStore(), config: getConfig({ SECRET: "test-secret-with-enough-characters", PREVIEW_MODE: "true", DB_NAME: "wanderlust_preview_test" }), rateLimits: false });
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ["/login", "/signup", "/privacy", "/terms"]) {
        const response = await fetch(base + route);
        assert.equal(response.status, 200, route);
        assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
        assert.equal(response.headers.get("x-powered-by"), null);
        assert.match(await response.text(), /WanderLust/i);
    }
    const rejected = await fetch(base + "/logout", { method: "POST", redirect: "manual" });
    assert.equal(rejected.status, 403);
    const missing = await fetch(base + "/this-page-does-not-exist");
    assert.equal(missing.status, 404);
});
