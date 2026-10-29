const configurationMessages = Object.freeze({
    INVALID_PREVIEW_DATABASE: "Preview mode requires a separate wanderlust_preview_ database in DB_NAME and the connection URL. For the existing production database, set PREVIEW_MODE=false.",
    INVALID_DATABASE_URL: "ATLASDB_URL is not a valid MongoDB connection URL. Check its format and percent-encode special characters in the username and password.",
    MISSING_DATABASE_URL: "Set ATLASDB_URL in the hosting service's environment variables before starting the app. Production does not load the local .env file.",
    INVALID_SESSION_SECRET: "Set SECRET to a persistent random value of at least 32 characters in the hosting service's environment variables, then redeploy.",
    INVALID_PORT: "PORT must be a valid TCP port between 1 and 65535. Use the port supplied by the hosting service.",
});

class StartupConfigurationError extends Error {
    constructor(code) {
        super(configurationMessages[code] || "Invalid startup configuration.");
        this.name = "StartupConfigurationError";
        this.code = code;
    }
}

function describeStartupError(error) {
    // Log only known messages: driver errors may contain credentials or connection URLs.
    if (error instanceof StartupConfigurationError && Object.hasOwn(configurationMessages, error.code)) {
        return `[${error.code}] ${configurationMessages[error.code]}`;
    }
    if (error?.code === 18 || error?.codeName === "AuthenticationFailed") {
        return "[DATABASE_AUTHENTICATION] MongoDB rejected authentication. Check the database user, password, and authSource in ATLASDB_URL.";
    }
    if (["MongoParseError", "MongoInvalidArgumentError"].includes(error?.name)) {
        return `[INVALID_DATABASE_URL] ${configurationMessages.INVALID_DATABASE_URL}`;
    }
    if (["ENOTFOUND", "EAI_AGAIN"].includes(error?.code)) {
        return "[DATABASE_DNS] The database hostname could not be resolved. Check the cluster hostname in ATLASDB_URL and its DNS availability.";
    }
    if (["MongooseServerSelectionError", "MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError"].includes(error?.name)) {
        return "[DATABASE_CONNECTION] Could not connect to MongoDB. Check cluster availability, the connection URL, and Atlas Network Access for the hosting service's outbound IP addresses.";
    }
    return "[STARTUP_ERROR] Application initialization failed. Check deployment dependencies and environment configuration. Raw error details are omitted to protect credentials.";
}

module.exports = { StartupConfigurationError, describeStartupError };
