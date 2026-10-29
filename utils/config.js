const crypto = require("node:crypto");

function getConfig(env = process.env) {
    const previewMode = env.PREVIEW_MODE === "true";
    const dbName = env.DB_NAME || undefined;
    const uriDb = (env.ATLASDB_URL || "").match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
    if (previewMode && (!dbName?.startsWith("wanderlust_preview_") || (uriDb && decodeURIComponent(uriDb) !== dbName))) {
        throw new Error("Preview mode requires a separate wanderlust_preview_ database in DB_NAME and the connection URL.");
    }
    if (env.NODE_ENV === "production" && (!env.SECRET || env.SECRET.length < 32)) {
        throw new Error("Set SECRET to at least 32 characters in production.");
    }
    const port = Number(env.PORT || (previewMode ? 8081 : 8080));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
    return {
        dbUrl: env.ATLASDB_URL,
        dbName,
        previewMode,
        port,
        host: env.HOST || (previewMode ? "127.0.0.1" : "0.0.0.0"),
        production: env.NODE_ENV === "production",
        trustProxy: env.TRUST_PROXY === "1",
        secret: env.SECRET || crypto.randomBytes(32).toString("hex"),
    };
}
module.exports = { getConfig };
