"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../lib/api";
import { clearAdminSession, loadAdminSession } from "../../lib/adminAuth";
import { buildAssignedAdminEmail } from "../../lib/identity";
import { BlockchainPanel } from "../../components/BlockchainPanel";
import { PasswordField } from "../../components/PasswordField";
import { SectionCard } from "../../components/SectionCard";
import { StatusPill } from "../../components/StatusPill";

const initialMatch = {
  matchId: "",
  homeTeam: "",
  awayTeam: "",
  stadium: "",
  matchDate: ""
};

const initialTicket = {
  ticketId: "",
  matchId: "",
  seatNumber: "",
  ticketType: "General",
  ownerAddress: "",
  maxTransfers: "1"
};

const initialAdmin = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "ADMIN"
};

const initialVerification = {
  ticketId: "",
  claimedOwner: "",
  scannedBy: "admin-console"
};

export default function AdminPage() {
  const router = useRouter();
  const fixtureBatchSize = 6;
  const supporterBatchSize = 6;
  const [session, setSession] = useState(null);
  const [matchForm, setMatchForm] = useState(initialMatch);
  const [ticketForm, setTicketForm] = useState(initialTicket);
  const [newAdminForm, setNewAdminForm] = useState(initialAdmin);
  const [verificationForm, setVerificationForm] = useState(initialVerification);
  const [verificationResult, setVerificationResult] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [supporters, setSupporters] = useState([]);
  const [supporterVisibility, setSupporterVisibility] = useState("LIMITED");
  const [matches, setMatches] = useState([]);
  const [blockchainStatus, setBlockchainStatus] = useState(null);
  const [latestTransaction, setLatestTransaction] = useState(null);
  const [fixturePage, setFixturePage] = useState(0);
  const [supporterPage, setSupporterPage] = useState(0);
  const [revokeTicketId, setRevokeTicketId] = useState("");
  const [feedback, setFeedback] = useState("Checking admin session...");
  const derivedMatchEndTime = matchForm.matchDate
    ? new Date(new Date(matchForm.matchDate).getTime() + 90 * 60 * 1000).toLocaleString()
    : "Select a match start time to calculate the end time.";
  const derivedLatestCheckInTime = matchForm.matchDate
    ? new Date(new Date(matchForm.matchDate).getTime() - 30 * 60 * 1000).toLocaleString()
    : "Select a match start time to calculate the latest check-in time.";

  useEffect(() => {
    const nextSession = loadAdminSession();
    if (!nextSession?.token) {
      router.replace("/admin/sign-in");
      return;
    }

    setSession(nextSession);
    setFeedback(`Signed in as ${nextSession.admin.name}.`);
  }, [router]);

  useEffect(() => {
    if (!newAdminForm.name || newAdminForm.email) {
      return;
    }

    setNewAdminForm((current) => ({
      ...current,
      email: buildAssignedAdminEmail(current.name)
    }));
  }, [newAdminForm.name, newAdminForm.email]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let ignore = false;

    async function loadDashboardData() {
      try {
        const [nextMatches, nextBlockchainStatus] = await Promise.all([
          apiFetch("/api/matches"),
          apiFetch("/api/blockchain/status")
        ]);
        if (!ignore) {
          setMatches(nextMatches);
          setBlockchainStatus(nextBlockchainStatus);
        }

        const supporterResult = await apiFetch("/api/auth/supporters", {
          token: session.token
        });

        if (!ignore) {
          setSupporters(supporterResult.supporters);
          setSupporterVisibility(supporterResult.visibility);
        }

        if (session.admin.role === "SUPER_ADMIN") {
          const result = await apiFetch("/api/auth/admin/list", {
            token: session.token
          });
          const requestResult = await apiFetch("/api/auth/admin/requests", {
            token: session.token
          });

          if (!ignore) {
            setAdmins(result);
            setAdminRequests(requestResult);
          }
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(error.message);
        }
      }
    }

    loadDashboardData();
    return () => {
      ignore = true;
    };
  }, [session]);

  async function submitMatch(event) {
    event.preventDefault();
    setFeedback("Submitting match to backend and contract...");

    try {
      const created = await apiFetch("/api/matches", {
        method: "POST",
        token: session.token,
        body: JSON.stringify(matchForm)
      });

      setLatestTransaction({
        label: `Match ${created.matchId} created`,
        hash: created.txHash || ""
      });
      setFeedback(`Match ${created.matchId} created.`);
      setMatchForm(initialMatch);
      const refreshedMatches = await apiFetch("/api/matches");
      setMatches(refreshedMatches);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function submitTicket(event) {
    event.preventDefault();
    setFeedback("Minting ticket and generating QR...");

    try {
      const created = await apiFetch("/api/tickets", {
        method: "POST",
        token: session.token,
        body: JSON.stringify(ticketForm)
      });

      setLatestTransaction({
        label: `Ticket ${created.ticketId} minted`,
        hash: created.txHash || ""
      });
      setFeedback(`Ticket ${created.ticketId} minted for ${created.ownerAddress}.`);
      setTicketForm(initialTicket);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function revokeTicket(event) {
    event.preventDefault();
    setFeedback("Revoking ticket...");

    try {
      const result = await apiFetch(`/api/tickets/${revokeTicketId}/revoke`, {
        method: "POST",
        token: session.token
      });

      setLatestTransaction({
        label: `Ticket ${result.ticketId} revoked`,
        hash: result.txHash || ""
      });
      setFeedback(`Ticket ${result.ticketId} revoked.`);
      setRevokeTicketId("");
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function createAdmin(event) {
    event.preventDefault();
    const assignedEmail = newAdminForm.email || buildAssignedAdminEmail(newAdminForm.name);

    if (!newAdminForm.name || !assignedEmail || !newAdminForm.password || !newAdminForm.confirmPassword) {
      setFeedback("Name, email, password, and confirm password are required.");
      return;
    }

    if (newAdminForm.password !== newAdminForm.confirmPassword) {
      setFeedback("Password and confirm password must match.");
      return;
    }

    setFeedback("Creating admin account...");

    try {
      const created = await apiFetch("/api/auth/admin/create", {
        method: "POST",
        token: session.token,
        body: JSON.stringify({
          ...newAdminForm,
          email: assignedEmail
        })
      });

      setFeedback(`Admin ${created.email} created.`);
      setNewAdminForm(initialAdmin);

      const refreshed = await apiFetch("/api/auth/admin/list", {
        token: session.token
      });
      setAdmins(refreshed);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  function signOut() {
    clearAdminSession();
    router.replace("/admin/sign-in");
  }

  async function verifyTicket(event) {
    event.preventDefault();
    setFeedback("Running live ticket verification...");

    try {
      const result = await apiFetch("/api/verification/check", {
        method: "POST",
        body: JSON.stringify({
          ticketId: Number(verificationForm.ticketId),
          claimedOwner: verificationForm.claimedOwner
        })
      });

      setVerificationResult(result);
      setFeedback("Verification complete.");
    } catch (error) {
      setVerificationResult(null);
      setFeedback(error.message);
    }
  }

  async function checkInTicket() {
    setFeedback("Checking in ticket...");

    try {
      const result = await apiFetch("/api/verification/check-in", {
        method: "POST",
        body: JSON.stringify({
          ticketId: Number(verificationForm.ticketId),
          claimedOwner: verificationForm.claimedOwner,
          scannedBy: verificationForm.scannedBy
        })
      });

      setLatestTransaction({
        label: `Ticket ${verificationForm.ticketId} checked in`,
        hash: result.txHash || ""
      });
      setVerificationResult(result);
      setFeedback("Ticket marked as used.");
    } catch (error) {
      setVerificationResult(null);
      setFeedback(error.message);
    }
  }

  async function reviewAdminRequest(requestId, action) {
    setFeedback(`${action === "approve" ? "Approving" : "Denying"} admin request...`);

    try {
      await apiFetch(`/api/auth/admin/requests/${requestId}/${action}`, {
        method: "POST",
        token: session.token
      });

      const [refreshedAdmins, refreshedRequests] = await Promise.all([
        apiFetch("/api/auth/admin/list", { token: session.token }),
        apiFetch("/api/auth/admin/requests", { token: session.token })
      ]);

      setAdmins(refreshedAdmins);
      setAdminRequests(refreshedRequests);
      setFeedback(`Admin request ${action}d.`);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  if (!session) {
    return (
      <main className="shell stack">
        <p className="feedback">{feedback}</p>
      </main>
    );
  }

  const fixtureStartIndex = fixturePage * fixtureBatchSize;
  const fixtureEndIndex = fixtureStartIndex + fixtureBatchSize;
  const visibleFixtures = matches.slice(fixtureStartIndex, fixtureEndIndex);
  const totalFixturePages = Math.max(1, Math.ceil(matches.length / fixtureBatchSize));

  const supporterStartIndex = supporterPage * supporterBatchSize;
  const supporterEndIndex = supporterStartIndex + supporterBatchSize;
  const visibleSupporters = supporters.slice(supporterStartIndex, supporterEndIndex);
  const totalSupporterPages = Math.max(1, Math.ceil(supporters.length / supporterBatchSize));

  return (
    <main className="shell stack">
      <header className="pageHeader">
        <p className="eyebrow">Admin Dashboard</p>
        <h1>Premier League style control for fixtures, ticketing, and access.</h1>
        <p className="lede">{session.admin.name} ({session.admin.role})</p>
        <div className="inlineForm">
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="dashboardHero dashboardHeroAdmin">
        <div className="dashboardHeroMain">
          <p className="eyebrow eyebrowInverse">Control centre</p>
          <h2>Run the whole matchday flow from one polished admin workspace.</h2>
          <p>Create fixtures, issue tickets, verify access, and review admin approvals without leaving the dashboard.</p>
          <div className="heroStats">
            <article className="heroStatCard">
              <span>Fixture list</span>
              <strong>{matches.length}</strong>
            </article>
            <article className="heroStatCard">
              <span>Admins</span>
              <strong>{admins.length}</strong>
            </article>
            <article className="heroStatCard">
              <span>Pending requests</span>
              <strong>{adminRequests.filter((request) => request.status === "PENDING").length}</strong>
            </article>
          </div>
        </div>
        <aside className="dashboardHeroSide">
          <p className="dashboardLabel">Current access</p>
          <div className="profileList">
            <div>
              <span>Name</span>
              <strong>{session.admin.name}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{session.admin.email}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{session.admin.role}</strong>
            </div>
          </div>
        </aside>
      </section>

      <BlockchainPanel
        status={blockchainStatus}
        latestTransaction={latestTransaction}
        title="Admin Blockchain Status"
      />

      <section className="gridTwo dashboardSectionGrid">
        <SectionCard
          title="Fixture List"
          description="Upcoming fixtures, shown in six-match windows."
        >
          <div className="listStack">
            {visibleFixtures.map((match) => (
              <article className="miniCard fixtureMiniCard" key={match.matchId}>
                <p className="fixtureLabel">Fixture window</p>
                <strong>{match.homeTeam} vs {match.awayTeam}</strong>
                <span>Kick-off: {new Date(match.matchDate).toLocaleString()}</span>
                <span>Latest check-in: {new Date(match.latestCheckInTime || match.transferCutoff).toLocaleString()}</span>
                <span>{match.stadium}</span>
              </article>
            ))}
          </div>
          <div className="pagerBar">
            <span className="feedback">
              Batch {matches.length ? fixturePage + 1 : 0} of {matches.length ? totalFixturePages : 0}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={fixturePage === 0} onClick={() => setFixturePage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={fixturePage >= totalFixturePages - 1} onClick={() => setFixturePage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Matchday Verification"
          description="Live verification"
        >
          <form className="form" onSubmit={verifyTicket}>
            <input
              placeholder="Ticket ID"
              value={verificationForm.ticketId}
              onChange={(event) => setVerificationForm({ ...verificationForm, ticketId: event.target.value })}
            />
            <input
              placeholder="Claimed owner wallet"
              value={verificationForm.claimedOwner}
              onChange={(event) => setVerificationForm({ ...verificationForm, claimedOwner: event.target.value })}
            />
            <input
              placeholder="Verified by"
              value={verificationForm.scannedBy}
              onChange={(event) => setVerificationForm({ ...verificationForm, scannedBy: event.target.value })}
            />
            <div className="actions">
              <button type="submit">Verify only</button>
              <button type="button" className="secondary" onClick={checkInTicket}>Verify and check in</button>
            </div>
          </form>

          {verificationResult ? (
            <div className="resultCard">
              <StatusPill status={verificationResult.status} valid={verificationResult.valid} />
              <p>Current owner: {verificationResult.currentOwner || "N/A"}</p>
              <p>Match ID: {verificationResult.matchId ?? "N/A"}</p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Supporter Directory"
          description={
            supporterVisibility === "FULL"
              ? "Super admin view with quick supporter summaries and full drill-down pages."
              : "Admin view with non-sensitive supporter summaries only."
          }
        >
          <div className="listStack">
            {visibleSupporters.map((supporter) => (
              <article className="miniCard supporterCard" key={supporter.id || supporter._id}>
                <p className="fixtureLabel">Supporter record</p>
                <strong>{supporter.fullName}</strong>
                <span>Favourite club: {supporter.favouriteClub || "Not set"}</span>
                <span>Joined: {supporter.createdAt ? new Date(supporter.createdAt).toLocaleString() : "N/A"}</span>
                <Link className="textLink" href={`/admin/supporters/${supporter.id || supporter._id}`}>
                  View supporter details
                </Link>
              </article>
            ))}
            {!supporters.length ? (
              <article className="miniCard supporterCard">
                <strong>No supporter accounts yet.</strong>
                <span>Registered fan accounts will appear here after supporters sign up through the homepage.</span>
              </article>
            ) : null}
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
      </section>

      {session.admin.role === "SUPER_ADMIN" ? (
        <section className="gridTwo dashboardSectionGrid">
          <SectionCard
            title="Create Admin"
            description="Add an approved admin"
          >
            <form className="form" onSubmit={createAdmin}>
              <input placeholder="Full name" value={newAdminForm.name} onChange={(event) => setNewAdminForm({ ...newAdminForm, name: event.target.value })} />
              <input placeholder="Assigned email" value={newAdminForm.email} readOnly />
              <PasswordField placeholder="Password" value={newAdminForm.password} onChange={(event) => setNewAdminForm({ ...newAdminForm, password: event.target.value })} />
              <PasswordField placeholder="Confirm password" value={newAdminForm.confirmPassword} onChange={(event) => setNewAdminForm({ ...newAdminForm, confirmPassword: event.target.value })} />
              <select value={newAdminForm.role} onChange={(event) => setNewAdminForm({ ...newAdminForm, role: event.target.value })}>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
              <button type="submit">Create admin</button>
            </form>
          </SectionCard>

          <SectionCard
            title="Admin Directory"
            description="Approved staff"
          >
            <div className="listStack">
              {admins.map((admin) => (
                <article className="miniCard" key={admin._id}>
                  <strong>{admin.name}</strong>
                  <span>{admin.email}</span>
                  <span>{admin.role}</span>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Admin Requests"
            description="Pending and reviewed admin access requests."
          >
            <div className="listStack">
              {adminRequests.map((request) => (
                <article className="miniCard" key={request._id}>
                  <strong>{request.name}</strong>
                  <span>{request.email}</span>
                  <span>{request.status}</span>
                  {request.reason ? <span>{request.reason}</span> : null}
                  {request.status === "PENDING" ? (
                    <div className="inlineForm">
                      <button type="button" onClick={() => reviewAdminRequest(request._id, "approve")}>Approve</button>
                      <button type="button" className="secondary" onClick={() => reviewAdminRequest(request._id, "deny")}>Deny</button>
                    </div>
                  ) : (
                    <span>
                      Reviewed by {request.reviewedBy || "N/A"} on{" "}
                      {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "N/A"}
                    </span>
                  )}
                </article>
              ))}
            </div>
          </SectionCard>
        </section>
      ) : null}

      <section className="gridTwo dashboardSectionGrid">
        <SectionCard
          title="Create Match"
          description="Create fixture"
        >
          <form className="form" onSubmit={submitMatch}>
            <input placeholder="Match ID" value={matchForm.matchId} onChange={(e) => setMatchForm({ ...matchForm, matchId: e.target.value })} />
            <input placeholder="Home Team" value={matchForm.homeTeam} onChange={(e) => setMatchForm({ ...matchForm, homeTeam: e.target.value })} />
            <input placeholder="Away Team" value={matchForm.awayTeam} onChange={(e) => setMatchForm({ ...matchForm, awayTeam: e.target.value })} />
            <input placeholder="Stadium" value={matchForm.stadium} onChange={(e) => setMatchForm({ ...matchForm, stadium: e.target.value })} />
            <input type="datetime-local" value={matchForm.matchDate} onChange={(e) => setMatchForm({ ...matchForm, matchDate: e.target.value })} />
            <div className="miniCard">
              <strong>Match end time</strong>
              <span>{derivedMatchEndTime}</span>
            </div>
            <div className="miniCard">
              <strong>Latest check-in time</strong>
              <span>{derivedLatestCheckInTime}</span>
            </div>
            <button type="submit">Create match</button>
          </form>
        </SectionCard>

        <SectionCard
          title="Mint Ticket"
          description="Issue ticket"
        >
          <form className="form" onSubmit={submitTicket}>
            <input placeholder="Ticket ID" value={ticketForm.ticketId} onChange={(e) => setTicketForm({ ...ticketForm, ticketId: e.target.value })} />
            <input placeholder="Match ID" value={ticketForm.matchId} onChange={(e) => setTicketForm({ ...ticketForm, matchId: e.target.value })} />
            <input placeholder="Seat Number" value={ticketForm.seatNumber} onChange={(e) => setTicketForm({ ...ticketForm, seatNumber: e.target.value })} />
            <input placeholder="Ticket Type" value={ticketForm.ticketType} onChange={(e) => setTicketForm({ ...ticketForm, ticketType: e.target.value })} />
            <input placeholder="Owner MetaMask Address" value={ticketForm.ownerAddress} onChange={(e) => setTicketForm({ ...ticketForm, ownerAddress: e.target.value })} />
            <input placeholder="Max Transfers" value={ticketForm.maxTransfers} onChange={(e) => setTicketForm({ ...ticketForm, maxTransfers: e.target.value })} />
            <button type="submit">Mint ticket</button>
          </form>
        </SectionCard>
      </section>

      <SectionCard
        title="Revoke Ticket"
        description="Invalidate a ticket"
      >
        <form className="inlineForm" onSubmit={revokeTicket}>
          <input placeholder="Ticket ID" value={revokeTicketId} onChange={(e) => setRevokeTicketId(e.target.value)} />
          <button type="submit">Revoke</button>
        </form>
      </SectionCard>

      <p className="feedback">{feedback || "No admin actions yet."}</p>
    </main>
  );
}
