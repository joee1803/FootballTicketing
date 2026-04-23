const mongoose = require("mongoose");

const adminActivityLogSchema = new mongoose.Schema(
  {
    actorType: { type: String, required: true, trim: true, default: "ADMIN" },
    actorId: { type: String, required: true, trim: true },
    actorAdminId: { type: String, default: "", trim: true },
    actorName: { type: String, required: true, trim: true },
    actorEmail: { type: String, default: "", trim: true, lowercase: true },
    actorRole: { type: String, required: true, trim: true },
    actionType: { type: String, required: true, trim: true, index: true },
    summary: { type: String, required: true, trim: true },
    targetType: { type: String, default: "", trim: true },
    targetId: { type: String, default: "", trim: true },
    targetLabel: { type: String, default: "", trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminActivityLog", adminActivityLogSchema);
