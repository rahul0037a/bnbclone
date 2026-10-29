const express = require("express");
const multer = require("multer");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const { isLoggedIn, isOwner, validateListing, validateBooking } = require("../middleware");
const listings = require("../controllers/listings");
const bookings = require("../controllers/bookings");
const { storage } = require("../cloudConfig");

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30, fieldSize: 20000 },
    fileFilter(req, file, callback) {
        if (!["image/jpeg", "image/png"].includes(file.mimetype)) return callback(new ExpressError(400, "Choose a JPG or PNG image."));
        callback(null, true);
    },
});

router.route("/:id/book")
    .get(isLoggedIn, wrapAsync(bookings.renderBookingForm))
    .post(isLoggedIn, validateBooking, wrapAsync(bookings.createBooking));

router.route("/")
    .get(wrapAsync(listings.index))
    .post(isLoggedIn, upload.single("listing[image]"), validateListing, wrapAsync(listings.createListing));

router.get("/new", isLoggedIn, listings.renderNewForm);
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listings.renderEditForm));
router.route("/:id")
    .get(wrapAsync(listings.showListing))
    .put(isLoggedIn, isOwner, upload.single("listing[image]"), validateListing, wrapAsync(listings.updateListing))
    .delete(isLoggedIn, isOwner, wrapAsync(listings.deleteListing));

module.exports = router;
