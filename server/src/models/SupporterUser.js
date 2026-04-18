const mongoose = require("mongoose");

const supporterUserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    favouriteClub: { type: String, default: "", trim: true },
    walletAddress: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupporterUser", supporterUserSchema);
