"use client";

export function AppStateScreen({
  eyebrow = "Matchday Ledger",
  title = "Loading portal",
  message = "Please wait while the page gets everything ready."
}) {
  return (
    <main className="shell stack">
      <section className="pageHeader appStateScreen">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{message}</p>
        <div className="appStatePulseRow" aria-hidden="true">
          <span className="appStatePulse" />
          <span className="appStatePulse appStatePulseDelay" />
          <span className="appStatePulse appStatePulseSlow" />
        </div>
      </section>
    </main>
  );
}
