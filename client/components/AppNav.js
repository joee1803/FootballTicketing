"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppModal } from "./AppModal";
import { clearAdminSession } from "../lib/adminAuth";
import { loadActiveSession } from "../lib/sessionState";

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeSession, setActiveSession] = useState(null);
  const [fanSwitchOpen, setFanSwitchOpen] = useState(false);

  useEffect(() => {
    // The nav reflects whichever role owns the browser session, even after another tab signs in or out.
    function syncSession() {
      setActiveSession(loadActiveSession());
    }

    syncSession();
    window.addEventListener("football-ticket-session-change", syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener("football-ticket-session-change", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, [pathname]);

  const homeHref = activeSession?.dashboardPath || "/";
  const inAdminArea = pathname.startsWith("/admin");
  const adminHomeHref = activeSession?.role === "ADMIN" ? "/admin" : "/";
  const homeActive =
    pathname === "/" ||
    pathname === activeSession?.dashboardPath;
  const badgeLabel = activeSession?.role === "ADMIN"
    ? activeSession.adminSession?.admin?.role || "ADMIN"
    : activeSession?.role === "SUPPORTER"
    ? "SUPPORTER"
    : pathname === "/"
    ? "Home"
    : "Signed out";

  function handleFanSwitch() {
    if (activeSession?.role === "ADMIN") {
      setFanSwitchOpen(true);
      return;
    }

    router.push("/");
  }

  function confirmFanSwitch() {
    clearAdminSession();
    setFanSwitchOpen(false);
    router.push("/");
  }

  return (
    <header className="appNavWrap">
      <div className="appNav">
        <Link className="brandMark" href="/">
          <span className="brandKicker">Matchday Ledger</span>
          <strong>Football Ticketing</strong>
        </Link>

        <nav className="navLinks" aria-label="Primary">
          {inAdminArea ? (
            <>
              <Link className={`navLink${inAdminArea ? " navLinkActive" : ""}`} href={adminHomeHref}>
                Home
              </Link>
              <button className="navLink navButton" type="button" onClick={handleFanSwitch}>
                Fan
              </button>
            </>
          ) : (
            <>
              <Link className={`navLink${homeActive ? " navLinkActive" : ""}`} href={homeHref}>
                Home
              </Link>
              <Link className={`navLink${pathname.startsWith("/admin") ? " navLinkActive" : ""}`} href="/admin/sign-in">
                Admin
              </Link>
            </>
          )}
        </nav>

        <div className="navMeta">
          <span className="navBadge">{badgeLabel}</span>
        </div>
      </div>

      <AppModal
        open={fanSwitchOpen}
        title="Switch to fan workspace"
        overlayClassName="workspaceSwitchOverlay"
        panelClassName="authDeck workspaceSwitchDeck"
      >
            <aside className="authStory authStoryAdmin panel">
              <p className="eyebrow">Fan Access</p>
              <h1>Sign out of the admin dashboard first.</h1>
              <p className="authCaption">Only one active role can use the app at a time, so admin and supporter sessions cannot overlap.</p>
            </aside>

            <section className="authSurface panel">
              <div className="authBlockedCard">
                <p className="eyebrow">Active admin session</p>
                <h2>{activeSession?.adminSession?.admin?.name || "Admin user"}</h2>
                <p>
                  This browser is currently signed in as an admin. Log out of the admin dashboard before you open the fan
                  workspace or sign in as a supporter.
                </p>
                <div className="detailGrid">
                  <article className="miniCard supporterCard">
                    <span>Admin email</span>
                    <strong>{activeSession?.adminSession?.admin?.email || "Admin account"}</strong>
                  </article>
                  <article className="miniCard supporterCard">
                    <span>Access level</span>
                    <strong>{activeSession?.adminSession?.admin?.role || "ADMIN"}</strong>
                  </article>
                </div>
                <div className="actions">
                  <button type="button" className="ghostButton" onClick={() => setFanSwitchOpen(false)}>
                    Return to admin dashboard
                  </button>
                  <button type="button" onClick={confirmFanSwitch}>
                    Sign out and continue
                  </button>
                </div>
              </div>
            </section>
      </AppModal>
    </header>
  );
}
