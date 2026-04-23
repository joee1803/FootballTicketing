"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let activeModalLocks = 0;
let previousBodyOverflow = "";

function lockPageScroll() {
  if (activeModalLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  activeModalLocks += 1;
}

function unlockPageScroll() {
  activeModalLocks = Math.max(0, activeModalLocks - 1);

  if (activeModalLocks === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

export function AppModal({
  open,
  title,
  overlayClassName = "confirmOverlay",
  panelClassName = "confirmDialog panel",
  children
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) {
      return undefined;
    }

    lockPageScroll();
    return () => unlockPageScroll();
  }, [open, mounted]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className={overlayClassName} role="dialog" aria-modal="true" aria-label={title}>
      <div className={panelClassName}>{children}</div>
    </div>,
    document.body
  );
}
