"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type RegisterState } from "../login/actions";

const initial: RegisterState = { username: "" };

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, initial);
  const noAutofix = { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const;

  return (
    <main className="sheet">
      <Link href="/login" className="back">← Anmelden</Link>
      <h1 className="title">Konto anlegen</h1>
      <p className="lead">Du brauchst einen Einladungscode. Den bekommst du von der Person, die die App betreibt.</p>

      <form action={action} className="stack">
        <label className="field">
          <span>Benutzername</span>
          <input name="username" autoComplete="username" required minLength={3} maxLength={20} defaultValue={state.username} {...noAutofix} />
        </label>
        <p className="hint">3 bis 20 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Binde- oder Unterstrich.</p>
        <label className="field">
          <span>Passwort (mindestens 10 Zeichen)</span>
          <input name="password" type="password" autoComplete="new-password" required minLength={10} />
        </label>
        <label className="field">
          <span>Passwort wiederholen</span>
          <input name="password2" type="password" autoComplete="new-password" required minLength={10} />
        </label>
        <label className="field">
          <span>Einladungscode</span>
          <input name="code" required autoComplete="off" {...noAutofix} />
        </label>
        <button className="btn" disabled={pending}>{pending ? "Wird angelegt …" : "Konto anlegen"}</button>
      </form>

      {state.error && <p role="alert" className="error">{state.error}</p>}

      <p className="hint">Wichtig: Merk dir dein Passwort gut. Es kann nicht per E-Mail zurückgesetzt werden.</p>
    </main>
  );
}
