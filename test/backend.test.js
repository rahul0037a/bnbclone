const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { bookingSchema, listingSchema, signupSchema, filterSchema } = require("../schema");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");
const middleware = require("../middleware");
const { sameId, assertObjectId } = require("../utils/identity");
const { dateOnly, validateStay, calculatePrice, peakOccupancy, assertCapacity, DAY_MS } = require("../utils/stays");
const { reserveBooking, cancelBooking } = require("../utils/bookingService");
const { presentBooking } = require("../controllers/bookings");

const id = () => new mongoose.Types.ObjectId();
const future = offset => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
const chain = value => ({ session() { return this; }, populate() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const interval = (start, end, rooms = 1, guests = 2, status = "confirmed") => ({ checkInDate: dateOnly(start), checkOutDate: dateOnly(end), numberOfRooms: rooms, numberOfPeople: guests, status });

test("strict calendar dates reject normalized invalid dates and preserve UTC day arithmetic", () => {
    assert.throws(() => dateOnly("2030-02-30"), /valid calendar date/);
    assert.throws(() => dateOnly("2030-01-01T00:00:00Z"), /YYYY-MM-DD/);
    assert.equal(dateOnly("2030-03-01").toISOString(), "2030-03-01T00:00:00.000Z");
    assert.equal(validateStay("2030-03-01", "2030-03-03", new Date("2030-02-01")).nights, 2);
    assert.throws(() => validateStay("2030-01-01", "2030-01-02", new Date("2030-02-01")), /past/);
    assert.throws(() => validateStay("2030-03-01", "2030-03-01", new Date("2030-02-01")), /1 and 90/);
});

test("Joi conversions are retained by booking middleware, including numeric scientific notation", async () => {
    const req = { body: { checkInDate: future(10), checkOutDate: future(12), numberOfPeople: "1e1", numberOfRooms: "2", _csrf: "already-verified" } };
    let called = false;
    await middleware.validateBooking(req, {}, () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.body.numberOfPeople, 10);
    assert.equal(req.body.numberOfRooms, 2);
    assert.ok(req.body.checkInDate instanceof Date);
    assert.equal(req.body._csrf, undefined);
    assert.ok(bookingSchema.validate({ ...req.body, checkInDate: "2020-01-01", checkOutDate: "2020-01-02" }).error);
});

test("validation rejects fractional counts, hostile query structures, invalid sorting and missing listing body", () => {
    assert.ok(bookingSchema.validate({ checkInDate: future(10), checkOutDate: future(11), numberOfPeople: 1.5, numberOfRooms: 1 }).error);
    assert.ok(filterSchema.validate({ search: { $ne: "" } }).error);
    assert.ok(filterSchema.validate({ category: ["Beach", "Cabins"] }).error);
    assert.ok(filterSchema.validate({ sort: "price;drop" }).error);
    assert.ok(filterSchema.validate({ minPrice: 100, maxPrice: 10 }).error);
    assert.ok(filterSchema.validate({ checkIn: future(10) }).error);
    assert.ok(listingSchema.validate(undefined).error);
    assert.ok(filterSchema.validate({ saved: "not-an-id" }).error);
});

test("signup normalizes account identifiers and applies password requirements", () => {
    const valid = signupSchema.validate({ username: "  Traveler_1 ", email: " USER@Example.com ", password: "Sensible-pass-42" });
    assert.ifError(valid.error);
    assert.equal(valid.value.username, "traveler_1");
    assert.equal(valid.value.email, "user@example.com");
    assert.ok(signupSchema.validate({ username: "bad user", email: "bad", password: "short" }).error);
    assert.ok(signupSchema.validate({ username: "traveler", email: "user@example.com", password: "onlyletterspassword" }).error);
});

test("capacity uses peak concurrent inventory rather than summing disjoint reservations", () => {
    const start = dateOnly("2030-01-01"), end = dateOnly("2030-01-05");
    const bookings = [interval("2030-01-01", "2030-01-03"), interval("2030-01-03", "2030-01-05")];
    assert.deepEqual(peakOccupancy(bookings, start, end), { rooms: 1, guests: 2 });
    assert.doesNotThrow(() => assertCapacity({ totalRooms: 2, maxGuests: 4 }, bookings, start, end, 1, 2));
    assert.throws(() => assertCapacity({ totalRooms: 1, maxGuests: 4 }, bookings, start, end, 1, 1), /enough rooms/);
    assert.throws(() => assertCapacity({ totalRooms: 3, maxGuests: 2 }, bookings, start, end, 1, 1), /guest capacity/);
});

test("cancelled stays and checkout boundaries release inventory", () => {
    const existing = [interval("2030-01-01", "2030-01-03"), interval("2030-01-03", "2030-01-05", 1, 2, "cancelled")];
    assert.deepEqual(peakOccupancy(existing, dateOnly("2030-01-03"), dateOnly("2030-01-05")), { rooms: 0, guests: 0 });
});

test("server price breakdown consistently rounds currency to two decimal places", () => {
    const pricing = calculatePrice(1234.56, 3, 2);
    assert.equal(pricing.subtotal, 7407.36);
    assert.equal(pricing.taxAmount, 1333.32);
    assert.equal(pricing.total, 8740.68);
    assert.equal(calculatePrice(1000, 2, 1).total, 2360);
});

test("reservation locks listing before reading capacity and creates immutable receipt values", async () => {
    const events = [], session = Symbol("session");
    const listing = { _id: id(), owner: id(), title: "Original coast", location: "Goa", country: "India", price: 1000, totalRooms: 1, maxGuests: 4, image: { url: "https://example.com/original.jpg" }, isCatalog: true };
    const user = { _id: id(), email: "guest@example.com" };
    const booking = await reserveBooking({ listingId: String(listing._id), user, now: new Date("2030-01-01"), input: { checkInDate: "2030-01-10", checkOutDate: "2030-01-12", numberOfPeople: 2, numberOfRooms: 1 } }, {
        transaction: callback => callback(session),
        Listing: { async findOneAndUpdate(query, update, options) { events.push("lock"); assert.equal(update.$inc.bookingVersion, 1); assert.equal(options.session, session); return listing; } },
        Booking: {
            find(query) { events.push("capacity"); assert.equal(query.status.$ne, "cancelled"); return chain([]); },
            async create(documents, options) { events.push("create"); assert.equal(options.session, session); return documents; },
        },
    });
    assert.deepEqual(events, ["lock", "capacity", "create"]);
    assert.equal(booking.totalPrice, 2360);
    assert.equal(booking.contactEmail, user.email);
    assert.equal(booking.isDemo, true);
    listing.title = "Changed"; listing.price = 9000;
    assert.equal(booking.listingSnapshot.title, "Original coast");
    assert.equal(booking.nightlyPrice, 1000);
});

test("reservation rejects sold-out dates and self-bookings before inserting", async () => {
    const listing = { _id: id(), owner: id(), totalRooms: 1, maxGuests: 2, price: 1000 };
    let inserted = false;
    const dependencies = {
        transaction: callback => callback({}),
        Listing: { async findOneAndUpdate() { return listing; } },
        Booking: { find: () => chain([interval("2030-01-10", "2030-01-12")]), async create() { inserted = true; } },
    };
    const input = { checkInDate: "2030-01-10", checkOutDate: "2030-01-12", numberOfPeople: 1, numberOfRooms: 1 };
    await assert.rejects(reserveBooking({ listingId: String(listing._id), user: { _id: id() }, input, now: new Date("2030-01-01") }, dependencies), error => error.statusCode === 409);
    await assert.rejects(reserveBooking({ listingId: String(listing._id), user: { _id: listing.owner }, input, now: new Date("2030-01-01") }, dependencies), error => error.statusCode === 403);
    assert.equal(inserted, false);
});

test("cancellation is private and rejects a stay that has already begun", async () => {
    const booking = { _id: id(), listing: id(), user: id(), owner: id(), status: "confirmed", checkInDate: dateOnly("2030-01-10") };
    const deps = { transaction: callback => callback({}), Listing: { async findOneAndUpdate() { return { owner: booking.owner }; } }, Booking: { findById: () => chain(booking), async findOneAndUpdate() { throw new Error("Must not update"); } } };
    await assert.rejects(cancelBooking({ bookingId: String(booking._id), user: { _id: id() }, now: new Date("2030-01-01") }, deps), error => error.statusCode === 403);
    await assert.rejects(cancelBooking({ bookingId: String(booking._id), user: { _id: booking.user }, now: new Date("2030-01-10") }, deps), /before the check-in/);
});

test("legacy booking presentation survives missing listing and preserves saved total", () => {
    const booking = presentBooking({ listing: null, checkInDate: dateOnly("2030-01-01"), checkOutDate: dateOnly("2030-01-03"), numberOfRooms: 1, totalPrice: 2360 });
    assert.equal(booking.listingSnapshot.title, "Archived stay");
    assert.equal(booking.pricing.nightlyPrice, 1000);
    assert.equal(booking.pricing.subtotal, 2000);
    assert.equal(booking.pricing.total, 2360);
});

test("ownership handles missing documents and review deletion checks its parent listing", async () => {
    const originalFindById = Listing.findById, originalFindOne = Listing.findOne;
    try {
        Listing.findById = async () => null;
        await assert.rejects(middleware.isOwner({ params: { id: String(id()) }, user: { _id: id() } }, {}, () => {}), error => error.statusCode === 404);
        Listing.findOne = async query => { assert.ok(query.reviews); return null; };
        await assert.rejects(middleware.isReviewAuthor({ params: { id: String(id()), reviewId: String(id()) }, user: { _id: id() } }, {}, () => {}), error => error.statusCode === 404);
    } finally { Listing.findById = originalFindById; Listing.findOne = originalFindOne; }
    assert.equal(sameId(null, id()), false);
    assert.throws(() => assertObjectId("bad"), error => error.statusCode === 404);
});

test("model validation enforces negative-price, fractional-capacity and coordinate bounds", async () => {
    const listing = new Listing({ title: "Bad listing", description: "A sample listing description.", price: -1, location: "Goa", country: "India", owner: id(), totalRooms: 1.5, maxGuests: 2.5, geometry: { type: "Point", coordinates: [190, 95] } });
    await assert.rejects(listing.validate(), error => Boolean(error.errors.price && error.errors.totalRooms && error.errors.maxGuests && error.errors["geometry.coordinates"]));
    const review = new Review({ comment: "Review", rating: 2.5, author: id() });
    await assert.rejects(review.validate());
    assert.equal(Review.schema.path("createdAt").defaultValue, Date.now);
    assert.equal(Booking.schema.path("totalPrice").options.immutable, true);
    assert.equal(Booking.schema.path("listingSnapshot").options.immutable, true);
});
