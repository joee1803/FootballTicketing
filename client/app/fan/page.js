"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BlockchainPanel } from "../../components/BlockchainPanel";
import { SectionCard } from "../../components/SectionCard";
import { getBrowserTicketingContract } from "../../lib/contract";
import { apiFetch, getApiBaseUrl } from "../../lib/api";
import { clearSupporterProfile, loadSupporterProfile } from "../../lib/supporterProfile";

export default function FanPage() {
  const router = useRouter();
  const matchesPerPage = 6;
  const ticketsPerPage = 6;
  const [tickets, setTickets] = useState([]);
  const [matches, setMatches] = useState([]);
  const [profile, setProfile] = useState(null);
  const [connectedWallet, setConnectedWallet] = useState("");
  const [blockchainStatus, setBlockchainStatus] = useState(null);
  const [latestTransaction, setLatestTransaction] = useState(null);
  const [matchPage, setMatchPage] = useState(0);
  const [ticketPage, setTicketPage] = useState(0);
  const [message, setMessage] = useState("Loading your supporter account...");

  async function loadTicketsForOwner(ownerAddress) {
    const result = await apiFetch(`/api/tickets?ownerAddress=${ownerAddress}`);
    setTickets(result);
    setMessage(result.length ? "Owned tickets loaded." : "No tickets found for this wallet.");
  }

  useEffect(() => {
    const savedProfile = loadSupporterProfile();
    if (!savedProfile?.walletAddress) {
      router.replace("/");
      return;
    }

    setProfile(savedProfile);
    setMessage(`Signed in as ${savedProfile.fullName}.`);
  }, [router]);

  useEffect(() => {
    let ignore = false;

    async function loadMatches() {
      try {
        const [result, status] = await Promise.all([
          apiFetch("/api/matches"),
          apiFetch("/api/blockchain/status")
        ]);
        if (!ignore) {
          setMatches(result);
          setBlockchainStatus(status);
        }
      } catch {
        if (!ignore) {
          setMatches([]);
        }
      }
    }

    loadMatches();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!profile?.walletAddress) {
      return;
    }

    let ignore = false;

    async function loadTickets() {
      setMessage("Loading tickets from backend...");
      try {
        const result = await apiFetch(`/api/tickets?ownerAddress=${profile.walletAddress}`);
        if (ignore) {
          return;
        }

        setTickets(result);
        setMessage(result.length ? "Owned tickets loaded." : "No tickets found for this wallet.");
      } catch (error) {
        if (!ignore) {
          setMessage(error.message);
        }
      }
    }

    loadTickets();
    return () => {
      ignore = true;
    };
  }, [profile]);

  async function buyTicket(matchId) {
    if (!profile?.walletAddress) {
      setMessage("Load your supporter profile before booking a ticket.");
      return;
    }
    if (!connectedWallet) {
      setMessage("Connect the supporter MetaMask wallet before booking.");
      return;
    }
    if (connectedWallet.toLowerCase() !== String(profile.walletAddress || "").toLowerCase()) {
      setMessage("The connected MetaMask wallet must match the supporter wallet on file.");
      return;
    }

    try {
      setMessage(`Booking a ticket for match ${matchId}...`);
      const ticket = await apiFetch("/api/tickets/purchase", {
        method: "POST",
        body: JSON.stringify({
          matchId,
          ownerAddress: profile.walletAddress,
          ticketType: "General"
        })
      });

      setLatestTransaction({
        label: `Ticket ${ticket.ticketId} minted`,
        hash: ticket.txHash || ""
      });
      await loadTicketsForOwner(profile.walletAddress);
      setMessage(`Ticket ${ticket.ticketId} booked successfully.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function connectWallet() {
    try {
      setMessage("Connecting supporter MetaMask wallet...");
      const { signerAddress } = await getBrowserTicketingContract();
      setConnectedWallet(signerAddress);
      setMessage(`Connected wallet: ${signerAddress}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const matchStartIndex = matchPage * matchesPerPage;
  const matchEndIndex = matchStartIndex + matchesPerPage;
  const visibleMatches = matches.slice(matchStartIndex, matchEndIndex);
  const totalMatchPages = Math.max(1, Math.ceil(matches.length / matchesPerPage));

  const ticketStartIndex = ticketPage * ticketsPerPage;
  const ticketEndIndex = ticketStartIndex + ticketsPerPage;
  const visibleTickets = tickets.slice(ticketStartIndex, ticketEndIndex);
  const totalTicketPages = Math.max(1, Math.ceil(tickets.length / ticketsPerPage));

  return (
    <main className="shell stack">
      <header className="pageHeader">
        <p className="eyebrow">Fan Workspace</p>
        <h1>Your matchday desk for fixtures, tickets, and supporter details.</h1>
        <p className="lede">Everything here is tailored to the supporter currently signed in, with booking and ticket review kept in one clean flow.</p>
      </header>

      <section className="dashboardHero dashboardHeroFan">
        <div className="dashboardHeroMain">
          <p className="eyebrow eyebrowInverse">Signed in supporter</p>
          <h2>{profile?.fullName || "Supporter account"}</h2>
          <p>Browse fixtures in batches, secure tickets quickly, and keep the portal centered on the active fan only.</p>
          <div className="heroStats">
            <article className="heroStatCard">
              <span>Favourite club</span>
              <strong>{profile?.favouriteClub || "Not set"}</strong>
            </article>
            <article className="heroStatCard">
              <span>Tickets held</span>
              <strong>{tickets.length}</strong>
            </article>
            <article className="heroStatCard">
              <span>Open fixtures</span>
              <strong>{matches.length}</strong>
            </article>
          </div>
        </div>
        <aside className="dashboardHeroSide">
          <p className="dashboardLabel">Supporter profile</p>
          <div className="profileList">
            <div>
              <span>Full name</span>
              <strong>{profile?.fullName || "N/A"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile?.email || "N/A"}</strong>
            </div>
            <div>
              <span>Favourite club</span>
              <strong>{profile?.favouriteClub || "N/A"}</strong>
            </div>
            <div>
              <span>MetaMask wallet</span>
              <strong className="wallet">{profile?.walletAddress || "N/A"}</strong>
            </div>
            <div>
              <span>Connected wallet</span>
              <strong className="wallet">{connectedWallet || "Not connected"}</strong>
            </div>
          </div>
          <div className="inlineForm">
            <button type="button" className="ghostButton heroGhostButton" onClick={connectWallet}>
              Connect MetaMask
            </button>
            <button
              type="button"
              className="ghostButton heroGhostButton"
              onClick={() => {
                clearSupporterProfile();
                router.replace("/");
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
      </section>

      <SectionCard
        title="Available Matches"
        description="Fixtures are grouped into six-match windows so the booking view stays lighter and easier to scan."
      >
        <div className="ticketGrid">
          {visibleMatches.map((match) => (
            <article className="ticketCard fixtureCard" key={match.matchId}>
              <div className="ticketMeta">
                <span>Match #{match.matchId}</span>
                <strong>{new Date(match.matchDate).toLocaleString()}</strong>
              </div>
              <p className="fixtureLabel">Premier League fixture</p>
              <h2>{match.homeTeam} vs {match.awayTeam}</h2>
              <p>Venue: {match.stadium}</p>
              <p>Match ends: {match.matchEndTime ? new Date(match.matchEndTime).toLocaleString() : "Not set"}</p>
              <p>Latest check-in: {match.latestCheckInTime ? new Date(match.latestCheckInTime).toLocaleString() : "Not set"}</p>
              <button type="button" onClick={() => buyTicket(match.matchId)}>Book or buy ticket</button>
            </article>
          ))}
        </div>
        <div className="pagerBar">
          <span className="feedback">
            Batch {matches.length ? matchPage + 1 : 0} of {matches.length ? totalMatchPages : 0}
          </span>
          <div className="pagerActions">
            <button type="button" className="ghostButton" disabled={matchPage === 0} onClick={() => setMatchPage((current) => current - 1)}>
              Previous batch
            </button>
            <button type="button" disabled={matchPage >= totalMatchPages - 1} onClick={() => setMatchPage((current) => current + 1)}>
              Next batch
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="My Tickets"
        description={`Ticket summaries stay compact here, with full details and QR access inside the dedicated detail view on ${getApiBaseUrl()}.`}
      >
        <div className="ticketGrid">
          {visibleTickets.map((ticket) => (
            <article className="ticketCard ownedTicketCard" key={ticket.ticketId}>
              <div className="ticketMeta">
                <span>Ticket #{ticket.ticketId}</span>
                <strong>{ticket.status}</strong>
              </div>
              <h2>{ticket.ticketType}</h2>
              <p>Match ID: {ticket.matchId}</p>
              <p>Seat: {ticket.seatNumber}</p>
              <Link className="textLink" href={`/fan/tickets/${ticket.ticketId}`}>
                View ticket details
              </Link>
            </article>
          ))}
          {!tickets.length ? (
            <article className="ticketCard emptyTicketCard">
              <p className="fixtureLabel">No active tickets yet</p>
              <h2>Your booked tickets will appear here.</h2>
              <p>Choose a fixture above to mint your first supporter ticket for the demo.</p>
            </article>
          ) : null}
        </div>
        {tickets.length ? (
          <div className="pagerBar">
            <span className="feedback">
              Batch {ticketPage + 1} of {totalTicketPages}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={ticketPage === 0} onClick={() => setTicketPage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={ticketPage >= totalTicketPages - 1} onClick={() => setTicketPage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <BlockchainPanel
        status={blockchainStatus}
        latestTransaction={latestTransaction}
        title="Fan Blockchain Status"
      />

      <p className="feedback">{message}</p>
    </main>
  );
}
