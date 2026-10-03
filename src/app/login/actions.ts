"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: string;
};

export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return { step: "email", email, error: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: "Diese Adresse ist für die App nicht freigeschaltet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    return { step: "email", email, error: "Der Code konnte nicht gesendet werden. Bitte in einer Minute erneut versuchen." };
  }
  return { step: "code", email };
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(token)) {
    return { email, step: "code", error: "Der Code besteht aus Ziffern. Bitte genau so eingeben, wie er in der E-Mail steht." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { email, step: "code", error: "Der Code stimmt nicht oder ist abgelaufen. Fordere einen neuen an." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
