-- 010_access3_toc_greenline2021.sql
-- Access 3 nach dem Inhaltsverzeichnis des Verlags (Blick ins Buch) neu aufgebaut;
-- Green Line 1, Ausgabe 2021 (Bundesausgabe) als drittes Buch.

-- Neue Abschnitte: Einstieg und Text (Access)
alter table public.vocab drop constraint vocab_section_check;
alter table public.vocab add constraint vocab_section_check check (section in (
  'check_in','station_1','station_2','station_3','intro','part_a','part_b','part_c','text','story','skills','unit_task','other'));

-- Pro Buch-Unit: Wortfelder/Themen (für die Lückentexte) und eigene Abschnitte (z. B. nur Part A–B)
alter table public.textbook_units
  add column topics   text,
  add column sections text[];

-- ---------- Access 3 neu (noch kein Profil nutzt das Buch)
delete from public.textbook_units where textbook_id = (select id from public.textbooks where name = 'Access 3');

update public.textbooks set
  sections = '{intro,part_a,part_b,part_c,text,other}',
  prior_grammar = 'Everything from the first two years of English: simple present and present progressive, simple past, present perfect (simple), will-future and going to-future, if-clauses type 1, comparison of adjectives, adverbs of manner, modal verbs (can, must, may, should, have to), relative pronouns and relative clauses with who/which/that, some/any, question words, possessive forms.'
where name = 'Access 3';

with tb as (select id from public.textbooks where name = 'Access 3'),
u as (
  insert into public.textbook_units (textbook_id, code, title, kind, sort_order, topics, sections)
  select tb.id, v.code, v.title, v.kind, v.ord, v.topics, v.secs
  from tb, (values
    ('U1',  'Unit 1: This is London',                 'unit',  1, 'holidays, messages and postcards, sights in London, making plans, street map and tube map, the Notting Hill Carnival', '{intro,part_a,part_b,part_c,text,other}'::text[]),
    ('KAL', 'Kaleidoscope: The British Isles',        'focus', 2, 'the countries and regions of the British Isles', null::text[]),
    ('U2',  'Unit 2: Welcome to Snowdonia',           'unit',  3, 'jobs, town and country, moving house, planning a trip, volunteer work, sports, Wales and Snowdonia', '{intro,part_a,part_b,text,other}'::text[]),
    ('U3',  'Unit 3: A weekend in Liverpool',         'unit',  4, 'describing actions, sport, visiting a museum, famous people, buildings and their history, football, the Beatles, Liverpool', '{intro,part_a,part_b,part_c,text,other}'::text[]),
    ('U4',  'Unit 4: My trip to Ireland',             'unit',  5, 'countries, travelling, legends, natural wonders, Irish history, crossing borders, life on a farm', '{intro,part_a,part_b,part_c,text,other}'::text[]),
    ('U5',  'Unit 5: Extraordinary Scotland',         'unit',  6, 'music and entertainment, festivals, a scientific project, helping friends in trouble, Scottish traditions', '{intro,part_a,part_b,text,other}'::text[]),
    ('TF',  'Text File',                              'focus', 7, 'poems, songs, stories and short texts', null::text[])
  ) as v(code, title, kind, ord, topics, secs)
  returning id, code
)
insert into public.grammar_topics (textbook_unit_id, code, label_de, forms, sort_order)
select u.id, g.code, g.label_de, g.forms, g.ord
from u join (values
  ('U1', 'pp_progressive',    'present perfect progressive mit for und since',        '{ing}'::text[],        1),
  ('U2', 'conditional_2',     'if-Sätze Typ 2 (conditional 2)',                       '{past}'::text[],       1),
  ('U3', 'contact_clauses',   'contact clauses (Relativsätze ohne Relativpronomen)',  '{}'::text[],           1),
  ('U3', 'passive',           'Passiv',                                               '{participle}'::text[], 2),
  ('U4', 'modal_substitutes', 'modal substitutes (Ersatzformen der Modalverben)',     '{}'::text[],           1),
  ('U4', 'past_perfect',      'past perfect',                                         '{participle}'::text[], 2),
  ('U5', 'reflexive',         'Reflexivpronomen und each other',                      '{}'::text[],           1),
  ('U5', 'reported_speech',   'indirekte Rede (indirect speech)',                     '{}'::text[],           2)
) as g(unit_code, code, label_de, forms, ord) on g.unit_code = u.code;

-- ---------- Green Line 1, Ausgabe 2021 (Bundesausgabe, alle Länder außer Bayern)
-- Aufbau laut Buchbeschreibung des Handels. Grammatik pro Unit ist noch nicht bekannt:
-- bis dahin vorsichtig nur Gegenwartsformen.
with tb as (
  insert into public.textbooks (name, edition, lernjahr, min_level, sections, base_forms, profile, prior_grammar)
  values (
    'Green Line 1', 'Ausgabe 2021, 5. Klasse (nicht Bayern)', 1, 1,
    '{check_in,station_1,station_2,station_3,story,skills,unit_task,other}',
    '{base}',
    'a German child aged 10–11 in the first year of English (textbook: Green Line 1, Ausgabe 2021, CEFR A1). Setting: Greenwich / London, UK.',
    'am/is/are, I/you/he/she/it/we/they, my/your/his/her, a/an/the, this/that, there is/there are, can/can''t, have got, imperatives, simple present, ''I like …''. Use ONLY present forms: no past tenses and no future forms.'
  )
  returning id
)
insert into public.textbook_units (textbook_id, code, title, kind, sort_order)
select tb.id, v.code, v.title, v.kind, v.ord
from tb, (values
  ('HELLO', 'Hello!',                                               'pick_up',         1),
  ('U1',    'Unit 1: A new school',                                 'unit',            2),
  ('MS',    'Media smart: Writing texts on computers',              'focus',           3),
  ('U2',    'Unit 2: At home',                                      'unit',            4),
  ('AC1',   'Across cultures 1: Greenwich – A special corner of London', 'across_cultures', 5),
  ('U3',    'Unit 3: Our Greenwich',                                'unit',            6),
  ('AC2',   'Across cultures 2: How does it taste?',                'across_cultures', 7),
  ('U4',    'Unit 4: Happy Birthday',                               'unit',            8)
) as v(code, title, kind, ord);
