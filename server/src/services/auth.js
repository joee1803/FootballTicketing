const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET || "local-demo-secret";
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function signAdminToken(admin) {
  return jwt.sign(
    {
      sub: admin._id.toString(),
      role: admin.role,
      email: admin.email,
      name: admin.name
    },
    getJwtSecret(),
    { expiresIn: "8h" }
  );
}

function verifyAdminToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  comparePassword,
  hashPassword,
  signAdminToken,
  verifyAdminToken
};
