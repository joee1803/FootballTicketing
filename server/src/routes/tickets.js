const express = require("express");

const { requireAdmin } = require("../middleware/auth");
const Ticket = require("../models/Ticket");
const Match = require("../models/Match");
const { getTicketingContract, isEthereumAddress, mapStatus } = require("../services/blockchain");
const { buildTicketQrCode } = require("../services/qrcode");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.ownerAddress) {
      filter.ownerAddress = new RegExp(`^${String(req.query.ownerAddress || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }
    if (req.query.matchId) {
      filter.matchId = Number(req.query.matchId);
    }

    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

router.get("/:ticketId", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const contract = getTicketingContract();
    const chainTicket = await contract.getTicket(ticketId);
    const ownerAddress = await contract.ownerOf(ticketId);

    res.json({
      ...ticket.toObject(),
      onChain: {
        ownerAddress,
        matchId: Number(chainTicket.matchId),
        transferCount: Number(chainTicket.transferCount),
        maxTransfers: Number(chainTicket.maxTransfers),
        status: mapStatus(Number(chainTicket.status)),
        issuedAt: Number(chainTicket.issuedAt),
        usedAt: Number(chainTicket.usedAt),
        revokedAt: Number(chainTicket.revokedAt)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { ticketId, matchId, seatNumber, ticketType, ownerAddress, maxTransfers } = req.body;
    if (!isEthereumAddress(String(ownerAddress || "").trim())) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }
    const match = await Match.findOne({ matchId: Number(matchId) });
    if (!match) {
      return res.status(404).json({ error: "Match metadata not found" });
    }

    const contract = getTicketingContract();
    const tx = await contract.mintTicket(
      ownerAddress,
      Number(ticketId),
      Number(matchId),
      Number(maxTransfers)
    );
    await tx.wait();

    const qrCodeDataUrl = await buildTicketQrCode({
      ticketId: Number(ticketId),
      matchId: Number(matchId),
      ownerAddress
    });

    const ticket = await Ticket.create({
      ticketId: Number(ticketId),
      matchId: Number(matchId),
      seatNumber,
      ticketType,
      ownerAddress: String(ownerAddress).trim(),
      qrCodeDataUrl,
      transferCount: 0,
      maxTransfers: Number(maxTransfers),
      status: "Valid"
    });

    res.status(201).json({
      ...ticket.toObject(),
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:ticketId/transfer", requireAdmin, async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const { fromAddress, toAddress } = req.body;
    if (!isEthereumAddress(String(fromAddress || "").trim()) || !isEthereumAddress(String(toAddress || "").trim())) {
      return res.status(400).json({ error: "Use valid Ethereum wallet addresses for transfers." });
    }

    const contract = getTicketingContract();
    const tx = await contract.transferFrom(fromAddress, toAddress, ticketId);
    await tx.wait();

    const chainTicket = await contract.getTicket(ticketId);
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      {
        ownerAddress: String(toAddress).trim(),
        transferCount: Number(chainTicket.transferCount)
      },
      { new: true }
    );

    res.json({
      ...ticket.toObject(),
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:ticketId/revoke", requireAdmin, async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const contract = getTicketingContract();
    const tx = await contract.revokeTicket(ticketId);
    await tx.wait();

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      { status: "Revoked" },
      { new: true }
    );

    res.json({
      ...ticket.toObject(),
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:ticketId/sync-owner", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const contract = getTicketingContract();
    const ownerAddress = await contract.ownerOf(ticketId);
    const chainTicket = await contract.getTicket(ticketId);

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      {
        ownerAddress: String(ownerAddress).trim(),
        transferCount: Number(chainTicket.transferCount),
        status: mapStatus(Number(chainTicket.status))
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

router.post("/purchase", async (req, res, next) => {
  try {
    const { matchId, ownerAddress, ticketType } = req.body;
    if (!isEthereumAddress(String(ownerAddress || "").trim())) {
      return res.status(400).json({ error: "Connect a valid MetaMask wallet before booking." });
    }
    const match = await Match.findOne({ matchId: Number(matchId) });
    if (!match) {
      return res.status(404).json({ error: "Match metadata not found" });
    }

    const existingTicket = await Ticket.findOne().sort({ ticketId: -1 });
    const ticketId = existingTicket ? existingTicket.ticketId + 1 : 1000;
    const seatNumber = `AUTO-${ticketId}`;

    const contract = getTicketingContract();
    const tx = await contract.mintTicket(
      ownerAddress,
      Number(ticketId),
      Number(matchId),
      1
    );
    await tx.wait();

    const qrCodeDataUrl = await buildTicketQrCode({
      ticketId: Number(ticketId),
      matchId: Number(matchId),
      ownerAddress
    });

    const ticket = await Ticket.create({
      ticketId: Number(ticketId),
      matchId: Number(matchId),
      seatNumber,
      ticketType: ticketType || "General",
      ownerAddress: String(ownerAddress).trim(),
      qrCodeDataUrl,
      transferCount: 0,
      maxTransfers: 1,
      status: "Valid"
    });

    res.status(201).json({
      ...ticket.toObject(),
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
