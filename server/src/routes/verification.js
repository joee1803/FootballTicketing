const express = require("express");

const Ticket = require("../models/Ticket");
const ScanLog = require("../models/ScanLog");
const { getTicketingContract, isEthereumAddress, mapStatus } = require("../services/blockchain");

const router = express.Router();

router.post("/check", async (req, res, next) => {
  try {
    const { ticketId, claimedOwner } = req.body;
    if (!isEthereumAddress(String(claimedOwner || "").trim())) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required for verification." });
    }
    const contract = getTicketingContract();

    const verification = await contract.verifyTicket(Number(ticketId), claimedOwner);
    const payload = {
      valid: verification[0],
      status: mapStatus(Number(verification[1])),
      currentOwner: verification[2],
      matchId: Number(verification[3])
    };

    await ScanLog.create({
      ticketId: Number(ticketId),
      scannedBy: "verification-only",
      ownerAddress: claimedOwner,
      result: payload.valid ? "Accepted" : "Rejected",
      details: payload.status
    });

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/check-in", async (req, res, next) => {
  try {
    const { ticketId, claimedOwner, scannedBy } = req.body;
    if (!isEthereumAddress(String(claimedOwner || "").trim())) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required for check-in." });
    }
    const contract = getTicketingContract();

    const verification = await contract.verifyTicket(Number(ticketId), claimedOwner);
    const isValid = verification[0];
    const status = mapStatus(Number(verification[1]));

    if (!isValid) {
      await ScanLog.create({
        ticketId: Number(ticketId),
        scannedBy,
        ownerAddress: claimedOwner,
        result: "Rejected",
        details: status
      });

      return res.status(400).json({
        valid: false,
        status
      });
    }

    const tx = await contract.markTicketAsUsed(Number(ticketId));
    await tx.wait();

    await Ticket.findOneAndUpdate(
      { ticketId: Number(ticketId) },
      { status: "Used" }
    );

    await ScanLog.create({
      ticketId: Number(ticketId),
      scannedBy,
      ownerAddress: claimedOwner,
      result: "Accepted",
      details: "Used"
    });

    res.json({
      valid: true,
      status: "Used",
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
