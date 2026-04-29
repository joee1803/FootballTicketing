"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppStateScreen } from "./AppStateScreen";
import { buildAssignedSupporterEmail } from "../lib/identity";
import { FEATURED_CLUBS } from "../lib/pricing";
import { loadActiveSession, loadSessionState, saveExclusiveSupporterProfile } from "../lib/sessionState";
import { connectMetaMaskWallet, getConnectedMetaMaskWallet, watchMetaMaskWallet } from "../lib/wallet";
import { PasswordField } from "./PasswordField";
import { HelpButton } from "./HelpButton";
import { useToast } from "./ToastProvider";
import {
  registerSupporterProfile,
  signInSupporterProfile
} from "../lib/supporterProfile";

const defaultSignInForm = {
  identifier: "",
  password: ""
};

const defaultRegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  favouriteClub: "",
  walletAddress: "",
  password: "",
  confirmPassword: ""
};

export function FanAuthPortal() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mode, setMode] = useState("sign-in");
  const [signInForm, setSignInForm] = useState(defaultSignInForm);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activeSession = loadActiveSession();

    // The homepage becomes the signed-in user's dashboard until they explicitly sign out.
    if (activeSession?.dashboardPath) {
      router.replace(activeSession.dashboardPath);
      return;
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!registerForm.firstName || !registerForm.lastName || registerForm.email) {
      return;
    }

    setRegisterForm((current) => ({
      ...current,
      email: buildAssignedSupporterEmail(current.firstName, current.lastName)
    }));
  }, [registerForm.firstName, registerForm.lastName, registerForm.email]);

  useEffect(() => {
    let active = true;

    // MetaMask can already be connected before the page opens, so hydrate the wallet automatically.
    async function hydrateWallet() {
      const walletAddress = await getConnectedMetaMaskWallet();
      if (!active || !walletAddress) {
        return;
      }

      setRegisterForm((current) => ({
        ...current,
        walletAddress
      }));
    }

    hydrateWallet();
    const unsubscribe = watchMetaMaskWallet((walletAddress) => {
      if (!active) {
        return;
      }

      setRegisterForm((current) => ({
        ...current,
        walletAddress
      }));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleSignIn(event) {
    event.preventDefault();

    if (loadSessionState().adminSession) {
      pushToast("Sign out of the admin dashboard before signing in as a supporter.", "error");
      router.push("/admin");
      return;
    }

    try {
      const supporter = await signInSupporterProfile(signInForm);
      saveExclusiveSupporterProfile(supporter);
      pushToast(`Welcome back, ${supporter.fullName}.`, "info");
      router.push("/fan");
    } catch (error) {
      pushToast(error.message, "error");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const assignedEmail = registerForm.email || buildAssignedSupporterEmail(registerForm.firstName, registerForm.lastName);

    if (loadSessionState().adminSession) {
      pushToast("Sign out of the admin dashboard before registering a supporter account.", "error");
      router.push("/admin");
      return;
    }

    if (!registerForm.firstName || !registerForm.lastName || !assignedEmail || !registerForm.password || !registerForm.confirmPassword) {
      pushToast("First name, last name, email, password, and confirm password are required to register.", "error");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      pushToast("Password and confirm password must match.", "error");
      return;
    }

    try {
      const supporter = await registerSupporterProfile({
        ...registerForm,
        email: assignedEmail
      });
      saveExclusiveSupporterProfile(supporter);
      pushToast(`Supporter account created for ${supporter.fullName}. Assigned email: ${supporter.email}`, "info");
      router.push("/fan");
    } catch (error) {
      if (error.message.includes("already linked to another supporter account")) {
        const existingSupporter = error.data?.existingSupporter;
        if (existingSupporter?.email) {
          setSignInForm((current) => ({
            ...current,
            identifier: existingSupporter.email
          }));
          setMode("sign-in");
          pushToast(`This MetaMask wallet already belongs to ${existingSupporter.fullName}. Sign in with the prefilled email or switch MetaMask accounts.`, "error");
          return;
        }

        setMode("sign-in");
        pushToast("This MetaMask wallet is already linked to an existing supporter account. Sign in with that account or switch to a different wallet.", "error");
        return;
      }

      pushToast(error.message, "error");
    }
  }

  async function handleWalletConnect() {
    try {
      const walletAddress = await connectMetaMaskWallet();
      setRegisterForm((current) => ({
        ...current,
        walletAddress
      }));
      pushToast(`MetaMask wallet connected: ${walletAddress}`, "info");
    } catch (error) {
      pushToast(error.message, "error");
    }
  }

  if (!ready) {
    return <AppStateScreen eyebrow="Fan Portal" title="Checking active session" message="Working out whether this browser should open the homepage or take you straight back to your dashboard." />;
  }

  return (
    <main className="shell authShell">
      <section className="authDeck">
        <aside className="authStory authStoryFan panel">
          <p className="eyebrow">Fan Portal</p>
          <h1>Fan sign in and registration.</h1>
          <p className="authCaption">Secure access to fixtures, tickets, and account details.</p>
          <div className="actions">
            <HelpButton
              title="Supporter Sign-In Guide"
              steps={[
                "Register with your name and password first. Your supporter email is assigned automatically.",
                "Choose a favourite club from the featured list if you want discounted pricing whenever that club appears in a fixture.",
                "If MetaMask is already unlocked in the browser, your wallet should appear automatically on the register form.",
                "After sign-in, use Fixtures to book, Tickets to review what you own, and Profile for account and wallet details."
              ]}
            />
          </div>
        </aside>

        <section className="authSurface panel">
          <div className="authViewport">
            <div className={`authTrack authTrack${mode === "register" ? " authTrackRegister" : ""}`}>
              <section className="authPane" aria-hidden={mode !== "sign-in"}>
                <div className="authPaneCopy">
                  <p className="eyebrow">Supporter Sign In</p>
                  <h2>Return to your fan portal.</h2>
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
                  <button type="submit">Sign in to fan portal</button>
                </form>
              </section>

              <section className="authPane" aria-hidden={mode !== "register"}>
                <div className="authPaneCopy">
                  <p className="eyebrow">Supporter Register</p>
                  <h2>Create your fan portal account.</h2>
                </div>

                <form className="form" onSubmit={handleRegister}>
                  <input
                    placeholder="First name"
                    value={registerForm.firstName}
                    onChange={(event) => setRegisterForm({ ...registerForm, firstName: event.target.value })}
                  />
                  <input
                    placeholder="Last name"
                    value={registerForm.lastName}
                    onChange={(event) => setRegisterForm({ ...registerForm, lastName: event.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Assigned email"
                    value={registerForm.email}
                    readOnly
                  />
                  <div className="inlineForm">
                    <input
                      placeholder="MetaMask wallet"
                      value={registerForm.walletAddress}
                      readOnly
                    />
                    <button type="button" className="ghostButton" onClick={handleWalletConnect}>
                      {registerForm.walletAddress ? "Refresh MetaMask" : "Connect MetaMask"}
                    </button>
                  </div>
                  <select
                    value={registerForm.favouriteClub}
                    onChange={(event) => setRegisterForm({ ...registerForm, favouriteClub: event.target.value })}
                  >
                    <option value="">Favourite club for eligible ticket discounts</option>
                    {FEATURED_CLUBS.map((club) => (
                      <option key={club} value={club}>
                        {club}
                      </option>
                    ))}
                  </select>
                  <PasswordField
                    placeholder="Password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                  />
                  <PasswordField
                    placeholder="Confirm password"
                    value={registerForm.confirmPassword}
                    onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                  />
                  <button type="submit">Register supporter account</button>
                </form>
              </section>
            </div>

            <div className={`authWipe authWipe${mode === "register" ? " authWipeRegister" : ""}`} />
          </div>

          <div className="authSwitcher" role="tablist" aria-label="Fan authentication mode">
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
        </section>
      </section>
    </main>
  );
}
