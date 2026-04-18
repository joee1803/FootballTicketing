"use client";

import { useId, useState } from "react";

function EyeIcon({ open }) {
  return (
    <svg aria-hidden="true" className="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
      {open ? <circle cx="12" cy="12" r="3.2" /> : <path d="M4 4l16 16" />}
    </svg>
  );
}

export function PasswordField({
  placeholder,
  value,
  onChange,
  visibleLabel = "Show password",
  hiddenLabel = "Hide password"
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="passwordField">
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="eyeToggle"
        aria-label={visible ? hiddenLabel : visibleLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
