const express = require("express");

const { requireAdmin } = require("../middleware/auth");
const Match = require("../models/Match");
const { recordAdminActivity } = require("../services/adminActivity");
const { getTicketingContract } = require("../services/blockchain");
const { generateNextMatchId } = require("../services/matchIds");
const { syncMatchFromChain } = require("../services/matchCleanup");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    // Listing fixtures should stay fast for every page load; startup and write actions keep chain state aligned.
    const matches = await Match.find().sort({ matchDate: 1 });
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

router.get("/next-id", requireAdmin, async (req, res, next) => {
  try {
    const matchDate = req.query.matchDate;
    if (!matchDate) {
      return res.status(400).json({ error: "Match date is required to generate the next match ID." });
    }

    const existingMatches = await Match.find({}, { matchId: 1 });
    res.json({
      matchId: generateNextMatchId(matchDate, existingMatches.map((match) => match.matchId))
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { matchId, homeTeam, awayTeam, stadium, matchDate, ticketPriceCredits } = req.body;
    const contract = getTicketingContract();
    const matchStart = new Date(matchDate);
    const matchEndTime = new Date(matchStart.getTime() + 90 * 60 * 1000);
    const latestCheckInTime = new Date(matchStart.getTime() - 30 * 60 * 1000);
    const priceCredits = Number(ticketPriceCredits);
    const existingMatches = await Match.find({}, { matchId: 1 });
    const derivedMatchId = matchId
      ? Number(matchId)
      : generateNextMatchId(matchDate, existingMatches.map((entry) => entry.matchId));

    if (!Number.isFinite(priceCredits) || priceCredits < 0) {
      return res.status(400).json({ error: "Enter a valid pound price for the match." });
    }
    if (!Number.isFinite(derivedMatchId) || derivedMatchId <= 0) {
      return res.status(400).json({ error: "The match ID could not be generated for that kick-off date." });
    }

    const matchTimestamp = Math.floor(matchStart.getTime() / 1000);
    const cutoffTimestamp = Math.floor(latestCheckInTime.getTime() / 1000);

    const tx = await contract.createMatch(
      derivedMatchId,
      homeTeam,
      awayTeam,
      stadium,
      matchTimestamp,
      cutoffTimestamp
    );
    await tx.wait();

    const match = await Match.create({
      matchId: derivedMatchId,
      homeTeam,
      awayTeam,
      stadium,
      ticketPriceCredits: priceCredits,
      matchDate: matchStart,
      matchEndTime,
      latestCheckInTime,
      transferCutoff: latestCheckInTime
    });

    await recordAdminActivity(req.admin, {
      actionType: "MATCH_CREATED",
      summary: `Created fixture ${homeTeam} vs ${awayTeam}.`,
      targetType: "MATCH",
      targetId: String(derivedMatchId),
      targetLabel: `${homeTeam} vs ${awayTeam}`,
      metadata: {
        txHash: tx.hash,
        stadium,
        ticketPriceCredits: priceCredits
      }
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
