import { clearAdminSession, loadAdminSession, saveAdminSession } from "./adminAuth";
import { clearSupporterProfile, loadSupporterProfile, saveSupporterProfile } from "./supporterProfile";

export function hasAdminSession(session = loadAdminSession()) {
  return Boolean(session?.token);
}

export function hasSupporterSession(profile = loadSupporterProfile()) {
  return Boolean(profile?.walletAddress);
}

export function loadSessionState() {
  const adminSession = loadAdminSession();
  const supporterSession = loadSupporterProfile();

  return {
    adminSession: hasAdminSession(adminSession) ? adminSession : null,
    supporterSession: hasSupporterSession(supporterSession) ? supporterSession : null
  };
}

export function loadActiveSession() {
  const { adminSession, supporterSession } = loadSessionState();

  if (adminSession) {
    return {
      role: "ADMIN",
      dashboardPath: "/admin",
      adminSession,
      supporterSession
    };
  }

  if (supporterSession) {
    return {
      role: "SUPPORTER",
      dashboardPath: "/fan",
      adminSession,
      supporterSession
    };
  }

  return null;
}

export function saveExclusiveAdminSession(session) {
  clearSupporterProfile();
  saveAdminSession(session);
}

export function saveExclusiveSupporterProfile(profile) {
  clearAdminSession();
  saveSupporterProfile(profile);
}
