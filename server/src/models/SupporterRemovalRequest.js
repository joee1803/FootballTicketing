const mongoose = require("mongoose");

const supporterRemovalRequestSchema = new mongoose.Schema(
  {
    supporterId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    supporterName: { type: String, required: true, trim: true },
    supporterEmail: { type: String, required: true, trim: true, lowercase: true },
    requestedByAdminId: { type: String, required: true, trim: true },
    requestedByName: { type: String, required: true, trim: true },
    requestedByEmail: { type: String, required: true, trim: true, lowercase: true },
    reason: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED"],
      default: "PENDING"
    },
    reviewedByAdminId: { type: String, default: null },
    reviewedByName: { type: String, default: null, trim: true },
    reviewedByEmail: { type: String, default: null, trim: true, lowercase: true },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupporterRemovalRequest", supporterRemovalRequestSchema);
