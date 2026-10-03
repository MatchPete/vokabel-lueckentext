-- =====================================================================
-- 002_englisch_app_schema.sql
-- Englisch-Vokabel-App mit Lückentexten (Green Line 1 Bayern)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lehrwerk-Stammdaten (für alle angemeldeten Nutzer lesbar)
-- ---------------------------------------------------------------------
create table public.textbooks (
  id      uuid primary key default gen_random_uuid(),
  name    text not null unique,
  edition text
);

create table public.textbook_units (
  id          uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  code        text not null,
  title       text not null,
  kind        text not null check (kind in ('pick_up','unit','across_cultures','focus')),
  sort_order  int  not null,
  unique (textbook_id, code),
  unique (textbook_id, sort_order)
);

create table public.grammar_topics (
  id               uuid primary key default gen_random_uuid(),
  textbook_unit_id uuid not null references public.textbook_units(id) on delete cascade,
  code             text not null,
  label_de         text not null,
  forms            text[] not null default '{}',  -- welche Wortformen in Lücken damit erlaubt sind
  sort_order       int  not null,
  unique (textbook_unit_id, code)
);

-- ---------------------------------------------------------------------
-- 2. Nutzerdaten (jede Zeile gehört über owner_id genau einem Konto)
-- ---------------------------------------------------------------------
create table public.children (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 30),
  textbook_id uuid references public.textbooks(id),
  created_at  timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.units (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid(),
  child_id         uuid not null,
  textbook_unit_id uuid references public.textbook_units(id),
  title            text not null,
  sort_order       int  not null,
  created_at       timestamptz not null default now(),
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade,
  unique (child_id, sort_order),
  unique (id, child_id)
);
create index units_textbook_unit_idx on public.units (textbook_unit_id);

alter table public.children
  add column current_unit_id uuid,
  add constraint children_current_unit_fk
    foreign key (current_unit_id, id) references public.units(id, child_id)
    on delete set null (current_unit_id);

-- Abweichungen der Lehrkraft von der Buch-Reihenfolge
create table public.child_grammar_overrides (
  owner_id uuid not null default auth.uid(),
  child_id uuid not null,
  topic_id uuid not null references public.grammar_topics(id) on delete cascade,
  enabled  boolean not null,
  primary key (child_id, topic_id),
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade
);
create index cgo_topic_idx on public.child_grammar_overrides (topic_id);

create table public.vocab (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid(),
  child_id    uuid not null,
  unit_id     uuid not null,
  section     text not null default 'other'
              check (section in ('check_in','station_1','station_2','station_3',
                                 'story','skills','unit_task','other')),
  en          text not null check (char_length(trim(en)) > 0),
  de          text not null check (char_length(trim(de)) > 0),
  word_type   text check (word_type in ('noun','verb','adjective','adverb','phrase','other')),
  example_en  text,
  accepted_en text[] not null default '{}',   -- zusätzlich akzeptierte Schreibweisen
  created_at  timestamptz not null default now(),
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade,
  foreign key (unit_id, child_id)  references public.units(id, child_id)       on delete cascade
);
create unique index vocab_unique_idx on public.vocab (child_id, lower(trim(en)), lower(trim(de)));
create index vocab_unit_idx on public.vocab (unit_id);

-- Leitner-Stand pro Vokabel
create table public.vocab_progress (
  vocab_id      uuid primary key references public.vocab(id) on delete cascade,
  owner_id      uuid not null default auth.uid(),
  child_id      uuid not null,
  box           smallint not null default 1 check (box between 1 and 5),
  due_date      date not null default (now() at time zone 'Europe/Berlin')::date,
  correct_count int not null default 0,
  wrong_count   int not null default 0,
  last_seen_at  timestamptz,
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade
);
create index vocab_progress_due_idx on public.vocab_progress (child_id, due_date);

create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid(),
  child_id   uuid not null,
  unit_id    uuid,
  title      text not null,
  text_type  text not null check (text_type in ('story','dialogue','email','postcard','voice_message')),
  theme      text,
  segments   jsonb not null check (jsonb_typeof(segments) = 'array'),
  model      text,
  flagged    boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade,
  foreign key (unit_id, child_id)  references public.units(id, child_id)
    on delete set null (unit_id)
);
create index exercises_unit_idx on public.exercises (unit_id);
create index exercises_child_idx on public.exercises (child_id, created_at desc);

create table public.attempts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid(),
  child_id    uuid not null,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  score       smallint,
  max_score   smallint,
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade
);
create index attempts_child_idx on public.attempts (child_id, started_at desc);
create index attempts_exercise_idx on public.attempts (exercise_id);

create table public.attempt_answers (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  vocab_id   uuid not null references public.vocab(id) on delete cascade,
  given      text not null,
  result     text not null check (result in ('correct','almost','wrong')),
  try_no     smallint not null check (try_no in (1,2)),
  created_at timestamptz not null default now(),
  unique (attempt_id, vocab_id, try_no)
);
create index attempt_answers_vocab_idx on public.attempt_answers (vocab_id);

-- Tageslimit für API-Aufrufe (Kostenbremse)
create table public.api_usage (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day      date not null default (now() at time zone 'Europe/Berlin')::date,
  kind     text not null check (kind in ('photo','exercise')),
  count    int  not null default 0,
  primary key (owner_id, day, kind)
);

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['textbooks','textbook_units','grammar_topics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read for authenticated" on public.%I for select to authenticated using (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;

  foreach t in array array['children','units','child_grammar_overrides','vocab','vocab_progress',
                           'exercises','attempts','attempt_answers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated '
                   'using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- api_usage: nur lesbar; geschrieben wird ausschliesslich ueber consume_quota()
alter table public.api_usage enable row level security;
create policy "read own usage" on public.api_usage for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.api_usage from anon, authenticated;
grant select on public.api_usage to authenticated;

-- ---------------------------------------------------------------------
-- 4. Funktionen
-- ---------------------------------------------------------------------

-- Neue Vokabel -> Leitner-Eintrag (Fach 1, heute fällig)
create or replace function public.vocab_after_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.vocab_progress (vocab_id, owner_id, child_id)
  values (new.id, new.owner_id, new.child_id);
  return new;
end;
$$;

create trigger vocab_after_insert
after insert on public.vocab
for each row execute function public.vocab_after_insert();

-- Kinderprofil anlegen und Units aus dem Lehrwerk übernehmen
create or replace function public.create_child(p_nickname text, p_textbook_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_child uuid;
begin
  insert into public.children (nickname, textbook_id)
  values (p_nickname, p_textbook_id)
  returning id into v_child;

  insert into public.units (child_id, textbook_unit_id, title, sort_order)
  select v_child, tu.id, tu.title, tu.sort_order
  from public.textbook_units tu
  where tu.textbook_id = p_textbook_id;

  update public.children
  set current_unit_id = (select u.id from public.units u
                         where u.child_id = v_child order by u.sort_order limit 1)
  where id = v_child;

  return v_child;
end;
$$;

-- Freigeschaltete Grammatik: alles bis zur aktuellen Unit, plus/minus Abweichungen
create or replace function public.unlocked_grammar(p_child_id uuid)
returns setof public.grammar_topics
language sql
stable
security invoker
set search_path = ''
as $$
  with cur as (
    select tu.sort_order, tu.textbook_id
    from public.children c
    join public.units u           on u.id = c.current_unit_id
    join public.textbook_units tu on tu.id = u.textbook_unit_id
    where c.id = p_child_id
  ), base as (
    select g.*
    from public.grammar_topics g
    join public.textbook_units tu on tu.id = g.textbook_unit_id
    join cur on tu.textbook_id = cur.textbook_id and tu.sort_order <= cur.sort_order
  )
  select b.* from base b
  where not exists (
    select 1 from public.child_grammar_overrides o
    where o.child_id = p_child_id and o.topic_id = b.id and o.enabled = false
  )
  union
  select g.* from public.grammar_topics g
  join public.child_grammar_overrides o
    on o.topic_id = g.id and o.child_id = p_child_id and o.enabled = true;
$$;

-- Übung abschließen: Leitner-Fächer fortschreiben (nur 1. Versuch zählt)
-- Intervalle: Fach 1 = sofort, 2 = 1 Tag, 3 = 3 Tage, 4 = 7 Tage, 5 = 21 Tage
create or replace function public.finish_attempt(p_attempt_id uuid)
returns table (richtig int, gesamt int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_score int;
  v_max   int;
begin
  if not exists (select 1 from public.attempts a
                 where a.id = p_attempt_id and a.finished_at is null) then
    raise exception 'Übung nicht gefunden oder bereits abgeschlossen';
  end if;

  update public.vocab_progress vp set
    box = case when f.result = 'correct' then least(vp.box + 1, 5) else 1 end,
    due_date = v_today + case when f.result = 'correct' then
                 case least(vp.box + 1, 5) when 2 then 1 when 3 then 3
                                           when 4 then 7 when 5 then 21 else 0 end
               else 0 end,
    correct_count = vp.correct_count + case when f.result = 'correct' then 1 else 0 end,
    wrong_count   = vp.wrong_count   + case when f.result = 'correct' then 0 else 1 end,
    last_seen_at  = now()
  from public.attempt_answers f
  where f.attempt_id = p_attempt_id and f.try_no = 1 and vp.vocab_id = f.vocab_id;

  select count(*) filter (where f.result = 'correct'), count(*)
    into v_score, v_max
  from public.attempt_answers f
  where f.attempt_id = p_attempt_id and f.try_no = 1;

  update public.attempts a
  set finished_at = now(), score = v_score, max_score = v_max
  where a.id = p_attempt_id;

  return query select v_score, v_max;
end;
$$;

-- Tageslimit zählen; liefert false, wenn das Limit überschritten ist
create or replace function public.consume_quota(p_kind text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'nicht angemeldet';
  end if;
  insert into public.api_usage (owner_id, kind, count) values (v_uid, p_kind, 1)
  on conflict (owner_id, day, kind)
  do update set count = public.api_usage.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.create_child(text, uuid),
                           public.unlocked_grammar(uuid),
                           public.finish_attempt(uuid),
                           public.consume_quota(text, int)
  from public, anon;
grant execute on function public.create_child(text, uuid),
                          public.unlocked_grammar(uuid),
                          public.finish_attempt(uuid),
                          public.consume_quota(text, int)
  to authenticated;

-- ---------------------------------------------------------------------
-- 5. Seed: Green Line 1 Bayern (Units + Grammatik laut Klett-Stoffverteilungsplan)
-- ---------------------------------------------------------------------
with tb as (
  insert into public.textbooks (name, edition)
  values ('Green Line 1 Bayern', 'Ausgabe ab 2017')
  returning id
), u as (
  insert into public.textbook_units (textbook_id, code, title, kind, sort_order)
  select tb.id, v.code, v.title, v.kind, v.ord
  from tb, (values
    ('PUA', 'Pick-up A: I''m from Greenwich',                   'pick_up',          1),
    ('U1',  'Unit 1: It''s fun at home',                        'unit',             2),
    ('PUB', 'Pick-up B: This is fun!',                          'pick_up',          3),
    ('U2',  'Unit 2: I''m new at TTS',                          'unit',             4),
    ('U3',  'Unit 3: I like my busy days',                      'unit',             5),
    ('AC1', 'Across Cultures 1: How to be polite in English',   'across_cultures',  6),
    ('F1',  'Focus 1: The United Kingdom',                      'focus',            7),
    ('U4',  'Unit 4: Let''s do something fun',                  'unit',             8),
    ('U5',  'Unit 5: Let''s go shopping',                       'unit',             9),
    ('AC2', 'Across Cultures 2: Food in the UK',                'across_cultures', 10),
    ('F2',  'Focus 2: English around the world',                'focus',           11),
    ('U6',  'Unit 6: It''s my party',                           'unit',            12),
    ('AC3', 'Across Cultures 3: Special days, special events',  'across_cultures', 13),
    ('F3',  'Focus 3: A first look at the US',                  'focus',           14)
  ) as v(code, title, kind, ord)
  returning id, code
)
insert into public.grammar_topics (textbook_unit_id, code, label_de, forms, sort_order)
select u.id, g.code, g.label_de, g.forms, g.ord
from u
join (values
  -- Unit 1
  ('U1', 'plural_nouns',        'Nomen: Singular und Plural',                          '{plural}'::text[],      1),
  ('U1', 'pron_be',             'Personalpronomen und Formen von be',                  '{}'::text[],            2),
  ('U1', 'be_negation',         'Verneinung von be',                                   '{}'::text[],            3),
  ('U1', 'be_questions',        'Entscheidungsfragen und Kurzantworten mit be',        '{}'::text[],            4),
  ('U1', 'there_is_are',        'there is / there are (Aussage, Frage, Kurzantwort)',  '{}'::text[],            5),
  ('U1', 'possessive_det',      'Possessivbegleiter (my, your, his …)',                '{}'::text[],            6),
  -- Unit 2
  ('U2', 'indef_article',       'Unbestimmter Artikel a / an',                         '{}'::text[],            1),
  ('U2', 'def_article',         'Bestimmter Artikel the',                              '{}'::text[],            2),
  ('U2', 'have_got',            'have got (Aussage und Verneinung)',                   '{}'::text[],            3),
  ('U2', 'have_got_questions',  'Fragen und Kurzantworten mit have got',               '{}'::text[],            4),
  ('U2', 'who_what_whose',      'Fragewörter who, what, whose',                        '{}'::text[],            5),
  ('U2', 'can_cant',            'can / can''t',                                        '{}'::text[],            6),
  ('U2', 'imperative',          'Imperativ',                                           '{}'::text[],            7),
  ('U2', 's_genitive',          's-Genitiv',                                           '{genitive}'::text[],    8),
  ('U2', 'of_genitive',         'Besitzform mit of',                                   '{}'::text[],            9),
  ('U2', 'demonstratives',      'this, that, these, those',                            '{}'::text[],           10),
  -- Unit 3
  ('U3', 'simple_present',      'simple present (Aussagen, 3. Person -s)',             '{third_person}'::text[],1),
  ('U3', 'word_order',          'Satzstellung im Aussagesatz',                         '{}'::text[],            2),
  ('U3', 'freq_adverbs',        'Häufigkeitsadverbien (always, often …)',              '{}'::text[],            3),
  -- Unit 4
  ('U4', 'do_does_questions',   'Entscheidungsfragen und Kurzantworten mit do/does',   '{}'::text[],            1),
  ('U4', 'sp_negation',         'Verneinung im simple present (don''t / doesn''t)',    '{}'::text[],            2),
  ('U4', 'object_pronouns',     'Objektformen der Personalpronomen (me, him …)',       '{}'::text[],            3),
  ('U4', 'wh_questions_do',     'Fragen mit Fragewort und do/does',                    '{}'::text[],            4),
  -- Unit 5
  ('U5', 'quantities_of',       'Mengenangaben mit of (a bottle of …)',                '{}'::text[],            1),
  ('U5', 'present_progressive', 'present progressive',                                 '{ing}'::text[],         2),
  ('U5', 'pp_vs_sp',            'present progressive vs. simple present',              '{}'::text[],            3),
  ('U5', 'some_any_no',         'some, any, no und Zusammensetzungen',                 '{}'::text[],            4),
  ('U5', 'much_many',           'much, many, a lot of',                                '{}'::text[],            5),
  ('U5', 'few_little',          'a few, a little, a couple of',                        '{}'::text[],            6),
  -- Unit 6
  ('U6', 'must_mustnt_neednt',  'must, mustn''t, needn''t',                            '{}'::text[],            1),
  ('U6', 'simple_past',         'simple past (Aussagen)',                              '{past}'::text[],        2),
  ('U6', 'simple_past_q_neg',   'simple past: Fragen und Verneinung',                  '{}'::text[],            3),
  ('U6', 'clauses',             'Haupt- und Nebensätze',                               '{}'::text[],            4)
) as g(unit_code, code, label_de, forms, ord)
  on g.unit_code = u.code;
