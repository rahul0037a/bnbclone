const express = require("express");
const router = express.Router({mergeParams: true});
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const {listingSchema, reviewSchema} = require("../schema.js");
const Listing = require("../models/listing");
const Review = require("../models/review.js");
const {isLoggedIn, validateReview, isReviewAuthor} = require("../middleware.js");
const reviewsController = require("../controllers/reviews.js");





//REVIEWS ROUTE
//POST Review Route
router.post("/", isLoggedIn, validateReview, wrapAsync(reviewsController.createReview));


//DELETE Review Route
router.delete("/:reviewId",isLoggedIn, isReviewAuthor, wrapAsync( reviewsController.destroyReview));



module.exports = router;


