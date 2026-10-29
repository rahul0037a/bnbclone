const crypto = require("node:crypto");
const ExpressError = require("./ExpressError");

function csrfProtection(req, res, next) {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    res.locals.csrfToken = req.session.csrfToken;
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const supplied = req.body?._csrf || req.query._csrf || req.get("x-csrf-token");
    const expected = req.session.csrfToken;
    if (typeof supplied !== "string" || !/^[a-f0-9]{64}$/.test(supplied) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        return next(new ExpressError(403, "This form has expired. Refresh the page and try again."));
    }
    if (req.body) delete req.body._csrf;
    return next();
}
module.exports = { csrfProtection };
