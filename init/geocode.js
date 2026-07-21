const mongoose = require('mongoose');
const Listing = require('../models/listing');

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
.then(() => {
    console.log("Connected to DB");
})
.catch(err => console.log(err));

async function main() {
    await mongoose.connect(MONGO_URL);
}

// Nominatim requires 1 request/second max
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeLocation(location, country) {
    try {
        const query = encodeURIComponent(`${location}, ${country}`);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
            {
                headers: {
                    'User-Agent': 'WanderLust-BnBClone/1.0',
                },
            }
        );
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                type: 'Point',
                coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)],
            };
        }
        return null;
    } catch (err) {
        console.log("Geocoding error:", err.message);
        return null;
    }
}

const geocodeAll = async () => {
    // Find all listings that don't have geometry or have empty coordinates
    const listings = await Listing.find({
        $or: [
            { geometry: { $exists: false } },
            { geometry: null },
            { 'geometry.coordinates': { $exists: false } },
            { 'geometry.coordinates': { $size: 0 } },
        ]
    });

    console.log(`Found ${listings.length} listings without coordinates.\n`);

    let success = 0;
    let failed = 0;

    for (let listing of listings) {
        const locationStr = `${listing.location}, ${listing.country}`;
        process.stdout.write(`Geocoding: "${locationStr}" ... `);

        const geometry = await geocodeLocation(listing.location, listing.country);

        if (geometry) {
            listing.geometry = geometry;
            await listing.save();
            console.log(`✓ [${geometry.coordinates[1]}, ${geometry.coordinates[0]}]`);
            success++;
        } else {
            console.log(`✗ Not found`);
            failed++;
        }

        // Respect Nominatim's 1 req/sec rate limit
        await delay(1100);
    }

    console.log(`\n--- Done ---`);
    console.log(`Successfully geocoded: ${success}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${listings.length}`);

    mongoose.connection.close();
};

geocodeAll();
