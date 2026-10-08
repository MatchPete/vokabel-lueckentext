"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = { identifier: "" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <main className="sheet">
      <h1 className="title">Vokabelheft</h1>

      <form action={action} className="stack">
        <label className="field">
          <span>Benutzername</span>
          <input
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            defaultValue={state.identifier}
          />
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

      <p className="hint">
        Noch kein Konto? <Link href="/registrieren" className="link">Mit Einladungscode registrieren</Link>
      </p>
    </main>
  );
}
