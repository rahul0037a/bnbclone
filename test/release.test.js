const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const listingsController = require("../controllers/listings");
const { getConfig } = require("../utils/config");
const { assertPreviewDatabase } = require("../init/previewSafety");

test("legacy mixed-case usernames retain their original lookup spelling", () => {
    const filter = User.findByUsername("LegacyHost").getFilter();
    assert.deepEqual(filter, { $or: [{ username: "LegacyHost" }] });
});

test("login retries normalized usernames only after an exact lookup misses", async t => {
    const legacyUser = new User({ username: "LegacyHost", email: "legacy@example.com" });
    const normalizedUser = new User({ username: "legacyhost", email: "normalized@example.com" });
    const legacyPassword = "TestLegacyPassword42";
    const normalizedPassword = "TestNormalizedPassword42";
    await Promise.all([legacyUser.setPassword(legacyPassword), normalizedUser.setPassword(normalizedPassword)]);

    const accounts = new Map([[legacyUser.username, legacyUser], [normalizedUser.username, normalizedUser]]);
    const lookups = [];
    t.mock.method(User, "findByUsername", async (username, selectCredentials) => {
        assert.equal(selectCredentials, true);
        lookups.push(username);
        return accounts.get(username) || null;
    });
    const login = (username, password) => new Promise((resolve, reject) => {
        User.verifyLogin(username, password, (error, user, failure) => {
            if (error) reject(error);
            else resolve({ user, failure });
        });
    });

    assert.equal((await login("LegacyHost", legacyPassword)).user, legacyUser);
    assert.deepEqual(lookups.splice(0), ["LegacyHost"]);

    const wrongAccount = await login("LegacyHost", normalizedPassword);
    assert.equal(wrongAccount.user, false);
    assert.equal(wrongAccount.failure.name, "IncorrectPasswordError");
    assert.deepEqual(lookups.splice(0), ["LegacyHost"]);

    assert.equal((await login("LEGACYHOST", normalizedPassword)).user, normalizedUser);
    assert.deepEqual(lookups, ["LEGACYHOST", "legacyhost"]);
});

test("deployment binds publicly while preview remains loopback by default", () => {
    assert.equal(getConfig({}).host, "0.0.0.0");
    assert.equal(getConfig({ PREVIEW_MODE: "true", DB_NAME: "wanderlust_preview_test" }).host, "127.0.0.1");
    assert.equal(getConfig({ HOST: "127.0.0.1" }).host, "127.0.0.1");
});

test("catalog writes require a suffixed preview database", () => {
    for (const name of ["wanderlust", "production", "wanderlust_preview", "wanderlust_preview_"]) {
        assert.throws(() => assertPreviewDatabase(name));
    }
    assert.equal(assertPreviewDatabase("wanderlust_preview_local"), "wanderlust_preview_local");
});

test("an unchanged legacy address with empty coordinates remains editable", async t => {
    const owner = new mongoose.Types.ObjectId();
    const listing = new Listing({ title: "Legacy home", description: "A legacy listing with a missing map point.", price: 1000, location: "Goa", country: "India", owner, geometry: { type: "Point", coordinates: [] }, totalRooms: 1, maxGuests: 2 });
    const original = { transaction: mongoose.connection.transaction, update: Listing.findOneAndUpdate, find: Booking.find, fetch: global.fetch };
    t.after(() => {
        mongoose.connection.transaction = original.transaction;
        Listing.findOneAndUpdate = original.update;
        Booking.find = original.find;
        global.fetch = original.fetch;
    });
    let geocoded = false, saved = false;
    global.fetch = async () => { geocoded = true; return { ok: true, json: async () => [] }; };
    mongoose.connection.transaction = async callback => callback({});
    Listing.findOneAndUpdate = async () => listing;
    Booking.find = () => ({ session: async () => [] });
    listing.save = async () => { await listing.validate(); saved = true; return listing; };
    const req = { listing, params: { id: String(listing._id) }, user: { _id: owner }, flash() {}, body: { listing: { title: listing.title, description: listing.description, location: listing.location, country: listing.country, price: 1200, totalRooms: 1, maxGuests: 2, categories: ["Rooms"] } } };
    let redirect;
    await listingsController.updateListing(req, { redirect: target => { redirect = target; } });
    assert.equal(geocoded, true);
    assert.equal(saved, true);
    assert.equal(listing.geometry?.coordinates, undefined);
    assert.equal(redirect, "/listings/" + listing._id);
});
