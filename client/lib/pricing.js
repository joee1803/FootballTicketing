export const FEATURED_CLUBS = [
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

export const FAVOURITE_CLUB_DISCOUNT_RATE = 0.2;

export function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function formatPounds(value) {
  const amount = roundCurrency(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function normalizeClubName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return CLUB_ALIASES.get(normalized) || FEATURED_CLUBS.find((club) => club.toLowerCase() === normalized) || String(value || "").trim();
}

export function getFixturePricing(match, favouriteClub) {
  const basePrice = roundCurrency(match?.ticketPriceCredits || 0);
  const normalizedFavouriteClub = normalizeClubName(favouriteClub);
  const homeTeam = normalizeClubName(match?.homeTeam);
  const awayTeam = normalizeClubName(match?.awayTeam);
  const discountApplied =
    Boolean(normalizedFavouriteClub) &&
    (normalizedFavouriteClub === homeTeam || normalizedFavouriteClub === awayTeam);
  const discountAmount = discountApplied ? roundCurrency(basePrice * FAVOURITE_CLUB_DISCOUNT_RATE) : 0;
  const finalPrice = roundCurrency(Math.max(basePrice - discountAmount, 0));

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountApplied
  };
}
