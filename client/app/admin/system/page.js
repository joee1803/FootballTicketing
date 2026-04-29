"use client";

import { useEffect, useMemo, useState } from "react";

import { AppStateScreen } from "../../../components/AppStateScreen";
import { AdminWorkspace } from "../../../components/AdminWorkspace";
import { BlockchainPanel } from "../../../components/BlockchainPanel";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LauncherDetailFlow } from "../../../components/LauncherDetailFlow";
import { PasswordField } from "../../../components/PasswordField";
import { SectionCard } from "../../../components/SectionCard";
import { apiFetch } from "../../../lib/api";
import { buildAssignedAdminEmail } from "../../../lib/identity";
import { useAdminSession } from "../../../lib/useAdminSession";
import { useToast } from "../../../components/ToastProvider";

const initialAdmin = {
  name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

export default function AdminSystemPage() {
  const { ready, session, signOut } = useAdminSession();
  const { pushToast } = useToast();
  const [blockchainStatus, setBlockchainStatus] = useState(null);
  const [latestTransaction, setLatestTransaction] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [removalRequests, setRemovalRequests] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [newAdminForm, setNewAdminForm] = useState(initialAdmin);
  const [adminRemovalReason, setAdminRemovalReason] = useState("");
  const [systemLoadError, setSystemLoadError] = useState("");
  const [activeView, setActiveView] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!newAdminForm.name || newAdminForm.email) {
      return;
    }

    setNewAdminForm((current) => ({
      ...current,
      email: buildAssignedAdminEmail(current.name)
    }));
  }, [newAdminForm.name, newAdminForm.email]);

  function refreshLists(nextAdmins, nextRequests, nextRemovalRequests, nextActivityLogs) {
    setAdmins(nextAdmins);
    setAdminRequests(nextRequests);
    setRemovalRequests(nextRemovalRequests);
    setActivityLogs(nextActivityLogs);

    const nextLatest = nextActivityLogs.find((entry) => entry.metadata?.txHash) || nextActivityLogs[0] || null;
    setLatestTransaction(
      nextLatest
        ? {
            label: nextLatest.summary,
            hash: nextLatest.metadata?.txHash || ""
          }
        : null
    );
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let ignore = false;

    async function loadSystem() {
      try {
        setSystemLoadError("");
        const status = await apiFetch("/api/blockchain/status");
        if (!ignore) {
          setBlockchainStatus(status);
        }

        const loadedActivityLogs = await apiFetch("/api/auth/admin/activity", { token: session.token });

        if (session.admin.role === "SUPER_ADMIN") {
          const [nextAdmins, nextRequests, nextRemovalRequests] = await Promise.all([
            apiFetch("/api/auth/admin/list?includeDeleted=true", { token: session.token }),
            apiFetch("/api/auth/admin/requests", { token: session.token }),
            apiFetch("/api/auth/supporters/removal-requests", { token: session.token })
          ]);

          if (!ignore) {
            refreshLists(nextAdmins, nextRequests, nextRemovalRequests, loadedActivityLogs);
          }
        } else if (!ignore) {
          refreshLists([], [], [], loadedActivityLogs);
        }
      } catch (error) {
        if (!ignore) {
          if (error.status === 401 || error.status === 403) {
            signOut();
            return;
          }

          const message = error.message || "System tools could not be loaded. Please try again.";
          setSystemLoadError(message);
          pushToast(message, "error");
        }
      }
    }

    loadSystem();
    return () => {
      ignore = true;
    };
  }, [pushToast, session, signOut]);

  const confirmCopy = useMemo(() => {
    if (!confirmAction) {
      return null;
    }

    if (confirmAction.type === "create-admin") {
      return {
        eyebrow: "Create admin",
        title: "Confirm admin creation",
        message: `Are you sure you want to create an admin account for ${confirmAction.payload.name}?`,
        confirmLabel: "Yes, create admin",
        cancelLabel: "No, cancel"
      };
    }

    if (confirmAction.type === "promote-admin") {
      return {
        eyebrow: "Promote admin",
        title: "Confirm super admin promotion",
        message: `Are you sure you want to promote ${confirmAction.payload.name} to super admin privileges?`,
        confirmLabel: "Yes, promote admin",
        cancelLabel: "No, keep as admin"
      };
    }

    if (confirmAction.type === "remove-admin" || confirmAction.type === "restore-admin") {
      return {
        eyebrow: confirmAction.type === "remove-admin" ? "Remove admin" : "Restore admin",
        title: confirmAction.type === "remove-admin" ? "Confirm admin removal" : "Confirm admin restore",
        message:
          confirmAction.type === "remove-admin"
            ? `Are you sure you want to remove ${confirmAction.payload.name} from the active admin directory?`
            : `Are you sure you want to restore ${confirmAction.payload.name} into the active admin directory?`,
        confirmLabel: confirmAction.type === "remove-admin" ? "Yes, remove admin" : "Yes, restore admin",
        cancelLabel: "No, cancel"
      };
    }

    if (confirmAction.type === "approve-removal-request" || confirmAction.type === "deny-removal-request") {
      return {
        eyebrow: "Supporter removal",
        title: `Confirm request ${confirmAction.type === "approve-removal-request" ? "approval" : "denial"}`,
        message: `Are you sure you want to ${confirmAction.type === "approve-removal-request" ? "approve" : "deny"} the supporter removal request for ${confirmAction.payload.supporterName}?`,
        confirmLabel: confirmAction.type === "approve-removal-request" ? "Yes, approve" : "Yes, deny",
        cancelLabel: "No, cancel"
      };
    }

    return {
      eyebrow: "Review request",
      title: `Confirm request ${confirmAction.type === "approve-request" ? "approval" : "denial"}`,
      message: `Are you sure you want to ${confirmAction.type === "approve-request" ? "approve" : "deny"} ${confirmAction.payload.name}'s admin request?`,
      confirmLabel: confirmAction.type === "approve-request" ? "Yes, approve" : "Yes, deny",
      cancelLabel: "No, cancel"
    };
  }, [confirmAction]);

  const workflowCards = useMemo(() => {
    if (session?.admin?.role !== "SUPER_ADMIN") {
      return [];
    }

    const pendingAdminRequests = adminRequests.filter((request) => request.status === "PENDING").length;
    const pendingRemovalRequests = removalRequests.filter((request) => request.status === "PENDING").length;
    const activeAdmins = admins.filter((admin) => !admin.isDeleted);
    const superAdmins = activeAdmins.filter((admin) => admin.role === "SUPER_ADMIN");

    return [
      {
        id: "create-admin",
        eyebrow: "Admin setup",
        title: "Create admin",
        summary: "Start here when a new approved admin needs a permanent account in the system.",
        countLabel: `${activeAdmins.length} live admin${activeAdmins.length === 1 ? "" : "s"}`,
        hint: "The account is created as a standard admin first, then promoted only if needed.",
        actionLabel: "Open create admin"
      },
      {
        id: "admin-directory",
        eyebrow: "Directory",
        title: "Admin directory",
        summary: "Review the current admin list, audit roles, and promote standard admins where appropriate.",
        countLabel: `${superAdmins.length} super admin${superAdmins.length === 1 ? "" : "s"}`,
        hint: "The founding super admin stays protected, while removed admins can be restored later.",
        actionLabel: "Open admin directory"
      },
      {
        id: "admin-requests",
        eyebrow: "Access queue",
        title: "Admin requests",
        summary: "Clear the access queue by approving or denying requests from prospective admins.",
        countLabel: `${pendingAdminRequests} pending request${pendingAdminRequests === 1 ? "" : "s"}`,
        hint: "Reviewed requests remain visible for accountability and audit history.",
        actionLabel: "Open admin requests"
      },
      {
        id: "supporter-removal-requests",
        eyebrow: "Removal queue",
        title: "Supporter removal requests",
        summary: "Handle standard-admin removal requests so no supporter record is deleted without super-admin review.",
        countLabel: `${pendingRemovalRequests} pending removal${pendingRemovalRequests === 1 ? "" : "s"}`,
        hint: "Approve only when the request and audit trail both make sense.",
        actionLabel: "Open removal queue"
      },
      {
        id: "blockchain-status",
        eyebrow: "Activity",
        title: "Recent activity",
        summary: "Review network status and the latest supporter and admin actions.",
        countLabel: `${activityLogs.length} activity record${activityLogs.length === 1 ? "" : "s"}`,
        hint: "Activity is grouped in batches so the page stays readable.",
        actionLabel: "Open activity"
      }
    ];
  }, [activityLogs.length, adminRequests, admins, removalRequests, session?.admin?.role]);

  async function reloadSuperAdminData() {
    const [nextAdmins, nextRequests, nextRemovalRequests, nextActivityLogs] = await Promise.all([
      apiFetch("/api/auth/admin/list?includeDeleted=true", { token: session.token }),
      apiFetch("/api/auth/admin/requests", { token: session.token }),
      apiFetch("/api/auth/supporters/removal-requests", { token: session.token }),
      apiFetch("/api/auth/admin/activity", { token: session.token })
    ]);

    refreshLists(nextAdmins, nextRequests, nextRemovalRequests, nextActivityLogs);
  }

  function requestCreateAdmin(event) {
    event.preventDefault();
    const assignedEmail = newAdminForm.email || buildAssignedAdminEmail(newAdminForm.name);

    if (!newAdminForm.name || !assignedEmail || !newAdminForm.password || !newAdminForm.confirmPassword) {
      pushToast("Name, email, password, and confirm password are required.", "error");
      return;
    }
    if (newAdminForm.password !== newAdminForm.confirmPassword) {
      pushToast("Password and confirm password must match.", "error");
      return;
    }

    setConfirmAction({
      type: "create-admin",
      payload: {
        ...newAdminForm,
        email: assignedEmail
      }
    });
  }

  async function commitConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    try {
      setActionBusy(true);

      if (confirmAction.type === "create-admin") {
        const created = await apiFetch("/api/auth/admin/create", {
          method: "POST",
          token: session.token,
          body: JSON.stringify(confirmAction.payload)
        });

        pushToast(`Admin ${created.email} created.`, "info");
        setNewAdminForm(initialAdmin);
      }

      if (confirmAction.type === "approve-request" || confirmAction.type === "deny-request") {
        await apiFetch(`/api/auth/admin/requests/${confirmAction.payload.id}/${confirmAction.type === "approve-request" ? "approve" : "deny"}`, {
          method: "POST",
          token: session.token
        });

        pushToast(`Admin request ${confirmAction.type === "approve-request" ? "approved" : "denied"}.`, "info");
      }

      if (confirmAction.type === "promote-admin") {
        const promoted = await apiFetch(`/api/auth/admin/${confirmAction.payload.id}/promote`, {
          method: "POST",
          token: session.token
        });
        pushToast(`${promoted.name} is now a super admin.`, "info");
      }

      if (confirmAction.type === "remove-admin") {
        const removed = await apiFetch(`/api/auth/admin/${confirmAction.payload.id}/remove`, {
          method: "POST",
          token: session.token,
          body: JSON.stringify({
            reason: confirmAction.payload.reason || ""
          })
        });
        pushToast(`${removed.name} removed from the active admin directory.`, "info");
        setAdminRemovalReason("");
      }

      if (confirmAction.type === "restore-admin") {
        const restored = await apiFetch(`/api/auth/admin/${confirmAction.payload.id}/restore`, {
          method: "POST",
          token: session.token
        });
        pushToast(`${restored.name} restored into the active admin directory.`, "info");
      }

      if (confirmAction.type === "approve-removal-request" || confirmAction.type === "deny-removal-request") {
        await apiFetch(
          `/api/auth/supporters/removal-requests/${confirmAction.payload.id}/${confirmAction.type === "approve-removal-request" ? "approve" : "deny"}`,
          {
            method: "POST",
            token: session.token
          }
        );

        pushToast(
          `Supporter removal request ${confirmAction.type === "approve-removal-request" ? "approved" : "denied"}.`,
          "info"
        );
      }

      if (session.admin.role === "SUPER_ADMIN") {
        await reloadSuperAdminData();
      }

      setConfirmAction(null);
    } catch (error) {
      setConfirmAction(null);
      pushToast(error.message, "error");
    } finally {
      setActionBusy(false);
    }
  }

  if (!ready || !session) {
    return <AppStateScreen eyebrow="Admin System" title="Loading system tools" message="Connecting the blockchain status, activity feed, and super-admin controls." />;
  }

  function renderSystemView(view) {
    if (view === "blockchain-status") {
      return (
        <BlockchainPanel
          status={blockchainStatus}
          latestTransaction={latestTransaction}
          activityLogs={activityLogs}
          title="Blockchain Status"
        />
      );
    }

    if (view === "create-admin") {
      return (
        <SectionCard
          id="create-admin"
          title="Create Admin"
          description="Create approved admins as standard admins first, then promote them later only when needed."
        >
          <form className="form" onSubmit={requestCreateAdmin}>
            <input placeholder="Full name" value={newAdminForm.name} onChange={(event) => setNewAdminForm({ ...newAdminForm, name: event.target.value })} />
            <input placeholder="Assigned email" value={newAdminForm.email} readOnly />
            <PasswordField placeholder="Password" value={newAdminForm.password} onChange={(event) => setNewAdminForm({ ...newAdminForm, password: event.target.value })} />
            <PasswordField placeholder="Confirm password" value={newAdminForm.confirmPassword} onChange={(event) => setNewAdminForm({ ...newAdminForm, confirmPassword: event.target.value })} />
            <div className="miniCard">
              <strong>Role on creation</strong>
              <span>Admin</span>
            </div>
            <button type="submit">Create admin</button>
          </form>
        </SectionCard>
      );
    }

    if (view === "admin-directory") {
      const activeAdmins = admins.filter((admin) => !admin.isDeleted);
      const removedAdmins = admins.filter((admin) => admin.isDeleted);

      return (
        <SectionCard
          id="admin-directory"
          title="Admin Directory"
          description="Full admin records with promotion, removal, and restore controls for super admin review."
        >
          <div className="form">
            <textarea
              placeholder="Optional reason for removing an admin from the active directory."
              value={adminRemovalReason}
              onChange={(event) => setAdminRemovalReason(event.target.value)}
            />
          </div>
          <div className="listStack">
            {activeAdmins.map((admin) => (
              <article className="miniCard" key={admin.id || admin._id}>
                <strong>{admin.name}</strong>
                <span>{admin.email}</span>
                <span>{admin.role}</span>
                <span>Created: {admin.createdAt ? new Date(admin.createdAt).toLocaleString() : "N/A"}</span>
                {admin.isPrimarySuperAdmin ? (
                  <span className="fixtureLabel">Founding super admin</span>
                ) : null}
                {!admin.isPrimarySuperAdmin && admin.role === "ADMIN" ? (
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          type: "promote-admin",
                          payload: {
                            id: admin.id || admin._id,
                            name: admin.name
                          }
                        })
                      }
                    >
                      Promote to super admin
                    </button>
                  </div>
                ) : null}
                {!admin.isPrimarySuperAdmin && String(admin.id || admin._id) !== String(session.admin.id) ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setConfirmAction({
                          type: "remove-admin",
                          payload: {
                            id: admin.id || admin._id,
                            name: admin.name,
                            reason: adminRemovalReason
                          }
                        })
                      }
                    >
                      Remove admin
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {!activeAdmins.length ? (
              <article className="miniCard">
                <strong>No active admins found.</strong>
              </article>
            ) : null}
          </div>

          <div className="sectionDivider" aria-hidden="true" />
          <h3>Removed admins</h3>
          <div className="listStack">
            {removedAdmins.map((admin) => (
              <article className="miniCard" key={admin.id || admin._id}>
                <strong>{admin.name}</strong>
                <span>{admin.email}</span>
                <span>{admin.role}</span>
                <span>Removed: {admin.deletedAt ? new Date(admin.deletedAt).toLocaleString() : "N/A"}</span>
                {admin.deletionReason ? <span>Reason: {admin.deletionReason}</span> : null}
                <div className="actions">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: "restore-admin",
                        payload: {
                          id: admin.id || admin._id,
                          name: admin.name
                        }
                      })
                    }
                  >
                    Restore admin
                  </button>
                </div>
              </article>
            ))}
            {!removedAdmins.length ? (
              <article className="miniCard">
                <strong>No removed admins.</strong>
              </article>
            ) : null}
          </div>
        </SectionCard>
      );
    }

    if (view === "admin-requests") {
      return (
        <SectionCard
          id="admin-requests"
          title="Admin Requests"
          description="Pending and reviewed access requests."
        >
          <div className="listStack">
            {adminRequests.map((request) => (
              <article className="miniCard" key={request._id || request.id}>
                <strong>{request.name}</strong>
                <span>{request.email}</span>
                <span>{request.status}</span>
                {request.reason ? <span>{request.reason}</span> : null}
                {request.status === "PENDING" ? (
                  <div className="inlineForm">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          type: "approve-request",
                          payload: {
                            id: request._id || request.id,
                            name: request.name
                          }
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setConfirmAction({
                          type: "deny-request",
                          payload: {
                            id: request._id || request.id,
                            name: request.name
                          }
                        })
                      }
                    >
                      Deny
                    </button>
                  </div>
                ) : (
                  <span>
                    Reviewed by {request.reviewedBy || "N/A"} on{" "}
                    {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "N/A"}
                  </span>
                )}
              </article>
            ))}
          </div>
        </SectionCard>
      );
    }

    return (
      <SectionCard
        id="supporter-removal-requests"
        title="Supporter Removal Requests"
        description="Approve or deny supporter removals requested by standard admins."
      >
        <div className="listStack">
          {removalRequests.map((request) => (
            <article className="miniCard" key={request.id}>
              <strong>{request.supporterName}</strong>
              <span>{request.supporterEmail}</span>
              <span>Status: {request.status}</span>
              <span>Requested by: {request.requestedByName}</span>
              {request.reason ? <span>Reason: {request.reason}</span> : null}
              {request.status === "PENDING" ? (
                <div className="inlineForm">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: "approve-removal-request",
                        payload: request
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setConfirmAction({
                        type: "deny-removal-request",
                        payload: request
                      })
                    }
                  >
                    Deny
                  </button>
                </div>
              ) : (
                <span>
                  Reviewed by {request.reviewedByName || "N/A"} on{" "}
                  {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "N/A"}
                </span>
              )}
            </article>
          ))}
          {!removalRequests.length ? (
            <article className="miniCard">
              <strong>No supporter removal requests yet.</strong>
            </article>
          ) : null}
        </div>
      </SectionCard>
    );
  }

  return (
    <AdminWorkspace
      session={session}
      title="System"
      description={
        session.admin.role === "SUPER_ADMIN"
          ? "Network status, approval queues, admin controls, and activity history live here for super-admin oversight."
          : "Network status and your own recent admin actions live here for quick review."
      }
      onSignOut={signOut}
    >
      {systemLoadError ? (
        <SectionCard
          title="System tools unavailable"
          description="Your admin session is still active. Refresh this section once the service is ready."
        >
          <article className="miniCard detailSpanTwo">
            <span>Issue</span>
            <strong>{systemLoadError}</strong>
          </article>
        </SectionCard>
      ) : null}

      {session.admin.role === "SUPER_ADMIN" ? (
        <LauncherDetailFlow
          activeView={activeView}
          cards={workflowCards.map((card) => ({
            id: card.id,
            eyebrow: card.eyebrow,
            title: card.title,
            description: card.summary,
            meta: card.countLabel,
            preview: (
              <article className="launcherPreviewCard">
                <span className="fixtureLabel">Guidance</span>
                <strong>{card.hint}</strong>
              </article>
            )
          }))}
          title="System workflow map"
          description="Open one system workflow at a time. The selected tool becomes the main focus and the rest of the workspace stays out of the way."
          onSelect={setActiveView}
          onBack={() => setActiveView("")}
          renderDetail={renderSystemView}
        />
      ) : (
        <BlockchainPanel
          status={blockchainStatus}
          latestTransaction={latestTransaction}
          activityLogs={activityLogs}
          title="My Latest Transactions"
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmAction && confirmCopy)}
        eyebrow={confirmCopy?.eyebrow || "Confirm action"}
        title={confirmCopy?.title || "Confirm action"}
        message={confirmCopy?.message || ""}
        confirmLabel={confirmCopy?.confirmLabel || "Confirm"}
        cancelLabel={confirmCopy?.cancelLabel || "Cancel"}
        busy={actionBusy}
        onConfirm={commitConfirmedAction}
        onCancel={() => {
          if (actionBusy) {
            return;
          }

          setConfirmAction(null);
          pushToast("Admin action cancelled.", "info");
        }}
      >
        {confirmAction?.type === "create-admin" ? (
          <>
            <article className="miniCard">
              <span>Name</span>
              <strong>{confirmAction.payload.name}</strong>
            </article>
            <article className="miniCard">
              <span>Email</span>
              <strong>{confirmAction.payload.email}</strong>
            </article>
          </>
        ) : null}
        {confirmAction?.payload?.reason ? (
          <article className="miniCard detailSpanTwo">
            <span>Reason</span>
            <strong>{confirmAction.payload.reason}</strong>
          </article>
        ) : null}
      </ConfirmDialog>
    </AdminWorkspace>
  );
}
