"use client";

function shorten(value) {
  if (!value) {
    return "Not available";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function BlockchainPanel({ status, latestTransaction, title = "Blockchain Status" }) {
  return (
    <section className="panel sectionCard blockchainPanel">
      <div className="sectionHeading">
        <h2>{title}</h2>
        <p>Live network and contract proof for the current demo session.</p>
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
          <strong>{latestTransaction?.label || "No on-chain action yet"}</strong>
          <span className="wallet">{latestTransaction?.hash || "A transaction hash will appear here after the next write action."}</span>
        </article>
      </div>
    </section>
  );
}
