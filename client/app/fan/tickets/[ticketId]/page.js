"use client";

import Link from "next/link";
import { formatEther, isAddress } from "ethers";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppStateScreen } from "../../../../components/AppStateScreen";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import { SectionCard } from "../../../../components/SectionCard";
import { SupporterWorkspace } from "../../../../components/SupporterWorkspace";
import { useToast } from "../../../../components/ToastProvider";
import { apiFetch } from "../../../../lib/api";
import { getBrowserTicketingContract } from "../../../../lib/contract";
import { formatFixtureLabel } from "../../../../lib/fixtures";
import { formatPounds } from "../../../../lib/pricing";
import { getConnectedMetaMaskWallet, watchMetaMaskWallet } from "../../../../lib/wallet";
import { useSupporterSession } from "../../../../lib/useSupporterSession";

export default function FanTicketDetailPage() {
  const params = useParams();
  const { ready, profile, updateProfile, signOut } = useSupporterSession();
  const { pushToast } = useToast();
  const [ticket, setTicket] = useState(null);
  const [transferOptions, setTransferOptions] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [connectedWallet, setConnectedWallet] = useState("");
  const [transferToAddress, setTransferToAddress] = useState("");
  const [latestTransaction, setLatestTransaction] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [walletFunding, setWalletFunding] = useState(null);
  const [fundingBusy, setFundingBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [transferFundsOpen, setTransferFundsOpen] = useState(false);
  const [transferEstimate, setTransferEstimate] = useState(null);
  const [checkInRequestBusy, setCheckInRequestBusy] = useState(false);
  const [checkInRequestConfirmOpen, setCheckInRequestConfirmOpen] = useState(false);
  const [checkInRequest, setCheckInRequest] = useState(null);

  useEffect(() => {
    if (!profile?.walletAddress || !params?.ticketId) {
      return;
    }

    let ignore = false;

    async function loadTicket() {
      try {
        setLoadError("");
        const result = await apiFetch(`/api/tickets/${params.ticketId}`);
        if (ignore) {
          return;
        }

        if (String(result.ownerAddress || "").toLowerCase() !== String(profile.walletAddress || "").toLowerCase()) {
          pushToast("This ticket does not belong to the signed-in supporter.", "error");
          return;
        }

        setTicket(result);
      } catch (error) {
        if (!ignore) {
          setTicket(null);
          setLoadError(error.message);
          pushToast(error.message, "error");
        }
      }
    }

    loadTicket();
    return () => {
      ignore = true;
    };
  }, [params?.ticketId, profile, pushToast]);

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
          pushToast(error.message, "error");
        }
      }
    }

    loadTransferOptions();
    return () => {
      ignore = true;
    };
  }, [profile, pushToast]);

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

  useEffect(() => {
    if (
      !ticket?.ticketId ||
      !connectedWallet ||
      !isAddress(String(transferToAddress || "").trim()) ||
      connectedWallet.toLowerCase() !== String(ticket.ownerAddress || "").toLowerCase()
    ) {
      setTransferEstimate(null);
      return;
    }

    let ignore = false;

    async function estimateTransfer() {
      try {
        const { contract, provider } = await getBrowserTicketingContract({ requestConnection: false });
        const estimatedGas = await contract.transferFrom.estimateGas(
          ticket.ownerAddress,
          transferToAddress.trim(),
          Number(ticket.ticketId)
        );
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
        if (!gasPrice) {
          throw new Error("Unable to estimate the current network fee.");
        }

        const balanceWei = await provider.getBalance(connectedWallet);
        const estimatedFeeWei = estimatedGas * gasPrice;
        const remainingWei = balanceWei > estimatedFeeWei ? balanceWei - estimatedFeeWei : 0n;

        if (!ignore) {
          setTransferEstimate({
            estimatedFeeEth: Number(formatEther(estimatedFeeWei)),
            remainingEth: Number(formatEther(remainingWei)),
            insufficientBalance: balanceWei < estimatedFeeWei
          });
        }
      } catch (error) {
        if (!ignore) {
          setTransferEstimate({
            estimatedFeeEth: null,
            remainingEth: null,
            insufficientBalance: false,
            error: error.message
          });
        }
      }
    }

    estimateTransfer();
    return () => {
      ignore = true;
    };
  }, [connectedWallet, ticket, transferToAddress]);

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

  function openTransferConfirm(event) {
    event.preventDefault();
    if (!ticket?.ticketId || !profile?.walletAddress) {
      pushToast("Load the supporter ticket before attempting a transfer.", "error");
      return;
    }
    if (!connectedWallet) {
      pushToast("Connect the current owner wallet in MetaMask before transferring.", "error");
      return;
    }
    if (connectedWallet.toLowerCase() !== String(ticket.ownerAddress || "").toLowerCase()) {
      pushToast("The connected MetaMask wallet must match the current on-chain ticket owner.", "error");
      return;
    }
    if (!selectedRecipientId) {
      pushToast("Choose a registered supporter to receive this ticket.", "error");
      return;
    }
    if (!isAddress(String(transferToAddress || "").trim())) {
      pushToast("Enter a valid Ethereum wallet address for the new owner.", "error");
      return;
    }
    if (String(transferToAddress || "").trim().toLowerCase() === String(ticket.ownerAddress || "").toLowerCase()) {
      pushToast("Transfer the ticket to a different wallet address.", "error");
      return;
    }
    if (transferEstimate?.insufficientBalance) {
      setTransferFundsOpen(true);
      return;
    }

    setTransferConfirmOpen(true);
  }

  async function confirmTransferTicket() {
    if (!ticket?.ticketId) {
      return;
    }

    try {
      setTransferBusy(true);
      const { contract } = await getBrowserTicketingContract();
      const tx = await contract.transferFrom(ticket.ownerAddress, transferToAddress.trim(), Number(ticket.ticketId));
      await tx.wait();

      const syncedTicket = await apiFetch(`/api/tickets/${ticket.ticketId}/sync-owner`, {
        method: "POST",
        body: JSON.stringify({
          txHash: tx.hash
        })
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
      setTransferConfirmOpen(false);
      pushToast("Transaction completed. The ticket transfer is now reflected on-chain and in the backend.", "info");
    } catch (error) {
      setTransferConfirmOpen(false);
      pushToast(`Transaction failed. ${error.message}`, "error");
    } finally {
      setTransferBusy(false);
    }
  }

  function openCheckInRequestConfirm() {
    if (!ticket?.ticketId || !ticket?.ownerAddress) {
      pushToast("Load the ticket details before sending a check-in request.", "error");
      return;
    }
    if (ticket.status !== "Valid") {
      pushToast("Only valid tickets can send a new check-in request.", "error");
      return;
    }

    setCheckInRequestConfirmOpen(true);
  }

  async function confirmCheckInRequest() {
    if (!ticket?.ticketId || !ticket?.ownerAddress) {
      return;
    }

    try {
      setCheckInRequestBusy(true);
      const result = await apiFetch("/api/verification/request", {
        method: "POST",
        body: JSON.stringify({
          ticketId: Number(ticket.ticketId),
          ownerAddress: ticket.ownerAddress
        })
      });

      setCheckInRequest(result);
      setCheckInRequestConfirmOpen(false);
      pushToast("Check-in request sent to the admin queue.", "info");
    } catch (error) {
      setCheckInRequestConfirmOpen(false);
      pushToast(error.message, "error");
    } finally {
      setCheckInRequestBusy(false);
    }
  }

  const selectedRecipient = transferOptions.find((supporter) => supporter.id === selectedRecipientId) || null;

  if (!ready || !profile) {
    return <AppStateScreen eyebrow="Ticket Detail" title="Loading ticket details" message="Pulling together your ticket record, QR code, and transfer controls." />;
  }

  return (
    <SupporterWorkspace
      profile={profile}
      title={ticket ? `Ticket #${ticket.ticketId}` : "Match ticket detail"}
      description="Expanded ticket information, including the QR code and transfer tools, lives here instead of in the summary list."
      onSignOut={signOut}
    >
      {loadError ? (
        <SectionCard
          title="Ticket unavailable"
        description="This ticket is no longer available for supporter actions."
        >
          <div className="detailGrid">
            <article className="miniCard ownedTicketCard detailSpanTwo">
              <span>Status</span>
              <strong>{loadError}</strong>
            </article>
          </div>
          <Link className="textLink" href="/fan/tickets">
            Return to my tickets
          </Link>
        </SectionCard>
      ) : null}

      {ticket ? (
        <>
          <SectionCard
            title="Ticket Record"
            description="Detailed view for the selected supporter ticket."
          >
            <div className="detailGrid">
              <article className="miniCard ownedTicketCard">
                <span>Status</span>
                <strong>{ticket?.status || "N/A"}</strong>
              </article>
              <article className="miniCard ownedTicketCard detailSpanTwo">
                <span>Fixture</span>
                <strong>{formatFixtureLabel(ticket?.match)}</strong>
                <span>
                  {ticket?.match?.matchDate
                    ? `${new Date(ticket.match.matchDate).toLocaleString()} at ${ticket.match.stadium || "Venue not available"}`
                    : `Match ID ${ticket?.matchId ?? "N/A"}`}
                </span>
              </article>
              <article className="miniCard ownedTicketCard">
                <span>Seat</span>
                <strong>{ticket?.seatNumber || "N/A"}</strong>
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
            <form className="transferBox" onSubmit={openTransferConfirm}>
              <div className="inlineForm">
                <button type="button" className="ghostButton" onClick={connectWallet}>
                  Connect owner wallet
                </button>
              <button type="button" className="ghostButton" onClick={addWalletFunds} disabled={!connectedWallet || fundingBusy}>
                {fundingBusy ? "Adding funds..." : "Add funds"}
              </button>
                <div className="miniCard ownedTicketCard transferStatusCard">
                  <span>Connected wallet</span>
                  <strong className="wallet">{connectedWallet || "Not connected"}</strong>
                </div>
                <div className="miniCard ownedTicketCard transferStatusCard">
              <span>Wallet gas balance</span>
                  <strong>{walletFunding ? `${Number(walletFunding.balanceEth).toFixed(4)} ETH` : "Connect wallet to check"}</strong>
                </div>
                <div className="miniCard ownedTicketCard transferStatusCard">
                  <span>Estimated transfer fee</span>
                  <strong>
                    {transferEstimate?.estimatedFeeEth != null
                      ? `${transferEstimate.estimatedFeeEth.toFixed(6)} ETH`
                      : "Choose a recipient to preview"}
                  </strong>
                </div>
                <div className="miniCard ownedTicketCard transferStatusCard">
                  <span>Estimated ETH after transfer</span>
                  <strong>
                    {transferEstimate?.remainingEth != null
                      ? `${transferEstimate.remainingEth.toFixed(6)} ETH`
                      : "Choose a recipient to preview"}
                  </strong>
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
              <button type="submit">
                    {transferEstimate?.insufficientBalance ? "Review transfer funds" : "Transfer ticket in MetaMask"}
              </button>
            </form>

            <div className="detailGrid">
              <article className="miniCard ownedTicketCard detailSpanTwo">
                <span>Latest transaction</span>
                <strong>{latestTransaction?.label || "No transfer submitted yet"}</strong>
                <span className="wallet">{latestTransaction?.hash || "The signed MetaMask transaction hash will appear here."}</span>
              </article>
            </div>
          </SectionCard>

          <SectionCard
            title="Matchday Entry"
            description="Send a check-in request from the supporter side first, then the admin team can verify and approve it from their queue."
          >
            <div className="detailGrid">
              <article className="miniCard ownedTicketCard">
                <span>Ticket status</span>
                <strong>{ticket.status}</strong>
              </article>
              <article className="miniCard ownedTicketCard detailSpanTwo">
                <span>Latest supporter request</span>
                <strong>{checkInRequest ? checkInRequest.status : "No check-in request sent yet"}</strong>
                <span>
                  {checkInRequest?.createdAt
                    ? `Sent ${new Date(checkInRequest.createdAt).toLocaleString()}`
                    : "Use the button below when you are ready to ask the admin team to verify this ticket."}
                </span>
              </article>
            </div>
            <div className="actions">
              <button type="button" onClick={openCheckInRequestConfirm} disabled={ticket.status !== "Valid"}>
                {ticket.status === "Valid" ? "Send check-in request" : "Ticket not eligible for a new request"}
              </button>
            </div>
          </SectionCard>

          <Link className="textLink" href="/fan/tickets">
            Back to my tickets
          </Link>
        </>
      ) : null}

      <ConfirmDialog
        open={transferConfirmOpen}
        eyebrow="Transfer ticket"
        title="Confirm ticket transfer"
        message={
          selectedRecipient
            ? `Are you sure you want to transfer ticket ${ticket?.ticketId} to ${selectedRecipient.fullName}?`
            : ""
        }
        confirmLabel="Yes, transfer ticket"
        cancelLabel="No, cancel"
        busy={transferBusy}
        onConfirm={confirmTransferTicket}
        onCancel={() => {
          if (transferBusy) {
            return;
          }

          setTransferConfirmOpen(false);
          pushToast("Ticket transfer cancelled.", "info");
        }}
      >
        <article className="miniCard ownedTicketCard">
          <span>Recipient supporter</span>
          <strong>{selectedRecipient?.fullName || "No supporter selected"}</strong>
        </article>
        <article className="miniCard ownedTicketCard detailSpanTwo">
          <span>Recipient MetaMask wallet</span>
          <strong className="wallet">{transferToAddress || "No wallet selected"}</strong>
        </article>
        <article className="miniCard ownedTicketCard detailSpanTwo">
          <span>Transfer note</span>
          <strong>
            {transferEstimate?.insufficientBalance
              ? `This transfer is estimated to need about ${transferEstimate.estimatedFeeEth.toFixed(6)} ETH, and the connected wallet does not currently have enough ETH to cover it.`
              : transferEstimate?.estimatedFeeEth != null
              ? `MetaMask is likely to use about ${transferEstimate.estimatedFeeEth.toFixed(6)} ETH, leaving roughly ${transferEstimate.remainingEth.toFixed(6)} ETH after this transfer.`
              : transferEstimate?.error || "Choose a recipient to estimate the ETH needed for this transfer."}
          </strong>
        </article>
      </ConfirmDialog>

      <ConfirmDialog
        open={transferFundsOpen}
        eyebrow="Insufficient ETH"
        title="Add funds before transferring"
        message="The connected wallet does not currently have enough ETH to cover the estimated MetaMask transfer fee."
        confirmLabel="Add funds"
        cancelLabel="Close"
        onConfirm={() => {
          setTransferFundsOpen(false);
          addWalletFunds();
        }}
        onCancel={() => setTransferFundsOpen(false)}
      >
        <article className="miniCard ownedTicketCard">
          <span>Estimated transfer fee</span>
          <strong>
            {transferEstimate?.estimatedFeeEth != null
              ? `${transferEstimate.estimatedFeeEth.toFixed(6)} ETH`
              : "Estimate not available"}
          </strong>
        </article>
        <article className="miniCard ownedTicketCard">
          <span>Current wallet balance</span>
          <strong>{walletFunding ? `${Number(walletFunding.balanceEth).toFixed(6)} ETH` : "Connect wallet to check"}</strong>
        </article>
      </ConfirmDialog>

      <ConfirmDialog
        open={checkInRequestConfirmOpen}
        eyebrow="Request check-in"
        title="Send supporter check-in request"
        message={
          ticket?.match
            ? `Are you sure you want to ask the admin team to verify and check you in for ${formatFixtureLabel(ticket.match)}?`
            : `Are you sure you want to ask the admin team to verify and check in ticket ${ticket?.ticketId}?`
        }
        confirmLabel="Yes, send request"
        cancelLabel="No, cancel"
        busy={checkInRequestBusy}
        onConfirm={confirmCheckInRequest}
        onCancel={() => {
          if (checkInRequestBusy) {
            return;
          }

          setCheckInRequestConfirmOpen(false);
          pushToast("Check-in request cancelled.", "info");
        }}
      >
        <article className="miniCard ownedTicketCard">
          <span>Ticket</span>
          <strong>#{ticket?.ticketId}</strong>
        </article>
        <article className="miniCard ownedTicketCard detailSpanTwo">
          <span>Fixture</span>
          <strong>{formatFixtureLabel(ticket?.match)}</strong>
        </article>
      </ConfirmDialog>
    </SupporterWorkspace>
  );
}
