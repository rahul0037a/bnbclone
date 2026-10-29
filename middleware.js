const Listing = require("./models/listing");
const Review = require("./models/review");
const ExpressError = require("./utils/ExpressError");
const schemas = require("./schema");
const { sameId, assertObjectId } = require("./utils/identity");
const { cleanupUpload } = require("./utils/uploads");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "Please log in to continue.");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    const redirectUrl = req.session.redirectUrl;
    if (typeof redirectUrl === "string" && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")) res.locals.redirectUrl = redirectUrl;
    delete req.session.redirectUrl;
    next();
};

module.exports.isOwner = async (req, res, next) => {
    assertObjectId(req.params.id, "Listing");
    const listing = await Listing.findById(req.params.id);
    if (!listing || listing.isActive === false) throw new ExpressError(404, "Listing not found.");
    if (!sameId(listing.owner, req.user._id)) throw new ExpressError(403, "Only the host can change this listing.");
    req.listing = listing;
    next();
};

function validator(schema, upload = false) {
    return async (req, res, next) => {
        const body = req.body && { ...req.body };
        if (body) delete body._csrf;
        const { value, error } = schema.validate(body, { abortEarly: false });
        if (error) {
            if (upload) await cleanupUpload(req.file);
            throw new ExpressError(400, error.details.map(detail => detail.message).join(" "));
        }
        // Preserve Joi conversion (notably scientific numeric notation and strict date values).
        req.body = value;
        next();
    };
}

module.exports.validateListing = validator(schemas.listingSchema, true);
module.exports.validateReview = validator(schemas.reviewSchema);
module.exports.validateBooking = validator(schemas.bookingSchema);
module.exports.validateSignup = validator(schemas.signupSchema);

module.exports.isReviewAuthor = async (req, res, next) => {
    assertObjectId(req.params.id, "Listing");
    assertObjectId(req.params.reviewId, "Review");
    const listing = await Listing.findOne({ _id: req.params.id, isActive: { $ne: false }, reviews: req.params.reviewId });
    if (!listing) throw new ExpressError(404, "Review not found on this listing.");
    const review = await Review.findById(req.params.reviewId);
    if (!review) throw new ExpressError(404, "Review not found.");
    if (!sameId(review.author, req.user._id)) throw new ExpressError(403, "Only the review author can delete this review.");
    next();
};
