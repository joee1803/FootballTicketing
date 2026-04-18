"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveAdminSession } from "../lib/adminAuth";
import { apiFetch } from "../lib/api";
import { saveSupporterProfile } from "../lib/supporterProfile";

const defaultSignInForm = {
  email: "",
  password: ""
};

const defaultRegisterForm = {
  fullName: "",
  email: "",
  favouriteClub: "",
  walletAddress: ""
};

const authHighlights = [
  "Homepage now routes straight into access control instead of a detached landing page.",
  "Supporter registration stores a reusable local profile for demos without forcing a wallet extension.",
  "Admin sign-in still uses the protected backend session and leads directly into control tools."
];

export function AuthPortal({ initialMode = "sign-in" }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [signInForm, setSignInForm] = useState(defaultSignInForm);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [message, setMessage] = useState(
    "Choose sign in for protected admin tools or register to create a supporter profile for ticket booking."
  );

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

  function handleRegister(event) {
    event.preventDefault();

    if (!registerForm.fullName || !registerForm.email || !registerForm.walletAddress) {
      setMessage("Full name, email, and wallet address are required to create a supporter profile.");
      return;
    }

    saveSupporterProfile(registerForm);
    setMessage(`Supporter profile saved for ${registerForm.fullName}. Redirecting to the fan portal...`);
    router.push("/fan");
  }

  return (
    <main className="shell authShell">
      <section className={`authDeck authDeck${mode === "register" ? " authDeckRegister" : ""}`}>
        <aside className="authStory panel">
          <p className="eyebrow">Premier League Ticketing Demo</p>
          <h1>Secure entry, cleaner routing, and a smoother first impression.</h1>
          <p className="lede">
            This prototype now starts where users actually begin: authentication. Slide between admin sign in
            and supporter registration, then move into booking or protected matchday controls without a dead-end
            landing page.
          </p>

          <div className="authHighlights">
            {authHighlights.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </aside>

        <section className="authSurface panel">
          <div className="authViewport">
            <div className={`authTrack authTrack${mode === "register" ? " authTrackRegister" : ""}`}>
              <section className="authPane" aria-hidden={mode !== "sign-in"}>
                <div className="authPaneCopy">
                  <p className="eyebrow">Sign In</p>
                  <h2>Return to protected admin controls.</h2>
                  <p>
                    Use your backend-issued admin account to manage fixtures, mint tickets, revoke access,
                    and run matchday verification from one dashboard.
                  </p>
                </div>

                <form className="form" onSubmit={handleSignIn}>
                  <input
                    placeholder="Admin email"
                    value={signInForm.email}
                    onChange={(event) => setSignInForm({ ...signInForm, email: event.target.value })}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={signInForm.password}
                    onChange={(event) => setSignInForm({ ...signInForm, password: event.target.value })}
                  />
                  <button type="submit">Sign in to admin</button>
                </form>
              </section>

              <section className="authPane" aria-hidden={mode !== "register"}>
                <div className="authPaneCopy">
                  <p className="eyebrow">Register</p>
                  <h2>Create a supporter profile for the fan portal.</h2>
                  <p>
                    Save your details locally for demos, prefill your ticket wallet address, and jump straight
                    into the fixture list without needing a wallet extension prompt first.
                  </p>
                </div>

                <form className="form" onSubmit={handleRegister}>
                  <input
                    placeholder="Full name"
                    value={registerForm.fullName}
                    onChange={(event) => setRegisterForm({ ...registerForm, fullName: event.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                  />
                  <input
                    placeholder="Favourite club"
                    value={registerForm.favouriteClub}
                    onChange={(event) => setRegisterForm({ ...registerForm, favouriteClub: event.target.value })}
                  />
                  <input
                    placeholder="Wallet address"
                    value={registerForm.walletAddress}
                    onChange={(event) => setRegisterForm({ ...registerForm, walletAddress: event.target.value })}
                  />
                  <button type="submit">Register supporter profile</button>
                </form>
              </section>
            </div>

            <div className={`authWipe authWipe${mode === "register" ? " authWipeRegister" : ""}`} />
          </div>

          <div className="authSwitcher" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={`switchButton${mode === "sign-in" ? " switchButtonActive" : ""}`}
              onClick={() => setMode("sign-in")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`switchButton${mode === "register" ? " switchButtonActive" : ""}`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <p className="feedback">{message}</p>
        </section>
      </section>
    </main>
  );
}
