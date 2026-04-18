const express = require("express");

const { getBlockchainStatus } = require("../services/blockchain");

const router = express.Router();

router.get("/status", async (_req, res, next) => {
  try {
    const status = await getBlockchainStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
