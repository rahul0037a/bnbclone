const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const ExpressError = require("./ExpressError");
const { sameId } = require("./identity");
const { dateOnly, validateStay, assertCapacity, calculatePrice, utcToday } = require("./stays");

const transaction = callback => mongoose.connection.transaction(callback, {
    readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary",
});

async function reserveBooking({ listingId, user, input, now = new Date() }, dependencies = {}) {
    const models = { Listing, Booking, transaction, ...dependencies };
    const { bookingRequestId, numberOfRooms, numberOfPeople } = input;
    if (!bookingRequestId) throw new ExpressError(400, "Open the reservation form again before submitting.");
    if (!Number.isInteger(numberOfRooms) || numberOfRooms < 1 || numberOfRooms > 20 || !Number.isInteger(numberOfPeople) || numberOfPeople < 1 || numberOfPeople > 50) throw new ExpressError(400, "Choose valid whole room and guest counts.");
    const checkIn = dateOnly(input.checkInDate);
    const checkOut = dateOnly(input.checkOutDate);
    const contactPhone = input.contactPhone || "";
    const request = { listing: listingId, user: user._id, bookingRequestId };
    return models.transaction(async session => {
        const saved = await models.Booking.findOne(request).session(session);
        if (saved) {
            if (+saved.checkInDate !== +checkIn || +saved.checkOutDate !== +checkOut ||
                saved.numberOfRooms !== numberOfRooms || saved.numberOfPeople !== numberOfPeople ||
                (saved.contactPhone || "") !== contactPhone) {
                throw new ExpressError(409, "This form has already been submitted. Open a new form to make another reservation.");
            }
            return saved;
        }
        const { nights } = validateStay(checkIn, checkOut, now);
        // This shared write serializes reservations, cancellations, inventory edits and archival.
        // A competing transaction gets a write conflict and the driver's transaction retry reads fresh inventory.
        const listing = await models.Listing.findOneAndUpdate(
            { _id: listingId, isActive: { $ne: false } },
            { $inc: { bookingVersion: 1 } }, { new: true, session, runValidators: true }
        );
        if (!listing) throw new ExpressError(404, "This stay is no longer available.");
        if (sameId(listing.owner, user._id)) throw new ExpressError(403, "You cannot reserve your own listing.");
        const existing = await models.Booking.find({ listing: listingId, status: { $ne: "cancelled" }, checkInDate: { $lt: checkOut }, checkOutDate: { $gt: checkIn } }).session(session);
        assertCapacity(listing, existing, checkIn, checkOut, numberOfRooms, numberOfPeople);
        const pricing = calculatePrice(listing.price, nights, numberOfRooms);
        const [booking] = await models.Booking.create([{
            listing: listing._id, user: user._id, bookingRequestId, owner: listing.owner,
            listingSnapshot: {
                title: listing.title, location: listing.location, country: listing.country,
                imageUrl: listing.image?.url || "", nightlyPrice: listing.price,
                isCatalog: Boolean(listing.isCatalog), sourceName: listing.sourceName, sourceUrl: listing.sourceUrl,
            },
            checkInDate: checkIn, checkOutDate: checkOut,
            numberOfPeople, numberOfRooms, nights, contactPhone, contactEmail: user.email,
            nightlyPrice: pricing.nightlyPrice, subtotal: pricing.subtotal,
            taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, totalPrice: pricing.total,
            status: "confirmed", isDemo: true,
        }], { session });
        return booking;
    });
}

async function cancelBooking({ bookingId, user, now = new Date() }, dependencies = {}) {
    const models = { Listing, Booking, transaction, ...dependencies };
    return models.transaction(async session => {
        const booking = await models.Booking.findById(bookingId).session(session);
        if (!booking) throw new ExpressError(404, "Reservation not found.");
        const listing = await models.Listing.findOneAndUpdate({ _id: booking.listing }, { $inc: { bookingVersion: 1 } }, { new: true, session });
        if (!sameId(booking.user, user._id) && !sameId(booking.owner || listing?.owner, user._id)) throw new ExpressError(403, "Only the guest or host can cancel this reservation.");
        if (booking.status === "cancelled") return booking;
        if (booking.checkInDate <= utcToday(now)) throw new ExpressError(400, "Reservations can only be cancelled before the check-in day.");
        return models.Booking.findOneAndUpdate(
            { _id: bookingId, status: { $ne: "cancelled" } },
            { $set: { status: "cancelled", cancelledAt: now, cancelledBy: user._id } },
            { new: true, session, runValidators: true }
        );
    });
}

module.exports = { reserveBooking, cancelBooking };
