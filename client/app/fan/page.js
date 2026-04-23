"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppStateScreen } from "../../components/AppStateScreen";
import { SectionCard } from "../../components/SectionCard";
import { SupporterWorkspace } from "../../components/SupporterWorkspace";
import { apiFetch } from "../../lib/api";
import { formatPounds } from "../../lib/pricing";
import { useSupporterSession } from "../../lib/useSupporterSession";

const supporterAreas = [
  {
    href: "/fan/fixtures",
    eyebrow: "Fixtures",
    step: "01",
    title: "Browse available matches and book tickets in smaller batches.",
    summary: "Keep ticket booking in its own area instead of mixing it with profile and ticket management."
  },
  {
    href: "/fan/tickets",
    eyebrow: "Tickets",
    step: "02",
    title: "See your active tickets and open full ticket pages only when needed.",
    summary: "Ticket summaries stay compact here while QR codes and transfers live on the detail screen."
  },
  {
    href: "/fan/profile",
    eyebrow: "Profile",
    step: "03",
    title: "Review your supporter details and wallet readiness.",
    summary: "Your account identity and wallet connection are grouped together away from booking."
  }
];

export default function FanPage() {
  const { ready, profile, signOut } = useSupporterSession();
  const [summary, setSummary] = useState({
    tickets: 0,
    matches: 0
  });

  useEffect(() => {
    if (!profile?.walletAddress) {
      return;
    }

    let ignore = false;

    async function loadSummary() {
      const [matches, tickets] = await Promise.all([
        apiFetch("/api/matches"),
        apiFetch(`/api/tickets?ownerAddress=${profile.walletAddress}`)
      ]);

      if (!ignore) {
        setSummary({
          matches: matches.length,
          tickets: tickets.length
        });
      }
    }

    loadSummary();
    return () => {
      ignore = true;
    };
  }, [profile]);

  if (!ready || !profile) {
    return <AppStateScreen eyebrow="Supporter Portal" title="Loading supporter portal" message="Preparing your supporter session, ticket summary, and shortcuts." />;
  }

  return (
    <SupporterWorkspace
      profile={profile}
      title="Supporter home"
      description="Move through booking, tickets, and account details one focused step at a time."
      onSignOut={signOut}
    >
      <section className="dashboardHero dashboardHeroFan">
        <div className="dashboardHeroMain">
          <p className="eyebrow eyebrowInverse">Signed in supporter</p>
          <h2>{profile.fullName}</h2>
          <p>Your matchday account brings bookings, ticket access, wallet status, and club pricing into one calm supporter experience.</p>
          <div className="heroStats">
            <article className="heroStatCard">
              <span>Favourite club</span>
              <strong>{profile.favouriteClub || "Not set"}</strong>
            </article>
            <article className="heroStatCard">
              <span>Tickets held</span>
              <strong>{summary.tickets}</strong>
            </article>
            <article className="heroStatCard">
              <span>Open fixtures</span>
              <strong>{summary.matches}</strong>
            </article>
            <article className="heroStatCard">
              <span>Supporter balance</span>
              <strong>{formatPounds(profile.creditBalance || 0)}</strong>
            </article>
          </div>
        </div>
        <aside className="dashboardHeroSide">
          <p className="dashboardLabel">Supporter summary</p>
          <div className="profileList">
            <div>
              <span>Full name</span>
              <strong>{profile.fullName}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile.email}</strong>
            </div>
            <div>
              <span>Favourite club</span>
              <strong>{profile.favouriteClub || "N/A"}</strong>
            </div>
            <div>
              <span>Supporter balance</span>
              <strong>{formatPounds(profile.creditBalance || 0)}</strong>
            </div>
          </div>
          <div className="heroSideActions">
            <Link className="heroActionLink" href="/fan/fixtures">
              Browse fixtures
            </Link>
            <Link className="heroActionLink heroActionLinkGhost" href="/fan/tickets">
              View tickets
            </Link>
          </div>
        </aside>
      </section>

      <SectionCard eyebrow="Journey map" title="Supporter Areas" description="Choose one task and keep the flow focused.">
        <div className="adminRouteGrid">
          {supporterAreas.map((area) => (
            <Link className="miniCard adminRouteCard adminRouteCardLink" href={area.href} key={area.href}>
              <div className="routeMetaRow">
                <p className="fixtureLabel">{area.eyebrow}</p>
                <span className="routeIndex">{area.step}</span>
              </div>
              <h2>{area.title}</h2>
              <p className="routeSummary">{area.summary}</p>
              <span className="textLink">Open {area.eyebrow.toLowerCase()} view</span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </SupporterWorkspace>
  );
}
