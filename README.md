# Vokabelheft

PWA für Englisch in der 5. Klasse (Gymnasium Bayern, Green Line 1 Bayern):
Vokabeln abfotografieren oder eintippen und in passenden Lückentexten üben.

Stack: Next.js 16 · Supabase (Projekt `vokabelbaer`) · Vercel

## Einrichtung

1. `.env.example` nach `.env.local` kopieren und ausfüllen.
2. In Supabase unter Authentication:
   - Neue Registrierungen deaktivieren (nur bestehende Konten dürfen sich anmelden).
   - Passwort für das bestehende Konto setzen (siehe Chat-Anleitung).
3. In Vercel `AI_GATEWAY_API_KEY` setzen (Vercel → AI Gateway → API Keys).

## Datenbank

Die Migrationen liegen in `supabase/migrations/` und sind bereits angewendet.
Lückewort-Altdaten liegen archiviert im Schema `lueckewort`.

## Stand

- [x] Schema, RLS, Leitner-Logik, Green-Line-1-Seed
- [x] Login per E-Mail und Passwort, Profile, Units, aktuelle Unit
- [x] Vokabeln manuell eingeben
- [x] Lückentext-Generierung und Üben
- [x] Foto-Import
- [ ] Elternansicht, PIN, Keep-alive
