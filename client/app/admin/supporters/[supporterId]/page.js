"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { loadAdminSession } from "../../../../lib/adminAuth";
import { apiFetch } from "../../../../lib/api";
import { SectionCard } from "../../../../components/SectionCard";

export default function SupporterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [supporter, setSupporter] = useState(null);
  const [visibility, setVisibility] = useState("LIMITED");
  const [message, setMessage] = useState("Loading supporter details...");

  useEffect(() => {
    const nextSession = loadAdminSession();
    if (!nextSession?.token) {
      router.replace("/admin/sign-in");
      return;
    }

    setSession(nextSession);
  }, [router]);

  useEffect(() => {
    if (!session?.token || !params?.supporterId) {
      return;
    }

    let ignore = false;

    async function loadSupporter() {
      try {
        const result = await apiFetch(`/api/auth/supporters/${params.supporterId}`, {
          token: session.token
        });

        if (!ignore) {
          setSupporter(result.supporter);
          setVisibility(result.visibility);
          setMessage("Supporter details loaded.");
        }
      } catch (error) {
        if (!ignore) {
          setMessage(error.message);
        }
      }
    }

    loadSupporter();
    return () => {
      ignore = true;
    };
  }, [params?.supporterId, session]);

  return (
    <main className="shell stack">
      <header className="pageHeader">
        <p className="eyebrow">Supporter Detail</p>
        <h1>{supporter?.fullName || "Supporter record"}</h1>
        <p className="lede">
          {visibility === "FULL"
            ? "Super admin detail view with the full supporter record."
            : "Admin-safe supporter detail view with non-sensitive information only."}
        </p>
        <Link className="textLink" href="/admin">
          Back to admin dashboard
        </Link>
      </header>

      <SectionCard
        title="Supporter Record"
        description="Expanded detail view for the selected supporter."
      >
        <div className="detailGrid">
          <article className="miniCard supporterCard">
            <span>Full name</span>
            <strong>{supporter?.fullName || "N/A"}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Favourite club</span>
            <strong>{supporter?.favouriteClub || "Not set"}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Joined</span>
            <strong>{supporter?.createdAt ? new Date(supporter.createdAt).toLocaleString() : "N/A"}</strong>
          </article>
          {visibility === "FULL" ? (
            <article className="miniCard supporterCard">
              <span>Assigned email</span>
              <strong>{supporter?.email || "N/A"}</strong>
            </article>
          ) : null}
          {visibility === "FULL" ? (
            <article className="miniCard supporterCard detailSpanTwo">
              <span>MetaMask wallet</span>
              <strong className="wallet">{supporter?.walletAddress || "N/A"}</strong>
            </article>
          ) : null}
        </div>
      </SectionCard>

      <p className="feedback">{message}</p>
    </main>
  );
}
