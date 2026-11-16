const ExpressError = require("./ExpressError");
const { tripFilterSchema } = require("../schema");

function readTripFilters(query) {
    const { value, error } = tripFilterSchema.validate(query, { stripUnknown: true, abortEarly: false });
    if (error) throw new ExpressError(400, error.details.map(item => item.message).join(" "));
    return value;
}

function tripQueryString({ checkIn, checkOut, rooms, guests }) {
    const query = new URLSearchParams();
    if (checkIn && checkOut) {
        query.set("checkIn", checkIn.toISOString().slice(0, 10));
        query.set("checkOut", checkOut.toISOString().slice(0, 10));
    }
    if (rooms) query.set("rooms", rooms);
    if (guests) query.set("guests", guests);
    return query.size ? `?${query}` : "";
}

module.exports = { readTripFilters, tripQueryString };
