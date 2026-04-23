const AdminActivityLog = require("../models/AdminActivityLog");

async function recordActivity(actor = {}, activity = {}) {
  const actorId = String(actor.id || actor._id || actor.actorId || actor.walletAddress || "").trim();
  const actorName = String(
    actor.name ||
      actor.fullName ||
      actor.actorName ||
      actor.email ||
      actor.walletAddress ||
      ""
  ).trim();
  const actorEmail = String(actor.email || actor.actorEmail || "").toLowerCase().trim();
  const actorType = String(actor.type || actor.actorType || "SYSTEM").trim().toUpperCase();
  const actorRole = String(actor.role || actor.actorRole || actorType).trim().toUpperCase();

  if (!actorId || !actorName) {
    return null;
  }

  return AdminActivityLog.create({
    actorType,
    actorId,
    actorAdminId: actorType === "ADMIN" ? actorId : "",
    actorName,
    actorEmail,
    actorRole,
    actionType: String(activity.actionType || "SYSTEM_ACTION"),
    summary: String(activity.summary || "Activity recorded."),
    targetType: String(activity.targetType || ""),
    targetId: String(activity.targetId || ""),
    targetLabel: String(activity.targetLabel || ""),
    metadata: activity.metadata || {}
  });
}

async function recordAdminActivity(admin, activity = {}) {
  if (!admin?.id || !admin?.email) {
    return null;
  }

  return recordActivity({
    type: "ADMIN",
    id: admin.id,
    name: admin.name || admin.email || "Admin",
    email: admin.email,
    role: admin.role || "ADMIN"
  }, {
    actionType: String(activity.actionType || "ADMIN_ACTION"),
    summary: String(activity.summary || "Admin activity recorded."),
    targetType: String(activity.targetType || ""),
    targetId: String(activity.targetId || ""),
    targetLabel: String(activity.targetLabel || ""),
    metadata: activity.metadata || {}
  });
}

async function recordSupporterActivity(supporter, activity = {}) {
  const supporterId = String(supporter?.id || supporter?._id || supporter?.walletAddress || "").trim();
  if (!supporterId) {
    return null;
  }

  const supporterName = String(
    supporter?.fullName ||
      `${String(supporter?.firstName || "").trim()} ${String(supporter?.lastName || "").trim()}`.trim() ||
      supporter?.email ||
      "Supporter"
  ).trim();

  return recordActivity({
    type: "SUPPORTER",
    id: supporterId,
    name: supporterName,
    email: supporter?.email || "",
    role: "SUPPORTER"
  }, {
    actionType: String(activity.actionType || "SUPPORTER_ACTION"),
    summary: String(activity.summary || "Supporter activity recorded."),
    targetType: String(activity.targetType || ""),
    targetId: String(activity.targetId || ""),
    targetLabel: String(activity.targetLabel || ""),
    metadata: activity.metadata || {}
  });
}

module.exports = {
  recordActivity,
  recordAdminActivity,
  recordSupporterActivity
};
