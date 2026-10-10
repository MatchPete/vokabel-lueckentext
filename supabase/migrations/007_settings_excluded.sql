-- 007_settings_excluded.sql
-- Einstellungen pro Kinderprofil und gesperrte Vokabeln.
alter table public.children add column settings jsonb not null default '{}'::jsonb;
alter table public.vocab add column excluded boolean not null default false;
create index vocab_child_excluded_idx on public.vocab (child_id) where excluded;
