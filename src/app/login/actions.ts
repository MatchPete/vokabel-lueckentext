"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

export type LoginState = {
  email: string;
  error?: string;
};

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@") || !password) {
    return { email, error: "Bitte E-Mail-Adresse und Passwort eingeben." };
  }
  if (!isAllowedEmail(email)) {
    return { email, error: "Diese Adresse ist für die App nicht freigeschaltet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { email, error: "E-Mail-Adresse oder Passwort stimmen nicht." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
