"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppStateScreen } from "../../components/AppStateScreen";
import { AdminWorkspace } from "../../components/AdminWorkspace";
import { SectionCard } from "../../components/SectionCard";
import { apiFetch } from "../../lib/api";
import { useAdminSession } from "../../lib/useAdminSession";

const adminSections = [
  {
    href: "/admin/fixtures",
    eyebrow: "Fixtures",
    step: "01",
    title: "Create matches and browse the fixture list.",
    summary: "Add new match windows without mixing that form into every other admin task."
  },
  {
    href: "/admin/tickets",
    eyebrow: "Tickets",
    step: "02",
    title: "Mint and revoke tickets in one focused area.",
    summary: "Keep ticket issuing and invalidation together instead of buried down the page."
  },
  {
    href: "/admin/verification",
    eyebrow: "Verification",
    step: "03",
    title: "Run live ticket checks and check-ins.",
    summary: "Handle matchday scanning in its own screen so it feels like an operational tool."
  },
  {
    href: "/admin/supporters",
    eyebrow: "Supporters",
    step: "04",
    title: "Review supporter accounts and open full detail pages.",
    summary: "Browse supporters cleanly before drilling into individual records."
  },
  {
    href: "/admin/system",
    eyebrow: "System",
    step: "05",
    title: "Review blockchain status, admin accounts, and approvals.",
    summary: "Keep super-admin controls and activity history in a dedicated area."
  }
];

export default function AdminPage() {
  const { ready, session, signOut } = useAdminSession();
  const [summary, setSummary] = useState({
    matches: 0,
    supporters: 0,
    pendingRequests: 0,
    admins: 1
  });

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let ignore = false;

    async function loadSummary() {
      const [matches, supporterResult, adminResult, requests] = await Promise.all([
        apiFetch("/api/matches"),
        apiFetch("/api/auth/supporters", { token: session.token }),
        session.admin.role === "SUPER_ADMIN"
          ? apiFetch("/api/auth/admin/list", { token: session.token })
          : Promise.resolve(null),
        session.admin.role === "SUPER_ADMIN"
          ? apiFetch("/api/auth/admin/requests", { token: session.token })
          : Promise.resolve([])
      ]);

      const pendingRequests = requests.filter((request) => request.status === "PENDING").length;

      if (!ignore) {
        setSummary({
          matches: matches.length,
          supporters: supporterResult.supporters.length,
          pendingRequests,
          admins: adminResult?.length || 1
        });
      }
    }

    loadSummary();
    return () => {
      ignore = true;
    };
  }, [session]);

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Admin Suite" title="Loading admin suite" message="Preparing your session, live counts, and workflow shortcuts." />;
  }

  return (
    <AdminWorkspace
      session={session}
      title="Admin control centre"
      description="Choose a focused workflow, complete the task, and return here whenever you need the wider operational picture."
      onSignOut={signOut}
    >
      <section className="dashboardHero dashboardHeroAdmin">
        <div className="dashboardHeroMain">
          <p className="eyebrow eyebrowInverse">Overview</p>
          <h2>Matchday operations, organised around the job at hand.</h2>
          <p>Fixtures, ticket operations, verification, supporters, and system controls each live in their own focused space.</p>
          <div className="heroStats">
            <article className="heroStatCard">
              <span>Fixtures</span>
              <strong>{summary.matches}</strong>
            </article>
            <article className="heroStatCard">
              <span>Supporters</span>
              <strong>{summary.supporters}</strong>
            </article>
            <article className="heroStatCard">
              <span>Pending requests</span>
              <strong>{summary.pendingRequests}</strong>
            </article>
            {session.admin.role === "SUPER_ADMIN" ? (
              <article className="heroStatCard">
                <span>Admins</span>
                <strong>{summary.admins}</strong>
              </article>
            ) : null}
          </div>
        </div>
        <aside className="dashboardHeroSide">
          <p className="dashboardLabel">Current admin</p>
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
            {session.admin.role === "SUPER_ADMIN" ? (
              <div>
                <span>Active admin accounts</span>
                <strong>{summary.admins}</strong>
              </div>
            ) : null}
          </div>
          <div className="heroSideActions">
            <Link className="heroActionLink" href="/admin/fixtures">
              Open fixtures
            </Link>
            <Link className="heroActionLink heroActionLinkGhost" href="/admin/verification">
              Open verification
            </Link>
          </div>
        </aside>
      </section>

      <SectionCard
        eyebrow="Workflow map"
        title="Admin Areas"
        description="Choose one workflow at a time."
      >
        <div className="adminRouteGrid">
          {adminSections.map((section) => (
            <Link className="miniCard adminRouteCard adminRouteCardLink" href={section.href} key={section.href}>
              <div className="routeMetaRow">
                <p className="fixtureLabel">{section.eyebrow}</p>
                <span className="routeIndex">{section.step}</span>
              </div>
              <h2>{section.title}</h2>
              <p className="routeSummary">{section.summary}</p>
              <span className="textLink">Open {section.eyebrow.toLowerCase()} view</span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </AdminWorkspace>
  );
}
