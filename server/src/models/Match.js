const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    matchId: { type: Number, required: true, unique: true, index: true },
    homeTeam: { type: String, required: true, trim: true },
    awayTeam: { type: String, required: true, trim: true },
    stadium: { type: String, required: true, trim: true },
    ticketPriceCredits: { type: Number, required: true, min: 0, default: 30 },
    matchDate: { type: Date, required: true },
    matchEndTime: { type: Date, required: true },
    latestCheckInTime: { type: Date, required: true },
    transferCutoff: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Match", matchSchema);
