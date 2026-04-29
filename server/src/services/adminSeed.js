const AdminUser = require("../models/AdminUser");
const { comparePassword, hashPassword } = require("./auth");

async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "superadmin@club.local").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!";
  const existing = await AdminUser.findOne({ email });
  if (existing) {
    const passwordMatches = await comparePassword(password, existing.passwordHash);
    if (!existing.isPrimarySuperAdmin) {
      existing.isPrimarySuperAdmin = true;
      existing.role = "SUPER_ADMIN";
    }
    if (existing.isDeleted) {
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.deletionReason = "";
    }
    if (!passwordMatches) {
      existing.passwordHash = await hashPassword(password);
    }
    await existing.save();
    return existing;
  }

  const passwordHash = await hashPassword(password);

  return AdminUser.create({
    name: process.env.SUPER_ADMIN_NAME || "System Super Admin",
    email,
    passwordHash,
    role: "SUPER_ADMIN",
    isPrimarySuperAdmin: true
  });
}

module.exports = {
  seedSuperAdmin
};
