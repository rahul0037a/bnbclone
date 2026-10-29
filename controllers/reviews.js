const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Review = require("../models/review");
const ExpressError = require("../utils/ExpressError");
const { assertObjectId } = require("../utils/identity");

module.exports.createReview = async (req, res) => {
    const id = assertObjectId(req.params.id, "Listing");
    await mongoose.connection.transaction(async session => {
        const review = new Review({ ...req.body.review, author: req.user._id });
        const result = await Listing.updateOne(
            { _id: id, isActive: { $ne: false } },
            { $push: { reviews: review._id } },
            { session, runValidators: true }
        );
        if (!result.matchedCount) throw new ExpressError(404, "Listing not found.");
        await review.save({ session });
    });
    req.flash("success", "Your review has been added.");
    res.redirect("/listings/" + id);
};

module.exports.destroyReview = async (req, res) => {
    const { id, reviewId } = req.params;
    await mongoose.connection.transaction(async session => {
        const result = await Listing.updateOne(
            { _id: id, isActive: { $ne: false }, reviews: reviewId },
            { $pull: { reviews: reviewId } },
            { session }
        );
        if (!result.matchedCount) throw new ExpressError(404, "Review not found on this listing.");
        const deleted = await Review.deleteOne({ _id: reviewId, author: req.user._id }, { session });
        if (!deleted.deletedCount) throw new ExpressError(403, "Only the review author can delete this review.");
    });
    req.flash("success", "Review deleted.");
    res.redirect("/listings/" + id);
};
