const mongoose = require("mongoose");

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN"],
      required: true,
      default: "ADMIN"
    },
    isPrimarySuperAdmin: { type: Boolean, default: false },
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

module.exports = mongoose.model("AdminUser", adminUserSchema);
