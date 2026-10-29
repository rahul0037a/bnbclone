const mongoose = require("mongoose");
const { Schema } = mongoose;

const integer = value => Number.isInteger(value);
const listingSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 10000 },
    image: {
        url: { type: String, maxlength: 2048 },
        filename: { type: String, maxlength: 512 },
        isIllustrative: { type: Boolean, default: false },
    },
    imageAttribution: { type: String, maxlength: 500 },
    categories: { type: [{ type: String, trim: true, maxlength: 60 }], default: ["Trending"] },
    price: { type: Number, required: true, min: 0, max: 10000000 },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    geometry: {
        type: { type: String, enum: ["Point"] },
        coordinates: {
            type: [Number], default: undefined,
            validate: {
                validator: value => !value || (value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90),
                message: "Coordinates must be [longitude, latitude] within valid ranges.",
            },
        },
    },
    coordinatesApproximate: { type: Boolean, default: false },
    totalRooms: { type: Number, required: true, default: 1, min: 1, max: 20, validate: integer },
    maxGuests: { type: Number, required: true, default: 2, min: 1, max: 50, validate: integer },
    bookingVersion: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    isCatalog: { type: Boolean, default: false },
    ratesIndicative: { type: Boolean, default: false },
    catalogSlug: { type: String, trim: true, maxlength: 200 },
    sourceName: { type: String, trim: true, maxlength: 200 },
    sourceUrl: { type: String, maxlength: 2048 },
    sourceAccessedAt: Date,
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

listingSchema.index({ owner: 1, isActive: 1 });
listingSchema.index({ isActive: 1, categories: 1, price: 1 });
listingSchema.index({ isActive: 1, createdAt: -1 });
listingSchema.index({ catalogSlug: 1 }, { unique: true, sparse: true });

// Public deletion is a soft delete: reservations and immutable receipts survive.
module.exports = mongoose.model("Listing", listingSchema);
