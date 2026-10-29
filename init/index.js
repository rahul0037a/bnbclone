require("dotenv").config({ quiet: true });
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Listing = require("../models/listing");
const User = require("../models/user");
const { data } = require("./data");
const { validateCatalog } = require("./validateCatalog");
const { assertPreviewDatabase } = require("./previewSafety");

const CATALOG_HOST_USERNAME = "wanderlust-catalog";
const CATALOG_HOST_EMAIL = "catalog@wanderlust-preview.invalid";

async function main() {
    const allowedFlags = new Set(["--validate-only", "--apply"]);
    const flags = process.argv.slice(2);
    if (flags.some(flag => !allowedFlags.has(flag))) {
        throw new Error("Usage: node init/index.js [--validate-only | --apply]");
    }
    if (flags.includes("--validate-only") && flags.includes("--apply")) {
        throw new Error("Choose validation or application, not both.");
    }

    const summary = validateCatalog(data);
    console.log(`Catalog validated: ${summary.listings} properties, ${summary.destinations} destinations, ${summary.countries} countries.`);
    if (flags.includes("--validate-only")) return;

    const databaseName = assertPreviewDatabase(process.env.DB_NAME);
    if (!process.env.ATLASDB_URL) throw new Error("Set ATLASDB_URL in the preview .env file.");
    console.log(`Seed target: ${databaseName}. Only this catalog's entries may be upserted.`);
    if (!flags.includes("--apply")) {
        console.log("No connection or changes made. Add --apply to seed this preview database.");
        return;
    }

    await mongoose.connect(process.env.ATLASDB_URL, {
        dbName: databaseName,
        serverSelectionTimeoutMS: 10000,
    });
    assertPreviewDatabase(mongoose.connection.name);
    await Promise.all([User.init(), Listing.init()]);

    let host = await User.findOne({ username: CATALOG_HOST_USERNAME });
    if (host && host.email !== CATALOG_HOST_EMAIL) {
        throw new Error("Catalog account name is already in use; refusing to take over an existing user.");
    }
    if (!host) {
        // This curatorial account is not any real property's owner.
        // Its random, unprinted password prevents a publicly known demo login.
        host = await User.register(new User({
            username: CATALOG_HOST_USERNAME,
            email: CATALOG_HOST_EMAIL,
        }), crypto.randomBytes(48).toString("base64url"));
    }

    for (const record of data) {
        const existing = await Listing.findOne({ catalogSlug: record.catalogSlug });
        if (existing && (!existing.isCatalog || !existing.owner?.equals(host._id))) {
            throw new Error(`Refusing to overwrite a listing outside this seed catalog: ${record.catalogSlug}`);
        }
        const document = new Listing({ ...record, owner: host._id });
        await document.validate();
    }

    let inserted = 0;
    let updated = 0;
    for (const record of data) {
        const result = await Listing.updateOne(
            { catalogSlug: record.catalogSlug, isCatalog: true, owner: host._id },
            { $set: { ...record, owner: host._id } },
            { upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        inserted += result.upsertedCount;
        updated += result.modifiedCount;
    }
    console.log(`Catalog ready: ${inserted} inserted, ${updated} updated. Existing reviews, bookings and non-catalog listings were preserved.`);
}

main().catch(error => {
    // Never print connection URIs or credentials from driver error objects.
    console.error(error.name === "MongoServerSelectionError" ? "Preview database connection failed. Check preview credentials and network access." : error.message);
    process.exitCode = 1;
}).finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
