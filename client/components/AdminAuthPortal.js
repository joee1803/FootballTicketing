"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { saveAdminSession } from "../lib/adminAuth";
import { apiFetch } from "../lib/api";
import { buildAssignedAdminEmail } from "../lib/identity";
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
  const [mode, setMode] = useState("sign-in");
  const [signInForm, setSignInForm] = useState(defaultSignInForm);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);
  const [message, setMessage] = useState("Sign in or request admin access.");

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
    setMessage("Signing in to admin controls...");

    try {
      const session = await apiFetch("/api/auth/admin/sign-in", {
        method: "POST",
        body: JSON.stringify(signInForm)
      });

      saveAdminSession(session);
      setMessage(`Welcome back, ${session.admin.name}. Redirecting to admin controls...`);
      router.push("/admin");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRequest(event) {
    event.preventDefault();
    const assignedEmail = requestForm.email || buildAssignedAdminEmail(requestForm.name);

    if (!requestForm.name || !assignedEmail || !requestForm.password || !requestForm.confirmPassword) {
      setMessage("Name, email, password, and confirm password are required.");
      return;
    }

    if (requestForm.password !== requestForm.confirmPassword) {
      setMessage("Password and confirm password must match.");
      return;
    }

    setMessage("Submitting admin access request...");

    try {
      await apiFetch("/api/auth/admin/request", {
        method: "POST",
        body: JSON.stringify({
          ...requestForm,
          email: assignedEmail
        })
      });

      setMessage(`Your admin request has been submitted. Assigned email: ${assignedEmail}`);
      setRequestForm(defaultRequestForm);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="shell authShell">
      <section className="authDeck">
        <aside className="authStory authStoryAdmin panel">
          <p className="eyebrow">Admin Access</p>
          <h1>Admin sign in and approval flow.</h1>
          <p className="authCaption">Clean access for approved staff and new requests.</p>
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

          <p className="feedback">{message}</p>
        </section>
      </section>
    </main>
  );
}
