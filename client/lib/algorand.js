const ALGORAND_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ADDRESS_LENGTH = 58;

function randomAlgorandAddress() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(ADDRESS_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => ALGORAND_ALPHABET[value % ALGORAND_ALPHABET.length]).join("");
  }

  return Array.from(
    { length: ADDRESS_LENGTH },
    () => ALGORAND_ALPHABET[Math.floor(Math.random() * ALGORAND_ALPHABET.length)]
  ).join("");
}

export function createGeneratedAlgorandWallet() {
  return randomAlgorandAddress();
}
