"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "./api";
import { clearSupporterProfile, loadSupporterProfile, saveSupporterProfile } from "./supporterProfile";

export function useSupporterSession() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const nextProfile = loadSupporterProfile();
    if (!nextProfile?.walletAddress) {
      router.replace("/");
      return;
    }

    async function validateProfile() {
      try {
        const supporter = await apiFetch(`/api/auth/supporters/by-wallet/${encodeURIComponent(nextProfile.walletAddress)}`);
        if (cancelled) {
          return;
        }

        setProfile(supporter);
        saveSupporterProfile(supporter);
        setReady(true);
      } catch {
        if (!cancelled) {
          clearSupporterProfile();
          router.replace("/");
        }
      }
    }

    validateProfile();
    return () => {
      cancelled = true;
    };
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
