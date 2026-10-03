-- =====================================================================
-- 001_archive_lueckewort.sql
-- Verschiebt die Lückewort-Tabellen in das Schema "lueckewort".
-- Daten, Indizes, RLS-Policies und Fremdschlüssel bleiben erhalten.
-- Das Schema ist nicht über die API freigegeben -> Lückewort ist damit
-- archiviert, aber jederzeit wiederherstellbar.
-- public.claude_documents wird NICHT angefasst.
-- =====================================================================

create schema if not exists lueckewort;

alter table public.reviews     set schema lueckewort;
alter table public.card_states set schema lueckewort;
alter table public.sentences   set schema lueckewort;
alter table public.words       set schema lueckewort;
alter table public.profiles    set schema lueckewort;

-- Der Signup-Trigger auf auth.users schreibt bisher in public.profiles.
-- Ohne Anpassung würde jede neue Registrierung fehlschlagen.
alter function public.handle_new_user() set schema lueckewort;

create or replace function lueckewort.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into lueckewort.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
