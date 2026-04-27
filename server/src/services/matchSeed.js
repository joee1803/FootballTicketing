const Match = require("../models/Match");
const Ticket = require("../models/Ticket");
const defaultFixtures = require("../data/defaultFixtures");
const featuredClubFixtures = require("../data/featuredClubFixtures");
const { getTicketingContract } = require("./blockchain");

const seededFixtures = [...defaultFixtures, ...featuredClubFixtures];
const PREVIOUS_SEED_YEAR_OFFSET = 1000000;

function buildTransferCutoff(matchDate) {
  return new Date(new Date(matchDate).getTime() - 30 * 60 * 1000);
}

function buildMatchEndTime(matchDate) {
  return new Date(new Date(matchDate).getTime() + 90 * 60 * 1000);
}

function buildTicketPriceCredits(fixture) {
  if (Number.isFinite(Number(fixture.ticketPriceCredits))) {
    return Number(fixture.ticketPriceCredits);
  }

  const kickoffHour = new Date(fixture.matchDate).getHours();
  if (kickoffHour >= 19) {
    return 60;
  }
  if (kickoffHour >= 16) {
    return 45;
  }

  return 35;
}

async function ensureMatchOnChain(contract, fixture) {
  const matchDate = new Date(fixture.matchDate);
  if (matchDate.getTime() <= Date.now()) {
    return "skipped-past";
  }

  try {
    await contract.getMatch(fixture.matchId);
    return "exists";
  } catch {
    const transferCutoff = buildTransferCutoff(fixture.matchDate);
    const tx = await contract.createMatch(
      fixture.matchId,
      fixture.homeTeam,
      fixture.awayTeam,
      fixture.stadium,
      Math.floor(new Date(fixture.matchDate).getTime() / 1000),
      Math.floor(transferCutoff.getTime() / 1000)
    );
    await tx.wait();
    return "created";
  }
}

async function seedDefaultMatches() {
  const contract = getTicketingContract();
  let created = 0;
  let skippedPast = 0;

  // The seed data is periodically moved forward for demos, so remove the previous date-based IDs.
  const previousSeedIds = seededFixtures
    .map((fixture) => Number(fixture.matchId) - PREVIOUS_SEED_YEAR_OFFSET)
    .filter((matchId) => Number.isFinite(matchId) && matchId > 0);
  if (previousSeedIds.length) {
    await Ticket.deleteMany({ matchId: { $in: previousSeedIds } });
    await Match.deleteMany({ matchId: { $in: previousSeedIds } });
  }

  for (const fixture of seededFixtures) {
    const matchDate = new Date(fixture.matchDate);
    if (matchDate.getTime() <= Date.now()) {
      await Ticket.deleteMany({ matchId: fixture.matchId });
      await Match.deleteOne({ matchId: fixture.matchId });
      skippedPast += 1;
      continue;
    }

    const transferCutoff = buildTransferCutoff(fixture.matchDate);
    const matchEndTime = buildMatchEndTime(fixture.matchDate);
    const ticketPriceCredits = buildTicketPriceCredits(fixture);

    await Match.updateOne(
      { matchId: fixture.matchId },
      {
        $set: {
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          stadium: fixture.stadium,
          ticketPriceCredits,
          matchDate: new Date(fixture.matchDate),
          matchEndTime,
          latestCheckInTime: transferCutoff,
          transferCutoff
        }
      },
      { upsert: true }
    );

    const deployed = await ensureMatchOnChain(contract, fixture);
    if (deployed === "created") {
      created += 1;
    }
    if (deployed === "skipped-past") {
      skippedPast += 1;
    }
  }

  return {
    total: seededFixtures.length,
    created,
    skippedPast
  };
}

module.exports = {
  seedDefaultMatches
};
