"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidInviteCode, isValidUsername, loginEmail, normalizeUsername, registrationConfigured, USERNAME_RULE } from "@/lib/auth";

export type LoginState = {
  identifier: string;
  error?: string;
};

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { identifier, error: "Bitte Benutzername und Passwort eingeben." };
  }

  const email = loginEmail(identifier);
  if (!email) return { identifier, error: "Benutzername oder Passwort stimmen nicht." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { identifier, error: "Benutzername oder Passwort stimmen nicht." };
  }
  redirect("/");
}

export type RegisterState = { username: string; error?: string };

export async function register(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  const code = String(formData.get("code") ?? "");

  if (!registrationConfigured()) {
    return { username, error: "Die Registrierung ist noch nicht eingerichtet." };
  }
  if (!isValidUsername(username)) {
    return { username, error: `Der Benutzername passt nicht. Erlaubt sind ${USERNAME_RULE}.` };
  }
  if (password.length < 10) {
    return { username, error: "Das Passwort muss mindestens 10 Zeichen lang sein." };
  }
  if (password !== password2) {
    return { username, error: "Die beiden Passwörter stimmen nicht überein." };
  }
  if (!isValidInviteCode(code)) {
    await new Promise((r) => setTimeout(r, 1000)); // Raten verlangsamen
    return { username, error: "Der Einladungscode stimmt nicht." };
  }

  const email = loginEmail(username) as string; // durch registrationConfigured() gesichert
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return { username, error: taken ? "Diesen Benutzernamen gibt es schon." : "Das Konto konnte nicht angelegt werden." };
  }

  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) return { username, error: "Konto angelegt. Bitte jetzt anmelden." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
