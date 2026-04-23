"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { SectionCard } from "../../../components/SectionCard";
import { SupporterWorkspace } from "../../../components/SupporterWorkspace";
import { useToast } from "../../../components/ToastProvider";
import { apiFetch } from "../../../lib/api";
import { formatFixtureLabel } from "../../../lib/fixtures";
import { usePagedList } from "../../../lib/usePagedList";
import { useSupporterSession } from "../../../lib/useSupporterSession";

export default function FanTicketsPage() {
  const { ready, profile, signOut } = useSupporterSession();
  const { pushToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const ticketsPerPage = 6;

  useEffect(() => {
    if (!profile?.walletAddress) {
      return;
    }

    let ignore = false;

    async function loadTickets() {
      try {
        setTicketsLoading(true);
        setTicketsError("");
        const result = await apiFetch(`/api/tickets?ownerAddress=${encodeURIComponent(profile.walletAddress)}`);
        if (!ignore) {
          setTickets(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        if (!ignore) {
          setTickets([]);
          setTicketsError(error.message);
          pushToast(error.message, "error");
        }
      } finally {
        if (!ignore) {
          setTicketsLoading(false);
        }
      }
    }

    loadTickets();
    return () => {
      ignore = true;
    };
  }, [profile?.walletAddress, pushToast]);

  const {
    page: ticketPage,
    setPage: setTicketPage,
    totalPages: totalTicketPages,
    visibleItems: visibleTickets,
    canGoPrevious: canGoPreviousTickets,
    canGoNext: canGoNextTickets
  } = usePagedList(tickets, ticketsPerPage);

  if (!ready || !profile) {
    return <AppStateScreen eyebrow="Supporter Tickets" title="Loading tickets" message="Gathering your current tickets, match labels, and ticket actions." />;
  }

  return (
    <SupporterWorkspace
      profile={profile}
      title="My tickets"
      description="Keep ticket summaries here, then open the dedicated detail page whenever you need QR codes or transfer actions."
      onSignOut={signOut}
    >
      <SectionCard title="Owned Tickets" description="Open a ticket card to view the fixture, QR code, transfer controls, and check-in request tools.">
        {ticketsLoading ? (
          <article className="miniCard adminRouteCard ownedTicketLauncherCard">
            <p className="fixtureLabel">Loading tickets</p>
            <h2>Preparing your ticket wallet.</h2>
            <p className="routeSummary">Your active tickets will appear here as soon as the records are ready.</p>
          </article>
        ) : null}

        {ticketsError ? (
          <article className="miniCard adminRouteCard ownedTicketLauncherCard">
            <p className="fixtureLabel">Ticket loading issue</p>
            <h2>We could not load your tickets.</h2>
            <p className="routeSummary">{ticketsError}</p>
          </article>
        ) : null}

        <div className="adminRouteGrid ownedTicketLauncherGrid">
          {visibleTickets.map((ticket) => (
            <Link
              className="miniCard adminRouteCard adminRouteCardLink ownedTicketLauncherCard"
              href={`/fan/tickets/${ticket.ticketId}`}
              key={ticket.ticketId}
            >
              <div className="routeMetaRow">
                <p className="fixtureLabel">Ticket #{ticket.ticketId}</p>
                <span className="routeIndex">{ticket.status || "Open"}</span>
              </div>
              <h2>{formatFixtureLabel(ticket.match)}</h2>
              <p className="routeSummary">
                {ticket.match?.matchDate ? new Date(ticket.match.matchDate).toLocaleString() : `Match ID ${ticket.matchId}`}
              </p>
              <div className="ticketLauncherMeta">
                <span>{ticket.match?.stadium || "Venue not available"}</span>
                <strong>{ticket.seatNumber || "Seat pending"}</strong>
              </div>
              <span className="textLink">Open ticket details</span>
            </Link>
          ))}
          {!ticketsLoading && !ticketsError && !tickets.length ? (
            <article className="miniCard adminRouteCard ownedTicketLauncherCard">
              <p className="fixtureLabel">No active tickets yet</p>
              <h2>Your booked tickets will appear here.</h2>
              <p className="routeSummary">Choose a fixture to book your first supporter ticket.</p>
              <Link className="textLink" href="/fan/fixtures">
                Book tickets for available matches
              </Link>
            </article>
          ) : null}
        </div>
        {tickets.length ? (
          <div className="pagerBar">
            <span className="feedback">
              Batch {ticketPage + 1} of {totalTicketPages}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={!canGoPreviousTickets} onClick={() => setTicketPage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={!canGoNextTickets} onClick={() => setTicketPage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </SupporterWorkspace>
  );
}
