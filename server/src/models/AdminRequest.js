const mongoose = require("mongoose");

const adminRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true },
    reason: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED"],
      default: "PENDING"
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminRequest", adminRequestSchema);
