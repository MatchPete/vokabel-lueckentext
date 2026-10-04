-- 005_generation_failures.sql
-- Protokoll misslungener Lückentext-Erzeugungen (Rohtext + gefundene Probleme), zur Fehlersuche.
create table public.generation_failures (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid(),
  child_id   uuid not null,
  unit_id    uuid,
  model      text,
  attempts   jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade
);
create index generation_failures_child_idx on public.generation_failures (child_id, created_at desc);

alter table public.generation_failures enable row level security;
create policy "own rows" on public.generation_failures for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.generation_failures from anon;
grant select, insert on public.generation_failures to authenticated;
