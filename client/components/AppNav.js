"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { loadAdminSession } from "../lib/adminAuth";

export function AppNav() {
  const pathname = usePathname();
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(loadAdminSession());
  }, [pathname]);

  return (
    <header className="appNavWrap">
      <div className="appNav">
        <Link className="brandMark" href="/">
          <span className="brandKicker">Matchday Ledger</span>
          <strong>Football Ticketing</strong>
        </Link>

        <nav className="navLinks" aria-label="Primary">
          <Link className={`navLink${pathname === "/" ? " navLinkActive" : ""}`} href="/">
            Home
          </Link>
          <Link className={`navLink${pathname.startsWith("/admin") ? " navLinkActive" : ""}`} href="/admin/sign-in">
            Admin
          </Link>
        </nav>

        <div className="navMeta">
          <span className="navBadge">
            {session?.admin?.role ? session.admin.role : pathname === "/" ? "Home" : "Signed out"}
          </span>
        </div>
      </div>
    </header>
  );
}
