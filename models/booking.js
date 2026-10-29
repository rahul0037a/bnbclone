const mongoose = require("mongoose");
const { Schema } = mongoose;
const money = { type: Number, required: true, min: 0, immutable: true };
const quantity = { type: Number, required: true, min: 1, immutable: true, validate: Number.isInteger };
const snapshotSchema = new Schema({
    title: { type: String, required: true },
    location: { type: String, required: true },
    country: { type: String, required: true },
    imageUrl: String,
    nightlyPrice: { type: Number, required: true, min: 0 },
    isCatalog: { type: Boolean, default: false },
    sourceName: String,
    sourceUrl: String,
}, { _id: false });
const bookingSchema = new Schema({
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true, immutable: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    listingSnapshot: { type: snapshotSchema, required: true, immutable: true },
    checkInDate: { type: Date, required: true, immutable: true },
    checkOutDate: { type: Date, required: true, immutable: true },
    numberOfPeople: { ...quantity, max: 50 },
    numberOfRooms: { ...quantity, max: 20 },
    nights: { ...quantity, max: 90 },
    contactPhone: { type: String, maxlength: 20, immutable: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true, immutable: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    nightlyPrice: money,
    subtotal: money,
    taxRate: { ...money, max: 1, default: 0.18 },
    taxAmount: money,
    totalPrice: money,
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", required: true },
    isDemo: { type: Boolean, default: true, immutable: true },
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now, immutable: true },
});
bookingSchema.pre("validate", function(next) {
    if (this.checkInDate && this.checkOutDate && this.checkOutDate <= this.checkInDate) this.invalidate("checkOutDate", "Check-out must be after check-in.");
    next();
});
bookingSchema.virtual("pricing").get(function() {
    return { nightlyPrice: this.nightlyPrice, nights: this.nights, rooms: this.numberOfRooms, subtotal: this.subtotal, taxRate: this.taxRate, taxAmount: this.taxAmount, total: this.totalPrice };
});
bookingSchema.index({ listing: 1, status: 1, checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ owner: 1, createdAt: -1 });
module.exports = mongoose.model("Booking", bookingSchema);
