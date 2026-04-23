"use client";

import { useEffect, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { AdminWorkspace } from "../../../components/AdminWorkspace";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LauncherDetailFlow } from "../../../components/LauncherDetailFlow";
import { SectionCard } from "../../../components/SectionCard";
import { StatusPill } from "../../../components/StatusPill";
import { apiFetch } from "../../../lib/api";
import { useAdminSession } from "../../../lib/useAdminSession";
import { useToast } from "../../../components/ToastProvider";

export default function AdminVerificationPage() {
  const { ready, session, signOut } = useAdminSession();
  const { pushToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [requestPage, setRequestPage] = useState(0);
  const [activeView, setActiveView] = useState("");
  const [latestResult, setLatestResult] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const requestsPerPage = 6;

  async function loadRequests() {
    const result = await apiFetch("/api/verification/requests", { token: session.token });
    setRequests(result);
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let ignore = false;

    async function loadVerificationRequests() {
      const result = await apiFetch("/api/verification/requests", { token: session.token });
      if (!ignore) {
        setRequests(result);
      }
    }

    loadVerificationRequests();
    return () => {
      ignore = true;
    };
  }, [session]);

  async function commitCheckInRequest() {
    if (!confirmRequest) {
      return;
    }

    try {
      setActionBusy(true);
      const result = await apiFetch(`/api/verification/requests/${confirmRequest.id}/check-in`, {
        method: "POST",
        token: session.token
      });

      setLatestResult(result);
      await loadRequests();
      setConfirmRequest(null);

      if (result.valid) {
        pushToast(`Check-in completed for ticket ${result.request.ticketId}.`, "info");
      } else {
        pushToast(`Check-in request rejected. ${result.request.resultNote}`, "error");
      }
    } catch (error) {
      setConfirmRequest(null);
      pushToast(error.message, "error");
    } finally {
      setActionBusy(false);
    }
  }

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Admin Verification" title="Loading verification tools" message="Pulling the supporter check-in queue and latest verification activity into place." />;
  }

  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  const processedRequests = requests.filter((request) => request.status !== "PENDING").slice(0, 6);
  const visiblePendingRequests = pendingRequests.slice(requestPage * requestsPerPage, requestPage * requestsPerPage + requestsPerPage);
  const totalPendingPages = Math.max(1, Math.ceil(pendingRequests.length / requestsPerPage));
  const verificationCards = [
    {
      id: "check-in-queue",
      eyebrow: "Queue",
      title: "Check-in Requests",
      description: "Review supporter check-in requests in six-item batches.",
      meta: `${pendingRequests.length} pending request${pendingRequests.length === 1 ? "" : "s"}`
    },
    {
      id: "verification-history",
      eyebrow: "History",
      title: "Verification History",
      description: "Review the latest processed requests and the most recent admin decision.",
      meta: `${processedRequests.length} recent record${processedRequests.length === 1 ? "" : "s"}`
    }
  ];

  function renderVerificationView(view) {
    if (view === "verification-history") {
      return (
        <section className="gridTwo dashboardSectionGrid">
          <SectionCard
            title="Latest Verification Result"
            description="The most recent admin decision stays visible here so the outcome is easy to confirm."
          >
            {latestResult ? (
              <div className="detailGrid">
                <article className="miniCard ownedTicketCard">
                  <span>Outcome</span>
                  <StatusPill status={latestResult.valid ? "Checked in" : "Rejected"} valid={latestResult.valid} />
                </article>
                <article className="miniCard ownedTicketCard detailSpanTwo">
                  <span>Fixture</span>
                  <strong>{latestResult.request?.fixtureLabel || `Match ${latestResult.matchId}`}</strong>
                </article>
                <article className="miniCard ownedTicketCard">
                  <span>Ticket</span>
                  <strong>#{latestResult.request?.ticketId}</strong>
                </article>
                <article className="miniCard ownedTicketCard">
                  <span>Status</span>
                  <strong>{latestResult.status}</strong>
                </article>
                {latestResult.txHash ? (
                  <article className="miniCard ownedTicketCard detailSpanTwo">
                    <span>Transaction hash</span>
                    <strong className="wallet">{latestResult.txHash}</strong>
                  </article>
                ) : null}
                {latestResult.request?.resultNote ? (
                  <article className="miniCard ownedTicketCard detailSpanTwo">
                    <span>Admin note</span>
                    <strong>{latestResult.request.resultNote}</strong>
                  </article>
                ) : null}
              </div>
            ) : (
              <article className="miniCard ownedTicketCard">
                <strong>No verification action taken yet.</strong>
                <span>The next processed request will be summarised here.</span>
              </article>
            )}
          </SectionCard>

          <SectionCard
            title="Recently Processed"
            description="A short history of the latest requests accepted or rejected by the admin team."
          >
            <div className="listStack">
              {processedRequests.map((request) => (
                <article className="miniCard ownedTicketCard" key={request.id}>
                  <p className="fixtureLabel">{request.status.replaceAll("_", " ")}</p>
                  <strong>{request.supporterName}</strong>
                  <span>{request.fixtureLabel || `Match ${request.matchId}`}</span>
                  <span>Ticket #{request.ticketId}</span>
                  <span>{request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "Awaiting review"}</span>
                  {request.txHash ? <span className="wallet">Tx: {request.txHash}</span> : null}
                </article>
              ))}

              {!processedRequests.length ? (
                <article className="miniCard ownedTicketCard">
                  <strong>No processed requests yet.</strong>
                  <span>Accepted and rejected check-ins will appear here after the first admin decision.</span>
                </article>
              ) : null}
            </div>
          </SectionCard>
        </section>
      );
    }

    return (
      <SectionCard
        title="Matchday Verification"
        description="Review supporter check-in requests in batches instead of manually typing ticket details."
      >
        <div className="listStack">
          {visiblePendingRequests.map((request) => (
            <article className="miniCard supporterCard" key={request.id}>
              <p className="fixtureLabel">Pending check-in request</p>
              <strong>{request.supporterName}</strong>
              <span>{request.fixtureLabel || `Match ${request.matchId}`}</span>
              <span>Ticket #{request.ticketId}</span>
              <span className="wallet">Wallet: {request.ownerAddress}</span>
              <span>Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : "N/A"}</span>
              {request.requestNote ? <span>Supporter note: {request.requestNote}</span> : null}
              <div className="actions">
                <button type="button" onClick={() => setConfirmRequest(request)}>
                  Verify and check in
                </button>
              </div>
            </article>
          ))}

          {!pendingRequests.length ? (
            <article className="miniCard supporterCard">
              <strong>No pending check-in requests.</strong>
              <span>Supporter requests will appear here as soon as they are submitted from a ticket detail page.</span>
            </article>
          ) : null}
        </div>

        {pendingRequests.length ? (
          <div className="pagerBar">
            <span className="feedback">
              Batch {requestPage + 1} of {totalPendingPages}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={requestPage === 0} onClick={() => setRequestPage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={requestPage >= totalPendingPages - 1} onClick={() => setRequestPage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    );
  }

  return (
    <AdminWorkspace
      session={session}
      title="Verification"
      description="Supporters now send check-in requests first, and the admin team reviews and processes those requests from one queue."
      onSignOut={signOut}
    >
      <LauncherDetailFlow
        activeView={activeView}
        cards={verificationCards}
        title="Verification workflow"
        description="Open one verification task at a time: process pending check-ins or review recent decisions."
        onSelect={setActiveView}
        onBack={() => setActiveView("")}
        renderDetail={renderVerificationView}
      />

      <ConfirmDialog
        open={Boolean(confirmRequest)}
        eyebrow="Verify request"
        title="Confirm supporter check-in"
        message={
          confirmRequest
            ? `Are you sure you want to verify and check in ticket ${confirmRequest.ticketId} for ${confirmRequest.supporterName}?`
            : ""
        }
        confirmLabel="Yes, verify and check in"
        cancelLabel="No, cancel"
        busy={actionBusy}
        onConfirm={commitCheckInRequest}
        onCancel={() => {
          if (actionBusy) {
            return;
          }

          setConfirmRequest(null);
          pushToast("Verification action cancelled.", "info");
        }}
      >
        {confirmRequest ? (
          <>
            <article className="miniCard fixtureMiniCard">
              <span>Supporter</span>
              <strong>{confirmRequest.supporterName}</strong>
            </article>
            <article className="miniCard fixtureMiniCard">
              <span>Ticket</span>
              <strong>#{confirmRequest.ticketId}</strong>
            </article>
            <article className="miniCard fixtureMiniCard detailSpanTwo">
              <span>Fixture</span>
              <strong>{confirmRequest.fixtureLabel || `Match ${confirmRequest.matchId}`}</strong>
            </article>
            <article className="miniCard fixtureMiniCard detailSpanTwo">
              <span>Wallet</span>
              <strong className="wallet">{confirmRequest.ownerAddress}</strong>
            </article>
          </>
        ) : null}
      </ConfirmDialog>
    </AdminWorkspace>
  );
}
