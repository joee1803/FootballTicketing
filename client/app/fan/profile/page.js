"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { SectionCard } from "../../../components/SectionCard";
import { SupporterWorkspace } from "../../../components/SupporterWorkspace";
import { useToast } from "../../../components/ToastProvider";
import { apiFetch } from "../../../lib/api";
import { getBrowserTicketingContract } from "../../../lib/contract";
import { formatPounds } from "../../../lib/pricing";
import { getConnectedMetaMaskWallet, watchMetaMaskWallet } from "../../../lib/wallet";
import { useSupporterSession } from "../../../lib/useSupporterSession";

export default function FanProfilePage() {
  const { ready, profile, updateProfile, signOut } = useSupporterSession();
  const { pushToast } = useToast();
  const [connectedWallet, setConnectedWallet] = useState("");
  const [tickets, setTickets] = useState([]);
  const [walletFunding, setWalletFunding] = useState(null);
  const [fundingBusy, setFundingBusy] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProfileSummary() {
      if (!profile?.walletAddress) {
        return;
      }

      const [ownedTickets, refreshedProfile] = await Promise.all([
        apiFetch(`/api/tickets?ownerAddress=${profile.walletAddress}`),
        apiFetch(`/api/auth/supporters/by-wallet/${profile.walletAddress}`)
      ]);

      if (!ignore) {
        setTickets(ownedTickets);
        updateProfile(refreshedProfile);
      }
    }

    loadProfileSummary();
    return () => {
      ignore = true;
    };
  }, [profile?.walletAddress, updateProfile]);

  useEffect(() => {
    let active = true;

    async function hydrateWallet() {
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

  if (!ready || !profile) {
    return <AppStateScreen eyebrow="Supporter Profile" title="Loading supporter profile" message="Preparing your account details and ticket readiness." />;
  }

  const walletMatches =
    connectedWallet &&
    connectedWallet.toLowerCase() === String(profile.walletAddress || "").toLowerCase();
  const validTickets = tickets.filter((ticket) => ticket.status === "Valid").length;
  const mostRecentTicket = tickets[0] || null;

  return (
    <SupporterWorkspace
      profile={profile}
      title="Supporter profile"
      description="Your account details, wallet connection, and ticket readiness live here away from booking and ticket browsing."
      onSignOut={signOut}
    >
      <section className="gridTwo dashboardSectionGrid">
        <SectionCard title="Supporter Details" description="Only the signed-in supporter record is shown here.">
          <div className="detailGrid">
            <article className="miniCard supporterCard">
              <span>Full name</span>
              <strong>{profile.fullName}</strong>
            </article>
            <article className="miniCard supporterCard">
              <span>Email</span>
              <strong>{profile.email}</strong>
            </article>
            <article className="miniCard supporterCard">
              <span>Favourite club</span>
              <strong>{profile.favouriteClub || "Not set"}</strong>
            </article>
            <article className="miniCard supporterCard detailSpanTwo">
              <span>Supporter wallet</span>
              <strong className="wallet">{profile.walletAddress}</strong>
            </article>
          </div>
        </SectionCard>

        <SectionCard title="Wallet Connection" description="Connect the same MetaMask wallet stored on your supporter record.">
          <div className="listStack">
            <article className="miniCard supporterCard">
              <span>Wallet on file</span>
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
      </section>

      <SectionCard
        title="Ticket Action Readiness"
        description="This section keeps the supporter wallet checks simple before you buy or transfer a ticket."
      >
        <div className="detailGrid">
          <article className="miniCard supporterCard">
            <span>Wallet match</span>
            <strong className={walletMatches ? "statusTextOk" : "statusTextWarn"}>
              {connectedWallet ? (walletMatches ? "Connected wallet matches supporter account" : "Connected wallet does not match supporter account") : "No MetaMask wallet connected"}
            </strong>
          </article>
          <article className="miniCard supporterCard detailSpanTwo">
            <span>Connected MetaMask wallet</span>
            <strong className="wallet">{connectedWallet || "Not connected yet"}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Tickets on this wallet</span>
            <strong>{tickets.length}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Supporter balance remaining</span>
            <strong>{formatPounds(profile.creditBalance || 0)}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Valid tickets</span>
            <strong>{validTickets}</strong>
          </article>
          <article className="miniCard supporterCard detailSpanTwo">
            <span>Most recent supporter ticket</span>
            <strong>
              {mostRecentTicket ? `Ticket #${mostRecentTicket.ticketId} for match ${mostRecentTicket.matchId}` : "No ticket activity yet"}
            </strong>
            {mostRecentTicket ? (
              <Link className="textLink" href={`/fan/tickets/${mostRecentTicket.ticketId}`}>
                Open latest ticket
              </Link>
            ) : null}
          </article>
        </div>
      </SectionCard>
    </SupporterWorkspace>
  );
}
