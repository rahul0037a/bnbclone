require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const fs = require("node:fs");
const mongoose = require("mongoose");
const session = require("express-session");
const { createApp } = require("../app");
const { getConfig } = require("../utils/config");
const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const config = getConfig();
if (!config.previewMode || !config.dbName?.startsWith("wanderlust_preview_")) throw new Error("Integration checks only run against the isolated preview database.");
const result = { checks: [] };
const userIds = [], listingIds = [];
let server;
const tokenFrom = html => [...html.matchAll(/<input\b[^>]*>/g)].map(m => m[0]).find(s => /name=["']_csrf["']/.test(s))?.match(/value=["']([^"']+)/)?.[1];
function client(base) {
    let cookie = "", token;
    return {
        async get(route) {
            const response = await fetch(base + route, { headers: { cookie }, redirect: "manual" });
            const cookies = response.headers.getSetCookie();
            if (cookies.length) cookie = cookies.map(c => c.split(";")[0]).join("; ");
            const html = await response.text();
            token = tokenFrom(html) || token;
            return { response, html };
        },
        async post(route, body = {}) {
            const response = await fetch(base + route, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...body, _csrf: token || "" }), redirect: "manual" });
            const cookies = response.headers.getSetCookie();
            if (cookies.length) cookie = cookies.map(c => c.split(";")[0]).join("; ");
            return response;
        },
        async login(username, password) {
            await this.get("/login");
            const response = await this.post("/login", { username, password });
            assert.equal(response.status, 302, "login");
            // Passport regenerates the session at login; fetch a form for its new CSRF token.
            await this.get("/signup");
        },
    };
}
async function run() {
    await mongoose.connect(config.dbUrl, { dbName: config.dbName, serverSelectionTimeoutMS: 15000 });
    assert.equal(mongoose.connection.name, config.dbName);
    const stamp = Date.now().toString(36);
    const password = "Smoke-check-42-" + stamp;
    const users = {};
    for (const role of ["owner", "guest", "outsider"]) {
        const user = await User.register(new User({ username: `smoke_${role}_${stamp}`, email: `smoke-${role}-${stamp}@example.com` }), password);
        users[role] = user; userIds.push(user._id);
    }
    const listing = await Listing.create({ title: `Smoke coast ${stamp}`, description: "Temporary integration fixture.", image: { url: "https://images.unsplash.com/photo-1566073771259-6a8506099945", filename: "" }, price: 1000, location: "Goa", country: "India", geometry: { type: "Point", coordinates: [73.8, 15.5] }, categories: ["Beach"], owner: users.owner._id, totalRooms: 1, maxGuests: 4 });
    listingIds.push(listing._id);
    const other = await Listing.create({ ...listing.toObject(), _id: new mongoose.Types.ObjectId(), title: `Smoke forest ${stamp}` });
    listingIds.push(other._id);
    const app = createApp({ sessionStore: new session.MemoryStore(), config, rateLimits: false });
    server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const guest = client(base), host = client(base), outsider = client(base);
    await guest.login(users.guest.username, password);
    await host.login(users.owner.username, password);
    await outsider.login(users.outsider.username, password);
    result.checks.push("authentication and CSRF session rotation");
    const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const payload = { checkInDate: day(14), checkOutDate: day(16), numberOfPeople: "2", numberOfRooms: "1", contactEmail: users.guest.email };
    const responses = await Promise.all([guest.post(`/listings/${listing._id}/book`, payload), guest.post(`/listings/${listing._id}/book`, payload)]);
    const bookings = await Booking.find({ listing: listing._id, status: "confirmed" });
    assert.equal(bookings.length, 1, "concurrent requests must not overbook");
    assert.equal(responses.filter(r => /^\/bookings\/[a-f0-9]{24}$/.test(r.headers.get("location") || "")).length, 1);
    result.checks.push("concurrent reservation capacity protection");
    const booking = bookings[0];
    assert.equal(booking.totalPrice, 2360);
    const denied = await outsider.get(`/bookings/${booking._id}`);
    assert.ok([302,403].includes(denied.response.status), "unrelated user is denied receipt");
    assert.ok(!denied.html.includes(users.guest.email));
    result.checks.push("private receipt access");
    await Listing.updateOne({ _id: listing._id }, { $set: { price: 9000, title: `Changed ${stamp}` } });
    const receipt = await guest.get(`/bookings/${booking._id}`);
    assert.equal(receipt.response.status, 200);
    assert.ok(receipt.html.includes(`Smoke coast ${stamp}`), "receipt uses original title snapshot");
    assert.equal(booking.pricing.nightlyPrice, 1000);
    result.checks.push("historical booking snapshots survive price edits");
    const past = await guest.post(`/listings/${listing._id}/book`, { ...payload, checkInDate: "2020-01-01", checkOutDate: "2020-01-02" });
    assert.ok([400,302].includes(past.status));
    assert.equal(await Booking.countDocuments({ listing: listing._id }), 1);
    const own = await host.post(`/listings/${listing._id}/book`, payload);
    assert.ok([400,403,302].includes(own.status));
    assert.equal(await Booking.countDocuments({ listing: listing._id }), 1);
    result.checks.push("past dates and self booking rejected");
    await guest.post(`/listings/${listing._id}/reviews`, { "review[rating]": "4", "review[comment]": "Integration test review." });
    const review = await Review.findOne({ author: users.guest._id });
    assert.ok(review);
    await guest.post(`/listings/${other._id}/reviews/${review._id}?_method=DELETE`);
    assert.ok(await Review.findById(review._id), "wrong parent must not delete review");
    result.checks.push("review parent relationship enforced");
    const cancelled = await guest.post(`/bookings/${booking._id}/cancel`);
    assert.ok([302,303].includes(cancelled.status));
    assert.equal((await Booking.findById(booking._id)).status, "cancelled");
    const rebook = await guest.post(`/listings/${listing._id}/book`, payload);
    assert.match(rebook.headers.get("location") || "", /^\/bookings\//);
    result.checks.push("cancellation releases inventory");
    const deleted = await host.post(`/listings/${listing._id}?_method=DELETE`);
    assert.ok([302,303].includes(deleted.status));
    assert.equal((await Listing.findById(listing._id)).isActive, false);
    assert.equal((await guest.get(`/bookings/${booking._id}`)).response.status, 200);
    result.checks.push("listing archival preserves booking history");
    console.log(JSON.stringify({ passed: result.checks.length, checks: result.checks }, null, 2));
}
run().catch(err => { console.error(err.stack); process.exitCode = 1; }).finally(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === config.dbName && config.dbName.startsWith("wanderlust_preview_")) {
        await Booking.deleteMany({ listing: { $in: listingIds } });
        await Review.deleteMany({ author: { $in: userIds } });
        await Listing.deleteMany({ _id: { $in: listingIds } });
        await User.deleteMany({ _id: { $in: userIds } });
    }
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    fs.mkdirSync(".verification", { recursive: true });
    fs.writeFileSync(".verification/smoke-results.json", JSON.stringify(result, null, 2));
});
