-- 013_grammar_practice.sql
-- Grammatikübungen (Green Line 1 Bayern): Übungen und Ergebnisse pro Kind, eigenes Tageskontingent.
-- G37 (Haupt- und Nebensätze) wieder in Unit 6 aufgenommen (laut Grammatik-Übersicht des Buchs).
alter table public.api_usage drop constraint api_usage_kind_check;
alter table public.api_usage add constraint api_usage_kind_check check (kind in ('photo', 'exercise', 'grammar'));

create table public.grammar_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  chapter text not null check (chapter ~ '^G[0-9]{1,2}$'),
  items jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
create index grammar_exercises_child_idx on public.grammar_exercises (child_id, chapter, created_at desc);

create table public.grammar_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  exercise_id uuid not null references public.grammar_exercises (id) on delete cascade,
  chapter text not null,
  score int not null,
  max_score int not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index grammar_attempts_child_idx on public.grammar_attempts (child_id, chapter, created_at desc);

alter table public.grammar_exercises enable row level security;
alter table public.grammar_attempts enable row level security;
create policy grammar_exercises_own on public.grammar_exercises for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.children c where c.id = child_id and c.owner_id = (select auth.uid())));
create policy grammar_attempts_own on public.grammar_attempts for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.children c where c.id = child_id and c.owner_id = (select auth.uid())));

insert into public.grammar_topics (textbook_unit_id, code, label_de, forms, sort_order)
select tu.id, 'clauses', 'Haupt- und Nebensätze (z. B. mit because)', '{}', 9
from public.textbook_units tu join public.textbooks t on t.id = tu.textbook_id
where t.name = 'Green Line 1 Bayern' and tu.code = 'U6'
  and not exists (select 1 from public.grammar_topics g where g.textbook_unit_id = tu.id and g.code = 'clauses');
