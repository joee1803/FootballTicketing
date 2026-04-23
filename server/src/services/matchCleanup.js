const Match = require("../models/Match");
const Ticket = require("../models/Ticket");
const { getTicketingContract } = require("./blockchain");

function buildTransferCutoff(matchDate) {
  return new Date(new Date(matchDate).getTime() - 30 * 60 * 1000);
}

function isMissingMatchError(error) {
  return String(error?.message || "").includes("The requested match does not exist on-chain.");
}

async function readOnChainMatch(matchId) {
  const contract = getTicketingContract();

  try {
    const chainMatch = await contract.getMatch(matchId);
    return {
      exists: true,
      matchId: Number(chainMatch.matchId),
      homeTeam: chainMatch.homeTeam,
      awayTeam: chainMatch.awayTeam,
      stadium: chainMatch.stadium
    };
  } catch (error) {
    if (isMissingMatchError(error)) {
      return { exists: false };
    }

    throw error;
  }
}

async function ensureStoredMatchOnChain(match) {
  const contract = getTicketingContract();
  const matchDate = new Date(match.matchDate);

  try {
    await contract.getMatch(match.matchId);
    return { action: "exists" };
  } catch (error) {
    if (!isMissingMatchError(error)) {
      throw error;
    }

    if (matchDate.getTime() <= Date.now()) {
      await Ticket.deleteMany({ matchId: match.matchId });
      await Match.deleteOne({ _id: match._id });
      return { action: "removed-past" };
    }

    const transferCutoff = match.transferCutoff ? new Date(match.transferCutoff) : buildTransferCutoff(matchDate);
    const tx = await contract.createMatch(
      Number(match.matchId),
      match.homeTeam,
      match.awayTeam,
      match.stadium,
      Math.floor(matchDate.getTime() / 1000),
      Math.floor(transferCutoff.getTime() / 1000)
    );
    await tx.wait();

    return { action: "recreated" };
  }
}

async function cleanupStaleMatches() {
  const matches = await Match.find({}).sort({ matchDate: 1 });
  let recreated = 0;
  let removed = 0;

  for (const match of matches) {
    const result = await ensureStoredMatchOnChain(match);
    if (result.action === "recreated") {
      recreated += 1;
    }
    if (result.action === "removed-past") {
      removed += 1;
    }
  }

  return { recreated, removed };
}

async function syncMatchFromChain(matchId) {
  const match = await Match.findOne({ matchId: Number(matchId) });
  if (!match) {
    return null;
  }

  const result = await ensureStoredMatchOnChain(match);
  if (result.action === "removed-past") {
    return null;
  }

  return Match.findOne({ matchId: Number(matchId) });
}

module.exports = {
  cleanupStaleMatches,
  readOnChainMatch,
  syncMatchFromChain
};
