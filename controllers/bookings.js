const Booking = require("../models/booking");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");
const { sameId, assertObjectId } = require("../utils/identity");
const { utcToday, DAY_MS, roundMoney } = require("../utils/stays");
const { reserveBooking, cancelBooking } = require("../utils/bookingService");

function presentBooking(document) {
    const booking = document.toObject ? document.toObject() : { ...document };
    const listing = booking.listing;
    const nights = booking.nights || Math.max(1, Math.round((new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / DAY_MS));
    // Legacy receipts use their saved total rather than recalculating from a mutable current listing price.
    const subtotal = booking.subtotal ?? roundMoney(booking.totalPrice / 1.18);
    const taxAmount = booking.taxAmount ?? roundMoney(booking.totalPrice - subtotal);
    const nightlyPrice = booking.nightlyPrice ?? roundMoney(subtotal / nights / booking.numberOfRooms);
    booking.listingSnapshot ||= {
        title: listing?.title || "Archived stay", location: listing?.location || "", country: listing?.country || "",
        imageUrl: listing?.image?.url || "", nightlyPrice,
    };
    booking.pricing = { nightlyPrice, nights, rooms: booking.numberOfRooms, subtotal, taxRate: booking.taxRate ?? 0.18, taxAmount, total: booking.totalPrice };
    booking.nightlyPrice = nightlyPrice; booking.nights = nights; booking.subtotal = subtotal; booking.taxAmount = taxAmount; booking.taxRate ??= 0.18;
    booking.status ||= "confirmed";
    booking.isDemo = true;
    return booking;
}
module.exports.presentBooking = presentBooking;

module.exports.renderBookingForm = async (req, res) => {
    const id = assertObjectId(req.params.id, "Listing");
    const listing = await Listing.findOne({ _id: id, isActive: { $ne: false } });
    if (!listing) throw new ExpressError(404, "This stay is no longer available.");
    if (sameId(listing.owner, req.user._id)) throw new ExpressError(403, "You cannot reserve your own listing.");
    res.render("bookings/new.ejs", { listing });
};

module.exports.createBooking = async (req, res) => {
    const listingId = assertObjectId(req.params.id, "Listing");
    const booking = await reserveBooking({ listingId, user: req.user, input: req.body });
    req.flash("success", "Demo reservation confirmed. No payment was collected and no real property reservation was made.");
    res.redirect("/bookings/" + booking._id);
};

module.exports.showBooking = async (req, res) => {
    assertObjectId(req.params.id, "Reservation");
    const document = await Booking.findById(req.params.id).populate("listing").populate("user", "username email");
    if (!document) throw new ExpressError(404, "Reservation not found.");
    const isGuest = sameId(document.user, req.user._id);
    const isHost = sameId(document.owner || document.listing?.owner, req.user._id);
    if (!isGuest && !isHost) throw new ExpressError(403, "This receipt is private to its guest and host.");
    const booking = presentBooking(document);
    const canCancel = booking.status !== "cancelled" && new Date(booking.checkInDate) > utcToday();
    res.render("bookings/show.ejs", { booking, snapshot: booking.listingSnapshot, pricing: booking.pricing, canCancel });
};

module.exports.myBookings = async (req, res) => {
    const documents = await Booking.find({ user: req.user._id }).populate("listing").sort({ createdAt: -1 });
    res.render("bookings/my.ejs", { bookings: documents.map(presentBooking) });
};

module.exports.incomingBookings = async (req, res) => {
    const owned = await Listing.find({ owner: req.user._id }, "_id");
    const documents = await Booking.find({ $or: [{ owner: req.user._id }, { listing: { $in: owned.map(listing => listing._id) } }] })
        .populate("listing").populate("user", "username email").sort({ createdAt: -1 });
    res.render("bookings/incoming.ejs", { bookings: documents.map(presentBooking) });
};

module.exports.cancelBooking = async (req, res) => {
    assertObjectId(req.params.id, "Reservation");
    const booking = await cancelBooking({ bookingId: req.params.id, user: req.user });
    req.flash("success", "Demo reservation cancelled. Its room and guest capacity is available again. No payment or refund was involved.");
    res.redirect("/bookings/" + booking._id);
};
