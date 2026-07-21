const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookingsController = require("../controllers/bookings");

// View my bookings (User past bookings)
router.get("/my", isLoggedIn, wrapAsync(bookingsController.myBookings));

// View incoming bookings (Owner view)
router.get("/incoming", isLoggedIn, wrapAsync(bookingsController.incomingBookings));

// View details of a specific booking
router.get("/:id", isLoggedIn, wrapAsync(bookingsController.showBooking));

module.exports = router;
