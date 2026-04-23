const mongoose = require("mongoose");

const checkInRequestSchema = new mongoose.Schema(
  {
    ticketId: { type: Number, required: true, index: true },
    matchId: { type: Number, required: true, index: true },
    fixtureLabel: { type: String, default: "", trim: true },
    ownerAddress: { type: String, required: true, trim: true },
    supporterId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    supporterName: { type: String, required: true, trim: true },
    supporterEmail: { type: String, default: "", trim: true, lowercase: true },
    status: { type: String, required: true, trim: true, default: "PENDING", index: true },
    requestNote: { type: String, default: "", trim: true },
    resultNote: { type: String, default: "", trim: true },
    reviewedByAdminId: { type: String, default: "", trim: true },
    reviewedByName: { type: String, default: "", trim: true },
    reviewedByEmail: { type: String, default: "", trim: true, lowercase: true },
    reviewedAt: { type: Date, default: null },
    txHash: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CheckInRequest", checkInRequestSchema);
