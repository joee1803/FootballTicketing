const express = require("express");

const { requireAdmin } = require("../middleware/auth");
const CheckInRequest = require("../models/CheckInRequest");
const Match = require("../models/Match");
const ScanLog = require("../models/ScanLog");
const SupporterUser = require("../models/SupporterUser");
const Ticket = require("../models/Ticket");
const { recordAdminActivity, recordSupporterActivity } = require("../services/adminActivity");
const { getTicketingContract, isEthereumAddress, mapStatus } = require("../services/blockchain");

const router = express.Router();

function exactWalletAddress(value) {
  return new RegExp(`^${String(value || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function serializeRequest(request) {
  return {
    id: request._id,
    ticketId: request.ticketId,
    matchId: request.matchId,
    fixtureLabel: request.fixtureLabel,
    ownerAddress: request.ownerAddress,
    supporterId: request.supporterId,
    supporterName: request.supporterName,
    supporterEmail: request.supporterEmail,
    status: request.status,
    requestNote: request.requestNote || "",
    resultNote: request.resultNote || "",
    reviewedByAdminId: request.reviewedByAdminId || "",
    reviewedByName: request.reviewedByName || "",
    reviewedByEmail: request.reviewedByEmail || "",
    reviewedAt: request.reviewedAt,
    txHash: request.txHash || "",
    createdAt: request.createdAt
  };
}

router.post("/request", async (req, res, next) => {
  try {
    const ticketId = Number(req.body.ticketId);
    const ownerAddress = String(req.body.ownerAddress || req.body.claimedOwner || "").trim();
    const requestNote = String(req.body.requestNote || "").trim();

    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ error: "A valid ticket ID is required for a check-in request." });
    }
    if (!isEthereumAddress(ownerAddress)) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required for a check-in request." });
    }

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    const supporter = await SupporterUser.findOne({
      walletAddress: exactWalletAddress(ownerAddress),
      isDeleted: false
    });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter account not found for that wallet." });
    }

    const existingPendingRequest = await CheckInRequest.findOne({
      ticketId,
      ownerAddress: exactWalletAddress(ownerAddress),
      status: "PENDING"
    });
    if (existingPendingRequest) {
      return res.status(409).json({ error: "A check-in request for this ticket is already pending." });
    }

    const contract = getTicketingContract();
    const verification = await contract.verifyTicket(ticketId, ownerAddress);
    const isValid = verification[0];
    const status = mapStatus(Number(verification[1]));
    const currentOwner = verification[2];
    const matchId = Number(verification[3] || ticket.matchId);

    if (!isValid || String(currentOwner || "").trim().toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(400).json({ error: `This ticket is not ready for check-in. Current on-chain status: ${status}.` });
    }

    const match = await Match.findOne({ matchId });
    const fixtureLabel = match ? `${match.homeTeam} vs ${match.awayTeam}` : `Match ${matchId}`;

    const request = await CheckInRequest.create({
      ticketId,
      matchId,
      fixtureLabel,
      ownerAddress,
      supporterId: supporter._id,
      supporterName: supporter.fullName,
      supporterEmail: supporter.email,
      requestNote
    });

    await recordSupporterActivity(supporter, {
      actionType: "CHECK_IN_REQUESTED",
      summary: `Requested check-in for ticket ${ticketId}.`,
      targetType: "TICKET",
      targetId: String(ticketId),
      targetLabel: fixtureLabel,
      metadata: {
        matchId,
        ownerAddress,
        requestId: String(request._id)
      }
    });

    res.status(201).json(serializeRequest(request));
  } catch (error) {
    next(error);
  }
});

router.get("/requests", requireAdmin, async (_req, res, next) => {
  try {
    const requests = await CheckInRequest.find().sort({ createdAt: -1 }).limit(100);
    res.json(requests.map(serializeRequest));
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:requestId/check-in", requireAdmin, async (req, res, next) => {
  try {
    const request = await CheckInRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Check-in request not found." });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending check-in requests can be processed." });
    }

    const contract = getTicketingContract();
    const verification = await contract.verifyTicket(Number(request.ticketId), request.ownerAddress);
    const isValid = verification[0];
    const status = mapStatus(Number(verification[1]));
    const currentOwner = verification[2];
    const matchId = Number(verification[3] || request.matchId);

    request.reviewedByAdminId = String(req.admin.id);
    request.reviewedByName = String(req.admin.name || "");
    request.reviewedByEmail = String(req.admin.email || "").toLowerCase();
    request.reviewedAt = new Date();

    if (!isValid || String(currentOwner || "").trim().toLowerCase() !== String(request.ownerAddress || "").trim().toLowerCase()) {
      request.status = "REJECTED";
      request.resultNote = `Validation failed with on-chain status ${status}.`;
      await request.save();

      await ScanLog.create({
        ticketId: Number(request.ticketId),
        scannedBy: req.admin.name || "admin-console",
        ownerAddress: request.ownerAddress,
        result: "Rejected",
        details: request.resultNote
      });

      await recordAdminActivity(req.admin, {
        actionType: "CHECK_IN_REQUEST_REJECTED",
        summary: `Rejected check-in request for ticket ${request.ticketId}.`,
        targetType: "CHECK_IN_REQUEST",
        targetId: String(request._id),
        targetLabel: request.fixtureLabel || String(matchId),
        metadata: {
          ticketId: request.ticketId,
          matchId,
          currentOwner,
          status
        }
      });

      return res.json({
        valid: false,
        status,
        currentOwner,
        matchId,
        request: serializeRequest(request)
      });
    }

    const tx = await contract.markTicketAsUsed(Number(request.ticketId));
    await tx.wait();

    await Ticket.findOneAndUpdate(
      { ticketId: Number(request.ticketId) },
      { status: "Used" }
    );

    await ScanLog.create({
      ticketId: Number(request.ticketId),
      scannedBy: req.admin.name || "admin-console",
      ownerAddress: request.ownerAddress,
      result: "Accepted",
      details: "Used"
    });

    request.status = "CHECKED_IN";
    request.resultNote = "Ticket verified and checked in.";
    request.txHash = tx.hash;
    await request.save();

    const supporter = request.supporterId
      ? await SupporterUser.findById(request.supporterId)
      : await SupporterUser.findOne({ walletAddress: exactWalletAddress(request.ownerAddress), isDeleted: false });
    if (supporter) {
      await recordSupporterActivity(supporter, {
        actionType: "CHECKED_IN",
        summary: `Ticket ${request.ticketId} was checked in by the admin team.`,
        targetType: "TICKET",
        targetId: String(request.ticketId),
        targetLabel: request.fixtureLabel || String(matchId),
        metadata: {
          txHash: tx.hash,
          matchId
        }
      });
    }

    await recordAdminActivity(req.admin, {
      actionType: "CHECK_IN_REQUEST_APPROVED",
      summary: `Verified and checked in ticket ${request.ticketId}.`,
      targetType: "CHECK_IN_REQUEST",
      targetId: String(request._id),
      targetLabel: request.fixtureLabel || String(matchId),
      metadata: {
        txHash: tx.hash,
        ticketId: request.ticketId,
        matchId,
        currentOwner
      }
    });

    res.json({
      valid: true,
      status: "Used",
      currentOwner,
      matchId,
      txHash: tx.hash,
      request: serializeRequest(request)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/check", requireAdmin, async (req, res, next) => {
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

    await recordAdminActivity(req.admin, {
      actionType: "TICKET_VERIFIED",
      summary: `Verified ticket ${ticketId} from the admin console.`,
      targetType: "TICKET",
      targetId: String(ticketId),
      targetLabel: String(payload.matchId),
      metadata: {
        valid: payload.valid,
        status: payload.status,
        currentOwner: payload.currentOwner,
        matchId: payload.matchId
      }
    });

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/check-in", requireAdmin, async (req, res, next) => {
  try {
    const { ticketId, claimedOwner, scannedBy } = req.body;
    if (!isEthereumAddress(String(claimedOwner || "").trim())) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required for check-in." });
    }
    const contract = getTicketingContract();

    const verification = await contract.verifyTicket(Number(ticketId), claimedOwner);
    const isValid = verification[0];
    const status = mapStatus(Number(verification[1]));
    const currentOwner = verification[2];
    const matchId = Number(verification[3]);

    if (!isValid) {
      await ScanLog.create({
        ticketId: Number(ticketId),
        scannedBy,
        ownerAddress: claimedOwner,
        result: "Rejected",
        details: status
      });

      await recordAdminActivity(req.admin, {
        actionType: "TICKET_CHECK_IN_REJECTED",
        summary: `Rejected check-in for ticket ${ticketId}.`,
        targetType: "TICKET",
        targetId: String(ticketId),
        targetLabel: String(matchId),
        metadata: {
          valid: false,
          status,
          currentOwner,
          matchId
        }
      });

      return res.status(400).json({
        valid: false,
        status,
        currentOwner,
        matchId
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

    await recordAdminActivity(req.admin, {
      actionType: "TICKET_CHECKED_IN",
      summary: `Checked in ticket ${ticketId}.`,
      targetType: "TICKET",
      targetId: String(ticketId),
      targetLabel: String(matchId),
      metadata: {
        txHash: tx.hash,
        currentOwner,
        matchId
      }
    });

    res.json({
      valid: true,
      status: "Used",
      currentOwner,
      matchId,
      txHash: tx.hash
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
