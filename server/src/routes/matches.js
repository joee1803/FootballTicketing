const express = require("express");

const { requireAdmin } = require("../middleware/auth");
const Match = require("../models/Match");
const { getTicketingContract } = require("../services/blockchain");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const matches = await Match.find().sort({ matchDate: 1 });
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { matchId, homeTeam, awayTeam, stadium, matchDate } = req.body;
    const contract = getTicketingContract();
    const matchStart = new Date(matchDate);
    const matchEndTime = new Date(matchStart.getTime() + 90 * 60 * 1000);
    const latestCheckInTime = new Date(matchStart.getTime() - 30 * 60 * 1000);

    const matchTimestamp = Math.floor(matchStart.getTime() / 1000);
    const cutoffTimestamp = Math.floor(latestCheckInTime.getTime() / 1000);

    const tx = await contract.createMatch(
      Number(matchId),
      homeTeam,
      awayTeam,
      stadium,
      matchTimestamp,
      cutoffTimestamp
    );
    await tx.wait();

    const match = await Match.create({
      matchId: Number(matchId),
      homeTeam,
      awayTeam,
      stadium,
      matchDate: matchStart,
      matchEndTime,
      latestCheckInTime,
      transferCutoff: latestCheckInTime
    });

    res.status(201).json({
      ...match.toObject(),
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
