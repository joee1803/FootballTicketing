const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const authRoutes = require("./routes/auth");
const blockchainRoutes = require("./routes/blockchain");
const { seedSuperAdmin } = require("./services/adminSeed");
const { initializeTicketingContract } = require("./services/blockchain");
const { cleanupLegacySupporters } = require("./services/cleanup");
const { connectDatabase } = require("./services/database");
const { cleanupStaleMatches } = require("./services/matchCleanup");
const matchRoutes = require("./routes/matches");
const { seedDefaultMatches } = require("./services/matchSeed");
const { cleanupStaleTickets } = require("./services/ticketCleanup");
const ticketRoutes = require("./routes/tickets");
const verificationRoutes = require("./routes/verification");

dotenv.config({ path: "server/.env" });

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "Football Matchday Ticketing API",
    status: "running",
    appUrl: "http://localhost:3000",
    healthUrl: "http://localhost:4000/health"
  });
});

app.get("/health", async (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/verification", verificationRoutes);

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error"
  });
});

async function start() {
  await initializeTicketingContract();
  await connectDatabase();
  const cleanupSummary = await cleanupLegacySupporters();
  if (cleanupSummary.removed) {
    console.log(`Removed ${cleanupSummary.removed} legacy supporter records that were not compatible with MetaMask.`);
  }
  const staleTicketSummary = await cleanupStaleTickets();
  if (staleTicketSummary.removed) {
    console.log(`Removed ${staleTicketSummary.removed} stale tickets from previous blockchain sessions.`);
  }
  const staleMatchSummary = await cleanupStaleMatches();
  if (staleMatchSummary.recreated) {
    console.log(`Recreated ${staleMatchSummary.recreated} future matches on-chain after a local blockchain reset.`);
  }
  if (staleMatchSummary.removed) {
    console.log(`Removed ${staleMatchSummary.removed} past matches that no longer existed on-chain.`);
  }
  await seedSuperAdmin();
  const seedSummary = await seedDefaultMatches();
  console.log(`Fixture dataset ready: ${seedSummary.total} matches available.`);
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
