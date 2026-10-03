"use client";

import { useActionState } from "react";
import { sendCode, verifyCode, type LoginState } from "./actions";

const initial: LoginState = { step: "email", email: "" };

export default function LoginPage() {
  const [emailState, emailAction, emailPending] = useActionState(sendCode, initial);
  const [codeState, codeAction, codePending] = useActionState(verifyCode, initial);

  const onCodeStep = emailState.step === "code";
  const state = onCodeStep ? { ...codeState, email: emailState.email } : emailState;

  return (
    <main className="page">
      <h1 className="title">Vokabelheft</h1>
      <p className="lead">Anmelden mit einem Code per E-Mail.</p>

      {!onCodeStep ? (
        <form action={emailAction} className="stack">
          <label className="field">
            <span>E-Mail-Adresse</span>
            <input name="email" type="email" autoComplete="email" required defaultValue={state.email} />
          </label>
          <button className="btn" disabled={emailPending}>
            {emailPending ? "Code wird gesendet …" : "Code senden"}
          </button>
        </form>
      ) : (
        <form action={codeAction} className="stack">
          <p>Der Code ist unterwegs an {emailState.email}.</p>
          <input type="hidden" name="email" value={emailState.email} />
          <label className="field">
            <span>Code aus der E-Mail</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              required
              className="code-input"
            />
          </label>
          <button className="btn" disabled={codePending}>
            {codePending ? "Wird geprüft …" : "Anmelden"}
          </button>
          <a href="/login" className="link">Neuen Code anfordern</a>
        </form>
      )}

      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </main>
  );
}
