"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpButton } from "./HelpButton";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/supporters", label: "Supporters" },
  { href: "/admin/system", label: "System" }
];

export function AdminWorkspace({ session, title, description, children, onSignOut }) {
  const pathname = usePathname();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const guideSteps = [
    "Start on Overview, then open the admin area that matches the task you want to complete.",
    "Use Fixtures to create matches, Tickets to mint or revoke by selecting real supporters and fixtures, and Verification for matchday checks.",
    "Verification supports QR uploads and check-in requests so ticket ownership can be validated quickly.",
    "Open Supporters for fan records, and use System for admin approvals, blockchain status, and activity history."
  ];

  return (
    <main className="shell stack">
      <header className="pageHeader adminPageHeader workspaceHeaderShell workspaceHeaderShellAdmin">
        <div className="adminPageHeaderTop">
          <div className="workspaceLead">
            <p className="eyebrow">Admin Suite</p>
            <h1>{title}</h1>
            <p className="lede">{description}</p>
            <div className="workspaceChipRow">
              <span className="workspaceChip">Role: {session.admin.role}</span>
              <span className="workspaceChip">Signed in: {session.admin.email}</span>
            </div>
          </div>
          <div className="adminSessionMeta workspaceSideCard">
            <p className="workspaceSessionLabel">Current session</p>
            <strong className="workspaceSessionValue">{session.admin.name}</strong>
            <p className="workspaceSessionSecondary">{session.admin.email}</p>
            <div className="workspaceMetaGrid">
              <div>
                <span>Access level</span>
                <strong>{session.admin.role}</strong>
              </div>
              <div>
                <span>Area</span>
                <strong>Operations</strong>
              </div>
            </div>
            <div className="workspaceActionRow">
              <HelpButton title="Admin Guide" steps={guideSteps} />
              <button type="button" className="sessionSignOutButton" onClick={() => setSignOutOpen(true)}>
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="workspaceNavRail">
          <span className="workspaceNavLabel">Sections</span>
          <nav className="adminSectionNav" aria-label="Admin sections">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`adminSectionLink${pathname === link.href ? " adminSectionLinkActive" : ""}`}
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
        eyebrow="Admin session"
        title="Sign out of admin access?"
        message="This ends the current admin session in this browser. You can sign in again with your assigned email or full name."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={onSignOut}
        onCancel={() => setSignOutOpen(false)}
      >
        <article className="miniCard supporterCard">
          <span>Signed in as</span>
          <strong>{session.admin.name}</strong>
        </article>
        <article className="miniCard supporterCard">
          <span>Email</span>
          <strong>{session.admin.email}</strong>
        </article>
        <article className="miniCard supporterCard">
          <span>Access level</span>
          <strong>{session.admin.role}</strong>
        </article>
      </ConfirmDialog>
    </main>
  );
}
