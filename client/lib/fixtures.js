export function formatFixtureLabel(match) {
  if (!match) {
    return "Fixture not available";
  }

  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function padSequence(value) {
  return String(value).padStart(2, "0");
}

function formatMatchDatePrefix(matchDate) {
  const date = new Date(matchDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function generateNextMatchIdPreview(matchDate, matches = []) {
  if (!matchDate) {
    return "";
  }

  const prefix = formatMatchDatePrefix(matchDate);
  const highestSequence = matches.reduce((currentHighest, match) => {
    const raw = String(match?.matchId || "");
    if (!raw.startsWith(prefix)) {
      return currentHighest;
    }

    const suffix = Number(raw.slice(prefix.length));
    return Number.isFinite(suffix) ? Math.max(currentHighest, suffix) : currentHighest;
  }, 0);

  return `${prefix}${padSequence(highestSequence + 1)}`;
}
