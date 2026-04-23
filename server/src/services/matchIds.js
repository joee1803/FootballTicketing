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

function generateNextMatchId(matchDate, existingMatchIds = []) {
  const prefix = formatMatchDatePrefix(matchDate);
  const highestSequence = existingMatchIds.reduce((currentHighest, value) => {
    const raw = String(value || "");
    if (!raw.startsWith(prefix)) {
      return currentHighest;
    }

    const suffix = Number(raw.slice(prefix.length));
    return Number.isFinite(suffix) ? Math.max(currentHighest, suffix) : currentHighest;
  }, 0);

  return Number(`${prefix}${padSequence(highestSequence + 1)}`);
}

module.exports = {
  formatMatchDatePrefix,
  generateNextMatchId
};
