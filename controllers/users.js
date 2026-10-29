const User = require("../models/user");

module.exports.renderSignupForm = (req, res) => res.render("users/signup.ejs");
module.exports.renderLoginForm = (req, res) => res.render("users/login.ejs");

module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const user = await User.register(new User({ username, email }), password);
        req.login(user, error => {
            if (error) return next(error);
            req.flash("success", "Welcome to WanderLust. Your account is ready.");
            res.redirect("/listings");
        });
    } catch (error) {
        req.flash("error", error.code === 11000 ? "An account with that email already exists." : error.message);
        res.redirect("/signup");
    }
};
module.exports.login = (req, res) => {
    req.flash("success", "Welcome back.");
    res.redirect(res.locals.redirectUrl || "/listings");
};
module.exports.logout = (req, res, next) => {
    req.logout(error => {
        if (error) return next(error);
        req.flash("success", "You have been logged out.");
        res.redirect("/listings");
    });
};
