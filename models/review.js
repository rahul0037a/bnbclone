const mongoose = require("mongoose");
const { Schema } = mongoose;
const reviewSchema = new Schema({
    comment: { type: String, required: true, trim: true, maxlength: 3000 },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    createdAt: { type: Date, default: Date.now, immutable: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
});
reviewSchema.index({ author: 1 });
module.exports = mongoose.model("Review", reviewSchema);
