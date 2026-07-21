const Booking = require("../models/booking");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

// Render the form to book a listing
module.exports.renderBookingForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing Not Found!");
        return res.redirect("/listings");
    }
    // Prevent owner from booking their own listing
    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You cannot book your own listing!");
        return res.redirect(`/listings/${id}`);
    }
    res.render("bookings/new.ejs", { listing });
};

// Create a new booking
module.exports.createBooking = async (req, res) => {
    const { id } = req.params;
    const { checkInDate, checkOutDate, numberOfPeople, numberOfRooms, contactPhone } = req.body;
    
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing Not Found!");
        return res.redirect("/listings");
    }

    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You cannot book your own listing!");
        return res.redirect(`/listings/${id}`);
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        req.flash("error", "Invalid check-in or check-out date.");
        return res.redirect(`/listings/${id}/book`);
    }

    // Date range validation
    const timeDiff = checkOut.getTime() - checkIn.getTime();
    const numberOfDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (numberOfDays <= 0) {
        req.flash("error", "Check-out date must be after check-in date.");
        return res.redirect(`/listings/${id}/book`);
    }

    // Calculate pricing (18% GST included)
    const basePrice = listing.price * numberOfDays * parseInt(numberOfRooms || 1);
    const totalPrice = Math.round(basePrice * 1.18);

    const newBooking = new Booking({
        listing: id,
        user: req.user._id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfPeople: parseInt(numberOfPeople || 1),
        numberOfRooms: parseInt(numberOfRooms || 1),
        contactPhone,
        contactEmail: req.user.email,
        totalPrice
    });

    await newBooking.save();
    req.flash("success", "Booking successful! Your stay is reserved.");
    res.redirect(`/bookings/${newBooking._id}`);
};

// Show detail receipt for a specific booking
module.exports.showBooking = async (req, res) => {
    const { id } = req.params;
    const booking = await Booking.findById(id)
        .populate("listing")
        .populate("user");

    if (!booking) {
        req.flash("error", "Booking Not Found!");
        return res.redirect("/listings");
    }

    // Access control: Only booking user or listing owner can view this booking
    const isBooker = booking.user._id.equals(req.user._id);
    const isListingOwner = booking.listing.owner.equals(req.user._id);

    if (!isBooker && !isListingOwner) {
        req.flash("error", "You do not have permission to view this booking.");
        return res.redirect("/listings");
    }

    res.render("bookings/show.ejs", { booking });
};

// View user's own past and upcoming bookings
module.exports.myBookings = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .sort({ createdAt: -1 });

    res.render("bookings/my.ejs", { bookings });
};

// View incoming bookings on listings owned by user
module.exports.incomingBookings = async (req, res) => {
    // 1. Find all listings owned by the logged-in user
    const userListings = await Listing.find({ owner: req.user._id }, "_id");
    const listingIds = userListings.map(l => l._id);

    // 2. Query bookings matching those listings
    const bookings = await Booking.find({ listing: { $in: listingIds } })
        .populate("listing")
        .populate("user")
        .sort({ createdAt: -1 });

    res.render("bookings/incoming.ejs", { bookings });
};
