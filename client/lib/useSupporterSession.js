"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clearSupporterProfile, loadSupporterProfile, saveSupporterProfile } from "./supporterProfile";

export function useSupporterSession() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nextProfile = loadSupporterProfile();
    if (!nextProfile?.walletAddress) {
      router.replace("/");
      return;
    }

    setProfile(nextProfile);
    setReady(true);
  }, [router]);

  const signOut = useCallback(() => {
    clearSupporterProfile();
    router.replace("/");
  }, [router]);

  const updateProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    saveSupporterProfile(nextProfile);
  }, []);

  return {
    ready,
    profile,
    updateProfile,
    signOut
  };
}
