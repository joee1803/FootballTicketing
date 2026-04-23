"use client";

import { useEffect, useMemo, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LauncherDetailFlow } from "../../../components/LauncherDetailFlow";
import { SectionCard } from "../../../components/SectionCard";
import { SupporterWorkspace } from "../../../components/SupporterWorkspace";
import { useToast } from "../../../components/ToastProvider";
import { apiFetch } from "../../../lib/api";
import { getBrowserTicketingContract } from "../../../lib/contract";
import { formatPounds, getFixturePricing } from "../../../lib/pricing";
import { usePagedList } from "../../../lib/usePagedList";
import { getConnectedMetaMaskWallet, watchMetaMaskWallet } from "../../../lib/wallet";
import { useSupporterSession } from "../../../lib/useSupporterSession";

// Supporter fixture booking keeps wallet preparation and match browsing as separate focused workflows.
export default function FanFixturesPage() {
  const { ready, profile, updateProfile, signOut } = useSupporterSession();
  const { pushToast } = useToast();
  const [matches, setMatches] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState("");
  const [walletFunding, setWalletFunding] = useState(null);
  const [fundingBusy, setFundingBusy] = useState(false);
  const [activeView, setActiveView] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [purchaseTarget, setPurchaseTarget] = useState(null);
  const [insufficientFundsTarget, setInsufficientFundsTarget] = useState(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const matchesPerPage = 6;

  useEffect(() => {
    let ignore = false;

    async function loadMatches() {
      // Refreshing the profile alongside fixtures keeps the displayed balance in sync after bookings.
      try {
        const [result, refreshedProfile] = await Promise.all([
          apiFetch("/api/matches"),
          profile?.walletAddress ? apiFetch(`/api/auth/supporters/by-wallet/${profile.walletAddress}`) : Promise.resolve(null)
        ]);
        if (!ignore) {
          setMatches(result);
          if (refreshedProfile) {
            updateProfile(refreshedProfile);
          }
        }
      } catch (error) {
        if (!ignore) {
          pushToast(error.message, "error");
        }
      }
    }

    loadMatches();
    return () => {
      ignore = true;
    };
  }, [profile?.walletAddress, updateProfile]);

  useEffect(() => {
    let active = true;

    async function hydrateWallet() {
      // MetaMask exposes the current account asynchronously, then emits changes when the user switches wallets.
      const walletAddress = await getConnectedMetaMaskWallet();
      if (active && walletAddress) {
        setConnectedWallet(walletAddress);
      }
    }

    hydrateWallet();
    const unsubscribe = watchMetaMaskWallet((walletAddress) => {
      if (active) {
        setConnectedWallet(walletAddress);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!connectedWallet) {
      setWalletFunding(null);
      return;
    }

    let ignore = false;

    async function loadWalletFunding() {
      try {
        const result = await apiFetch(`/api/blockchain/wallet/${connectedWallet}`);
        if (!ignore) {
          setWalletFunding(result);
        }
      } catch (error) {
        if (!ignore) {
          pushToast(error.message, "error");
        }
      }
    }

    loadWalletFunding();
    return () => {
      ignore = true;
    };
  }, [connectedWallet, pushToast]);

  useEffect(() => {
    if (!matches.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % matches.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [matches.length]);

  async function connectWallet() {
    try {
      const { signerAddress } = await getBrowserTicketingContract();
      setConnectedWallet(signerAddress);
      pushToast(`Connected wallet: ${signerAddress}`, "info");
    } catch (error) {
      pushToast(error.message, "error");
    }
  }

  async function addWalletFunds() {
    if (!connectedWallet) {
      pushToast("Connect MetaMask first so the app knows which wallet to fund.", "error");
      return;
    }

    try {
      setFundingBusy(true);
      const result = await apiFetch("/api/blockchain/fund-wallet", {
        method: "POST",
        body: JSON.stringify({
          address: connectedWallet
        })
      });
      setWalletFunding(result);
      if (result.supporter) {
        updateProfile(result.supporter);
      }
      pushToast(`Added ${result.fundedAmountEth} ETH and ${formatPounds(result.balanceAddedPounds || 0)} to the supporter balance.`, "info");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setFundingBusy(false);
    }
  }

  function openPurchaseConfirm(match) {
    if (!profile?.walletAddress) {
      pushToast("Load your supporter profile before booking a ticket.", "error");
      return;
    }
    if (!connectedWallet) {
      pushToast("Connect the supporter MetaMask wallet before booking.", "error");
      return;
    }
    if (connectedWallet.toLowerCase() !== String(profile.walletAddress || "").toLowerCase()) {
      pushToast("The connected MetaMask wallet must match the supporter wallet on file.", "error");
      return;
    }

    const pricing = getFixturePricing(match, profile.favouriteClub);
    if (Number(profile.creditBalance || 0) < pricing.finalPrice) {
      setInsufficientFundsTarget(match);
      return;
    }

    setPurchaseTarget(match);
  }

  async function confirmTicketPurchase() {
    if (!purchaseTarget) {
      return;
    }

    try {
      setPurchaseBusy(true);
      // Ticket purchase writes through the backend so the database and smart contract stay aligned.
      const ticket = await apiFetch("/api/tickets/purchase", {
        method: "POST",
        body: JSON.stringify({
          matchId: purchaseTarget.matchId,
          ownerAddress: profile.walletAddress,
          ticketType: "General"
        })
      });

      updateProfile({
        ...profile,
        creditBalance: Number(ticket.remainingBalancePounds || ticket.remainingCredits || 0)
      });
      setPurchaseTarget(null);
      pushToast(`Transaction completed. Ticket ${ticket.ticketId} booked for ${formatPounds(ticket.finalPricePounds || ticket.purchasePriceCredits || 0)}.`, "info");
    } catch (error) {
      setPurchaseTarget(null);
      pushToast(`Transaction failed. ${error.message}`, "error");
    } finally {
      setPurchaseBusy(false);
    }
  }

  const {
    page: matchPage,
    setPage: setMatchPage,
    totalPages: totalMatchPages,
    visibleItems: visibleMatches,
    hasItems: hasMatches,
    canGoPrevious: canGoPreviousMatches,
    canGoNext: canGoNextMatches
  } = usePagedList(matches, matchesPerPage);
  const purchasePricing = purchaseTarget ? getFixturePricing(purchaseTarget, profile?.favouriteClub) : null;
  const previewMatch = matches[previewIndex] || matches[0] || null;
  const launcherCards = useMemo(
    () => [
      {
        id: "wallet-setup",
        eyebrow: "Wallet",
        title: "Wallet Setup",
        description: "Connect MetaMask, check the supporter wallet, and add funds before booking.",
        meta: connectedWallet ? "Wallet connected" : "Connect wallet"
      },
      {
        id: "available-matches",
        eyebrow: "Fixtures",
        title: "Book Tickets for Available Matches",
        description: "Browse six-match batches, review prices, and book the selected fixture.",
        meta: `${matches.length} match${matches.length === 1 ? "" : "es"} available`,
        preview: previewMatch ? (
          <article className="launcherPreviewCard">
            <span className="fixtureLabel">Now previewing</span>
            <strong>{previewMatch.homeTeam} vs {previewMatch.awayTeam}</strong>
            <span>{new Date(previewMatch.matchDate).toLocaleString()}</span>
            <span>{previewMatch.stadium}</span>
          </article>
        ) : (
          <article className="launcherPreviewCard">
            <span className="fixtureLabel">Fixtures</span>
            <strong>Loading available matches</strong>
            <span>The first fixture will appear here as soon as the list is ready.</span>
          </article>
        )
      }
    ],
    [connectedWallet, matches.length, previewMatch]
  );

  if (!ready || !profile) {
    return <AppStateScreen eyebrow="Supporter Fixtures" title="Loading fixtures" message="Preparing available matches, prices, and booking controls." />;
  }

  function renderActiveView(view) {
    if (view === "available-matches") {
      return (
        <SectionCard title="Available Matches" description="Fixtures are grouped into six-match batches to keep booking lighter and easier to scan.">
          <div className="ticketGrid">
            {visibleMatches.map((match) => (
              (() => {
                const pricing = getFixturePricing(match, profile.favouriteClub);
                return (
                  <article className="ticketCard fixtureCard" key={match.matchId}>
                    <div className="ticketMeta">
                      <span>Match #{match.matchId}</span>
                      <strong>{new Date(match.matchDate).toLocaleString()}</strong>
                    </div>
                    <p className="fixtureLabel">
                      {pricing.discountApplied
                        ? `Favourite club discount: save ${formatPounds(pricing.discountAmount)}`
                        : "Premier League fixture"}
                    </p>
                    <h2>{match.homeTeam} vs {match.awayTeam}</h2>
                    <p>Venue: {match.stadium}</p>
                    <p>
                      Ticket price: <strong>{formatPounds(pricing.finalPrice)}</strong>
                      {pricing.discountApplied ? ` instead of ${formatPounds(pricing.basePrice)}` : ""}
                    </p>
                    <p>Match ends: {match.matchEndTime ? new Date(match.matchEndTime).toLocaleString() : "Not set"}</p>
                    <p>Latest check-in: {match.latestCheckInTime ? new Date(match.latestCheckInTime).toLocaleString() : "Not set"}</p>
                    <button
                      type="button"
                      onClick={() => openPurchaseConfirm(match)}
                    >
                      Book for {formatPounds(pricing.finalPrice)}
                    </button>
                  </article>
                );
              })()
            ))}
          </div>
          <div className="pagerBar">
            <span className="feedback">
              Batch {hasMatches ? matchPage + 1 : 0} of {hasMatches ? totalMatchPages : 0}
            </span>
            <div className="pagerActions">
              <button type="button" className="ghostButton" disabled={!canGoPreviousMatches} onClick={() => setMatchPage((current) => current - 1)}>
                Previous batch
              </button>
              <button type="button" disabled={!canGoNextMatches} onClick={() => setMatchPage((current) => current + 1)}>
                Next batch
              </button>
            </div>
          </div>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="Wallet Setup" description="Connect the signed-in supporter wallet once here before you book.">
        <div className="listStack">
          <article className="miniCard supporterCard">
            <span>Supporter wallet on file</span>
            <strong className="wallet">{profile.walletAddress}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Connected MetaMask wallet</span>
            <strong className="wallet">{connectedWallet || "Not connected yet"}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Supporter balance</span>
            <strong>{formatPounds(profile.creditBalance || 0)}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Wallet gas balance</span>
            <strong>{walletFunding ? `${Number(walletFunding.balanceEth).toFixed(4)} ETH` : "Connect MetaMask to check"}</strong>
          </article>
        </div>
        <div className="actions">
          <button type="button" className="ghostButton" onClick={connectWallet}>
            {connectedWallet ? "Refresh MetaMask" : "Connect MetaMask"}
          </button>
          <button type="button" onClick={addWalletFunds} disabled={!connectedWallet || fundingBusy}>
            {fundingBusy ? "Adding funds..." : "Add funds"}
          </button>
        </div>
      </SectionCard>
    );
  }

  const insufficientFundsPricing = insufficientFundsTarget
    ? getFixturePricing(insufficientFundsTarget, profile?.favouriteClub)
    : null;

  return (
    <SupporterWorkspace
      profile={profile}
      title="Fixtures"
      description="Browse available matches in smaller windows and book from a page that only focuses on fixtures."
      onSignOut={signOut}
    >
      <LauncherDetailFlow
        activeView={activeView}
        cards={launcherCards}
        title="Fixture actions"
        description="Choose whether to prepare the wallet or browse available matches. Only the selected view opens, keeping the page focused."
        onSelect={setActiveView}
        onBack={() => setActiveView("")}
        renderDetail={renderActiveView}
      />

      <ConfirmDialog
        open={Boolean(purchaseTarget)}
        eyebrow="Purchase ticket"
        title="Confirm ticket purchase"
        message={
          purchaseTarget && purchasePricing
            ? `Are you sure you want to purchase ${purchaseTarget.homeTeam} vs ${purchaseTarget.awayTeam} for ${formatPounds(purchasePricing.finalPrice)}?`
            : ""
        }
        confirmLabel="Yes, purchase ticket"
        cancelLabel="No, cancel"
        busy={purchaseBusy}
        onConfirm={confirmTicketPurchase}
        onCancel={() => {
          if (purchaseBusy) {
            return;
          }

          setPurchaseTarget(null);
          pushToast("Ticket purchase cancelled.", "info");
        }}
      >
        {purchaseTarget && purchasePricing ? (
          <>
            <article className="miniCard fixtureMiniCard">
              <span>Kick-off</span>
              <strong>{new Date(purchaseTarget.matchDate).toLocaleString()}</strong>
            </article>
            <article className="miniCard fixtureMiniCard">
              <span>Supporter balance after purchase</span>
              <strong>{formatPounds(Number(profile.creditBalance || 0) - purchasePricing.finalPrice)}</strong>
            </article>
            {purchasePricing.discountApplied ? (
              <article className="miniCard fixtureMiniCard detailSpanTwo">
                <span>Favourite club discount</span>
                <strong>{formatPounds(purchasePricing.discountAmount)} saved on this fixture</strong>
              </article>
            ) : null}
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(insufficientFundsTarget)}
        eyebrow="Insufficient funds"
        title="Add funds before booking"
        message={
          insufficientFundsTarget && insufficientFundsPricing
            ? `${insufficientFundsTarget.homeTeam} vs ${insufficientFundsTarget.awayTeam} costs ${formatPounds(insufficientFundsPricing.finalPrice)}. Your current supporter balance is ${formatPounds(profile.creditBalance || 0)}.`
            : ""
        }
        confirmLabel="Add funds"
        cancelLabel="Close"
        onConfirm={() => {
          setInsufficientFundsTarget(null);
          setActiveView("wallet-setup");
        }}
        onCancel={() => setInsufficientFundsTarget(null)}
      >
        {insufficientFundsTarget && insufficientFundsPricing ? (
          <>
            <article className="miniCard fixtureMiniCard">
              <span>Fixture</span>
              <strong>{insufficientFundsTarget.homeTeam} vs {insufficientFundsTarget.awayTeam}</strong>
            </article>
            <article className="miniCard fixtureMiniCard">
              <span>Amount needed</span>
              <strong>{formatPounds(Math.max(0, insufficientFundsPricing.finalPrice - Number(profile.creditBalance || 0)))}</strong>
            </article>
          </>
        ) : null}
      </ConfirmDialog>
    </SupporterWorkspace>
  );
}
