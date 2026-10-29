const crypto = require("node:crypto");
const { StartupConfigurationError } = require("./startupError");

function getConfig(env = process.env) {
    const previewMode = env.PREVIEW_MODE === "true";
    const dbName = env.DB_NAME || undefined;
    const uriDb = (env.ATLASDB_URL || "").match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
    let decodedUriDb;
    try {
        decodedUriDb = uriDb ? decodeURIComponent(uriDb) : undefined;
    } catch {
        throw new StartupConfigurationError("INVALID_DATABASE_URL");
    }
    if (previewMode && (!dbName?.startsWith("wanderlust_preview_") || (decodedUriDb && decodedUriDb !== dbName))) {
        throw new StartupConfigurationError("INVALID_PREVIEW_DATABASE");
    }
    if (env.NODE_ENV === "production" && (!env.SECRET || env.SECRET.length < 32)) {
        throw new StartupConfigurationError("INVALID_SESSION_SECRET");
    }
    const port = Number(env.PORT || (previewMode ? 8081 : 8080));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new StartupConfigurationError("INVALID_PORT");
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
