"use client";

import { useEffect, useMemo, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { AdminWorkspace } from "../../../components/AdminWorkspace";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LauncherDetailFlow } from "../../../components/LauncherDetailFlow";
import { SectionCard } from "../../../components/SectionCard";
import { apiFetch } from "../../../lib/api";
import { generateNextMatchIdPreview } from "../../../lib/fixtures";
import { formatPounds } from "../../../lib/pricing";
import { usePagedList } from "../../../lib/usePagedList";
import { useAdminSession } from "../../../lib/useAdminSession";
import { useToast } from "../../../components/ToastProvider";

const initialMatch = {
  matchId: "",
  homeTeam: "",
  awayTeam: "",
  stadium: "",
  matchDate: "",
  ticketPriceCredits: "35.00"
};

export default function AdminFixturesPage() {
  const { ready, session, signOut } = useAdminSession();
  const { pushToast } = useToast();
  const [matches, setMatches] = useState([]);
  const [matchForm, setMatchForm] = useState(initialMatch);
  const [activeView, setActiveView] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const fixtureBatchSize = 6;
  const generatedMatchId = useMemo(
    () => generateNextMatchIdPreview(matchForm.matchDate, matches),
    [matchForm.matchDate, matches]
  );
  const parsedTicketPrice = Number.parseFloat(String(matchForm.ticketPriceCredits || "0").replace(/[^\d.]/g, ""));

  const derivedMatchEndTime = matchForm.matchDate
    ? new Date(new Date(matchForm.matchDate).getTime() + 90 * 60 * 1000).toLocaleString()
    : "Select a match start time to calculate the end time.";
  const derivedLatestCheckInTime = matchForm.matchDate
    ? new Date(new Date(matchForm.matchDate).getTime() - 30 * 60 * 1000).toLocaleString()
    : "Select a match start time to calculate the latest check-in time.";

  useEffect(() => {
    let ignore = false;

    async function loadMatches() {
      try {
        const nextMatches = await apiFetch("/api/matches");
        if (!ignore) {
          setMatches(nextMatches);
        }
      } catch (error) {
        if (!ignore) {
          pushToast(error.message, "error");
        }
      }
    }

    loadMatches();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setMatchForm((current) => ({
      ...current,
      matchId: current.matchDate ? generateNextMatchIdPreview(current.matchDate, matches) : ""
    }));
  }, [matchForm.matchDate, matches]);

  useEffect(() => {
    if (!matches.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % matches.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [matches.length]);

  function requestCreateMatch(event) {
    event.preventDefault();
    if (!matchForm.homeTeam || !matchForm.awayTeam || !matchForm.stadium || !matchForm.matchDate) {
      pushToast("Home team, away team, stadium, and kick-off time are required.", "error");
      return;
    }
    if (!Number.isFinite(parsedTicketPrice) || parsedTicketPrice < 0) {
      pushToast("Enter a valid ticket price before creating the match.", "error");
      return;
    }

    setCreateMatchOpen(true);
  }

  async function submitMatch() {
    try {
      setCreateBusy(true);
      const created = await apiFetch("/api/matches", {
        method: "POST",
        token: session.token,
        body: JSON.stringify({
          ...matchForm,
          matchId: generatedMatchId,
          ticketPriceCredits: parsedTicketPrice
        })
      });

      pushToast(`Match ${created.matchId} created.`, "info");
      setCreateMatchOpen(false);
      setMatchForm(initialMatch);
      setMatches(await apiFetch("/api/matches"));
    } catch (error) {
      setCreateMatchOpen(false);
      pushToast(error.message, "error");
    } finally {
      setCreateBusy(false);
    }
  }

  const {
    page: fixturePage,
    setPage: setFixturePage,
    totalPages: totalFixturePages,
    visibleItems: visibleFixtures,
    hasItems: hasFixtures,
    canGoPrevious: canGoPreviousFixtures,
    canGoNext: canGoNextFixtures
  } = usePagedList(matches, fixtureBatchSize);
  const previewMatch = matches[previewIndex] || matches[0] || null;
  const launcherCards = [
    {
      id: "create-match",
      eyebrow: "Match setup",
      title: "Create Match",
      description: "Add a fixture with automatic match ID, end time, and latest check-in time.",
      meta: generatedMatchId ? `Next ID: ${generatedMatchId}` : "Kick-off creates the ID"
    },
    {
      id: "fixture-list",
      eyebrow: "Fixtures",
      title: "View Available Matches",
      description: "Browse the live fixture list in six-match batches.",
      meta: `${matches.length} fixture${matches.length === 1 ? "" : "s"} loaded`,
      preview: previewMatch ? (
        <article className="launcherPreviewCard">
          <span className="fixtureLabel">Fixture preview</span>
          <strong>{previewMatch.homeTeam} vs {previewMatch.awayTeam}</strong>
          <span>{new Date(previewMatch.matchDate).toLocaleString()}</span>
          <span>{previewMatch.stadium}</span>
        </article>
      ) : (
        <article className="launcherPreviewCard">
          <span className="fixtureLabel">Fixture preview</span>
          <strong>Loading fixture list</strong>
          <span>The first available match will appear here shortly.</span>
        </article>
      )
    }
  ];

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Admin Fixtures" title="Loading fixtures" message="Preparing fixture batches and match-creation tools." />;
  }

  function renderFixtureView(view) {
    if (view === "create-match") {
      return (
        <SectionCard title="Create Match" description="Set the core match details and let the timings calculate automatically.">
          <form className="form" onSubmit={requestCreateMatch}>
            <input placeholder="Match ID" value={matchForm.matchId} readOnly />
            <input placeholder="Home Team" value={matchForm.homeTeam} onChange={(event) => setMatchForm({ ...matchForm, homeTeam: event.target.value })} />
            <input placeholder="Away Team" value={matchForm.awayTeam} onChange={(event) => setMatchForm({ ...matchForm, awayTeam: event.target.value })} />
            <input placeholder="Stadium" value={matchForm.stadium} onChange={(event) => setMatchForm({ ...matchForm, stadium: event.target.value })} />
            <input type="datetime-local" value={matchForm.matchDate} onChange={(event) => setMatchForm({ ...matchForm, matchDate: event.target.value })} />
            <label className="currencyField">
              <span>GBP</span>
              <input
                placeholder="35.00"
                value={matchForm.ticketPriceCredits}
                onChange={(event) =>
                  setMatchForm({
                    ...matchForm,
                    ticketPriceCredits: event.target.value.replace(/[^\d.]/g, "")
                  })
                }
              />
            </label>
            <div className="miniCard">
              <strong>Auto-generated match ID</strong>
              <span>{generatedMatchId || "Select a kick-off time to generate the match ID."}</span>
            </div>
            <div className="miniCard">
              <strong>Ticket price preview</strong>
              <span>{Number.isFinite(parsedTicketPrice) ? formatPounds(parsedTicketPrice) : "Enter a valid price."}</span>
            </div>
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
      );
    }

    return (
      <SectionCard title="Fixture List" description="Upcoming fixtures, shown in six-match batches.">
        <div className="listStack">
          {visibleFixtures.map((match) => (
            <article className="miniCard fixtureMiniCard" key={match.matchId}>
              <p className="fixtureLabel">Fixture window</p>
              <strong>{match.homeTeam} vs {match.awayTeam}</strong>
              <span>Kick-off: {new Date(match.matchDate).toLocaleString()}</span>
              <span>Latest check-in: {new Date(match.latestCheckInTime || match.transferCutoff).toLocaleString()}</span>
              <span>{formatPounds(match.ticketPriceCredits)}</span>
              <span>{match.stadium}</span>
            </article>
          ))}
        </div>
        <div className="pagerBar">
          <span className="feedback">
            Batch {hasFixtures ? fixturePage + 1 : 0} of {hasFixtures ? totalFixturePages : 0}
          </span>
          <div className="pagerActions">
            <button type="button" className="ghostButton" disabled={!canGoPreviousFixtures} onClick={() => setFixturePage((current) => current - 1)}>
              Previous batch
            </button>
            <button type="button" disabled={!canGoNextFixtures} onClick={() => setFixturePage((current) => current + 1)}>
              Next batch
            </button>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <AdminWorkspace
      session={session}
      title="Fixtures"
      description="Create new match windows and browse the fixture list without mixing in ticketing or verification controls."
      onSignOut={signOut}
    >
      <LauncherDetailFlow
        activeView={activeView}
        cards={launcherCards}
        title="Fixture workflow"
        description="Choose one fixture task at a time. The selected workflow opens in full focus while the other option moves out of view."
        onSelect={setActiveView}
        onBack={() => setActiveView("")}
        renderDetail={renderFixtureView}
      />

      <ConfirmDialog
        open={createMatchOpen}
        eyebrow="Create fixture"
        title="Confirm match creation"
        message={
          generatedMatchId
            ? `Are you sure you want to create ${matchForm.homeTeam} vs ${matchForm.awayTeam} with match ID ${generatedMatchId}?`
            : ""
        }
        confirmLabel="Yes, create match"
        cancelLabel="No, cancel"
        busy={createBusy}
        onConfirm={submitMatch}
        onCancel={() => {
          if (createBusy) {
            return;
          }

          setCreateMatchOpen(false);
          pushToast("Match creation cancelled.", "info");
        }}
      >
        <article className="miniCard fixtureMiniCard">
          <span>Kick-off</span>
          <strong>{matchForm.matchDate ? new Date(matchForm.matchDate).toLocaleString() : "Not set"}</strong>
        </article>
        <article className="miniCard fixtureMiniCard">
          <span>Ticket price</span>
          <strong>{Number.isFinite(parsedTicketPrice) ? formatPounds(parsedTicketPrice) : "Not set"}</strong>
        </article>
        <article className="miniCard fixtureMiniCard detailSpanTwo">
          <span>Stadium</span>
          <strong>{matchForm.stadium || "Not set"}</strong>
        </article>
      </ConfirmDialog>
    </AdminWorkspace>
  );
}
