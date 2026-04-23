const express = require("express");

const AdminActivityLog = require("../models/AdminActivityLog");
const AdminUser = require("../models/AdminUser");
const AdminRequest = require("../models/AdminRequest");
const SupporterUser = require("../models/SupporterUser");
const SupporterRemovalRequest = require("../models/SupporterRemovalRequest");
const { requireAdmin, requireSuperAdmin } = require("../middleware/auth");
const { comparePassword, hashPassword, signAdminToken } = require("../services/auth");
const { recordAdminActivity } = require("../services/adminActivity");
const { isEthereumAddress } = require("../services/blockchain");
const { isSupportedFavouriteClub, normalizeClubName } = require("../data/favouriteClubs");

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

function serializeSupporter(supporter) {
  return {
    id: supporter._id,
    firstName: supporter.firstName,
    lastName: supporter.lastName,
    fullName: supporter.fullName,
    email: supporter.email,
    favouriteClub: supporter.favouriteClub,
    walletAddress: supporter.walletAddress,
    creditBalance: supporter.creditBalance || 0,
    createdAt: supporter.createdAt,
    isDeleted: Boolean(supporter.isDeleted),
    deletedAt: supporter.deletedAt,
    deletionReason: supporter.deletionReason || "",
    restoredAt: supporter.restoredAt
  };
}

function serializeAdmin(admin) {
  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    isPrimarySuperAdmin: Boolean(admin.isPrimarySuperAdmin),
    createdAt: admin.createdAt
  };
}

function serializeRemovalRequest(request) {
  return {
    id: request._id,
    supporterId: request.supporterId,
    supporterName: request.supporterName,
    supporterEmail: request.supporterEmail,
    requestedByAdminId: request.requestedByAdminId,
    requestedByName: request.requestedByName,
    requestedByEmail: request.requestedByEmail,
    reason: request.reason || "",
    status: request.status,
    reviewedByAdminId: request.reviewedByAdminId,
    reviewedByName: request.reviewedByName,
    reviewedByEmail: request.reviewedByEmail,
    reviewedAt: request.reviewedAt,
    createdAt: request.createdAt
  };
}

async function softDeleteSupporter(supporter, admin, reason = "") {
  supporter.isDeleted = true;
  supporter.deletedAt = new Date();
  supporter.deletedByAdminId = String(admin.id);
  supporter.deletedByName = String(admin.name || "");
  supporter.deletedByEmail = String(admin.email || "").toLowerCase();
  supporter.deletionReason = String(reason || "").trim();
  supporter.restoredAt = null;
  supporter.restoredByAdminId = null;
  supporter.restoredByName = null;
  supporter.restoredByEmail = null;
  await supporter.save();
  return supporter;
}

async function restoreSupporterRecord(supporter, admin) {
  supporter.isDeleted = false;
  supporter.restoredAt = new Date();
  supporter.restoredByAdminId = String(admin.id);
  supporter.restoredByName = String(admin.name || "");
  supporter.restoredByEmail = String(admin.email || "").toLowerCase();
  supporter.deletedAt = null;
  supporter.deletedByAdminId = null;
  supporter.deletedByName = null;
  supporter.deletedByEmail = null;
  supporter.deletionReason = "";
  await supporter.save();
  return supporter;
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
      admin: serializeAdmin(admin)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/me", requireAdmin, async (req, res) => {
  res.json({
    admin: req.admin
  });
});

router.get("/admin/list", requireAdmin, requireSuperAdmin, async (_req, res, next) => {
  try {
    const admins = await AdminUser.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
    res.json(admins.map(serializeAdmin));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/create", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
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
      role: "ADMIN",
      isPrimarySuperAdmin: false
    });

    await recordAdminActivity(req.admin, {
      actionType: "ADMIN_CREATED",
      summary: `Created admin account for ${admin.name}.`,
      targetType: "ADMIN",
      targetId: String(admin._id),
      targetLabel: admin.email,
      metadata: {
        createdAdminRole: admin.role
      }
    });

    res.status(201).json(serializeAdmin(admin));
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
    const favouriteClub = normalizeClubName(req.body.favouriteClub);
    const walletAddress = String(req.body.walletAddress || "").trim();
    const password = String(req.body.password || "");

    if (!firstName || !lastName || !email || !walletAddress || !password) {
      return res.status(400).json({ error: "First name, last name, email, wallet address, and password are required" });
    }
    if (!isSupportedFavouriteClub(favouriteClub)) {
      return res.status(400).json({ error: "Choose a favourite club from the featured club list." });
    }
    if (!isEthereumAddress(walletAddress)) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }

    const existing = await SupporterUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "A supporter account with that email already exists" });
    }

    const existingWallet = await SupporterUser.findOne({
      walletAddress: exactWalletAddress(walletAddress),
      isDeleted: false
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
      creditBalance: 0,
      passwordHash
    });

    res.status(201).json(serializeSupporter(supporter));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/:adminId/promote", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const admin = await AdminUser.findById(req.params.adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin account not found" });
    }
    if (admin.isPrimarySuperAdmin) {
      return res.status(400).json({ error: "The founding super admin account cannot be changed." });
    }
    if (admin.role === "SUPER_ADMIN") {
      return res.status(400).json({ error: "This admin already has super admin privileges." });
    }

    admin.role = "SUPER_ADMIN";
    await admin.save();

    await recordAdminActivity(req.admin, {
      actionType: "ADMIN_PROMOTED",
      summary: `Promoted ${admin.name} to super admin.`,
      targetType: "ADMIN",
      targetId: String(admin._id),
      targetLabel: admin.email,
      metadata: {
        newRole: admin.role
      }
    });

    res.json(serializeAdmin(admin));
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/sign-in", async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim();
    const password = String(req.body.password || "");
    const email = identifier.toLowerCase();

    let supporter = await SupporterUser.findOne({ email, isDeleted: false });
    if (!supporter) {
      const supporters = await SupporterUser.find({ isDeleted: false }, { passwordHash: 1, fullName: 1, email: 1, firstName: 1, lastName: 1, favouriteClub: 1, walletAddress: 1, creditBalance: 1, createdAt: 1 });
      supporter = supporters.find((candidate) => normalizeName(candidate.fullName) === normalizeName(identifier)) || null;
    }
    if (!supporter) {
      return res.status(401).json({ error: "No supporter account matched those details." });
    }

    const valid = await comparePassword(password, supporter.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "No supporter account matched those details." });
    }

    res.json(serializeSupporter(supporter));
  } catch (error) {
    next(error);
  }
});

router.get("/supporters/by-wallet/:walletAddress", async (req, res, next) => {
  try {
    const walletAddress = String(req.params.walletAddress || "").trim();
    if (!isEthereumAddress(walletAddress)) {
      return res.status(400).json({ error: "A valid MetaMask wallet address is required." });
    }

    const supporter = await SupporterUser.findOne({
      walletAddress: exactWalletAddress(walletAddress),
      isDeleted: false
    });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter account not found for that wallet." });
    }

    res.json(serializeSupporter(supporter));
  } catch (error) {
    next(error);
  }
});

router.get("/supporters/transfer-options", async (_req, res, next) => {
  try {
    const supporters = await SupporterUser.find({ isDeleted: false }, { passwordHash: 0 })
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
    const includeDeleted = req.admin.role === "SUPER_ADMIN" && String(req.query.includeDeleted || "").toLowerCase() === "true";
    const supporterFilter = includeDeleted ? {} : { isDeleted: false };
    return res.json({
      visibility: req.admin.role === "SUPER_ADMIN" ? "FULL" : "LIMITED",
      supporters: await SupporterUser.find(supporterFilter, { passwordHash: 0 })
        .sort({ createdAt: -1 })
        .then((rows) =>
          rows.map((supporter) => ({
            id: supporter._id,
            fullName: supporter.fullName,
            favouriteClub: supporter.favouriteClub,
            creditBalance: supporter.creditBalance || 0,
            createdAt: supporter.createdAt,
            isDeleted: Boolean(supporter.isDeleted),
            deletedAt: supporter.deletedAt,
            deletionReason: supporter.deletionReason || ""
          }))
        )
    });
  } catch (error) {
    next(error);
  }
});

router.get("/supporters/:supporterId", requireAdmin, async (req, res, next) => {
  try {
    if (req.params.supporterId === "removal-requests") {
      return next();
    }

    const supporter = await SupporterUser.findById(req.params.supporterId, { passwordHash: 0 });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter not found" });
    }
    if (supporter.isDeleted && req.admin.role !== "SUPER_ADMIN") {
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
          creditBalance: supporter.creditBalance || 0,
          createdAt: supporter.createdAt,
          isDeleted: Boolean(supporter.isDeleted),
          deletedAt: supporter.deletedAt,
          deletionReason: supporter.deletionReason || "",
          restoredAt: supporter.restoredAt
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
        createdAt: supporter.createdAt,
        isDeleted: Boolean(supporter.isDeleted)
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
      role: "ADMIN",
      isPrimarySuperAdmin: false
    });

    request.status = "APPROVED";
    request.reviewedBy = req.admin.email;
    request.reviewedAt = new Date();
    await request.save();

    await recordAdminActivity(req.admin, {
      actionType: "ADMIN_REQUEST_APPROVED",
      summary: `Approved admin request for ${request.name}.`,
      targetType: "ADMIN_REQUEST",
      targetId: String(request._id),
      targetLabel: request.email,
      metadata: {
        createdAdminId: String(admin._id)
      }
    });

    res.json({
      request: {
        id: request._id,
        status: request.status,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt
      },
      admin: serializeAdmin(admin)
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

    await recordAdminActivity(req.admin, {
      actionType: "ADMIN_REQUEST_DENIED",
      summary: `Denied admin request for ${request.name}.`,
      targetType: "ADMIN_REQUEST",
      targetId: String(request._id),
      targetLabel: request.email
    });

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

router.post("/supporters/:supporterId/remove-request", requireAdmin, async (req, res, next) => {
  try {
    const supporter = await SupporterUser.findById(req.params.supporterId, { passwordHash: 0 });
    if (!supporter || supporter.isDeleted) {
      return res.status(404).json({ error: "Supporter not found" });
    }
    if (req.admin.role === "SUPER_ADMIN") {
      return res.status(400).json({ error: "Super admins can remove supporters directly without raising a request." });
    }

    const existingRequest = await SupporterRemovalRequest.findOne({
      supporterId: supporter._id,
      status: "PENDING"
    });
    if (existingRequest) {
      return res.status(409).json({ error: "There is already a pending removal request for this supporter." });
    }

    const removalRequest = await SupporterRemovalRequest.create({
      supporterId: supporter._id,
      supporterName: supporter.fullName,
      supporterEmail: supporter.email,
      requestedByAdminId: String(req.admin.id),
      requestedByName: String(req.admin.name || ""),
      requestedByEmail: String(req.admin.email || "").toLowerCase(),
      reason: String(req.body.reason || "").trim()
    });

    await recordAdminActivity(req.admin, {
      actionType: "SUPPORTER_REMOVAL_REQUESTED",
      summary: `Requested supporter removal for ${supporter.fullName}.`,
      targetType: "SUPPORTER",
      targetId: String(supporter._id),
      targetLabel: supporter.email,
      metadata: {
        removalRequestId: String(removalRequest._id),
        reason: removalRequest.reason || ""
      }
    });

    res.status(201).json(serializeRemovalRequest(removalRequest));
  } catch (error) {
    next(error);
  }
});

router.get("/supporters/removal-requests", requireAdmin, requireSuperAdmin, async (_req, res, next) => {
  try {
    const requests = await SupporterRemovalRequest.find().sort({ createdAt: -1 });
    res.json(requests.map(serializeRemovalRequest));
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/removal-requests/:requestId/approve", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const request = await SupporterRemovalRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Supporter removal request not found" });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending removal requests can be approved." });
    }

    const supporter = await SupporterUser.findById(request.supporterId);
    if (!supporter) {
      return res.status(404).json({ error: "The requested supporter record no longer exists." });
    }
    if (supporter.isDeleted) {
      return res.status(400).json({ error: "That supporter has already been removed." });
    }

    await softDeleteSupporter(supporter, req.admin, request.reason);
    request.status = "APPROVED";
    request.reviewedByAdminId = String(req.admin.id);
    request.reviewedByName = String(req.admin.name || "");
    request.reviewedByEmail = String(req.admin.email || "").toLowerCase();
    request.reviewedAt = new Date();
    await request.save();

    await recordAdminActivity(req.admin, {
      actionType: "SUPPORTER_REMOVAL_APPROVED",
      summary: `Approved supporter removal for ${supporter.fullName}.`,
      targetType: "SUPPORTER",
      targetId: String(supporter._id),
      targetLabel: supporter.email,
      metadata: {
        removalRequestId: String(request._id)
      }
    });

    res.json({
      request: serializeRemovalRequest(request),
      supporter: serializeSupporter(supporter)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/removal-requests/:requestId/deny", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const request = await SupporterRemovalRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Supporter removal request not found" });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending removal requests can be denied." });
    }

    request.status = "DENIED";
    request.reviewedByAdminId = String(req.admin.id);
    request.reviewedByName = String(req.admin.name || "");
    request.reviewedByEmail = String(req.admin.email || "").toLowerCase();
    request.reviewedAt = new Date();
    await request.save();

    await recordAdminActivity(req.admin, {
      actionType: "SUPPORTER_REMOVAL_DENIED",
      summary: `Denied supporter removal request for ${request.supporterName}.`,
      targetType: "SUPPORTER_REQUEST",
      targetId: String(request._id),
      targetLabel: request.supporterEmail
    });

    res.json(serializeRemovalRequest(request));
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/:supporterId/remove", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const supporter = await SupporterUser.findById(req.params.supporterId, { passwordHash: 0 });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter not found" });
    }
    if (supporter.isDeleted) {
      return res.status(400).json({ error: "This supporter has already been removed." });
    }

    await softDeleteSupporter(supporter, req.admin, String(req.body.reason || "").trim());

    await SupporterRemovalRequest.updateMany(
      { supporterId: supporter._id, status: "PENDING" },
      {
        $set: {
          status: "APPROVED",
          reviewedByAdminId: String(req.admin.id),
          reviewedByName: String(req.admin.name || ""),
          reviewedByEmail: String(req.admin.email || "").toLowerCase(),
          reviewedAt: new Date()
        }
      }
    );

    await recordAdminActivity(req.admin, {
      actionType: "SUPPORTER_REMOVED",
      summary: `Removed supporter ${supporter.fullName} from the active directory.`,
      targetType: "SUPPORTER",
      targetId: String(supporter._id),
      targetLabel: supporter.email,
      metadata: {
        reason: supporter.deletionReason || ""
      }
    });

    res.json({
      supporter: serializeSupporter(supporter)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/supporters/:supporterId/restore", requireAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const supporter = await SupporterUser.findById(req.params.supporterId, { passwordHash: 0 });
    if (!supporter) {
      return res.status(404).json({ error: "Supporter not found" });
    }
    if (!supporter.isDeleted) {
      return res.status(400).json({ error: "This supporter is already active." });
    }

    await restoreSupporterRecord(supporter, req.admin);

    await recordAdminActivity(req.admin, {
      actionType: "SUPPORTER_RESTORED",
      summary: `Restored supporter ${supporter.fullName} back into the active directory.`,
      targetType: "SUPPORTER",
      targetId: String(supporter._id),
      targetLabel: supporter.email
    });

    res.json({
      supporter: serializeSupporter(supporter)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/activity", requireAdmin, requireSuperAdmin, async (_req, res, next) => {
  try {
    const logs = await AdminActivityLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(
      logs.map((entry) => ({
        id: entry._id,
        actorType: entry.actorType || "ADMIN",
        actorId: entry.actorId || entry.actorAdminId || "",
        actorAdminId: entry.actorAdminId || "",
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        actionType: entry.actionType,
        summary: entry.summary,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetLabel: entry.targetLabel,
        metadata: entry.metadata || {},
        createdAt: entry.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
