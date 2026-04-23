"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef } from "react";

function getRouteGroup(pathname) {
  if (pathname.startsWith("/admin")) {
    return 1;
  }

  return 0;
}

export function PageTransitionShell({ children }) {
  const pathname = usePathname();
  const previousGroup = useRef(getRouteGroup(pathname));

  // Home/supporter routes sit on the left of the product, while admin routes sit on the right.
  // Tracking that relationship lets the page enter from the correct direction when the nav changes.
  const direction = useMemo(() => {
    const currentGroup = getRouteGroup(pathname);
    const nextDirection = currentGroup >= previousGroup.current ? "forward" : "back";
    previousGroup.current = currentGroup;
    return nextDirection;
  }, [pathname]);

  return (
    <div key={pathname} className={`routeTransitionShell routeTransition${direction === "forward" ? "Forward" : "Back"}`}>
      {children}
    </div>
  );
}
