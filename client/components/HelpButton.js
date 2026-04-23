"use client";

import { useState } from "react";

import { AppModal } from "./AppModal";

export function HelpButton({ title = "How It Works", description = "", steps = [], showGotIt = true }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="helpButton"
        aria-label={`Open help for ${title}`}
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      <AppModal
        open={open}
        title={title}
        overlayClassName="helpOverlay"
        panelClassName="helpDialog panel"
      >
        <div className="helpDialogHeader">
          <div>
            <p className="eyebrow">Guide</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ghostButton" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        {description ? <p className="confirmMessage">{description}</p> : null}

        <div className="helpList">
          {steps.map((step, index) => (
            <article className="miniCard helpStepCard" key={`${title}-${index}`}>
              <span className="fixtureLabel">Step {index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>

        {showGotIt ? (
          <div className="confirmActions">
            <button type="button" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        ) : null}
      </AppModal>
    </>
  );
}
