"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppStateScreen } from "../../../../components/AppStateScreen";
import { apiFetch } from "../../../../lib/api";
import { AdminWorkspace } from "../../../../components/AdminWorkspace";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import { SectionCard } from "../../../../components/SectionCard";
import { formatFixtureLabel } from "../../../../lib/fixtures";
import { useAdminSession } from "../../../../lib/useAdminSession";
import { useToast } from "../../../../components/ToastProvider";

export default function SupporterDetailPage() {
  const params = useParams();
  const { ready, session, signOut } = useAdminSession();
  const { pushToast } = useToast();
  const [supporter, setSupporter] = useState(null);
  const [visibility, setVisibility] = useState("LIMITED");
  const [tickets, setTickets] = useState([]);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [removalReason, setRemovalReason] = useState("");
  const [supporterAction, setSupporterAction] = useState(null);
  const [supporterActionBusy, setSupporterActionBusy] = useState(false);

  useEffect(() => {
    if (!session?.token || !params?.supporterId) {
      return;
    }

    let ignore = false;

    async function loadSupporter() {
      try {
        const [result, nextTickets] = await Promise.all([
          apiFetch(`/api/auth/supporters/${params.supporterId}`, {
            token: session.token
          }),
          apiFetch(`/api/tickets/supporter/${params.supporterId}`, {
            token: session.token
          })
        ]);

        if (!ignore) {
          setSupporter(result.supporter);
          setVisibility(result.visibility);
          setTickets(nextTickets);
        }
      } catch (error) {
        if (!ignore) {
          pushToast(error.message, "error");
        }
      }
    }

    loadSupporter();
    return () => {
      ignore = true;
    };
  }, [params?.supporterId, pushToast, session]);

  async function confirmRevokeTicket() {
    if (!revokeTarget) {
      return;
    }

    try {
      setRevokeBusy(true);
      await apiFetch(`/api/tickets/${revokeTarget.ticketId}/revoke`, {
        method: "POST",
        token: session.token
      });

      pushToast(`Ticket ${revokeTarget.ticketId} revoked.`, "info");
      setRevokeTarget(null);
      setTickets(await apiFetch(`/api/tickets/supporter/${params.supporterId}`, { token: session.token }));
    } catch (error) {
      setRevokeTarget(null);
      pushToast(error.message, "error");
    } finally {
      setRevokeBusy(false);
    }
  }

  async function confirmSupporterAction() {
    if (!supporter || !supporterAction) {
      return;
    }

    try {
      setSupporterActionBusy(true);

      if (supporterAction === "request-removal") {
        await apiFetch(`/api/auth/supporters/${params.supporterId}/remove-request`, {
          method: "POST",
          token: session.token,
          body: JSON.stringify({
            reason: removalReason
          })
        });
        pushToast("Supporter removal request sent to the super admin for review.", "info");
      }

      if (supporterAction === "remove") {
        const result = await apiFetch(`/api/auth/supporters/${params.supporterId}/remove`, {
          method: "POST",
          token: session.token,
          body: JSON.stringify({
            reason: removalReason
          })
        });
        setSupporter(result.supporter);
        pushToast("Supporter removed from the active directory. You can still restore the record later.", "info");
      }

      if (supporterAction === "restore") {
        const result = await apiFetch(`/api/auth/supporters/${params.supporterId}/restore`, {
          method: "POST",
          token: session.token
        });
        setSupporter(result.supporter);
        pushToast("Supporter restored into the active directory.", "info");
      }

      setSupporterAction(null);
      if (supporterAction !== "restore") {
        setRemovalReason("");
      }
    } catch (error) {
      setSupporterAction(null);
      pushToast(error.message, "error");
    } finally {
      setSupporterActionBusy(false);
    }
  }

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Supporter Record" title="Loading supporter details" message="Assembling the supporter record, visibility rules, and ticket history." />;
  }

  return (
    <AdminWorkspace
      session={session}
      title={supporter?.fullName || "Supporter record"}
      description={
        visibility === "FULL"
          ? "Super admin detail view with the full supporter record."
          : "Admin-safe supporter detail view with non-sensitive information only."
      }
      onSignOut={signOut}
    >
      <SectionCard
        title="Supporter Record"
        description="Expanded detail view for the selected supporter."
      >
        <div className="detailGrid">
          <article className="miniCard supporterCard">
            <span>Full name</span>
            <strong>{supporter?.fullName || "N/A"}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Favourite club</span>
            <strong>{supporter?.favouriteClub || "Not set"}</strong>
          </article>
          <article className="miniCard supporterCard">
            <span>Joined</span>
            <strong>{supporter?.createdAt ? new Date(supporter.createdAt).toLocaleString() : "N/A"}</strong>
          </article>
          {visibility === "FULL" ? (
            <article className="miniCard supporterCard">
              <span>Assigned email</span>
              <strong>{supporter?.email || "N/A"}</strong>
            </article>
          ) : null}
          {visibility === "FULL" ? (
            <article className="miniCard supporterCard detailSpanTwo">
              <span>MetaMask wallet</span>
              <strong className="wallet">{supporter?.walletAddress || "N/A"}</strong>
            </article>
          ) : null}
          <article className="miniCard supporterCard">
            <span>Directory status</span>
            <strong>{supporter?.isDeleted ? "Removed" : "Active"}</strong>
          </article>
          {visibility === "FULL" && supporter?.isDeleted ? (
            <article className="miniCard supporterCard detailSpanTwo">
              <span>Removal details</span>
              <strong>{supporter?.deletedAt ? new Date(supporter.deletedAt).toLocaleString() : "Removed"}</strong>
              <span>{supporter?.deletionReason || "No reason saved."}</span>
            </article>
          ) : null}
        </div>
        <div className="form">
          {!supporter?.isDeleted ? (
            <textarea
              placeholder={
                session.admin.role === "SUPER_ADMIN"
                  ? "Optional reason for removing this supporter from the active directory."
                  : "Reason for the super admin approval request."
              }
              value={removalReason}
              onChange={(event) => setRemovalReason(event.target.value)}
            />
          ) : null}
          <div className="actions">
            {session.admin.role === "SUPER_ADMIN" && !supporter?.isDeleted ? (
              <button type="button" className="secondary" onClick={() => setSupporterAction("remove")}>
                Remove supporter
              </button>
            ) : null}
            {session.admin.role === "SUPER_ADMIN" && supporter?.isDeleted ? (
              <button type="button" onClick={() => setSupporterAction("restore")}>
                Restore supporter
              </button>
            ) : null}
            {session.admin.role !== "SUPER_ADMIN" && !supporter?.isDeleted ? (
              <button type="button" className="secondary" onClick={() => setSupporterAction("request-removal")}>
                Request supporter removal
              </button>
            ) : null}
          </div>
        </div>
        <Link className="textLink" href="/admin/supporters">
          Back to supporter directory
        </Link>
      </SectionCard>

      <SectionCard
        title="Supporter Tickets"
        description="Review the selected supporter’s tickets here and revoke one immediately when needed."
      >
        <div className="listStack">
          {tickets.map((ticket) => (
            <article className="miniCard ownedTicketCard" key={ticket.ticketId}>
              <p className="fixtureLabel">Ticket #{ticket.ticketId}</p>
              <strong>{formatFixtureLabel(ticket.match)}</strong>
              <span>{ticket.match?.matchDate ? new Date(ticket.match.matchDate).toLocaleString() : `Match ID ${ticket.matchId}`}</span>
              <span>Seat: {ticket.seatNumber}</span>
              <span>Status: {ticket.status}</span>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={ticket.status !== "Valid"}
                  onClick={() => setRevokeTarget(ticket)}
                >
                  {ticket.status === "Valid" ? "Revoke ticket" : "Already inactive"}
                </button>
              </div>
            </article>
          ))}
          {!tickets.length ? (
            <article className="miniCard">
              <strong>No active tickets found for this supporter.</strong>
            </article>
          ) : null}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        eyebrow="Revoke ticket"
        title="Confirm ticket revocation"
        message={
          revokeTarget
            ? `Are you sure you want to invalidate ticket ${revokeTarget.ticketId} for ${formatFixtureLabel(revokeTarget.match)}?`
            : ""
        }
        confirmLabel="Yes, revoke ticket"
        cancelLabel="No, cancel"
        busy={revokeBusy}
        onConfirm={confirmRevokeTicket}
        onCancel={() => {
          if (revokeBusy) {
            return;
          }

          setRevokeTarget(null);
          pushToast("Ticket revocation cancelled.", "info");
        }}
      >
        <article className="miniCard ownedTicketCard">
          <span>Seat</span>
          <strong>{revokeTarget?.seatNumber || "Not set"}</strong>
        </article>
        <article className="miniCard ownedTicketCard detailSpanTwo">
          <span>Fixture</span>
          <strong>{revokeTarget ? formatFixtureLabel(revokeTarget.match) : "Not set"}</strong>
        </article>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(supporterAction)}
        eyebrow={
          supporterAction === "restore"
            ? "Restore supporter"
            : supporterAction === "remove"
            ? "Remove supporter"
            : "Request removal"
        }
        title={
          supporterAction === "restore"
            ? "Confirm supporter restore"
            : supporterAction === "remove"
            ? "Confirm supporter removal"
            : "Confirm removal request"
        }
        message={
          supporterAction === "restore"
            ? `Are you sure you want to restore ${supporter?.fullName} into the active supporter directory?`
            : supporterAction === "remove"
            ? `Are you sure you want to remove ${supporter?.fullName} from the active supporter directory?`
            : `Are you sure you want to send a removal request for ${supporter?.fullName} to the super admin?`
        }
        confirmLabel={
          supporterAction === "restore"
            ? "Yes, restore supporter"
            : supporterAction === "remove"
            ? "Yes, remove supporter"
            : "Yes, send request"
        }
        cancelLabel="No, cancel"
        busy={supporterActionBusy}
        onConfirm={confirmSupporterAction}
        onCancel={() => {
          if (supporterActionBusy) {
            return;
          }

          setSupporterAction(null);
          pushToast("Supporter action cancelled.", "info");
        }}
      >
        <article className="miniCard supporterCard">
          <span>Supporter</span>
          <strong>{supporter?.fullName || "Not set"}</strong>
        </article>
        {removalReason ? (
          <article className="miniCard supporterCard detailSpanTwo">
            <span>Reason</span>
            <strong>{removalReason}</strong>
          </article>
        ) : null}
      </ConfirmDialog>
    </AdminWorkspace>
  );
}
