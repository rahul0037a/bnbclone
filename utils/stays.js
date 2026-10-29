const ExpressError = require("./ExpressError");
const DAY_MS = 86400000;
function utcToday(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function dateOnly(value) {
    if (value instanceof Date && Number.isFinite(value.getTime()) && value.getTime() % DAY_MS === 0) return value;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ExpressError(400, "Use dates in YYYY-MM-DD format.");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ExpressError(400, "Choose a valid calendar date.");
    return date;
}
function validateStay(checkIn, checkOut, now = new Date()) {
    const start = dateOnly(checkIn), end = dateOnly(checkOut);
    const nights = (end - start) / DAY_MS;
    if (start < utcToday(now)) throw new ExpressError(400, "Check-in cannot be in the past.");
    if (nights < 1 || nights > 90) throw new ExpressError(400, "Choose a stay between 1 and 90 nights.");
    if (end - utcToday(now) > 2 * 366 * DAY_MS) throw new ExpressError(400, "Choose dates within the next two years.");
    return { checkIn: start, checkOut: end, nights };
}
function roundMoney(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function calculatePrice(nightlyPrice, nights, rooms) {
    const subtotal = roundMoney(nightlyPrice * nights * rooms), taxRate = 0.18;
    const taxAmount = roundMoney(subtotal * taxRate);
    return { nightlyPrice, nights, rooms, subtotal, taxRate, taxAmount, total: roundMoney(subtotal + taxAmount) };
}
// Half-open intervals allow arrival on checkout day. A sweep avoids counting stays that never overlap each other.
function peakOccupancy(bookings, checkIn, checkOut) {
    const events = [];
    for (const booking of bookings) {
        if (booking.status === "cancelled") continue;
        const start = Math.max(+new Date(booking.checkInDate), +checkIn), end = Math.min(+new Date(booking.checkOutDate), +checkOut);
        if (start >= end) continue;
        const rooms = Number(booking.numberOfRooms) || 1, guests = Number(booking.numberOfPeople) || 1;
        events.push({ time: start, rooms, guests, arrival: true }, { time: end, rooms: -rooms, guests: -guests, arrival: false });
    }
    events.sort((a, b) => a.time - b.time || Number(a.arrival) - Number(b.arrival));
    let rooms = 0, guests = 0, maxRooms = 0, maxGuests = 0;
    for (const event of events) {
        rooms += event.rooms; guests += event.guests;
        maxRooms = Math.max(maxRooms, rooms); maxGuests = Math.max(maxGuests, guests);
    }
    return { rooms: maxRooms, guests: maxGuests };
}
function assertCapacity(listing, existing, checkIn, checkOut, rooms, guests) {
    const capacity = { rooms: listing.totalRooms || 1, guests: listing.maxGuests || 2 };
    const used = peakOccupancy(existing, checkIn, checkOut);
    if (rooms + used.rooms > capacity.rooms || guests + used.guests > capacity.guests) throw new ExpressError(409, "This stay does not have enough rooms or guest capacity for those dates. Try fewer rooms, fewer guests, or other dates.");
    return { availableRooms: capacity.rooms - used.rooms, availableGuests: capacity.guests - used.guests };
}
module.exports = { DAY_MS, utcToday, dateOnly, validateStay, roundMoney, calculatePrice, peakOccupancy, assertCapacity };
