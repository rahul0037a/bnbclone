const express = require("express");
const passport = require("passport");
const rateLimit = require("express-rate-limit");
const wrapAsync = require("../utils/wrapAsync");
const { saveRedirectUrl, validateSignup } = require("../middleware");
const users = require("../controllers/users");
const router = express.Router();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10,
    message: "Too many attempts. Please try again in 15 minutes.",
    standardHeaders: "draft-8", legacyHeaders: false,
});
router.get("/signup", users.renderSignupForm);
router.post("/signup", authLimiter, validateSignup, wrapAsync(users.signup));
router.get("/login", users.renderLoginForm);
router.post("/login", authLimiter, saveRedirectUrl, passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }), users.login);
router.post("/logout", users.logout);
module.exports = router;
