const FEATURED_CLUBS = [
  "Arsenal",
  "Aston Villa",
  "Atletico Madrid",
  "Barcelona",
  "Bayern Munich",
  "Borussia Dortmund",
  "Chelsea",
  "Everton",
  "Inter Milan",
  "Juventus",
  "Leeds United",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Paris Saint-Germain",
  "Real Madrid",
  "Tottenham Hotspur",
  "AC Milan",
  "Ajax"
];

const CLUB_ALIASES = new Map([
  ["ac milan", "AC Milan"],
  ["ajax", "Ajax"],
  ["arsenal", "Arsenal"],
  ["aston villa", "Aston Villa"],
  ["atletico madrid", "Atletico Madrid"],
  ["barcelona", "Barcelona"],
  ["bayern munich", "Bayern Munich"],
  ["borussia dortmund", "Borussia Dortmund"],
  ["chelsea", "Chelsea"],
  ["everton", "Everton"],
  ["inter milan", "Inter Milan"],
  ["juventus", "Juventus"],
  ["leeds", "Leeds United"],
  ["leeds united", "Leeds United"],
  ["liverpool", "Liverpool"],
  ["man city", "Manchester City"],
  ["manchester city", "Manchester City"],
  ["man united", "Manchester United"],
  ["manchester united", "Manchester United"],
  ["newcastle", "Newcastle United"],
  ["newcastle united", "Newcastle United"],
  ["paris saint-germain", "Paris Saint-Germain"],
  ["psg", "Paris Saint-Germain"],
  ["real madrid", "Real Madrid"],
  ["tottenham", "Tottenham Hotspur"],
  ["tottenham hotspur", "Tottenham Hotspur"]
]);

function normalizeClubName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return CLUB_ALIASES.get(normalized) || FEATURED_CLUBS.find((club) => club.toLowerCase() === normalized) || String(value || "").trim();
}

function isSupportedFavouriteClub(value) {
  if (!String(value || "").trim()) {
    return true;
  }

  return FEATURED_CLUBS.includes(normalizeClubName(value));
}

module.exports = {
  FEATURED_CLUBS,
  normalizeClubName,
  isSupportedFavouriteClub
};
