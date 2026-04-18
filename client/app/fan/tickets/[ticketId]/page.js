"use client";

import Link from "next/link";
import { isAddress } from "ethers";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { SectionCard } from "../../../../components/SectionCard";
import { apiFetch } from "../../../../lib/api";
import { getBrowserTicketingContract } from "../../../../lib/contract";
import { loadSupporterProfile } from "../../../../lib/supporterProfile";

export default function FanTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [transferOptions, setTransferOptions] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [connectedWallet, setConnectedWallet] = useState("");
  const [transferToAddress, setTransferToAddress] = useState("");
  const [latestTransaction, setLatestTransaction] = useState(null);
  const [message, setMessage] = useState("Loading ticket details...");

  useEffect(() => {
    const savedProfile = loadSupporterProfile();
    if (!savedProfile?.walletAddress) {
      router.replace("/");
      return;
    }

    setProfile(savedProfile);
  }, [router]);

  useEffect(() => {
    if (!profile?.walletAddress || !params?.ticketId) {
      return;
    }

    let ignore = false;

    async function loadTicket() {
      try {
        const result = await apiFetch(`/api/tickets/${params.ticketId}`);
        if (ignore) {
          return;
        }

        if (String(result.ownerAddress || "").toLowerCase() !== String(profile.walletAddress || "").toLowerCase()) {
          setMessage("This ticket does not belong to the signed-in supporter.");
          return;
        }

        setTicket(result);
        setMessage("Ticket details loaded.");
      } catch (error) {
        if (!ignore) {
          setMessage(error.message);
        }
      }
    }

    loadTicket();
    return () => {
      ignore = true;
    };
  }, [params?.ticketId, profile]);

  useEffect(() => {
    if (!profile?.walletAddress) {
      return;
    }

    let ignore = false;

    async function loadTransferOptions() {
      try {
        const result = await apiFetch("/api/auth/supporters/transfer-options");
        if (ignore) {
          return;
        }

        setTransferOptions(
          result.supporters.filter(
            (supporter) =>
              String(supporter.walletAddress || "").toLowerCase() !== String(profile.walletAddress || "").toLowerCase()
          )
        );
      } catch (error) {
        if (!ignore) {
          setMessage(error.message);
        }
      }
    }

    loadTransferOptions();
    return () => {
      ignore = true;
    };
  }, [profile]);

  async function connectWallet() {
    try {
      setMessage("Connecting ticket owner wallet...");
      const { signerAddress } = await getBrowserTicketingContract();
      setConnectedWallet(signerAddress);
      setMessage(`Connected wallet: ${signerAddress}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function transferTicket(event) {
    event.preventDefault();

    if (!ticket?.ticketId || !profile?.walletAddress) {
      setMessage("Load the supporter ticket before attempting a transfer.");
      return;
    }
    if (!connectedWallet) {
      setMessage("Connect the current owner wallet in MetaMask before transferring.");
      return;
    }
    if (connectedWallet.toLowerCase() !== String(ticket.ownerAddress || "").toLowerCase()) {
      setMessage("The connected MetaMask wallet must match the current on-chain ticket owner.");
      return;
    }
    if (!selectedRecipientId) {
      setMessage("Choose a registered supporter to receive this ticket.");
      return;
    }
    if (!isAddress(String(transferToAddress || "").trim())) {
      setMessage("Enter a valid Ethereum wallet address for the new owner.");
      return;
    }
    if (String(transferToAddress || "").trim().toLowerCase() === String(ticket.ownerAddress || "").toLowerCase()) {
      setMessage("Transfer the ticket to a different wallet address.");
      return;
    }

    try {
      setMessage(`Submitting MetaMask transfer for ticket ${ticket.ticketId}...`);
      const { contract } = await getBrowserTicketingContract();
      const tx = await contract.transferFrom(ticket.ownerAddress, transferToAddress.trim(), Number(ticket.ticketId));
      await tx.wait();

      const syncedTicket = await apiFetch(`/api/tickets/${ticket.ticketId}/sync-owner`, {
        method: "POST"
      });

      setTicket((current) => ({
        ...current,
        ...syncedTicket
      }));
      setLatestTransaction({
        label: `Ticket ${ticket.ticketId} transferred`,
        hash: tx.hash
      });
      setTransferOptions((current) =>
        current.filter((supporter) => String(supporter.walletAddress || "").toLowerCase() !== String(transferToAddress || "").toLowerCase())
      );
      setSelectedRecipientId("");
      setTransferToAddress("");
      setMessage("Ticket transferred successfully. The new owner is now reflected on-chain and in the backend.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const selectedRecipient = transferOptions.find((supporter) => supporter.id === selectedRecipientId) || null;

  return (
    <main className="shell stack">
      <header className="pageHeader">
        <p className="eyebrow">Ticket Detail</p>
        <h1>{ticket ? `Ticket #${ticket.ticketId}` : "Match ticket detail"}</h1>
        <p className="lede">Expanded ticket information, including the QR code and ledger status, lives here instead of in the summary list.</p>
        <Link className="textLink" href="/fan">
          Back to fan portal
        </Link>
      </header>

      <SectionCard
        title="Ticket Record"
        description="Detailed view for the selected supporter ticket."
      >
        <div className="detailGrid">
          <article className="miniCard ownedTicketCard">
            <span>Status</span>
            <strong>{ticket?.status || "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard">
            <span>Match ID</span>
            <strong>{ticket?.matchId ?? "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard">
            <span>Seat</span>
            <strong>{ticket?.seatNumber || "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard">
            <span>Ticket type</span>
            <strong>{ticket?.ticketType || "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard detailSpanTwo">
            <span>Owner MetaMask wallet</span>
            <strong className="wallet">{ticket?.ownerAddress || "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard">
            <span>Transfers used</span>
            <strong>{ticket?.onChain?.transferCount ?? ticket?.transferCount ?? "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard">
            <span>Transfer limit</span>
            <strong>{ticket?.onChain?.maxTransfers ?? ticket?.maxTransfers ?? "N/A"}</strong>
          </article>
          <article className="miniCard ownedTicketCard detailSpanTwo">
            <span>QR code</span>
            {ticket?.qrCodeDataUrl ? (
              <img alt={`QR code for ticket ${ticket.ticketId}`} className="qrImage" src={ticket.qrCodeDataUrl} />
            ) : (
              <strong>N/A</strong>
            )}
          </article>
        </div>
      </SectionCard>

      <SectionCard
        title="Transfer Ticket"
        description="This action is signed in MetaMask by the current ticket owner, then synced back into the backend."
      >
        <form className="transferBox" onSubmit={transferTicket}>
          <div className="inlineForm">
            <button type="button" className="ghostButton" onClick={connectWallet}>
              Connect owner wallet
            </button>
            <div className="miniCard ownedTicketCard transferStatusCard">
              <span>Connected wallet</span>
              <strong className="wallet">{connectedWallet || "Not connected"}</strong>
            </div>
          </div>
          <select
            value={selectedRecipientId}
            onChange={(event) => {
              const nextRecipientId = event.target.value;
              const nextRecipient = transferOptions.find((supporter) => supporter.id === nextRecipientId) || null;
              setSelectedRecipientId(nextRecipientId);
              setTransferToAddress(nextRecipient?.walletAddress || "");
            }}
          >
            <option value="">Select a registered supporter</option>
            {transferOptions.map((supporter) => (
              <option key={supporter.id} value={supporter.id}>
                {supporter.fullName}{supporter.favouriteClub ? ` - ${supporter.favouriteClub}` : ""}
              </option>
            ))}
          </select>
          <div className="detailGrid">
            <article className="miniCard ownedTicketCard">
              <span>Selected supporter</span>
              <strong>{selectedRecipient?.fullName || "No supporter selected"}</strong>
            </article>
            <article className="miniCard ownedTicketCard detailSpanTwo">
              <span>Recipient MetaMask wallet</span>
              <strong className="wallet">{transferToAddress || "The selected supporter wallet will appear here."}</strong>
            </article>
          </div>
          <button type="submit">Transfer ticket in MetaMask</button>
        </form>

        <div className="detailGrid">
          <article className="miniCard ownedTicketCard detailSpanTwo">
            <span>Latest transaction</span>
            <strong>{latestTransaction?.label || "No transfer submitted yet"}</strong>
            <span className="wallet">{latestTransaction?.hash || "The signed MetaMask transaction hash will appear here."}</span>
          </article>
        </div>
      </SectionCard>

      <p className="feedback">{message}</p>
    </main>
  );
}
