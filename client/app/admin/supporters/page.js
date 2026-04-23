"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { AdminWorkspace } from "../../../components/AdminWorkspace";
import { SectionCard } from "../../../components/SectionCard";
import { apiFetch } from "../../../lib/api";
import { useAdminSession } from "../../../lib/useAdminSession";

export default function AdminSupportersPage() {
  const { ready, session, signOut } = useAdminSession();
  const [supporters, setSupporters] = useState([]);
  const [removedSupporters, setRemovedSupporters] = useState([]);
  const [supporterVisibility, setSupporterVisibility] = useState("LIMITED");
  const [supporterPage, setSupporterPage] = useState(0);
  const [removedSupporterPage, setRemovedSupporterPage] = useState(0);
  const supporterBatchSize = 6;

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let ignore = false;

    async function loadSupporters() {
      const result = await apiFetch(
        session.admin.role === "SUPER_ADMIN"
          ? "/api/auth/supporters?includeDeleted=true"
          : "/api/auth/supporters",
        { token: session.token }
      );
      if (!ignore) {
        const allSupporters = result.supporters || [];
        setSupporters(allSupporters.filter((supporter) => !supporter.isDeleted));
        setRemovedSupporters(allSupporters.filter((supporter) => supporter.isDeleted));
        setSupporterVisibility(result.visibility);
      }
    }

    loadSupporters();
    return () => {
      ignore = true;
    };
  }, [session]);

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Admin Supporters" title="Loading supporters" message="Preparing the supporter directory and detail shortcuts for admin review." />;
  }

  const visibleSupporters = supporters.slice(supporterPage * supporterBatchSize, supporterPage * supporterBatchSize + supporterBatchSize);
  const totalSupporterPages = Math.max(1, Math.ceil(supporters.length / supporterBatchSize));
  const visibleRemovedSupporters = removedSupporters.slice(
    removedSupporterPage * supporterBatchSize,
    removedSupporterPage * supporterBatchSize + supporterBatchSize
  );
  const totalRemovedSupporterPages = Math.max(1, Math.ceil(removedSupporters.length / supporterBatchSize));

  return (
    <AdminWorkspace
      session={session}
      title="Supporters"
      description="Browse supporters in smaller batches and open full records only when you actually need the detail."
      onSignOut={signOut}
    >
      <SectionCard
        title="Supporter Directory"
        description={
          supporterVisibility === "FULL"
            ? "Names first for a cleaner directory, then full detail pages when you drill into a supporter record."
            : "Names first for a lighter admin view, then open each supporter for the permitted detail."
        }
      >
        <div className="listStack">
          {visibleSupporters.map((supporter) => (
            <article className="miniCard supporterCard" key={supporter.id || supporter._id}>
              <p className="fixtureLabel">Supporter record</p>
              <strong>{supporter.fullName}</strong>
              <Link className="textLink" href={`/admin/supporters/${supporter.id || supporter._id}`}>
                View supporter details
              </Link>
            </article>
          ))}
        </div>
        {supporters.length ? (
          <div className="pagerBar">
            <span className="feedback">
              Batch {supporterPage + 1} of {totalSupporterPages}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={supporterPage === 0} onClick={() => setSupporterPage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={supporterPage >= totalSupporterPages - 1} onClick={() => setSupporterPage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      {supporterVisibility === "FULL" ? (
        <SectionCard
          title="Removed Supporters"
          description="Removed supporters stay compact here too, with the full record opening only when you need to inspect or restore it."
        >
          <div className="listStack">
            {visibleRemovedSupporters.map((supporter) => (
              <article className="miniCard supporterCard" key={supporter.id || supporter._id}>
                <p className="fixtureLabel">Removed supporter</p>
                <strong>{supporter.fullName}</strong>
                <Link className="textLink" href={`/admin/supporters/${supporter.id || supporter._id}`}>
                  View and restore supporter
                </Link>
              </article>
            ))}
            {!removedSupporters.length ? (
              <article className="miniCard supporterCard">
                <strong>No removed supporters.</strong>
              </article>
            ) : null}
          </div>
          {removedSupporters.length ? (
            <div className="pagerBar">
              <span className="feedback">
                Batch {removedSupporterPage + 1} of {totalRemovedSupporterPages}
              </span>
              <div className="pagerActions">
                <button type="button" className="ghostButton" disabled={removedSupporterPage === 0} onClick={() => setRemovedSupporterPage((current) => current - 1)}>
                  Previous batch
                </button>
                <button type="button" disabled={removedSupporterPage >= totalRemovedSupporterPages - 1} onClick={() => setRemovedSupporterPage((current) => current + 1)}>
                  Next batch
                </button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </AdminWorkspace>
  );
}
