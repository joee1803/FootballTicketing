"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clearAdminSession, loadAdminSession, saveAdminSession } from "./adminAuth";

export function useAdminSession() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nextSession = loadAdminSession();
    if (!nextSession?.token) {
      router.replace("/admin/sign-in");
      return;
    }

    setSession(nextSession);
    setReady(true);
  }, [router]);

  function signOut() {
    clearAdminSession();
    router.replace("/admin/sign-in");
  }

  function updateSession(nextSession) {
    setSession(nextSession);
    saveAdminSession(nextSession);
  }

  return {
    ready,
    session,
    updateSession,
    signOut
  };
}
