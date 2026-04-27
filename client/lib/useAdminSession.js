"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "./api";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "./adminAuth";

export function useAdminSession() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const nextSession = loadAdminSession();
    if (!nextSession?.token) {
      router.replace("/admin/sign-in");
      return;
    }

    async function validateSession() {
      try {
        const result = await apiFetch("/api/auth/admin/me", {
          token: nextSession.token
        });
        if (cancelled) {
          return;
        }

        const validatedSession = {
          ...nextSession,
          admin: result.admin || nextSession.admin
        };
        setSession(validatedSession);
        saveAdminSession(validatedSession);
        setReady(true);
      } catch {
        if (!cancelled) {
          clearAdminSession();
          router.replace("/admin/sign-in");
        }
      }
    }

    validateSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = useCallback(() => {
    clearAdminSession();
    router.replace("/admin/sign-in");
  }, [router]);

  const updateSession = useCallback((nextSession) => {
    setSession(nextSession);
    saveAdminSession(nextSession);
  }, []);

  return {
    ready,
    session,
    updateSession,
    signOut
  };
}
