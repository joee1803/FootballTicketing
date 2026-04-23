const express = require("express");

const { getBlockchainStatus, getWalletFundingStatus, fundWallet, isEthereumAddress } = require("../services/blockchain");
const SupporterUser = require("../models/SupporterUser");
const { recordSupporterActivity } = require("../services/adminActivity");

const router = express.Router();

function exactWalletAddress(value) {
  return new RegExp(`^${String(value || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

router.get("/status", async (_req, res, next) => {
  try {
    const status = await getBlockchainStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.get("/wallet/:address", async (req, res, next) => {
  try {
    const address = String(req.params.address || "").trim();
    if (!isEthereumAddress(address)) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }

    const status = await getWalletFundingStatus(address);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.post("/fund-wallet", async (req, res, next) => {
  try {
    const address = String(req.body.address || "").trim();
    if (!isEthereumAddress(address)) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }

    // Funding updates both the local wallet gas and the supporter balance used for ticket purchases.
    const funded = await fundWallet(address, "2.0");
    const supporter = await SupporterUser.findOneAndUpdate(
      { walletAddress: exactWalletAddress(address), isDeleted: false },
      { $inc: { creditBalance: 100 } },
      { new: true }
    );

    if (supporter) {
      await recordSupporterActivity(supporter, {
        actionType: "FUNDS_ADDED",
        summary: `Added funds to ${supporter.fullName}.`,
        targetType: "WALLET",
        targetId: supporter.walletAddress,
        targetLabel: supporter.walletAddress,
        metadata: {
          fundedAmountEth: funded.fundedAmountEth,
          balanceAddedPounds: 100,
          creditBalance: Number(supporter.creditBalance || 0)
        }
      });
    }

    res.json({
      ...funded,
      balanceAddedPounds: supporter ? 100 : 0,
      clubCreditsAdded: supporter ? 100 : 0,
      supporter: supporter
        ? {
            id: supporter._id,
            firstName: supporter.firstName,
            lastName: supporter.lastName,
            fullName: supporter.fullName,
            email: supporter.email,
            favouriteClub: supporter.favouriteClub,
            walletAddress: supporter.walletAddress,
            creditBalance: supporter.creditBalance || 0,
            createdAt: supporter.createdAt
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
