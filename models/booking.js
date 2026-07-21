const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    checkInDate: {
        type: Date,
        required: true,
    },
    checkOutDate: {
        type: Date,
        required: true,
    },
    numberOfPeople: {
        type: Number,
        required: true,
        min: 1,
    },
    numberOfRooms: {
        type: Number,
        required: true,
        min: 1,
    },
    contactPhone: {
        type: String,
    },
    contactEmail: {
        type: String,
        required: true,
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("Booking", bookingSchema);
