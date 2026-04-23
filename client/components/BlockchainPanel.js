"use client";

import { usePagedList } from "../lib/usePagedList";

function shorten(value) {
  if (!value) {
    return "Not available";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatActor(entry) {
  if (!entry) {
    return "Activity source";
  }

  if (entry.actorType === "SUPPORTER") {
    return `${entry.actorName} (Supporter)`;
  }

  return `${entry.actorName} (${entry.actorRole || entry.actorType || "Activity"})`;
}

export function BlockchainPanel({ status, latestTransaction, activityLogs = [], title = "Blockchain Status" }) {
  const {
    page: activityPage,
    setPage: setActivityPage,
    totalPages: totalActivityPages,
    visibleItems: visibleActivity,
    hasItems: hasActivity,
    canGoPrevious: canGoPreviousActivity,
    canGoNext: canGoNextActivity
  } = usePagedList(activityLogs, 6);

  return (
    <section className="panel sectionCard blockchainPanel">
      <div className="sectionHeading">
        <h2>{title}</h2>
        <p>Live network details plus the latest supporter and admin actions recorded by the platform.</p>
      </div>

      <div className="blockchainGrid">
        <article className="miniCard blockchainCard">
          <p className="fixtureLabel">Network</p>
          <strong>{status?.networkName || "Loading..."}</strong>
          <span>Chain ID: {status?.chainId ?? "Loading..."}</span>
          <span>{status?.rpcUrl || "Waiting for blockchain route..."}</span>
        </article>

        <article className="miniCard blockchainCard">
          <p className="fixtureLabel">Contract</p>
          <strong className="wallet">{shorten(status?.contractAddress)}</strong>
          <span className="wallet">{status?.contractAddress || "Waiting for contract address..."}</span>
        </article>

        <article className="miniCard blockchainCard">
          <p className="fixtureLabel">Backend signer</p>
          <strong className="wallet">{shorten(status?.backendAddress)}</strong>
          <span className="wallet">{status?.backendAddress || "Waiting for signer..."}</span>
        </article>

        <article className="miniCard blockchainCard">
          <p className="fixtureLabel">Latest transaction</p>
          <strong>{latestTransaction?.label || "No recent activity yet"}</strong>
          <span className="wallet">{latestTransaction?.hash || "Recent blockchain actions will appear here."}</span>
        </article>
      </div>

      <div className="blockchainActivity">
        <div className="sectionHeading blockchainActivityHeading">
          <h3>Recent activity</h3>
          <p>Funding, purchases, transfers, check-ins, and admin actions are surfaced here in one readable feed.</p>
        </div>

        <div className="listStack">
          {visibleActivity.map((entry) => (
            <article className="miniCard blockchainActivityCard" key={entry.id}>
              <p className="fixtureLabel">{entry.actionType.replaceAll("_", " ")}</p>
              <strong>{entry.summary}</strong>
              <span>{formatActor(entry)}</span>
              {entry.targetLabel ? <span>Target: {entry.targetLabel}</span> : null}
              {entry.metadata?.txHash ? <span className="wallet">Tx: {entry.metadata.txHash}</span> : null}
              <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "N/A"}</span>
            </article>
          ))}

          {!visibleActivity.length ? (
            <article className="miniCard blockchainActivityCard">
              <strong>No activity has been logged yet.</strong>
              <span>Funding, purchases, transfers, check-ins, and admin decisions will appear here.</span>
            </article>
          ) : null}
        </div>

        {hasActivity ? (
          <div className="pagerBar">
            <span className="workflowMapHint">
              Batch {hasActivity ? activityPage + 1 : 0} of {hasActivity ? totalActivityPages : 0}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={!canGoPreviousActivity} onClick={() => setActivityPage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={!canGoNextActivity} onClick={() => setActivityPage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
