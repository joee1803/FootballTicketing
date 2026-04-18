"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buildAssignedSupporterEmail } from "../lib/identity";
import { connectMetaMaskWallet } from "../lib/wallet";
import { PasswordField } from "./PasswordField";
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
  const [mode, setMode] = useState("sign-in");
  const [signInForm, setSignInForm] = useState(defaultSignInForm);
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm);
  const [message, setMessage] = useState("Sign in or register to continue.");

  useEffect(() => {
    if (!registerForm.firstName || !registerForm.lastName || registerForm.email) {
      return;
    }

    setRegisterForm((current) => ({
      ...current,
      email: buildAssignedSupporterEmail(current.firstName, current.lastName)
    }));
  }, [registerForm.firstName, registerForm.lastName, registerForm.email]);

  async function handleSignIn(event) {
    event.preventDefault();

    try {
      const supporter = await signInSupporterProfile(signInForm);
      setMessage(`Welcome back, ${supporter.fullName}. Redirecting to the fan portal...`);
      router.push("/fan");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const assignedEmail = registerForm.email || buildAssignedSupporterEmail(registerForm.firstName, registerForm.lastName);

    if (!registerForm.firstName || !registerForm.lastName || !assignedEmail || !registerForm.password || !registerForm.confirmPassword) {
      setMessage("First name, last name, email, password, and confirm password are required to register.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setMessage("Password and confirm password must match.");
      return;
    }

    try {
      const supporter = await registerSupporterProfile({
        ...registerForm,
        email: assignedEmail
      });
      setMessage(`Supporter account created for ${supporter.fullName}. Assigned email: ${supporter.email}`);
      router.push("/fan");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleWalletConnect() {
    try {
      setMessage("Connecting MetaMask wallet...");
      const walletAddress = await connectMetaMaskWallet();
      setRegisterForm((current) => ({
        ...current,
        walletAddress
      }));
      setMessage(`MetaMask wallet connected: ${walletAddress}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="shell authShell">
      <section className="authDeck">
        <aside className="authStory authStoryFan panel">
          <p className="eyebrow">Fan Portal</p>
          <h1>Fan sign in and registration.</h1>
          <p className="authCaption">Smooth entry into the supporter experience.</p>
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
                      Connect MetaMask
                    </button>
                  </div>
                  <input
                    placeholder="Favourite club"
                    value={registerForm.favouriteClub}
                    onChange={(event) => setRegisterForm({ ...registerForm, favouriteClub: event.target.value })}
                  />
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

          <p className="feedback">{message}</p>
        </section>
      </section>
    </main>
  );
}
