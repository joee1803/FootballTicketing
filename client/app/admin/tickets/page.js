"use client";

import { useEffect, useMemo, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { AdminWorkspace } from "../../../components/AdminWorkspace";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LauncherDetailFlow } from "../../../components/LauncherDetailFlow";
import { SectionCard } from "../../../components/SectionCard";
import { apiFetch } from "../../../lib/api";
import { formatFixtureLabel } from "../../../lib/fixtures";
import { formatPounds } from "../../../lib/pricing";
import { useAdminSession } from "../../../lib/useAdminSession";
import { useToast } from "../../../components/ToastProvider";

export default function AdminTicketsPage() {
  const { ready, session, signOut } = useAdminSession();
  const { pushToast } = useToast();
  const [supporters, setSupporters] = useState([]);
  const [matches, setMatches] = useState([]);
  const [mintSupporterId, setMintSupporterId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [revokeSupporterId, setRevokeSupporterId] = useState("");
  const [selectedSupporterTickets, setSelectedSupporterTickets] = useState([]);
  const [activeView, setActiveView] = useState("");
  const [mintConfirmOpen, setMintConfirmOpen] = useState(false);
  const [mintBusy, setMintBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let ignore = false;

    async function loadTicketTools() {
      const [nextSupporters, nextMatches] = await Promise.all([
        apiFetch("/api/auth/supporters", { token: session.token }),
        apiFetch("/api/matches")
      ]);

      if (!ignore) {
        setSupporters(nextSupporters.supporters);
        setMatches(nextMatches);
      }
    }

    loadTicketTools();
    return () => {
      ignore = true;
    };
  }, [session]);

  useEffect(() => {
    if (!revokeSupporterId || !session?.token) {
      setSelectedSupporterTickets([]);
      return;
    }

    let ignore = false;

    async function loadSupporterTickets() {
      try {
        const result = await apiFetch(`/api/tickets/supporter/${revokeSupporterId}`, {
          token: session.token
        });
        if (!ignore) {
          setSelectedSupporterTickets(result);
        }
      } catch (error) {
        if (!ignore) {
          pushToast(error.message, "error");
        }
      }
    }

    loadSupporterTickets();
    return () => {
      ignore = true;
    };
  }, [pushToast, revokeSupporterId, session]);

  const mintSupporter = useMemo(
    () => supporters.find((supporter) => String(supporter.id || supporter._id) === mintSupporterId) || null,
    [mintSupporterId, supporters]
  );
  const selectedMatch = useMemo(
    () => matches.find((match) => String(match.matchId) === String(selectedMatchId)) || null,
    [matches, selectedMatchId]
  );
  const revokeSupporter = useMemo(
    () => supporters.find((supporter) => String(supporter.id || supporter._id) === revokeSupporterId) || null,
    [revokeSupporterId, supporters]
  );

  function requestMintTicket(event) {
    event.preventDefault();
    if (!mintSupporterId || !selectedMatchId) {
      pushToast("Select both a supporter and a fixture before minting a ticket.", "error");
      return;
    }

    setMintConfirmOpen(true);
  }

  async function confirmMintTicket() {
    try {
      setMintBusy(true);
      const created = await apiFetch("/api/tickets", {
        method: "POST",
        token: session.token,
        body: JSON.stringify({
          supporterId: mintSupporterId,
          matchId: Number(selectedMatchId)
        })
      });

      pushToast(`Ticket ${created.ticketId} minted for ${mintSupporter?.fullName || "the selected supporter"}.`, "info");
      setMintConfirmOpen(false);
      setMintSupporterId("");
      setSelectedMatchId("");

      if (revokeSupporterId === mintSupporterId) {
        setSelectedSupporterTickets(await apiFetch(`/api/tickets/supporter/${revokeSupporterId}`, { token: session.token }));
      }
    } catch (error) {
      setMintConfirmOpen(false);
      pushToast(error.message, "error");
    } finally {
      setMintBusy(false);
    }
  }

  async function confirmRevokeTicket() {
    if (!revokeTarget) {
      return;
    }

    try {
      setRevokeBusy(true);
      const result = await apiFetch(`/api/tickets/${revokeTarget.ticketId}/revoke`, {
        method: "POST",
        token: session.token
      });

      pushToast(`Ticket ${result.ticketId} revoked.`, "info");
      setRevokeTarget(null);
      if (revokeSupporterId) {
        setSelectedSupporterTickets(await apiFetch(`/api/tickets/supporter/${revokeSupporterId}`, { token: session.token }));
      }
    } catch (error) {
      setRevokeTarget(null);
      pushToast(error.message, "error");
    } finally {
      setRevokeBusy(false);
    }
  }

  const ticketWorkflowCards = [
    {
      id: "mint-ticket",
      eyebrow: "Issue",
      title: "Mint Ticket",
      description: "Select a supporter and fixture, then issue a valid match ticket.",
      meta: `${supporters.length} supporter${supporters.length === 1 ? "" : "s"} available`
    },
    {
      id: "revoke-ticket",
      eyebrow: "Invalidate",
      title: "Revoke Ticket",
      description: "Choose a supporter, review their tickets, and revoke only the selected ticket.",
      meta: `${selectedSupporterTickets.length} selected ticket${selectedSupporterTickets.length === 1 ? "" : "s"}`
    }
  ];

  function renderTicketWorkflow(view) {
    if (view === "mint-ticket") {
      return (
        <SectionCard title="Mint Ticket" description="Choose the supporter and fixture. The wallet, transfer limit, and seat are assigned automatically.">
          <form className="form" onSubmit={requestMintTicket}>
            <select value={mintSupporterId} onChange={(event) => setMintSupporterId(event.target.value)}>
              <option value="">Select supporter</option>
              {supporters.map((supporter) => (
                <option key={supporter.id || supporter._id} value={supporter.id || supporter._id}>
                  {supporter.fullName}
                </option>
              ))}
            </select>
            <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)}>
              <option value="">Select fixture</option>
              {matches.map((match) => (
                <option key={match.matchId} value={match.matchId}>
                  {formatFixtureLabel(match)} - {new Date(match.matchDate).toLocaleString()}
                </option>
              ))}
            </select>
            <div className="detailGrid">
              <article className="miniCard fixtureMiniCard">
                <span>Supporter</span>
                <strong>{mintSupporter?.fullName || "No supporter selected"}</strong>
              </article>
              <article className="miniCard fixtureMiniCard detailSpanTwo">
                <span>Supporter summary</span>
                <strong>{mintSupporter?.favouriteClub || "No favourite club recorded"}</strong>
                <span>
                  Current balance: {mintSupporter ? formatPounds(mintSupporter.creditBalance || 0) : "Choose a supporter to load the account summary."}
                </span>
              </article>
              <article className="miniCard fixtureMiniCard detailSpanTwo">
                <span>Fixture</span>
                <strong>{selectedMatch ? formatFixtureLabel(selectedMatch) : "No fixture selected"}</strong>
                <span>{selectedMatch?.stadium || "Select a fixture to load its details."}</span>
              </article>
              <article className="miniCard fixtureMiniCard">
                <span>Transfer limit</span>
                <strong>1 transfer</strong>
              </article>
              <article className="miniCard fixtureMiniCard">
                <span>Seat assignment</span>
                <strong>Generated on mint</strong>
              </article>
              <article className="miniCard fixtureMiniCard">
                <span>Fixture price</span>
                <strong>{selectedMatch ? formatPounds(selectedMatch.ticketPriceCredits) : "Select a fixture"}</strong>
              </article>
            </div>
            <button type="submit">Mint ticket</button>
          </form>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="Revoke Ticket" description="Pick a supporter, review their tickets, and invalidate the selected ticket from the live list.">
        <div className="form">
          <select value={revokeSupporterId} onChange={(event) => setRevokeSupporterId(event.target.value)}>
            <option value="">Select supporter to review tickets</option>
            {supporters.map((supporter) => (
              <option key={supporter.id || supporter._id} value={supporter.id || supporter._id}>
                {supporter.fullName}
              </option>
            ))}
          </select>
        </div>

        {revokeSupporter ? (
          <div className="miniCard supporterCard">
            <span>Selected supporter</span>
            <strong>{revokeSupporter.fullName}</strong>
            <span>{selectedSupporterTickets.length} ticket(s) found.</span>
          </div>
        ) : null}

        <div className="listStack">
          {selectedSupporterTickets.map((ticket) => (
            <article className="miniCard ownedTicketCard" key={ticket.ticketId}>
              <p className="fixtureLabel">Ticket #{ticket.ticketId}</p>
              <strong>{formatFixtureLabel(ticket.match)}</strong>
              <span>{ticket.match?.matchDate ? new Date(ticket.match.matchDate).toLocaleString() : `Match ID ${ticket.matchId}`}</span>
              <span>Seat: {ticket.seatNumber}</span>
              <span>Status: {ticket.status}</span>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={ticket.status !== "Valid"}
                  onClick={() => setRevokeTarget(ticket)}
                >
                  {ticket.status === "Valid" ? "Revoke ticket" : "Already inactive"}
                </button>
              </div>
            </article>
          ))}
          {revokeSupporterId && !selectedSupporterTickets.length ? (
            <article className="miniCard">
              <strong>No active tickets found for this supporter yet.</strong>
            </article>
          ) : null}
        </div>
      </SectionCard>
    );
  }

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Admin Tickets" title="Loading ticket tools" message="Preparing ticket issue and revocation tools." />;
  }

  return (
    <AdminWorkspace
      session={session}
      title="Tickets"
      description="Issue and revoke tickets by choosing real supporters and fixtures from the live dataset instead of remembering IDs."
      onSignOut={signOut}
    >
      <LauncherDetailFlow
        activeView={activeView}
        cards={ticketWorkflowCards}
        title="Ticket workflow"
        description="Choose one ticket operation. Each tool opens in a focused workspace with the required supporter and fixture data."
        onSelect={setActiveView}
        onBack={() => setActiveView("")}
        renderDetail={renderTicketWorkflow}
      />

      <ConfirmDialog
        open={mintConfirmOpen}
        eyebrow="Mint ticket"
        title="Confirm ticket mint"
        message={
          mintSupporter && selectedMatch
            ? `Are you sure you want to mint a general ticket for ${mintSupporter.fullName} for ${formatFixtureLabel(selectedMatch)}?`
            : ""
        }
        confirmLabel="Yes, mint ticket"
        cancelLabel="No, cancel"
        busy={mintBusy}
        onConfirm={confirmMintTicket}
        onCancel={() => {
          if (mintBusy) {
            return;
          }

          setMintConfirmOpen(false);
          pushToast("Ticket minting cancelled.", "info");
        }}
      >
        <article className="miniCard fixtureMiniCard">
          <span>Kick-off</span>
          <strong>{selectedMatch?.matchDate ? new Date(selectedMatch.matchDate).toLocaleString() : "Not set"}</strong>
        </article>
        <article className="miniCard fixtureMiniCard">
          <span>Venue</span>
          <strong>{selectedMatch?.stadium || "Not set"}</strong>
        </article>
        <article className="miniCard fixtureMiniCard">
          <span>Supporter</span>
          <strong>{mintSupporter?.fullName || "Not set"}</strong>
        </article>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        eyebrow="Revoke ticket"
        title="Confirm ticket revocation"
        message={
          revokeTarget
            ? `Are you sure you want to invalidate ticket ${revokeTarget.ticketId} for ${formatFixtureLabel(revokeTarget.match)}?`
            : ""
        }
        confirmLabel="Yes, revoke ticket"
        cancelLabel="No, keep active"
        busy={revokeBusy}
        onConfirm={confirmRevokeTicket}
        onCancel={() => {
          if (revokeBusy) {
            return;
          }

          setRevokeTarget(null);
          pushToast("Ticket revocation cancelled.", "info");
        }}
      >
        <article className="miniCard ownedTicketCard">
          <span>Supporter</span>
          <strong>{revokeSupporter?.fullName || "Not set"}</strong>
        </article>
        <article className="miniCard ownedTicketCard detailSpanTwo">
          <span>Seat</span>
          <strong>{revokeTarget?.seatNumber || "Not set"}</strong>
        </article>
      </ConfirmDialog>
    </AdminWorkspace>
  );
}
