"use client";

import { AppModal } from "./AppModal";

export function ConfirmDialog({
  open,
  title,
  eyebrow = "Confirm action",
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  busy = false,
  onConfirm,
  onCancel,
  children
}) {
  if (!open) {
    return null;
  }

  return (
    <AppModal open={open} title={title}>
      <div className="confirmHeader">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>

      <p className="confirmMessage">{message}</p>
      {children ? <div className="confirmSummary">{children}</div> : null}

      <div className="confirmActions">
        <button type="button" className="ghostButton" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={busy}>
          {busy ? "Processing..." : confirmLabel}
        </button>
      </div>
    </AppModal>
  );
}
