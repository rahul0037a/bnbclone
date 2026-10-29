const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const ExpressError = require("../utils/ExpressError");
const categories = require("../utils/categories");
const { filterSchema } = require("../schema");
const { assertObjectId } = require("../utils/identity");
const { cleanupUpload, destroyImage } = require("../utils/uploads");
const { assertCapacity, utcToday } = require("../utils/stays");

function escapeRegex(text) { return text.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); }

async function geocodeLocation(location, country) {
    try {
        const response = await fetch("https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(location + ", " + country) + "&format=json&limit=1", {
            headers: { "User-Agent": "WanderLust-Preview/2.0" }, signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) return null;
        const coordinates = [Number(data[0].lon), Number(data[0].lat)];
        return coordinates.every(Number.isFinite) && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90 ? { type: "Point", coordinates } : null;
    } catch { return null; }
}

module.exports.index = async (req, res) => {
    const { value: values, error } = filterSchema.validate(req.query, { abortEarly: false });
    if (error) throw new ExpressError(400, error.details.map(item => item.message).join(" "));
    const query = { isActive: { $ne: false } };
    if (values.category) query.categories = values.category;
    if (values.search) {
        const pattern = new RegExp(escapeRegex(values.search), "i");
        query.$or = [{ title: pattern }, { location: pattern }, { country: pattern }];
    }
    if (values.minPrice !== undefined || values.maxPrice !== undefined) {
        query.price = {};
        if (values.minPrice !== undefined) query.price.$gte = values.minPrice;
        if (values.maxPrice !== undefined) query.price.$lte = values.maxPrice;
    }
    if (values.saved) query._id = { $in: [...new Set(values.saved.split(","))] };
    const capacityConditions = [];
    if (values.guests) capacityConditions.push({ $gte: [{ $ifNull: ["$maxGuests", 2] }, values.guests] });
    if (values.rooms) capacityConditions.push({ $gte: [{ $ifNull: ["$totalRooms", 1] }, values.rooms] });
    if (capacityConditions.length) query.$expr = { $and: capacityConditions };
    const sorts = { "price-asc": { price: 1, _id: 1 }, "price-desc": { price: -1, _id: 1 }, newest: { createdAt: -1, _id: -1 }, recommended: { isCatalog: -1, createdAt: -1, _id: 1 } };
    const limit = 12;
    let total, page, allListings;
    if (values.checkIn) {
        // Date searches use the same interval-capacity rules as the transactional reservation.
        const candidates = await Listing.find(query).sort(sorts[values.sort]).lean();
        const bookings = candidates.length ? await Booking.find({
            listing: { $in: candidates.map(item => item._id) }, status: { $ne: "cancelled" },
            checkInDate: { $lt: values.checkOut }, checkOutDate: { $gt: values.checkIn },
        }).select("listing checkInDate checkOutDate numberOfRooms numberOfPeople status").lean() : [];
        const groups = new Map();
        for (const booking of bookings) {
            const key = String(booking.listing);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(booking);
        }
        const available = candidates.filter(listing => {
            try {
                assertCapacity(listing, groups.get(String(listing._id)) || [], values.checkIn, values.checkOut, values.rooms || 1, values.guests || 1);
                return true;
            } catch { return false; }
        });
        total = available.length;
        page = Math.min(values.page, Math.max(1, Math.ceil(total / limit)));
        allListings = available.slice((page - 1) * limit, page * limit);
    } else {
        total = await Listing.countDocuments(query);
        page = Math.min(values.page, Math.max(1, Math.ceil(total / limit)));
        allListings = await Listing.find(query).sort(sorts[values.sort]).skip((page - 1) * limit).limit(limit);
    }
    const filters = {
        search: values.search, category: values.category,
        minPrice: values.minPrice ?? "", maxPrice: values.maxPrice ?? "",
        guests: values.guests ?? "", rooms: values.rooms ?? "",
        checkIn: values.checkIn ? values.checkIn.toISOString().slice(0, 10) : "",
        checkOut: values.checkOut ? values.checkOut.toISOString().slice(0, 10) : "",
        sort: values.sort, saved: values.saved || "", page,
    };
    res.render("listings/index.ejs", { allListings, categories, selectedCategory: values.category, filters, pagination: { page, totalPages: Math.max(1, Math.ceil(total / limit)), total, limit } });
};

module.exports.renderNewForm = (req, res) => res.render("listings/new.ejs", { categories });

module.exports.showListing = async (req, res) => {
    const id = assertObjectId(req.params.id, "Listing");
    const listing = await Listing.findOne({ _id: id, isActive: { $ne: false } })
        .populate({ path: "reviews", populate: { path: "author", select: "username" } })
        .populate("owner", "username");
    if (!listing) throw new ExpressError(404, "Listing not found.");
    const similarListings = await Listing.find({ _id: { $ne: listing._id }, isActive: { $ne: false }, categories: { $in: listing.categories } }).limit(3);
    res.render("listings/show.ejs", { listing, similarListings });
};

module.exports.createListing = async (req, res) => {
    if (!req.file) throw new ExpressError(400, "Choose a JPG or PNG cover image.");
    let persisted = false;
    try {
        const { image, ...fields } = req.body.listing;
        const listing = new Listing({ ...fields, owner: req.user._id, image: { url: req.file.path, filename: req.file.filename } });
        const geometry = await geocodeLocation(listing.location, listing.country);
        if (geometry) listing.geometry = geometry;
        await listing.save();
        persisted = true;
        req.flash("success", "Your stay has been published.");
        res.redirect("/listings/" + listing._id);
    } catch (error) {
        if (!persisted) await cleanupUpload(req.file);
        throw error;
    }
};

module.exports.renderEditForm = async (req, res) => {
    const listing = req.listing;
    const allCategories = [...categories];
    for (const name of listing.categories) if (!allCategories.some(item => item.name === name)) allCategories.push({ name, icon: "fa-solid fa-tag" });
    res.render("listings/edit.ejs", { listing, originalImageUrl: (listing.image?.url || "").replace("/upload/", "/upload/w_300/"), categories: allCategories });
};

module.exports.updateListing = async (req, res) => {
    const { image, ...fields } = req.body.listing;
    const addressChanged = fields.location !== req.listing.location || fields.country !== req.listing.country || req.listing.geometry?.coordinates?.length !== 2;
    const geometry = addressChanged ? await geocodeLocation(fields.location, fields.country) : undefined;
    let oldImage, persisted = false, listing;
    try {
        listing = await mongoose.connection.transaction(async session => {
            const current = await Listing.findOneAndUpdate({ _id: req.params.id, owner: req.user._id, isActive: { $ne: false } }, { $inc: { bookingVersion: 1 } }, { new: true, session });
            if (!current) throw new ExpressError(404, "Listing not found.");
            const existing = await Booking.find({ listing: current._id, status: { $ne: "cancelled" }, checkOutDate: { $gt: utcToday() } }).session(session);
            assertCapacity({ totalRooms: fields.totalRooms, maxGuests: fields.maxGuests }, existing, utcToday(), new Date("9999-12-31"), 0, 0);
            Object.assign(current, fields);
            if (addressChanged) current.geometry = geometry || undefined;
            if (req.file) {
                oldImage = { url: current.image?.url, filename: current.image?.filename };
                current.image = { url: req.file.path, filename: req.file.filename, isIllustrative: false };
                current.imageAttribution = undefined;
            }
            await current.save({ session });
            return current;
        });
        persisted = true;
        if (oldImage?.filename && oldImage.filename !== req.file?.filename) {
            // Keep an image that is part of an existing receipt snapshot.
            const referenced = await Booking.exists({ "listingSnapshot.imageUrl": oldImage.url });
            if (!referenced) await destroyImage(oldImage.filename);
        }
        req.flash("success", "Listing updated.");
        res.redirect("/listings/" + listing._id);
    } catch (error) {
        if (!persisted) await cleanupUpload(req.file);
        throw error;
    }
};

module.exports.deleteListing = async (req, res) => {
    const listing = await Listing.findOneAndUpdate({ _id: req.params.id, owner: req.user._id, isActive: { $ne: false } }, { $set: { isActive: false }, $inc: { bookingVersion: 1 } }, { new: true });
    if (!listing) throw new ExpressError(404, "Listing not found.");
    req.flash("success", "Listing archived. Existing demo reservations and receipts remain available.");
    res.redirect("/listings");
};
