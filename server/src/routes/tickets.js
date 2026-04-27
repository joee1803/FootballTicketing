const express = require("express");

const { requireAdmin } = require("../middleware/auth");
const Ticket = require("../models/Ticket");
const Match = require("../models/Match");
const SupporterUser = require("../models/SupporterUser");
const { recordAdminActivity, recordSupporterActivity } = require("../services/adminActivity");
const { getTicketingContract, isEthereumAddress, mapStatus } = require("../services/blockchain");
const { buildTicketQrCode } = require("../services/qrcode");
const { formatPounds, getMatchTicketPricing } = require("../services/pricing");
const { assignSeatIfNeeded, buildSeatNumber, isLegacySeatNumber } = require("../services/seatAssignment");
const { readOnChainTicket, syncTicketFromChain } = require("../services/ticketCleanup");
const { syncMatchFromChain } = require("../services/matchCleanup");

const router = express.Router();

function exactWalletAddress(value) {
  return new RegExp(`^${String(value || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function serializeMatch(match) {
  if (!match) {
    return null;
  }

  return {
    matchId: match.matchId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    stadium: match.stadium,
    matchDate: match.matchDate,
    matchEndTime: match.matchEndTime,
    latestCheckInTime: match.latestCheckInTime,
    ticketPriceCredits: match.ticketPriceCredits
  };
}

async function getNextTicketId() {
  const existingTicket = await Ticket.findOne().sort({ ticketId: -1 });
  return existingTicket ? existingTicket.ticketId + 1 : 1000;
}

async function hydrateTicketsWithMatches(ticketDocs) {
  const normalizedTickets = [];

  for (const ticket of ticketDocs) {
    normalizedTickets.push(await assignSeatIfNeeded(ticket));
  }

  const matchIds = [...new Set(normalizedTickets.map((ticket) => ticket.matchId))];
  const matches = await Match.find({ matchId: { $in: matchIds } });
  const matchMap = new Map(matches.map((match) => [match.matchId, serializeMatch(match)]));

  return normalizedTickets.map((ticket) => ({
    ...ticket.toObject(),
    match: matchMap.get(ticket.matchId) || null
  }));
}

function isMissingOnChainMatchError(error) {
  return String(error?.message || "").includes("The requested match does not exist on-chain.");
}

async function mintTicketWithMatchRepair({ contract, ownerAddress, ticketId, matchId, maxTransfers }) {
  try {
    return await contract.mintTicket(ownerAddress, ticketId, matchId, maxTransfers);
  } catch (error) {
    if (!isMissingOnChainMatchError(error)) {
      throw error;
    }

    const syncedMatch = await syncMatchFromChain(matchId);
    if (!syncedMatch) {
      throw new Error("This match is no longer available for ticketing.");
    }

    return contract.mintTicket(ownerAddress, ticketId, matchId, maxTransfers);
  }
}

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
    const validTickets = [];

    for (const ticket of tickets) {
      const syncedTicket = await syncTicketFromChain(ticket.ticketId);
      if (syncedTicket) {
        validTickets.push(syncedTicket);
      }
    }

    res.json(await hydrateTicketsWithMatches(validTickets));
  } catch (error) {
    next(error);
  }
});

router.get("/supporter/:supporterId", requireAdmin, async (req, res, next) => {
  try {
    const supporter = await SupporterUser.findById(req.params.supporterId);
    if (!supporter) {
      return res.status(404).json({ error: "Supporter not found" });
    }

    const tickets = await Ticket.find({
      ownerAddress: exactWalletAddress(supporter.walletAddress)
    }).sort({ createdAt: -1 });
    const validTickets = [];

    for (const ticket of tickets) {
      const syncedTicket = await syncTicketFromChain(ticket.ticketId);
      if (syncedTicket) {
        validTickets.push(syncedTicket);
      }
    }

    res.json(await hydrateTicketsWithMatches(validTickets));
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

    const chainState = await readOnChainTicket(ticketId);
    if (!chainState.exists) {
      await Ticket.deleteOne({ _id: ticket._id });
      return res.status(404).json({
        error: "This ticket belongs to a previous blockchain session. Please book a new ticket."
      });
    }

    if (
      String(ticket.ownerAddress || "").trim() !== chainState.ownerAddress ||
      Number(ticket.transferCount) !== chainState.transferCount ||
      Number(ticket.maxTransfers) !== chainState.maxTransfers ||
      String(ticket.status || "").trim() !== chainState.status
    ) {
      ticket.ownerAddress = chainState.ownerAddress;
      ticket.transferCount = chainState.transferCount;
      ticket.maxTransfers = chainState.maxTransfers;
      ticket.status = chainState.status;
      await ticket.save();
    }

    const [hydratedTicket] = await hydrateTicketsWithMatches([ticket]);

    res.json({
      ...hydratedTicket,
      onChain: {
        ownerAddress: chainState.ownerAddress,
        transferCount: chainState.transferCount,
        maxTransfers: chainState.maxTransfers,
        status: chainState.status
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { ticketId, matchId, seatNumber, ticketType, ownerAddress, maxTransfers, supporterId } = req.body;
    const supporter = supporterId ? await SupporterUser.findById(supporterId) : null;
    if (supporterId && (!supporter || supporter.isDeleted)) {
      return res.status(404).json({ error: "Supporter not found in the active directory." });
    }
    const resolvedOwnerAddress = String(ownerAddress || supporter?.walletAddress || "").trim();
    const resolvedTicketId = ticketId ? Number(ticketId) : await getNextTicketId();
    const resolvedTicketType = ticketType || "General";
    const resolvedMaxTransfers = maxTransfers ? Number(maxTransfers) : 1;

    if (!isEthereumAddress(resolvedOwnerAddress)) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }
    const match = await Match.findOne({ matchId: Number(matchId) });
    if (!match) {
      return res.status(404).json({ error: "Match metadata not found" });
    }
    const syncedMatch = await syncMatchFromChain(match.matchId);
    if (!syncedMatch) {
      return res.status(404).json({ error: "This match is no longer available for ticketing." });
    }
    const siblingTickets = await Ticket.find({ matchId: Number(matchId) }, { seatNumber: 1 });
    const resolvedSeatNumber = isLegacySeatNumber(seatNumber)
      ? await buildSeatNumber(Number(matchId), resolvedTicketId, siblingTickets.map((entry) => entry.seatNumber))
      : seatNumber;

    const contract = getTicketingContract();
    const tx = await mintTicketWithMatchRepair({
      contract,
      ownerAddress: resolvedOwnerAddress,
      ticketId: resolvedTicketId,
      matchId: Number(matchId),
      maxTransfers: resolvedMaxTransfers
    });
    await tx.wait();

    const qrCodeDataUrl = await buildTicketQrCode({
      ticketId: resolvedTicketId,
      matchId: Number(matchId),
      ownerAddress: resolvedOwnerAddress
    });

    const ticket = await Ticket.create({
      ticketId: resolvedTicketId,
      matchId: Number(matchId),
      seatNumber: resolvedSeatNumber,
      ticketType: resolvedTicketType,
      ownerAddress: resolvedOwnerAddress,
      qrCodeDataUrl,
      transferCount: 0,
      maxTransfers: resolvedMaxTransfers,
      status: "Valid"
    });

    const [hydratedTicket] = await hydrateTicketsWithMatches([ticket]);

    await recordAdminActivity(req.admin, {
      actionType: "TICKET_MINTED",
      summary: `Minted ticket ${resolvedTicketId} for match ${match.matchId}.`,
      targetType: "TICKET",
      targetId: String(resolvedTicketId),
      targetLabel: `${match.homeTeam} vs ${match.awayTeam}`,
      metadata: {
        txHash: tx.hash,
        matchId: match.matchId,
        ownerAddress: resolvedOwnerAddress,
        seatNumber: resolvedSeatNumber
      }
    });

    res.status(201).json({
      ...hydratedTicket,
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

    const [hydratedTicket] = await hydrateTicketsWithMatches([ticket]);

    await recordAdminActivity(req.admin, {
      actionType: "TICKET_TRANSFERRED_BY_ADMIN",
      summary: `Transferred ticket ${ticketId} between wallets from the admin console.`,
      targetType: "TICKET",
      targetId: String(ticketId),
      targetLabel: String(ticket?.matchId || ""),
      metadata: {
        txHash: tx.hash,
        fromAddress,
        toAddress,
        matchId: ticket?.matchId
      }
    });

    res.json({
      ...hydratedTicket,
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

    const [hydratedTicket] = await hydrateTicketsWithMatches([ticket]);

    await recordAdminActivity(req.admin, {
      actionType: "TICKET_REVOKED",
      summary: `Revoked ticket ${ticketId}.`,
      targetType: "TICKET",
      targetId: String(ticketId),
      targetLabel: String(ticket?.matchId || ""),
      metadata: {
        txHash: tx.hash,
        matchId: ticket?.matchId,
        ownerAddress: ticket?.ownerAddress
      }
    });

    res.json({
      ...hydratedTicket,
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
    const existingTicket = await Ticket.findOne({ ticketId });
    if (!existingTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const previousOwnerAddress = String(existingTicket.ownerAddress || "").trim();
    const ownerAddress = await contract.ownerOf(ticketId);
    const chainTicket = await contract.getTicket(ticketId);
    const txHash = String(req.body?.txHash || "").trim();

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      {
        ownerAddress: String(ownerAddress).trim(),
        transferCount: Number(chainTicket.transferCount),
        status: mapStatus(Number(chainTicket.status))
      },
      { new: true }
    );

    const [hydratedTicket] = await hydrateTicketsWithMatches([ticket]);

    if (txHash && previousOwnerAddress && previousOwnerAddress.toLowerCase() !== String(ownerAddress).trim().toLowerCase()) {
      const [sender, recipient] = await Promise.all([
        SupporterUser.findOne({ walletAddress: exactWalletAddress(previousOwnerAddress), isDeleted: false }),
        SupporterUser.findOne({ walletAddress: exactWalletAddress(ownerAddress), isDeleted: false })
      ]);

      if (sender) {
        await recordSupporterActivity(sender, {
          actionType: "TICKET_TRANSFERRED",
          summary: `Transferred ticket ${ticketId}${recipient ? ` to ${recipient.fullName}` : ""}.`,
          targetType: "TICKET",
          targetId: String(ticketId),
          targetLabel: hydratedTicket?.match ? `${hydratedTicket.match.homeTeam} vs ${hydratedTicket.match.awayTeam}` : String(ticket?.matchId || ""),
          metadata: {
            txHash,
            fromAddress: previousOwnerAddress,
            toAddress: String(ownerAddress).trim(),
            matchId: ticket?.matchId,
            recipientName: recipient?.fullName || ""
          }
        });
      }
    }

    res.json(hydratedTicket);
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
    const syncedMatch = await syncMatchFromChain(match.matchId);
    if (!syncedMatch) {
      return res.status(404).json({ error: "This match is no longer available for booking." });
    }
    const supporter = await SupporterUser.findOne({
      walletAddress: exactWalletAddress(ownerAddress),
      isDeleted: false
    });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter account not found for the connected wallet." });
    }
    const pricing = getMatchTicketPricing(match, supporter);

    if ((supporter.creditBalance || 0) < pricing.finalPrice) {
      return res.status(400).json({
        error: `This ticket costs ${formatPounds(pricing.finalPrice)}, but the supporter balance is only ${formatPounds(supporter.creditBalance || 0)}.`
      });
    }

    const ticketId = await getNextTicketId();
    const siblingTickets = await Ticket.find({ matchId: Number(matchId) }, { seatNumber: 1 });
    const seatNumber = await buildSeatNumber(Number(matchId), ticketId, siblingTickets.map((entry) => entry.seatNumber));

    await SupporterUser.updateOne(
      { _id: supporter._id },
      { $inc: { creditBalance: -pricing.finalPrice } }
    );

    try {
      const contract = getTicketingContract();
      const tx = await mintTicketWithMatchRepair({
        contract,
        ownerAddress,
        ticketId: Number(ticketId),
        matchId: Number(matchId),
        maxTransfers: 1
      });
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

      const refreshedSupporter = await SupporterUser.findById(supporter._id);
      const [hydratedTicket] = await hydrateTicketsWithMatches([ticket]);

      await recordSupporterActivity(refreshedSupporter || supporter, {
        actionType: "TICKET_PURCHASED",
        summary: `Purchased ticket ${ticket.ticketId} for ${match.homeTeam} vs ${match.awayTeam}.`,
        targetType: "TICKET",
        targetId: String(ticket.ticketId),
        targetLabel: `${match.homeTeam} vs ${match.awayTeam}`,
        metadata: {
          txHash: tx.hash,
          matchId: match.matchId,
          ownerAddress: String(ownerAddress).trim(),
          seatNumber,
          finalPricePounds: pricing.finalPrice,
          remainingBalancePounds: Number(refreshedSupporter?.creditBalance || 0)
        }
      });

      res.status(201).json({
        ...hydratedTicket,
        txHash: tx.hash,
        basePricePounds: pricing.basePrice,
        finalPricePounds: pricing.finalPrice,
        discountAmountPounds: pricing.discountAmount,
        discountApplied: pricing.discountApplied,
        purchasePriceCredits: pricing.finalPrice,
        remainingBalancePounds: Number(refreshedSupporter?.creditBalance || 0),
        remainingCredits: Number(refreshedSupporter?.creditBalance || 0)
      });
    } catch (error) {
      await SupporterUser.updateOne(
        { _id: supporter._id },
        { $inc: { creditBalance: pricing.finalPrice } }
      );
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
