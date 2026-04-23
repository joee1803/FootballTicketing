"use client";

// Shared launcher-to-detail shell: pages start with focused choices, then render one active workflow at a time.
export function LauncherDetailFlow({
  activeView,
  cards,
  title,
  description,
  backLabel = "Back to overview",
  onSelect,
  onBack,
  renderDetail
}) {
  const activeCard = cards.find((card) => card.id === activeView);

  if (activeView && activeCard) {
    return (
      <section className="launcherStage launcherStageDetail" aria-live="polite">
        <div className="launcherDetailHeader">
          <div>
            <p className="sectionEyebrow">{activeCard.eyebrow || "Selected view"}</p>
            <h2>{activeCard.title}</h2>
            <p>{activeCard.description}</p>
          </div>
          <button type="button" className="ghostButton" onClick={onBack}>
            {backLabel}
          </button>
        </div>
        <div className="launcherDetailPanel">{renderDetail(activeView)}</div>
      </section>
    );
  }

  return (
    <section className="launcherStage launcherStageOverview" aria-live="polite">
      <div className="launcherIntro">
        <p className="sectionEyebrow">Choose a view</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="launcherCardGrid">
        {cards.map((card) => (
          <button
            type="button"
            className="launcherCard"
            key={card.id}
            onClick={() => onSelect(card.id)}
          >
            <span className="launcherCardEyebrow">{card.eyebrow}</span>
            <strong>{card.title}</strong>
            <span>{card.description}</span>
            {card.meta ? <span className="launcherCardMeta">{card.meta}</span> : null}
            <div className="launcherPreview">{card.preview || <span className="launcherPreviewPlaceholder">Preparing view</span>}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
