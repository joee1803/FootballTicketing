const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const authRoutes = require("./routes/auth");
const blockchainRoutes = require("./routes/blockchain");
const { seedSuperAdmin } = require("./services/adminSeed");
const { initializeTicketingContract } = require("./services/blockchain");
const { connectDatabase } = require("./services/database");
const matchRoutes = require("./routes/matches");
const { seedDefaultMatches } = require("./services/matchSeed");
const ticketRoutes = require("./routes/tickets");
const verificationRoutes = require("./routes/verification");

dotenv.config({ path: "server/.env" });

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

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
