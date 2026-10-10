-- 008_hinted_answers.sql
-- Lückentext: Richtig nach "Tipp" zählt als "mit Mühe" (hard) statt "gewusst" (good).
alter table public.attempt_answers add column hinted boolean not null default false;
-- finish_attempt: Zuordnung correct+hinted -> hard (vollständige Funktion siehe Datenbank)
