const PREVIEW_DATABASE = /^wanderlust_preview_[a-z0-9_]+$/;

function assertPreviewDatabase(databaseName) {
    if (!PREVIEW_DATABASE.test(databaseName || "")) {
        throw new Error("Catalog writes require an explicit DB_NAME starting with wanderlust_preview_ and a suffix. Other databases are never seed targets.");
    }
    return databaseName;
}

module.exports = { assertPreviewDatabase };
