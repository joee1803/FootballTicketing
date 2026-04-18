const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: Number, required: true, unique: true, index: true },
    matchId: { type: Number, required: true, index: true },
    seatNumber: { type: String, required: true, trim: true },
    ticketType: { type: String, required: true, trim: true },
    ownerAddress: { type: String, required: true, trim: true },
    qrCodeDataUrl: { type: String, required: true },
    transferCount: { type: Number, default: 0 },
    maxTransfers: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Valid", "Used", "Revoked"],
      default: "Valid"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
