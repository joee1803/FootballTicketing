const mongoose = require("mongoose");

const scanLogSchema = new mongoose.Schema(
  {
    ticketId: { type: Number, required: true, index: true },
    scannedBy: { type: String, required: true, trim: true },
    result: { type: String, required: true, trim: true },
    ownerAddress: { type: String, default: null, trim: true },
    details: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScanLog", scanLogSchema);
