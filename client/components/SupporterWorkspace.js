"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpButton } from "./HelpButton";
import { formatPounds } from "../lib/pricing";

const supporterLinks = [
  { href: "/fan", label: "Overview" },
  { href: "/fan/fixtures", label: "Fixtures" },
  { href: "/fan/tickets", label: "Tickets" },
  { href: "/fan/profile", label: "Profile" }
];

export function SupporterWorkspace({ profile, title, description, children, onSignOut }) {
  const pathname = usePathname();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const guideSteps = [
    "Start on Overview, then open Fixtures to book tickets, Tickets to review what you own, or Profile for your wallet and account details.",
    "MetaMask should reconnect automatically if it is already available in the browser, so you only need to reconnect manually if the wallet has been switched or locked.",
    "Use Add funds when the wallet needs gas or the supporter balance needs topping up before booking.",
    "If your chosen favourite club appears in a fixture, the discounted supporter price will be shown automatically before checkout.",
    "Open a ticket detail page when you need the QR code, want to transfer that specific ticket, or want to send a check-in request to the admin queue."
  ];

  return (
    <main className="shell stack">
      <header className="pageHeader supporterPageHeader workspaceHeaderShell workspaceHeaderShellFan">
        <div className="supporterPageHeaderTop">
          <div className="workspaceLead">
            <p className="eyebrow">Supporter Portal</p>
            <h1>{title}</h1>
            <p className="lede">{description}</p>
            <div className="workspaceChipRow">
              <span className="workspaceChip">{profile.favouriteClub || "Favourite club not set"}</span>
              <span className="workspaceChip">Balance: {formatPounds(profile.creditBalance || 0)}</span>
            </div>
          </div>
          <div className="supporterSessionMeta workspaceSideCard">
            <p className="workspaceSessionLabel">Signed-in supporter</p>
            <strong className="workspaceSessionValue">{profile.fullName}</strong>
            <p className="workspaceSessionSecondary">{profile.email}</p>
            <div className="workspaceMetaGrid">
              <div>
                <span>Favourite club</span>
                <strong>{profile.favouriteClub || "Supporter"}</strong>
              </div>
              <div>
                <span>Ticket balance</span>
                <strong>{formatPounds(profile.creditBalance || 0)}</strong>
              </div>
            </div>
            <div className="workspaceActionRow">
              <HelpButton title="Supporter Guide" steps={guideSteps} />
              <button type="button" className="sessionSignOutButton" onClick={() => setSignOutOpen(true)}>
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="workspaceNavRail">
          <span className="workspaceNavLabel">Sections</span>
          <nav className="supporterSectionNav" aria-label="Supporter sections">
            {supporterLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`supporterSectionLink${pathname === link.href ? " supporterSectionLinkActive" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {children}

      <ConfirmDialog
        open={signOutOpen}
        eyebrow="Supporter session"
        title="Sign out of this supporter account?"
        message="Your tickets and account details will remain saved. Sign back in with your assigned email or full name when you return."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={onSignOut}
        onCancel={() => setSignOutOpen(false)}
      >
        <article className="miniCard supporterCard">
          <span>Signed in as</span>
          <strong>{profile.fullName}</strong>
        </article>
        <article className="miniCard supporterCard">
          <span>Email</span>
          <strong>{profile.email}</strong>
        </article>
        <article className="miniCard supporterCard">
          <span>Favourite club</span>
          <strong>{profile.favouriteClub || "Not set"}</strong>
        </article>
      </ConfirmDialog>
    </main>
  );
}
