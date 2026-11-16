const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ejs = require("ejs");
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

test("searched dates, rooms and guests carry through listing links, login and booking", async t => {
    const Listing = require("../models/listing");
    const Booking = require("../models/booking");
    const listings = require("../controllers/listings");
    const bookings = require("../controllers/bookings");
    const { isLoggedIn, saveRedirectUrl } = require("../middleware");
    const { DAY_MS } = require("../utils/stays");
    const listing = {
        _id: "111111111111111111111111", owner: { _id: "222222222222222222222222" },
        title: "Beach house", location: "Goa", country: "India", reviews: [], categories: ["Trending"],
        price: 100, totalRooms: 3, maxGuests: 6,
    };
    t.mock.method(Listing, "find", filter => filter._id?.$ne ? { limit: async () => [] } : { sort: () => ({ lean: async () => [listing] }) });
    t.mock.method(Listing, "findOne", () => ({
        populate() { return this; },
        then(resolve) { resolve(listing); },
    }));
    t.mock.method(Booking, "find", () => ({ select: () => ({ lean: async () => [] }) }));

    const checkIn = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 33 * DAY_MS).toISOString().slice(0, 10);
    const filters = { checkIn, checkOut, rooms: "2", guests: "4" };
    const parseLink = href => new URL(href.replaceAll("&amp;", "&"), "http://localhost");
    const queryFrom = url => Object.fromEntries(url.searchParams);
    const findLink = (html, linkPath) => Array.from(html.matchAll(/href="([^"]+)"/g), ([, href]) => parseLink(href))
        .find(url => url.pathname === linkPath);
    async function render(controller, req) {
        let response;
        await controller(req, { render(view, locals) {
            response = ejs.renderFile(path.join(__dirname, "..", "views", view), {
                layout() {}, csrfToken: "test-token", currUser: req.user ?? null, ...locals,
            });
        } });
        return response;
    }

    const detailPath = `/listings/${listing._id}`;
    const catalog = await render(listings.index, { query: { ...filters, search: "Goa" } });
    const detailLink = findLink(catalog, detailPath);
    assert.deepEqual(queryFrom(detailLink), filters);
    const detail = await render(listings.showListing, { params: { id: listing._id }, query: queryFrom(detailLink) });
    const bookingLink = findLink(detail, `${detailPath}/book`);
    assert.deepEqual(queryFrom(bookingLink), filters);

    const originalUrl = `${bookingLink.pathname}${bookingLink.search}`;
    const loginRequest = { isAuthenticated: () => false, originalUrl, session: {}, flash() {} };
    isLoggedIn(loginRequest, { redirect: location => assert.equal(location, "/login") }, assert.fail);
    const firstAttempt = { locals: {} };
    saveRedirectUrl(loginRequest, firstAttempt, () => {});
    assert.equal(firstAttempt.locals.redirectUrl, originalUrl);
    const secondAttempt = { locals: {} };
    saveRedirectUrl(loginRequest, secondAttempt, () => {});
    assert.equal(secondAttempt.locals.redirectUrl, originalUrl);

    const form = await render(bookings.renderBookingForm, {
        params: { id: listing._id }, query: queryFrom(parseLink(secondAttempt.locals.redirectUrl)),
        user: { _id: "333333333333333333333333", email: "guest@example.com" },
    });
    assert.match(form, new RegExp(`name="checkInDate" value="${checkIn}"`));
    assert.match(form, new RegExp(`name="checkOutDate" value="${checkOut}"`));
    assert.match(form, /name="numberOfRooms" value="2"/);
    assert.match(form, /name="numberOfPeople" value="4"/);
    assert.match(form, /id="preview-total">708</);
});
