const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError.js");
const categories = require("../utils/categories");
const { listingSchema } = require("../schema.js");

// Geocode a location string using Nominatim (OpenStreetMap)
async function geocodeLocation(location, country) {
    try {
        const query = encodeURIComponent(`${location}, ${country}`);

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
            {
                headers: {
                    "User-Agent": "WanderLust-BnBClone/1.0",
                },
            }
        );

        const data = await response.json();

        if (data && data.length > 0) {
            return {
                type: "Point",
                coordinates: [
                    parseFloat(data[0].lon),
                    parseFloat(data[0].lat),
                ],
            };
        }

        return null;
    } catch (err) {
        console.log("Geocoding error:", err.message);
        return null;
    }
}

// ====================== INDEX ======================

module.exports.index = async (req, res) => {
    const { category, search } = req.query;

    let query = {};

    if (category) {
        query.categories = category;
    }

    if (search) {
        const searchRegex = new RegExp(search.trim(), "i");
        query.$or = [
            { title: searchRegex },
            { location: searchRegex },
            { country: searchRegex }
        ];
    }

    let allListings = await Listing.find(query);

    res.render("listings/index.ejs", {
        allListings,
        categories,
        selectedCategory: category || "",
    });
};

// ====================== NEW ======================

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new", {
        categories,
    });
};

// ====================== SHOW ======================

module.exports.showListing = async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing Not Found!");
        return res.redirect("/listings");
    }

    // Fetch up to 3 similar listings that share categories
    const similarListings = await Listing.find({
        _id: { $ne: listing._id },
        categories: { $in: listing.categories }
    }).limit(3);

    res.render("listings/show.ejs", {
        listing,
        similarListings,
    });
};

// ====================== CREATE ======================

module.exports.createListing = async (req, res) => {
    let url = req.file.path;
    let filename = req.file.filename;

    let result = listingSchema.validate(req.body);

    if (result.error) {
        throw new ExpressError(400, result.error);
    }

    const newListing = new Listing(req.body.listing);

    newListing.owner = req.user._id;

    newListing.image = {
        url,
        filename,
    };

    // Remove duplicate categories
    if (req.body.listing.categories) {
        newListing.categories = [
            ...new Set(req.body.listing.categories),
        ];
    }

    // Geocode location
    let geometry = await geocodeLocation(
        req.body.listing.location,
        req.body.listing.country
    );

    if (geometry) {
        newListing.geometry = geometry;
    }

    await newListing.save();

    req.flash("success", "New Listing Created!");

    res.redirect("/listings");
};

// ====================== EDIT ======================

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing Not Found!");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace(
        "/upload",
        "/upload/w_200"
    );

    // Merge predefined + custom categories
    const allCategories = [...categories];

    listing.categories.forEach((cat) => {
        if (!allCategories.find((c) => c.name === cat)) {
            allCategories.push({
                name: cat,
                icon: "fa-solid fa-tag",
            });
        }
    });

    res.render("listings/edit.ejs", {
        listing,
        originalImageUrl,
        categories: allCategories,
    });
};

// ====================== UPDATE ======================

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;

    let listing = await Listing.findByIdAndUpdate(
        id,
        {
            ...req.body.listing,
        },
        {
            new: true,
        }
    );

    // Remove duplicate categories
    if (req.body.listing.categories) {
        listing.categories = [
            ...new Set(req.body.listing.categories),
        ];
    }

    // Update image
    if (req.file) {
        listing.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
    }

    // Re-geocode
    let geometry = await geocodeLocation(
        req.body.listing.location,
        req.body.listing.country
    );

    if (geometry) {
        listing.geometry = geometry;
    }

    await listing.save();

    req.flash("success", "Listing Updated!");

    res.redirect(`/listings/${id}`);
};

// ====================== DELETE ======================

module.exports.deleteListing = async (req, res) => {
    let { id } = req.params;

    let deletedListing = await Listing.findByIdAndDelete(id);

    console.log(deletedListing);

    req.flash("success", "Listing Deleted!");

    res.redirect("/listings");
};