const Ticket = require("../models/Ticket");

const STANDS = [
  { label: "North Stand", code: "N" },
  { label: "East Stand", code: "E" },
  { label: "South Stand", code: "S" },
  { label: "West Stand", code: "W" }
];
const ROWS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

function normalizeSeatNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function isLegacySeatNumber(value) {
  const normalized = String(value || "").trim();
  return !normalized || normalized.startsWith("AUTO-");
}

function buildSeatCandidates() {
  const candidates = [];

  for (const stand of STANDS) {
    for (let block = 1; block <= 4; block += 1) {
      for (const row of ROWS) {
        for (let seat = 1; seat <= 28; seat += 1) {
          candidates.push(`${stand.label} - Block ${stand.code}${block} - Row ${row} - Seat ${String(seat).padStart(2, "0")}`);
        }
      }
    }
  }

  return candidates;
}

const SEAT_CANDIDATES = buildSeatCandidates();

function chooseSeatCandidate(matchId, ticketId, takenSeats) {
  const offsetBase = Number(matchId || 0) + Number(ticketId || 0);

  for (let index = 0; index < SEAT_CANDIDATES.length; index += 1) {
    const candidate = SEAT_CANDIDATES[(offsetBase + index * 17) % SEAT_CANDIDATES.length];
    if (!takenSeats.has(normalizeSeatNumber(candidate))) {
      return candidate;
    }
  }

  return `North Stand - Block N1 - Row A - Seat ${String((offsetBase % 98) + 1).padStart(2, "0")}`;
}

async function buildSeatNumber(matchId, ticketId, existingSeats = []) {
  const takenSeats = new Set(existingSeats.map((seat) => normalizeSeatNumber(seat)));
  return chooseSeatCandidate(matchId, ticketId, takenSeats);
}

async function assignSeatIfNeeded(ticket) {
  if (!ticket || !isLegacySeatNumber(ticket.seatNumber)) {
    return ticket;
  }

  const siblingTickets = await Ticket.find(
    { matchId: ticket.matchId, _id: { $ne: ticket._id } },
    { seatNumber: 1 }
  );
  const nextSeat = await buildSeatNumber(
    ticket.matchId,
    ticket.ticketId,
    siblingTickets.map((entry) => entry.seatNumber)
  );

  ticket.seatNumber = nextSeat;
  await ticket.save();
  return ticket;
}

module.exports = {
  assignSeatIfNeeded,
  buildSeatNumber,
  isLegacySeatNumber
};
