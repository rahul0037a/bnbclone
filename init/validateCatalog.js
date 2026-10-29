const Joi = require("joi");
const mongoose = require("mongoose");
const Listing = require("../models/listing");

const officialUrl = Joi.string().uri({ scheme: ["https"] }).custom((value, helpers) => {
    return ["www.zostel.com", "staygenerator.com", "www.tajhotels.com"].includes(new URL(value).hostname)
        ? value : helpers.error("any.invalid");
});
const catalogSchema = Joi.object({
    catalogSlug: Joi.string().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).required(),
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(20).max(2000).required(),
    image: Joi.object({
        url: Joi.string().uri({ scheme: ["https"] }).required(),
        filename: Joi.string().allow("").required(),
        isIllustrative: Joi.boolean().valid(true).required(),
    }).required(),
    imageAttribution: Joi.string().required(),
    categories: Joi.array().items(Joi.string().max(50)).min(1).unique().required(),
    price: Joi.number().integer().min(0).max(10000000).required(),
    location: Joi.string().max(200).required(),
    country: Joi.string().max(100).required(),
    geometry: Joi.object({
        type: Joi.string().valid("Point").required(),
        coordinates: Joi.array().ordered(
            Joi.number().min(-180).max(180).required(),
            Joi.number().min(-90).max(90).required()
        ).length(2).required(),
    }).required(),
    coordinatesApproximate: Joi.boolean().valid(true).required(),
    totalRooms: Joi.number().integer().min(1).max(20).required(),
    maxGuests: Joi.number().integer().min(1).max(50).required(),
    sourceUrl: officialUrl.required(),
    sourceName: Joi.string().required(),
    sourceAccessedAt: Joi.string().isoDate().required(),
    isCatalog: Joi.boolean().valid(true).required(),
    ratesIndicative: Joi.boolean().valid(true).required(),
    isActive: Joi.boolean().valid(true).required(),
}).prefs({ convert: false, abortEarly: false });

function validateCatalog(records) {
    if (!Array.isArray(records) || !records.length) throw new Error("Catalog is empty.");
    for (const requiredPath of ["catalogSlug", "sourceUrl", "isCatalog", "ratesIndicative", "totalRooms", "maxGuests"]) {
        if (!Listing.schema.path(requiredPath)) throw new Error(`Listing model does not support catalog field ${requiredPath}.`);
    }
    const slugs = new Set();
    const sourceUrls = new Set();
    const placeholderOwner = new mongoose.Types.ObjectId();
    for (const record of records) {
        const result = catalogSchema.validate(record);
        if (result.error) throw new Error(`Invalid catalog record ${record.catalogSlug || "(no slug)"}: ${result.error.message}`);
        if (slugs.has(record.catalogSlug) || sourceUrls.has(record.sourceUrl)) throw new Error(`Duplicate catalog identity: ${record.catalogSlug}`);
        slugs.add(record.catalogSlug);
        sourceUrls.add(record.sourceUrl);
        const modelError = new Listing({ ...record, owner: placeholderOwner }).validateSync();
        if (modelError) throw new Error(`Listing model rejected ${record.catalogSlug}: ${modelError.message}`);
    }
    return {
        listings: records.length,
        destinations: new Set(records.map(record => record.location)).size,
        countries: new Set(records.map(record => record.country)).size,
    };
}

module.exports = { validateCatalog, catalogSchema };
