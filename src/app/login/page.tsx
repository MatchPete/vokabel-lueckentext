"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = { email: "" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <main className="page">
      <h1 className="title">Vokabelheft</h1>

      <form action={action} className="stack">
        <label className="field">
          <span>E-Mail-Adresse</span>
          <input name="email" type="email" autoComplete="username" required defaultValue={state.email} />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn" disabled={pending}>
          {pending ? "Anmelden …" : "Anmelden"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </main>
  );
}
