// Nur diese Adressen dürfen sich anmelden (kommagetrennt in ALLOWED_EMAILS).
export function isAllowedEmail(email: string): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
