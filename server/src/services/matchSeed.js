const Match = require("../models/Match");
const defaultFixtures = require("../data/defaultFixtures");
const featuredClubFixtures = require("../data/featuredClubFixtures");
const { getTicketingContract } = require("./blockchain");

const seededFixtures = [...defaultFixtures, ...featuredClubFixtures];

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

  for (const fixture of seededFixtures) {
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
