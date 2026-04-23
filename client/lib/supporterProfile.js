import { apiFetch } from "./api";

const ACTIVE_KEY = "football-ticket-active-supporter-profile";
const SESSION_EVENT = "football-ticket-session-change";

function emitSessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveSupporterProfile(profile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(profile));
  emitSessionChange();
}

export async function registerSupporterProfile(profile) {
  const supporter = await apiFetch("/api/auth/supporters/register", {
    method: "POST",
    body: JSON.stringify(profile)
  });

  saveSupporterProfile(supporter);
  return supporter;
}

export async function signInSupporterProfile({ identifier, password }) {
  const supporter = await apiFetch("/api/auth/supporters/sign-in", {
    method: "POST",
    body: JSON.stringify({
      identifier,
      password
    })
  });

  saveSupporterProfile(supporter);
  return supporter;
}

export function loadSupporterProfile() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSupporterProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_KEY);
  emitSessionChange();
}
