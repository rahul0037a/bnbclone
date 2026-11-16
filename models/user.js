const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;
const userSchema = new mongoose.Schema({
    email: {
        type: String, required: true, unique: true, lowercase: true, trim: true,
        maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
}, { timestamps: true });
userSchema.plugin(passportLocalMongoose, { usernameUnique: true });

userSchema.statics.verifyLogin = function(username, password, done) {
    const authenticate = this.authenticate();
    const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : username;
    return authenticate(username, password).then(result => {
        // Give existing legacy usernames priority when their spelling matches exactly.
        if (normalizedUsername !== username && result.error instanceof passportLocalMongoose.errors.IncorrectUsernameError) {
            return authenticate(normalizedUsername, password);
        }
        return result;
    }).then(({ user, error }) => done(null, user, error), done);
};

module.exports = mongoose.model("User", userSchema);
