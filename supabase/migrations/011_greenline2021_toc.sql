-- 011_greenline2021_toc.sql
-- Green Line 1, Ausgabe 2021: Aufbau, Themen und Grammatik nach dem Inhaltsverzeichnis
-- der offiziellen Klett-Demoversion (Digitaler Unterrichtsassistent).

delete from public.textbook_units where textbook_id = (select id from public.textbooks where name = 'Green Line 1');

-- Mit Grammatikangaben pro Unit gilt wieder der übliche Anfänger-Grundbaustein
update public.textbooks set
  prior_grammar = null,
  sections = '{check_in,station_1,station_2,station_3,story,unit_task,other}'
where name = 'Green Line 1';

with tb as (select id from public.textbooks where name = 'Green Line 1'),
u as (
  insert into public.textbook_units (textbook_id, code, title, kind, sort_order, topics, sections)
  select tb.id, v.code, v.title, v.kind, v.ord, v.topics, v.secs
  from tb, (values
    ('HELLO', 'Hello!',                                    'pick_up',         1, 'introducing yourself, numbers 0–12, colours, hobbies, the alphabet, school things', null::text[]),
    ('U1',    'Unit 1: A new school',                      'unit',            2, 'a new school, feelings, school uniforms, the classroom, the library, school rules, the cafeteria', '{check_in,station_1,station_2,station_3,story,other}'::text[]),
    ('MS',    'Media smart: Writing texts on computers',   'focus',           3, 'rules for using media in the classroom, making a poster on the computer', null::text[]),
    ('U2',    'Unit 2: At home',                           'unit',            4, 'things in the house, rooms, addresses, the family, family trees, telling the time, days of the week, a typical day', '{check_in,station_1,station_2,station_3,story,unit_task,other}'::text[]),
    ('AC1',   'Across cultures 1: Greenwich – A special corner of London', 'across_cultures', 5, 'historic Greenwich, sights, time zones, Britain and the sea', null::text[]),
    ('U3',    'Unit 3: Our Greenwich',                     'unit',            6, 'favourite places, free time activities, public transport, polite questions, asking the way, keeping in touch', '{check_in,station_1,station_2,station_3,story,unit_task,other}'::text[]),
    ('AC2',   'Across cultures 2: How does it taste?',     'across_cultures', 7, 'food in Britain, healthy food', null::text[]),
    ('U4',    'Unit 4: Happy Birthday',                    'unit',            8, 'birthdays, months and seasons, dates, parties, party food, desserts, shopping, British money, invitations, a flea market', '{check_in,station_1,station_2,station_3,story,unit_task,other}'::text[]),
    ('TR',    'Trailer: Plans for the school holidays',    'focus',           9, 'plans for the summer holidays', null::text[])
  ) as v(code, title, kind, ord, topics, secs)
  returning id, code
)
insert into public.grammar_topics (textbook_unit_id, code, label_de, forms, sort_order)
select u.id, g.code, g.label_de, g.forms, g.ord
from u join (values
  -- Codes von Grundbausteinen (be, there is, can, Imperativ, Possessivbegleiter, a/an) werden nie verboten
  ('HELLO', 'pron_be',              'to be (Langformen)',                                          '{}'::text[],             1),
  ('U1',    'indef_article',        'Nomen und Artikel (a/an)',                                     '{}'::text[],             1),
  ('U1',    'plural_nouns',         'Plural der Nomen',                                             '{plural}'::text[],       2),
  ('U1',    'be_questions',         'to be: Kurzformen, Verneinung, Fragen und Kurzantworten',      '{}'::text[],             3),
  ('U1',    'prepositions',         'Präpositionen des Ortes',                                      '{}'::text[],             4),
  ('U1',    'there_is_are',         'there is / there are (Aussagen und Fragen)',                   '{}'::text[],             5),
  ('U1',    'can_cant',             'can / can''t',                                                 '{}'::text[],             6),
  ('U1',    'imperative',           'Imperativ',                                                    '{}'::text[],             7),
  ('U1',    'possessive_det',       'Personalpronomen und Possessivbegleiter',                      '{}'::text[],             8),
  ('U2',    's_genitive',           'Besitzangaben mit ’s und s’',                                  '{genitive}'::text[],     1),
  ('U2',    'simple_present',       'simple present: Aussagesätze (3. Person -s)',                  '{third_person}'::text[], 2),
  ('U2',    'word_order',           'Satzstellung im Aussagesatz',                                  '{}'::text[],             3),
  ('U2',    'object_pronouns',      'Objektformen der Personalpronomen',                            '{}'::text[],             4),
  ('U3',    'do_does_questions',    'simple present: Fragen und Kurzantworten mit do/does',         '{}'::text[],             1),
  ('U3',    'sp_negation',          'simple present: Verneinung',                                   '{}'::text[],             2),
  ('U3',    'wh_questions_do',      'Fragen mit Fragewörtern',                                      '{}'::text[],             3),
  ('U4',    'quantifiers',          'some, any, much, many, a lot of, a few, a little, a couple of', '{}'::text[],            1),
  ('U4',    'quantities_of',        'Mengenangaben mit of',                                         '{}'::text[],             2),
  ('U4',    'present_progressive',  'present progressive (Aussagen, Fragen, Kurzantworten)',        '{ing}'::text[],          3),
  ('U4',    'pp_vs_sp',             'simple present vs. present progressive',                       '{}'::text[],             4),
  ('TR',    'going_to',             'going-to future',                                              '{}'::text[],             1)
) as g(unit_code, code, label_de, forms, ord) on g.unit_code = u.code;
