if (process.env.NODE_ENV !== "production") require("dotenv").config({ quiet: true });

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const path = require("node:path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const Listing = require("./models/listing");
const User = require("./models/user");
const categories = require("./utils/categories");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");
const { getConfig } = require("./utils/config");
const { StartupConfigurationError, describeStartupError } = require("./utils/startupError");
const { csrfProtection } = require("./utils/security");

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

function createApp({ sessionStore, config = getConfig(), rateLimits = true } = {}) {
    if (!sessionStore) throw new Error("An explicit session store is required.");
    const app = express();
    app.disable("x-powered-by");
    if (config.trustProxy) app.set("trust proxy", 1);
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));
    app.engine("ejs", ejsMate);
    Object.assign(app.locals, { currUser: null, searchQuery: "", success: [], error: [], csrfToken: "", previewMode: config.previewMode });
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
                imgSrc: ["'self'", "https:", "data:"],
                connectSrc: ["'self'", "https://nominatim.openstreetmap.org"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: config.production ? [] : null,
            },
        },
        crossOriginEmbedderPolicy: false,
        strictTransportSecurity: config.production,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }));
    app.use(express.static(path.join(__dirname, "public"), { maxAge: config.production ? "1h" : 0 }));
    if (rateLimits) app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: "draft-8", legacyHeaders: false }));
    app.use((req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
    app.use(express.urlencoded({ extended: true, limit: "100kb" }));
    app.use(methodOverride("_method"));
    app.use(session({
        name: config.previewMode ? "wanderlust.preview.sid" : "wanderlust.sid",
        store: sessionStore,
        secret: config.secret,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: config.production, sameSite: "lax" },
    }));
    app.use(flash());
    app.use(passport.initialize());
    app.use(passport.session());
    app.use((req, res, next) => {
        res.locals.success = req.flash("success");
        res.locals.error = req.flash("error");
        res.locals.currUser = req.user || null;
        res.locals.searchQuery = typeof req.query.search === "string" ? req.query.search : "";
        res.locals.previewMode = config.previewMode;
        next();
    });
    app.use(csrfProtection);
    app.get("/health", (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? "ok" : "starting" }));
    app.use("/listings", require("./routes/listing"));
    app.use("/listings/:id/reviews", require("./routes/review"));
    app.use("/bookings", require("./routes/bookings"));
    app.use("/", require("./routes/user"));
    app.get("/", wrapAsync(async (req, res) => {
        const [featuredListings, listingCount, countries] = await Promise.all([
            Listing.find({ isActive: { $ne: false } }).sort({ isCatalog: -1, _id: 1 }).limit(6).lean(),
            Listing.countDocuments({ isActive: { $ne: false } }),
            Listing.distinct("country", { isActive: { $ne: false } }),
        ]);
        res.render("listings/landing", { featuredListings, categories, listingCount, countryCount: countries.length });
    }));
    app.get("/privacy", (req, res) => res.render("privacy"));
    app.get("/terms", (req, res) => res.render("terms"));
    app.use((req, res, next) => next(new ExpressError(404, "We couldn't find that page.")));
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        let status = Number(err.statusCode || err.status || 500);
        let message = err.message;
        if (err.name === "CastError") { status = 400; message = "That identifier is invalid."; }
        if (err.name === "ValidationError") { status = 400; message = "Please check the submitted details."; }
        if (err.code === 11000) { status = 409; message = "An account with those details already exists."; }
        if (err.code === "LIMIT_FILE_SIZE") { status = 400; message = "Choose an image smaller than 5 MB."; }
        if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;
        if (status >= 500) { console.error("Request failed:", err.name); message = "Something went wrong. Please try again."; }
        res.status(status).render("error", { message, statusCode: status });
    });
    return app;
}

async function start() {
    const config = getConfig();
    if (!config.dbUrl) throw new StartupConfigurationError("MISSING_DATABASE_URL");
    await mongoose.connect(config.dbUrl, { dbName: config.dbName, serverSelectionTimeoutMS: 15000 });
    const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: config.dbName, crypto: { secret: config.secret }, touchAfter: 24 * 60 * 60 });
    store.on("error", err => console.error("Session store error:", err.name));
    const app = createApp({ sessionStore: store, config });
    const server = app.listen(config.port, config.host, () => console.log(`WanderLust ready at http://localhost:${config.port}${config.previewMode ? " (isolated preview)" : ""}`));
    const shutdown = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return { app, server };
}
if (require.main === module) start().catch(async err => {
    console.error("Startup failed:", describeStartupError(err));
    await mongoose.disconnect();
    process.exitCode = 1;
});
module.exports = { createApp, start };
