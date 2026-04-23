const SupporterUser = require("../models/SupporterUser");
const { isEthereumAddress } = require("./blockchain");

function isLegacyPivotSupporter(supporter) {
  return /^pivot supporter/i.test(String(supporter.fullName || "").trim());
}

async function cleanupLegacySupporters() {
  const supporters = await SupporterUser.find({})
    .sort({ createdAt: -1 })
    .lean();

  const seenWallets = new Set();
  const removableIds = [];

  supporters.forEach((supporter) => {
    const walletAddress = String(supporter.walletAddress || "").trim();
    const normalizedWallet = walletAddress.toLowerCase();
    const invalidWallet = !isEthereumAddress(walletAddress);
    const pivotRecord = isLegacyPivotSupporter(supporter);
    const duplicateWallet = !invalidWallet && seenWallets.has(normalizedWallet);

    if (invalidWallet || pivotRecord || duplicateWallet) {
      removableIds.push(supporter._id);
      return;
    }

    seenWallets.add(normalizedWallet);
  });

  if (!removableIds.length) {
    return {
      removed: 0
    };
  }

  await SupporterUser.deleteMany({ _id: { $in: removableIds } });

  return {
    removed: removableIds.length
  };
}

module.exports = {
  cleanupLegacySupporters
};
