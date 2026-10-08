// Anmeldung: Benutzername oder E-Mail. Benutzernamen werden intern auf eine
// E-Mail-Adresse abgebildet, an die nie Mails verschickt werden.
import { timingSafeEqual } from "node:crypto";

// Muss eine Domain sein, die dir gehört: Falls Supabase je eine Mail an so eine Adresse
// schicken würde (z. B. Passwort zurücksetzen), darf sie nicht bei Fremden landen.
const DOMAIN = (process.env.USERNAME_EMAIL_DOMAIN ?? "").trim().toLowerCase().replace(/^@/, "") || null;

export const registrationConfigured = () =>
  Boolean(DOMAIN && process.env.REGISTRATION_CODE?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const USERNAME_RULE = "3 bis 20 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Binde- oder Unterstrich";

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/.test(u);
}

/** "max" -> "max@<Domain>", eine echte E-Mail-Adresse bleibt unverändert. Ohne Domain: null. */
export function loginEmail(identifier: string): string | null {
  const id = identifier.trim().toLowerCase();
  if (id.includes("@")) return id;
  return DOMAIN ? `${id}@${DOMAIN}` : null;
}

/** Anzeigename: Benutzername bzw. die E-Mail-Adresse. */
export function displayName(email: string | undefined | null): string {
  if (!email) return "";
  return DOMAIN && email.endsWith(`@${DOMAIN}`) ? email.slice(0, -DOMAIN.length - 1) : email;
}

/** Einladungscode prüfen (zeitkonstant, damit sich der Code nicht erraten lässt). */
export function isValidInviteCode(code: string): boolean {
  const expected = process.env.REGISTRATION_CODE?.trim();
  if (!expected) return false; // ohne gesetzten Code ist keine Registrierung möglich
  const a = Buffer.from(code.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
