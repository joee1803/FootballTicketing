"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearSupporterProfile } from "../lib/supporterProfile";
import { apiFetch } from "../lib/api";
import { buildAssignedAdminEmail } from "../lib/identity";
import { loadSessionState, saveExclusiveAdminSession } from "../lib/sessionState";
import { AppStateScreen } from "./AppStateScreen";
import { HelpButton } from "./HelpButton";
import { useToast } from "./ToastProvider";
import { PasswordField } from "./PasswordField";

const defaultSignInForm = {
  identifier: "",
  password: ""
};

const defaultRequestForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  reason: ""
};

export function AdminAuthPortal() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mode, setMode] = useState("sign-in");
  const [signInForm, setSignInForm] = useState(defaultSignInForm);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);
  const [ready, setReady] = useState(false);
  const [blockedSupporter, setBlockedSupporter] = useState(null);

  useEffect(() => {
    const { adminSession, supporterSession } = loadSessionState();

    // Admin and supporter identities are exclusive so privileged screens cannot overlap with fan access.
    if (adminSession) {
      router.replace("/admin");
      return;
    }

    if (supporterSession) {
      setBlockedSupporter(supporterSession);
      setReady(true);
      return;
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!requestForm.name || requestForm.email) {
      return;
    }

    setRequestForm((current) => ({
      ...current,
      email: buildAssignedAdminEmail(current.name)
    }));
  }, [requestForm.name, requestForm.email]);

  async function handleSignIn(event) {
    event.preventDefault();

    if (loadSessionState().supporterSession) {
      pushToast("Sign out of the supporter dashboard before signing in as an admin.", "error");
      setBlockedSupporter(loadSessionState().supporterSession);
      return;
    }

    try {
      const session = await apiFetch("/api/auth/admin/sign-in", {
        method: "POST",
        body: JSON.stringify(signInForm)
      });

      saveExclusiveAdminSession(session);
      pushToast(`Welcome back, ${session.admin.name}.`, "info");
      router.push("/admin");
    } catch (error) {
      pushToast(error.message, "error");
    }
  }

  async function handleRequest(event) {
    event.preventDefault();
    const assignedEmail = requestForm.email || buildAssignedAdminEmail(requestForm.name);

    if (loadSessionState().supporterSession) {
      pushToast("Sign out of the supporter dashboard before requesting admin access.", "error");
      setBlockedSupporter(loadSessionState().supporterSession);
      return;
    }

    if (!requestForm.name || !assignedEmail || !requestForm.password || !requestForm.confirmPassword) {
      pushToast("Name, email, password, and confirm password are required.", "error");
      return;
    }

    if (requestForm.password !== requestForm.confirmPassword) {
      pushToast("Password and confirm password must match.", "error");
      return;
    }

    try {
      await apiFetch("/api/auth/admin/request", {
        method: "POST",
        body: JSON.stringify({
          ...requestForm,
          email: assignedEmail
        })
      });

      pushToast(`Admin request submitted. Assigned email: ${assignedEmail}`, "info");
      setRequestForm(defaultRequestForm);
    } catch (error) {
      pushToast(error.message, "error");
    }
  }

  function handleSupporterSignOut() {
    clearSupporterProfile();
    setBlockedSupporter(null);
    pushToast("Supporter session signed out. You can now continue with admin access.", "info");
  }

  if (!ready) {
    return <AppStateScreen eyebrow="Admin Access" title="Checking active session" message="Checking whether this browser already belongs to a supporter or admin before opening admin access." />;
  }

  if (blockedSupporter) {
    return (
      <main className="shell authShell">
        <section className="authDeck">
          <aside className="authStory authStoryAdmin panel">
            <p className="eyebrow">Admin Access</p>
            <h1>Sign out of the supporter dashboard first.</h1>
            <p className="authCaption">Only one active role can use the app at a time, so supporter and admin sessions cannot overlap.</p>
          </aside>

          <section className="authSurface panel">
            <div className="authBlockedCard">
              <p className="eyebrow">Active supporter session</p>
              <h2>{blockedSupporter.fullName}</h2>
              <p>
                This browser is currently signed in as a supporter. Log out of the fan dashboard before you sign in as an admin
                or submit an admin access request.
              </p>
              <div className="detailGrid">
                <article className="miniCard supporterCard">
                  <span>Supporter email</span>
                  <strong>{blockedSupporter.email}</strong>
                </article>
                <article className="miniCard supporterCard">
                  <span>Favourite club</span>
                  <strong>{blockedSupporter.favouriteClub || "Not set"}</strong>
                </article>
              </div>
              <div className="actions">
                <Link className="heroActionLink" href="/fan">
                  Return to fan dashboard
                </Link>
                <button type="button" onClick={handleSupporterSignOut}>
                  Sign out supporter session
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="shell authShell">
      <section className="authDeck">
        <aside className="authStory authStoryAdmin panel">
          <p className="eyebrow">Admin Access</p>
          <h1>Admin sign in and access requests.</h1>
          <p className="authCaption">Secure access for approved staff and new admin requests.</p>
          <div className="actions">
            <HelpButton
              title="Admin Access Guide"
              steps={[
                "Use Sign in if you already have an approved admin account and want to enter the admin suite.",
                "Use Request admin access if you are a new staff user who needs approval from the super admin first.",
                "After approval, sign in with your assigned email or full name together with the password you originally set."
              ]}
            />
          </div>
        </aside>

        <section className="authSurface panel">
          <div className="authViewport">
            <div className={`authTrack authTrack${mode === "request" ? " authTrackRegister" : ""}`}>
              <section className="authPane" aria-hidden={mode !== "sign-in"}>
                <div className="authPaneCopy">
                  <p className="eyebrow">Admin Sign In</p>
                  <h2>Enter the control area.</h2>
                </div>

                <form className="form" onSubmit={handleSignIn}>
                  <input
                    placeholder="Assigned email or full name"
                    value={signInForm.identifier}
                    onChange={(event) => setSignInForm({ ...signInForm, identifier: event.target.value })}
                  />
                  <PasswordField
                    placeholder="Password"
                    value={signInForm.password}
                    onChange={(event) => setSignInForm({ ...signInForm, password: event.target.value })}
                  />
                  <button type="submit">Sign in to admin</button>
                </form>
              </section>

              <section className="authPane" aria-hidden={mode !== "request"}>
                <div className="authPaneCopy">
                  <p className="eyebrow">Request Admin Access</p>
                  <h2>Send your details for approval.</h2>
                </div>

                <form className="form" onSubmit={handleRequest}>
                  <input
                    placeholder="Full name"
                    value={requestForm.name}
                    onChange={(event) => setRequestForm({ ...requestForm, name: event.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Assigned email"
                    value={requestForm.email}
                    readOnly
                  />
                  <PasswordField
                    placeholder="Password"
                    value={requestForm.password}
                    onChange={(event) => setRequestForm({ ...requestForm, password: event.target.value })}
                  />
                  <PasswordField
                    placeholder="Confirm password"
                    value={requestForm.confirmPassword}
                    onChange={(event) => setRequestForm({ ...requestForm, confirmPassword: event.target.value })}
                  />
                  <textarea
                    className="textArea"
                    placeholder="Why do you need admin access?"
                    value={requestForm.reason}
                    onChange={(event) => setRequestForm({ ...requestForm, reason: event.target.value })}
                  />
                  <button type="submit">Request admin access</button>
                </form>
              </section>
            </div>

            <div className={`authWipe authWipe${mode === "request" ? " authWipeRegister" : ""}`} />
          </div>

          <div className="authSwitcher" role="tablist" aria-label="Admin authentication mode">
            <button
              type="button"
              className={`switchButton${mode === "sign-in" ? " switchButtonActive" : ""}`}
              onClick={() => setMode("sign-in")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`switchButton${mode === "request" ? " switchButtonActive" : ""}`}
              onClick={() => setMode("request")}
            >
              Request admin access
            </button>
          </div>

        </section>
      </section>
    </main>
  );
}
