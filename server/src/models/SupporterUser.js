const mongoose = require("mongoose");

const supporterUserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    favouriteClub: { type: String, default: "", trim: true },
    walletAddress: { type: String, required: true, trim: true },
    creditBalance: { type: Number, default: 0, min: 0 },
    passwordHash: { type: String, required: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedByAdminId: { type: String, default: null, trim: true },
    deletedByName: { type: String, default: null, trim: true },
    deletedByEmail: { type: String, default: null, trim: true, lowercase: true },
    deletionReason: { type: String, default: "", trim: true },
    restoredAt: { type: Date, default: null },
    restoredByAdminId: { type: String, default: null, trim: true },
    restoredByName: { type: String, default: null, trim: true },
    restoredByEmail: { type: String, default: null, trim: true, lowercase: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupporterUser", supporterUserSchema);
