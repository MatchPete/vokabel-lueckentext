-- 009_textbooks_access3.sql
-- Lehrwerke werden "buchfähig": Abschnitte, Niveau, Vorwissen und erlaubte Wortformen je Buch.
-- Neu: Access 3 (Cornelsen, Allgemeine Ausgabe 2014, 7. Schuljahr).

-- Abschnitte: zusätzlich Part A/B/C (Access)
alter table public.vocab drop constraint vocab_section_check;
alter table public.vocab add constraint vocab_section_check check (section in (
  'check_in','station_1','station_2','station_3','part_a','part_b','part_c','story','skills','unit_task','other'));

alter table public.textbooks
  add column lernjahr      int    not null default 1,
  add column min_level     int    not null default 1 check (min_level between 1 and 3),
  add column sections      text[] not null default '{check_in,station_1,station_2,station_3,story,skills,unit_task,other}',
  add column base_forms    text[] not null default '{base}',
  add column profile       text,
  add column prior_grammar text;

update public.textbooks set
  lernjahr = 1,
  min_level = 1,
  profile = 'a German child aged 10–11 in the first year of English at a Bavarian Gymnasium (textbook: Green Line 1 Bayern, CEFR A1). Setting: Greenwich / London, UK.'
where name = 'Green Line 1 Bayern';

-- Access 3: Units und Grammatik nach dem Arbeitsplan eines Gymnasiums zu Access 3 (Klasse 7).
-- Annahme: Titel können im Buch leicht abweichen.
with tb as (
  insert into public.textbooks (name, edition, lernjahr, min_level, sections, base_forms, profile, prior_grammar)
  values (
    'Access 3', 'Allgemeine Ausgabe 2014, 7. Schuljahr', 3, 2,
    '{part_a,part_b,part_c,story,skills,other}',
    '{base,plural,third_person,ing,past,genitive,participle}',
    'a German student aged 12–13 in the third year of English at a German secondary school (textbook: Access 3, Cornelsen, CEFR A2). Settings of the book: London, Wales, Liverpool, Ireland and Scotland.',
    'Everything from the first two years of English: simple present and present progressive, simple past, present perfect (simple), will-future and going to-future, comparison of adjectives, adverbs of manner, if-clauses type 1, modal verbs (can, must, may, should, have to), some/any, question words, possessive forms.'
  )
  returning id
), u as (
  insert into public.textbook_units (textbook_id, code, title, kind, sort_order)
  select tb.id, v.code, v.title, 'unit', v.ord
  from tb, (values
    ('U1', 'Unit 1: This is London', 1),
    ('U2', 'Unit 2: Welcome to Snowdonia', 2),
    ('U3', 'Unit 3: A weekend in Liverpool', 3),
    ('U4', 'Unit 4: My trip to Ireland', 4),
    ('U5', 'Unit 5: Extraordinary Scotland', 5)
  ) as v(code, title, ord)
  returning id, code
)
insert into public.grammar_topics (textbook_unit_id, code, label_de, forms, sort_order)
select u.id, g.code, g.label_de, g.forms, g.ord
from u join (values
  ('U1', 'sp_vs_pp',          'simple past und present perfect unterscheiden',       '{}'::text[],    1),
  ('U1', 'pp_progressive',    'present perfect progressive mit for/since',           '{ing}'::text[], 2),
  ('U2', 'conditional_1',     'if-Sätze Typ 1 (Wiederholung)',                       '{}'::text[],    1),
  ('U2', 'conditional_2',     'if-Sätze Typ 2',                                      '{past}'::text[],2),
  ('U2', 'will_future',       'will-future',                                         '{}'::text[],    3),
  ('U3', 'relative_clauses',  'Relativsätze und contact clauses',                    '{}'::text[],    1),
  ('U3', 'passive',           'Passiv',                                              '{participle}'::text[], 2),
  ('U4', 'past_perfect',      'past perfect (Abgrenzung zum simple past)',           '{participle}'::text[], 1),
  ('U4', 'modal_substitutes', 'Modalverben in verschiedenen Zeiten (Ersatzformen)',  '{}'::text[],    2),
  ('U5', 'reflexive',         'Reflexivpronomen und each other',                     '{}'::text[],    1),
  ('U5', 'reported_speech',   'indirekte Rede',                                      '{}'::text[],    2)
) as g(unit_code, code, label_de, forms, ord) on g.unit_code = u.code;
