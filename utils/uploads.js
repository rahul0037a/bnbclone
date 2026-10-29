const { cloudinary } = require("../cloudConfig");

async function destroyImage(filename) {
    // Only app-managed Cloudinary assets may be destroyed; catalog image identifiers are external.
    if (!filename || !filename.startsWith("wanderlust_") || !process.env.CLOUD_API_KEY) return;
    try { await cloudinary.uploader.destroy(filename); }
    catch (error) { console.error("Image cleanup failed:", error.message); }
}
async function cleanupUpload(file) { if (file) await destroyImage(file.filename); }
module.exports = { cleanupUpload, destroyImage };
