const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const usersController = require("../controllers/users.js");
const rateLimit = require("express-rate-limit");

// Stricter rate limiter for authentication routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: "Too many attempts, please try again after 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
});

router.get("/signup",  usersController.renderSignupForm);

router.post("/signup", authLimiter, wrapAsync(usersController.signup));

router.get("/login", usersController.renderLoginForm);
router.post("/login", authLimiter, saveRedirectUrl, passport.authenticate("local", {failureRedirect:"/login", failureFlash:true}),
usersController.login);


router.get("/logout", usersController.logout);


module.exports = router;