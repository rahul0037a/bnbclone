const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const {listingSchema} = require("../schema.js");
const {isLoggedIn, isOwner, validateListing} = require("../middleware.js");

const listingsController = require("../controllers/listings.js");
const bookingsController = require("../controllers/bookings");
const multer = require("multer");
const {storage} = require("../cloudConfig.js");
const upload = multer({ storage });

router.route("/:id/book")
    .get(isLoggedIn, wrapAsync(bookingsController.renderBookingForm))
    .post(isLoggedIn, wrapAsync(bookingsController.createBooking));

router.route("/")
    .get(wrapAsync(listingsController.index))
    .post(validateListing, upload.single("listing[image]") , wrapAsync(listingsController.createListing));

router.get("/new", isLoggedIn, listingsController.renderNewForm);

router.route("/:id")
    .get(wrapAsync(listingsController.showListing))
    .put(isLoggedIn, isOwner, upload.single("listing[image]") , validateListing  , wrapAsync(listingsController.updateListing))
    .delete(isLoggedIn, isOwner,wrapAsync(listingsController.deleteListing)
);

//EDIT Route
router.get("/:id/edit",isLoggedIn, isOwner,wrapAsync(listingsController.renderEditForm));

module.exports = router;