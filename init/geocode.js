require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Listing = require("../models/listing");
const { assertPreviewDatabase } = require("./previewSafety");

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function geocodeLocation(location, country) {
    const query = encodeURIComponent(`${location}, ${country}`);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
        headers: { "User-Agent": "WanderLust-Preview-Catalog/1.0" },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Geocoder returned HTTP ${response.status}.`);
    const [result] = await response.json();
    if (!result) return null;
    const coordinates = [Number(result.lon), Number(result.lat)];
    if (coordinates.some(number => !Number.isFinite(number)) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) {
        throw new Error("Geocoder returned invalid coordinates.");
    }
    return { type: "Point", coordinates };
}

async function main() {
    const flags = process.argv.slice(2);
    if (flags.some(flag => !["--apply", "--dry-run"].includes(flag)) || (flags.includes("--apply") && flags.includes("--dry-run"))) {
        throw new Error("Usage: node init/geocode.js [--dry-run | --apply]");
    }
    const databaseName = assertPreviewDatabase(process.env.DB_NAME);
    if (!process.env.ATLASDB_URL) throw new Error("Set ATLASDB_URL in the preview .env file.");
    await mongoose.connect(process.env.ATLASDB_URL, { dbName: databaseName, serverSelectionTimeoutMS: 10000, autoIndex: false });
    assertPreviewDatabase(mongoose.connection.name);
    const listings = await Listing.find({
        isCatalog: { $ne: true },
        $or: [
            { geometry: { $exists: false } },
            { geometry: null },
            { "geometry.coordinates": { $exists: false } },
            { "geometry.coordinates": { $size: 0 } },
        ],
    });
    console.log(`Preview target: ${databaseName}. Found ${listings.length} non-catalog listings without coordinates.`);
    if (!flags.includes("--apply")) {
        console.log("Dry run: no geocoding calls or document writes. Add --apply to update these preview listings.");
        return;
    }
    for (const listing of listings) {
        try {
            const geometry = await geocodeLocation(listing.location, listing.country);
            if (geometry) {
                listing.geometry = geometry;
                listing.coordinatesApproximate = true;
                await listing.save();
                console.log(`Updated ${listing._id}. Coordinates remain approximate.`);
            }
        } catch (error) {
            console.error(`Skipped ${listing._id}: ${error.message}`);
        }
        await delay(1100);
    }
}

if (require.main === module) main().catch(error => {
    console.error(error.name === "MongoServerSelectionError" ? "Preview database connection failed. Check preview credentials and network access." : error.message);
    process.exitCode = 1;
}).finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

module.exports = { geocodeLocation };
