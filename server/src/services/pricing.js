const { normalizeClubName } = require("../data/favouriteClubs");

const FAVOURITE_CLUB_DISCOUNT_RATE = 0.2;

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatPounds(value) {
  const amount = roundCurrency(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function getMatchTicketPricing(match, supporter) {
  const basePrice = roundCurrency(match?.ticketPriceCredits || 0);
  const favouriteClub = normalizeClubName(supporter?.favouriteClub);
  const homeTeam = normalizeClubName(match?.homeTeam);
  const awayTeam = normalizeClubName(match?.awayTeam);
  const favouriteClubEligible =
    Boolean(favouriteClub) && (favouriteClub === homeTeam || favouriteClub === awayTeam);
  const discountAmount = favouriteClubEligible
    ? roundCurrency(basePrice * FAVOURITE_CLUB_DISCOUNT_RATE)
    : 0;
  const finalPrice = roundCurrency(Math.max(basePrice - discountAmount, 0));

  return {
    basePrice,
    finalPrice,
    discountAmount,
    discountApplied: favouriteClubEligible && discountAmount > 0,
    favouriteClub
  };
}

module.exports = {
  FAVOURITE_CLUB_DISCOUNT_RATE,
  formatPounds,
  getMatchTicketPricing,
  roundCurrency
};
