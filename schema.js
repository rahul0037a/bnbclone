const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing : Joi.object({
        title: Joi.string().required(),
        description : Joi.string().required(),
        location : Joi.string().required(),
        country : Joi.string().required(),
        price : Joi.number().required().min(0),
        image : Joi.string().allow("", null),
        categories: Joi.array().items(Joi.string()).optional(),
        geometry: Joi.object().optional(),
    }).required()
});


module.exports.reviewSchema = Joi.object({
    review : Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required(),
})

module.exports.bookingSchema = Joi.object({
    checkInDate: Joi.date().required(),
    checkOutDate: Joi.date().required(),
    numberOfPeople: Joi.number().integer().min(1).max(50).required(),
    numberOfRooms: Joi.number().integer().min(1).max(20).required(),
    contactEmail: Joi.string().email().allow("", null),
    contactPhone: Joi.string().pattern(/^[+\d\s()\-]{7,20}$/).allow("", null),
})