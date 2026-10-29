const mongoose = require("mongoose");
const ExpressError = require("./ExpressError");

function sameId(left, right) {
    if (!left || !right) return false;
    return String(left._id || left) === String(right._id || right);
}

function assertObjectId(value, label = "Resource") {
    if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) {
        throw new ExpressError(404, `${label} not found.`);
    }
    return value;
}

module.exports = { sameId, assertObjectId };
