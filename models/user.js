const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;
const userSchema = new mongoose.Schema({
    email: {
        type: String, required: true, unique: true, lowercase: true, trim: true,
        maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
}, { timestamps: true });
// Keep existing case-sensitive usernames usable; signup normalizes new names.
userSchema.plugin(passportLocalMongoose, { usernameUnique: true });
module.exports = mongoose.model("User", userSchema);
