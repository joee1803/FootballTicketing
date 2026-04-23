const Ticket = require("../models/Ticket");
const { getTicketingContract, mapStatus } = require("./blockchain");

async function readOnChainTicket(ticketId) {
  const contract = getTicketingContract();

  try {
    const [chainTicket, ownerAddress] = await Promise.all([
      contract.getTicket(ticketId),
      contract.ownerOf(ticketId)
    ]);

    return {
      exists: true,
      ownerAddress: String(ownerAddress || "").trim(),
      transferCount: Number(chainTicket.transferCount),
      maxTransfers: Number(chainTicket.maxTransfers),
      status: mapStatus(Number(chainTicket.status))
    };
  } catch (error) {
    if (String(error.message || "").includes("Ticket not found on-chain")) {
      return { exists: false };
    }

    throw error;
  }
}

async function cleanupStaleTickets() {
  const tickets = await Ticket.find({});
  let removed = 0;

  for (const ticket of tickets) {
    const chainState = await readOnChainTicket(ticket.ticketId);
    if (!chainState.exists) {
      await Ticket.deleteOne({ _id: ticket._id });
      removed += 1;
    }
  }

  return { removed };
}

async function syncTicketFromChain(ticketId) {
  const ticket = await Ticket.findOne({ ticketId: Number(ticketId) });
  if (!ticket) {
    return null;
  }

  const chainState = await readOnChainTicket(ticket.ticketId);
  if (!chainState.exists) {
    await Ticket.deleteOne({ _id: ticket._id });
    return null;
  }

  ticket.ownerAddress = chainState.ownerAddress;
  ticket.transferCount = chainState.transferCount;
  ticket.maxTransfers = chainState.maxTransfers;
  ticket.status = chainState.status;
  await ticket.save();

  return ticket;
}

module.exports = {
  cleanupStaleTickets,
  readOnChainTicket,
  syncTicketFromChain
};
