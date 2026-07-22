const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const {listingSchema} = require("../schema.js");
const {isLoggedIn, isOwner, validateListing, validateBooking} = require("../middleware.js");

const listingsController = require("../controllers/listings.js");
const bookingsController = require("../controllers/bookings");
const multer = require("multer");
const {storage} = require("../cloudConfig.js");
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

router.route("/:id/book")
    .get(isLoggedIn, wrapAsync(bookingsController.renderBookingForm))
    .post(isLoggedIn, validateBooking, wrapAsync(bookingsController.createBooking));

router.route("/")
    .get(wrapAsync(listingsController.index))
    .post(isLoggedIn, validateListing, upload.single("listing[image]"), wrapAsync(listingsController.createListing));

router.get("/new", isLoggedIn, listingsController.renderNewForm);

router.route("/:id")
    .get(wrapAsync(listingsController.showListing))
    .put(isLoggedIn, isOwner, upload.single("listing[image]") , validateListing  , wrapAsync(listingsController.updateListing))
    .delete(isLoggedIn, isOwner,wrapAsync(listingsController.deleteListing)
);

//EDIT Route
router.get("/:id/edit",isLoggedIn, isOwner,wrapAsync(listingsController.renderEditForm));

module.exports = router;