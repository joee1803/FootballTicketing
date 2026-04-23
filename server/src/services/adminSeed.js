const AdminUser = require("../models/AdminUser");
const { hashPassword } = require("./auth");

async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "superadmin@club.local").toLowerCase();
  const existing = await AdminUser.findOne({ email });
  if (existing) {
    if (!existing.isPrimarySuperAdmin) {
      existing.isPrimarySuperAdmin = true;
      existing.role = "SUPER_ADMIN";
      await existing.save();
    }
    return existing;
  }

  const password = process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!";
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
