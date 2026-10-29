const Joi = require("joi");
const { dateOnly, validateStay } = require("./utils/stays");
const dateField = Joi.string().custom((value, helpers) => {
    try { return dateOnly(value); } catch (error) { return helpers.message(error.message); }
});

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().trim().min(3).max(160).required(),
        description: Joi.string().trim().min(20).max(10000).required(),
        location: Joi.string().trim().max(160).required(),
        country: Joi.string().trim().max(100).required(),
        price: Joi.number().min(0).max(10000000).precision(2).required(),
        image: Joi.string().allow("", null),
        categories: Joi.array().items(Joi.string().trim().min(1).max(60)).single().unique().max(12).default(["Trending"]),
        totalRooms: Joi.number().integer().min(1).max(20).default(1),
        maxGuests: Joi.number().integer().min(1).max(50).default(2),
    }).required(),
}).required();

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().trim().min(3).max(3000).required(),
    }).required(),
}).required();

module.exports.bookingSchema = Joi.object({
    checkInDate: dateField.required(), checkOutDate: dateField.required(),
    numberOfPeople: Joi.number().integer().min(1).max(50).required(),
    numberOfRooms: Joi.number().integer().min(1).max(20).required(),
    contactEmail: Joi.string().email({ tlds: { allow: false } }).allow("", null),
    contactPhone: Joi.string().trim().pattern(/^[+\d\s()\-]{7,20}$/).allow("", null),
}).custom((value, helpers) => {
    try { validateStay(value.checkInDate, value.checkOutDate); return value; }
    catch (error) { return helpers.message(error.message); }
}).required();

module.exports.signupSchema = Joi.object({
    username: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{3,30}$/).required().messages({ "string.pattern.base": "Username must have 3–30 letters, digits, or underscores." }),
    email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254).required(),
    password: Joi.string().min(10).max(128).pattern(/^(?=.*[a-zA-Z])(?=.*\d)[\s\S]+$/).required().messages({ "string.pattern.base": "Password must include a letter and a number." }),
}).required();

module.exports.filterSchema = Joi.object({
    search: Joi.string().trim().max(100).allow("").default(""),
    category: Joi.string().trim().max(60).allow("").default(""),
    minPrice: Joi.number().min(0).max(10000000).empty("").optional(),
    maxPrice: Joi.number().min(0).max(10000000).empty("").optional(),
    guests: Joi.number().integer().min(1).max(50).empty("").optional(),
    rooms: Joi.number().integer().min(1).max(20).empty("").optional(),
    checkIn: dateField.empty("").optional(), checkOut: dateField.empty("").optional(),
    sort: Joi.string().valid("recommended", "newest", "price-asc", "price-desc").default("recommended"),
    saved: Joi.string().max(2499).pattern(/^(?:[a-fA-F0-9]{24})(?:,[a-fA-F0-9]{24}){0,99}$/).empty("").optional(),
    page: Joi.number().integer().min(1).max(10000).empty("").default(1),
}).custom((value, helpers) => {
    if (value.minPrice !== undefined && value.maxPrice !== undefined && value.maxPrice < value.minPrice) return helpers.message("Maximum price must be at least the minimum price.");
    if (Boolean(value.checkIn) !== Boolean(value.checkOut)) return helpers.message("Choose both check-in and check-out dates.");
    if (value.checkIn) { try { validateStay(value.checkIn, value.checkOut); } catch (error) { return helpers.message(error.message); } }
    return value;
}).required();
