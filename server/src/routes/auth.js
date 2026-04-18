const express = require("express");

const AdminUser = require("../models/AdminUser");
const AdminRequest = require("../models/AdminRequest");
const SupporterUser = require("../models/SupporterUser");
const { requireAdmin, requireSuperAdmin } = require("../middleware/auth");
const { comparePassword, hashPassword, signAdminToken } = require("../services/auth");
const { isEthereumAddress } = require("../services/blockchain");

const router = express.Router();

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactCaseInsensitive(value) {
  return new RegExp(`^${escapeRegExp(String(value || "").trim())}$`, "i");
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function exactWalletAddress(value) {
  return new RegExp(`^${escapeRegExp(String(value || "").trim())}$`, "i");
}

router.post("/admin/sign-in", async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim();
    const password = String(req.body.password || "");
    const email = identifier.toLowerCase();

    let admin = await AdminUser.findOne({ email });
    if (!admin) {
      const admins = await AdminUser.find({}, { passwordHash: 1, name: 1, email: 1, role: 1 });
      admin = admins.find((candidate) => normalizeName(candidate.name) === normalizeName(identifier)) || null;
    }
    if (!admin) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const valid = await comparePassword(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const token = signAdminToken(admin);
    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/me", requireAdmin, async (req, res) => {
  res.json({
    admin: {
      id: req.admin.sub,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role
    }
  });
});

router.get("/admin/list", requireAdmin, requireSuperAdmin, async (_req, res, next) => {
  try {
    const admins = await AdminUser.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/create", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const role = req.body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existing = await AdminUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "An admin with that email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const admin = await AdminUser.create({
      name,
      email,
      passwordHash,
      role
    });

    res.status(201).json({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/request", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const reason = String(req.body.reason || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existingAdmin = await AdminUser.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ error: "That email already belongs to an approved admin" });
    }

    const existingRequest = await AdminRequest.findOne({ email, status: "PENDING" });
    if (existingRequest) {
      return res.status(409).json({ error: "There is already a pending admin request for that email" });
    }

    const passwordHash = await hashPassword(password);
    const request = await AdminRequest.findOneAndUpdate(
      { email },
      {
        name,
        email,
        passwordHash,
        reason,
        status: "PENDING",
        reviewedBy: null,
        reviewedAt: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      id: request._id,
      name: request.name,
      email: request.email,
      status: request.status
    });
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/register", async (req, res, next) => {
  try {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const favouriteClub = String(req.body.favouriteClub || "").trim();
    const walletAddress = String(req.body.walletAddress || "").trim();
    const password = String(req.body.password || "");

    if (!firstName || !lastName || !email || !walletAddress || !password) {
      return res.status(400).json({ error: "First name, last name, email, wallet address, and password are required" });
    }
    if (!isEthereumAddress(walletAddress)) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }

    const existing = await SupporterUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "A supporter account with that email already exists" });
    }

    const existingWallet = await SupporterUser.findOne({
      walletAddress: exactWalletAddress(walletAddress)
    });
    if (existingWallet) {
      return res.status(409).json({ error: "That MetaMask wallet is already linked to another supporter account." });
    }

    const passwordHash = await hashPassword(password);
    const supporter = await SupporterUser.create({
      firstName,
      lastName,
      fullName,
      email,
      favouriteClub,
      walletAddress,
      passwordHash
    });

    res.status(201).json({
      id: supporter._id,
      firstName: supporter.firstName,
      lastName: supporter.lastName,
      fullName: supporter.fullName,
      email: supporter.email,
      favouriteClub: supporter.favouriteClub,
      walletAddress: supporter.walletAddress,
      createdAt: supporter.createdAt
    });
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/sign-in", async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim();
    const password = String(req.body.password || "");
    const email = identifier.toLowerCase();

    let supporter = await SupporterUser.findOne({ email });
    if (!supporter) {
      const supporters = await SupporterUser.find({}, { passwordHash: 1, fullName: 1, email: 1, firstName: 1, lastName: 1, favouriteClub: 1, walletAddress: 1, createdAt: 1 });
      supporter = supporters.find((candidate) => normalizeName(candidate.fullName) === normalizeName(identifier)) || null;
    }
    if (!supporter) {
      return res.status(401).json({ error: "No supporter account matched those details." });
    }

    const valid = await comparePassword(password, supporter.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "No supporter account matched those details." });
    }

    res.json({
      id: supporter._id,
      firstName: supporter.firstName,
      lastName: supporter.lastName,
      fullName: supporter.fullName,
      email: supporter.email,
      favouriteClub: supporter.favouriteClub,
      walletAddress: supporter.walletAddress,
      createdAt: supporter.createdAt
    });
  } catch (error) {
    next(error);
  }
});

router.get("/supporters/transfer-options", async (_req, res, next) => {
  try {
    const supporters = await SupporterUser.find({}, { passwordHash: 0 })
      .sort({ fullName: 1 })
      .then((rows) => {
        const seenWallets = new Set();

        return rows.filter((supporter) => {
          const walletAddress = String(supporter.walletAddress || "").trim();
          const normalizedWallet = walletAddress.toLowerCase();
          if (!isEthereumAddress(walletAddress) || seenWallets.has(normalizedWallet)) {
            return false;
          }

          seenWallets.add(normalizedWallet);
          return true;
        }).map((supporter) => ({
          id: supporter._id,
          fullName: supporter.fullName,
          favouriteClub: supporter.favouriteClub,
          walletAddress: supporter.walletAddress
        }));
      });

    res.json({
      supporters
    });
  } catch (error) {
    next(error);
  }
});

router.get("/supporters", requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      visibility: req.admin.role === "SUPER_ADMIN" ? "FULL" : "LIMITED",
      supporters: await SupporterUser.find({}, { passwordHash: 0 })
        .sort({ createdAt: -1 })
        .then((rows) =>
          rows.map((supporter) => ({
            id: supporter._id,
            fullName: supporter.fullName,
            favouriteClub: supporter.favouriteClub,
            createdAt: supporter.createdAt
          }))
        )
    });
  } catch (error) {
    next(error);
  }
});

router.get("/supporters/:supporterId", requireAdmin, async (req, res, next) => {
  try {
    const supporter = await SupporterUser.findById(req.params.supporterId, { passwordHash: 0 });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter not found" });
    }

    if (req.admin.role === "SUPER_ADMIN") {
      return res.json({
        visibility: "FULL",
        supporter: {
          id: supporter._id,
          firstName: supporter.firstName,
          lastName: supporter.lastName,
          fullName: supporter.fullName,
          email: supporter.email,
          favouriteClub: supporter.favouriteClub,
          walletAddress: supporter.walletAddress,
          createdAt: supporter.createdAt
        }
      });
    }

    return res.json({
      visibility: "LIMITED",
      supporter: {
        id: supporter._id,
        firstName: supporter.firstName,
        lastName: supporter.lastName,
        fullName: supporter.fullName,
        favouriteClub: supporter.favouriteClub,
        createdAt: supporter.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/requests", requireAdmin, requireSuperAdmin, async (_req, res, next) => {
  try {
    const requests = await AdminRequest.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/requests/:requestId/approve", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const request = await AdminRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Admin request not found" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending requests can be approved" });
    }

    const existingAdmin = await AdminUser.findOne({ email: request.email });
    if (existingAdmin) {
      return res.status(409).json({ error: "That request has already been fulfilled by an admin account" });
    }

    const admin = await AdminUser.create({
      name: request.name,
      email: request.email,
      passwordHash: request.passwordHash,
      role: "ADMIN"
    });

    request.status = "APPROVED";
    request.reviewedBy = req.admin.email;
    request.reviewedAt = new Date();
    await request.save();

    res.json({
      request: {
        id: request._id,
        status: request.status,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt
      },
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/requests/:requestId/deny", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const request = await AdminRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Admin request not found" });
    }

    request.status = "DENIED";
    request.reviewedBy = req.admin.email;
    request.reviewedAt = new Date();
    await request.save();

    res.json({
      id: request._id,
      status: request.status,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
