const { verifyAdminToken } = require("../services/auth");

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

function requireAdmin(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Admin authentication required" });
    }

    req.admin = verifyAdminToken(token);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired admin token" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: "Admin authentication required" });
  }

  if (req.admin.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super admin access required" });
  }

  return next();
}

module.exports = {
  requireAdmin,
  requireSuperAdmin
};
