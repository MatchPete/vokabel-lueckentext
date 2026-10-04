-- =====================================================================
-- 003_adaptive_review.sql
-- Ersetzt die festen Leitner-Fächer durch eine Planung pro Wort
-- (Prinzip wie SM-2: Leichtigkeit, Abstand, Wiederholungen, Fehler).
-- "box" bleibt als grobe Stufe 1–5 erhalten und wird aus dem Abstand abgeleitet.
-- =====================================================================

alter table public.vocab_progress
  add column ease          numeric(4,2) not null default 2.50,
  add column interval_days int          not null default 0,
  add column reps          int          not null default 0,
  add column lapses        int          not null default 0;

-- Bestehenden Stand aus den Leitner-Fächern übernehmen
update public.vocab_progress set
  interval_days = case box when 1 then 0 when 2 then 1 when 3 then 3 when 4 then 7 else 21 end,
  reps          = greatest(box - 1, 0);

-- Protokoll jeder Karteikarten-Antwort (für Auswertung und spätere Elternansicht)
create table public.card_reviews (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid(),
  child_id   uuid not null,
  vocab_id   uuid not null references public.vocab(id) on delete cascade,
  grade      text not null check (grade in ('again','hard','good','easy')),
  given      text not null default '',
  ms         int,
  created_at timestamptz not null default now(),
  foreign key (child_id, owner_id) references public.children(id, owner_id) on delete cascade
);
create index card_reviews_child_idx on public.card_reviews (child_id, created_at desc);
create index card_reviews_vocab_idx on public.card_reviews (vocab_id);

alter table public.card_reviews enable row level security;
create policy "own rows" on public.card_reviews for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.card_reviews from anon;
grant select, insert on public.card_reviews to authenticated;

-- ---------------------------------------------------------------------
-- Eine Antwort verarbeiten
--   again = nicht gewusst, hard = mit Mühe / Tippfehler,
--   good  = gewusst,       easy = schnell und sicher gewusst
-- Vorzeitige Wiederholung (noch nicht fällig): richtige Antworten
-- verschieben den Plan nicht, Fehler und "hard" schon.
-- ---------------------------------------------------------------------
create or replace function public.apply_review(p_vocab_id uuid, p_grade text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today  date := (now() at time zone 'Europe/Berlin')::date;
  v        public.vocab_progress%rowtype;
  v_ease   numeric;
  v_int    int;
  v_reps   int;
  v_lapses int;
begin
  if p_grade not in ('again','hard','good','easy') then
    raise exception 'Ungültige Bewertung: %', p_grade;
  end if;

  select * into v from public.vocab_progress where vocab_id = p_vocab_id for update;
  if not found then return; end if;

  -- Vorzeitig und richtig: nur protokollieren
  if v.due_date > v_today and p_grade in ('good','easy') then
    update public.vocab_progress
       set correct_count = correct_count + 1, last_seen_at = now()
     where vocab_id = p_vocab_id;
    return;
  end if;

  v_ease := v.ease; v_int := v.interval_days; v_reps := v.reps; v_lapses := v.lapses;

  if p_grade = 'again' then
    v_ease   := greatest(1.30, v_ease - 0.20);
    v_lapses := v_lapses + 1;
    v_reps   := 0;
    v_int    := 0;
  elsif p_grade = 'hard' then
    v_ease := greatest(1.30, v_ease - 0.15);
    v_int  := case when v.due_date > v_today then least(v_int, 1) else greatest(1, round(v_int * 1.2)::int) end;
    v_reps := v_reps + 1;
  else
    v_int := case
               when v_reps = 0 then 1
               when v_reps = 1 then 3
               else greatest(v_int + 1, round(v_int * v_ease)::int)
             end;
    if p_grade = 'easy' then
      v_int  := greatest(v_int + 1, round(v_int * 1.3)::int);
      v_ease := least(3.00, v_ease + 0.10);
    end if;
    v_reps := v_reps + 1;
  end if;

  v_int := least(v_int, 120);

  update public.vocab_progress set
    ease          = v_ease,
    interval_days = v_int,
    reps          = v_reps,
    lapses        = v_lapses,
    due_date      = v_today + v_int,
    box           = case when v_int < 1 then 1 when v_int < 3 then 2 when v_int < 7 then 3 when v_int < 21 then 4 else 5 end,
    correct_count = correct_count + case when p_grade in ('good','easy') then 1 else 0 end,
    wrong_count   = wrong_count   + case when p_grade in ('again','hard') then 1 else 0 end,
    last_seen_at  = now()
  where vocab_id = p_vocab_id;
end;
$$;

-- Lückentext abschließen: nutzt jetzt dieselbe Logik (nur der 1. Versuch zählt)
create or replace function public.finish_attempt(p_attempt_id uuid)
returns table (richtig int, gesamt int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_score int;
  v_max   int;
  r       record;
begin
  if not exists (select 1 from public.attempts a
                 where a.id = p_attempt_id and a.finished_at is null) then
    raise exception 'Übung nicht gefunden oder bereits abgeschlossen';
  end if;

  for r in
    select f.vocab_id, f.result from public.attempt_answers f
    where f.attempt_id = p_attempt_id and f.try_no = 1
  loop
    perform public.apply_review(
      r.vocab_id,
      case r.result when 'correct' then 'good' when 'almost' then 'hard' else 'again' end
    );
  end loop;

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

-- Karteikarte: Antwort protokollieren und einplanen (in einem Aufruf)
create or replace function public.record_card_review(p_vocab_id uuid, p_grade text, p_given text, p_ms int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_child uuid;
begin
  select child_id into v_child from public.vocab where id = p_vocab_id;
  if v_child is null then raise exception 'Vokabel nicht gefunden'; end if;

  insert into public.card_reviews (child_id, vocab_id, grade, given, ms)
  values (v_child, p_vocab_id, p_grade, left(coalesce(p_given, ''), 120),
          case when p_ms between 0 and 600000 then p_ms else null end);

  perform public.apply_review(p_vocab_id, p_grade);
end;
$$;

revoke execute on function public.apply_review(uuid, text),
                           public.record_card_review(uuid, text, text, int)
  from public, anon;
grant execute on function public.apply_review(uuid, text),
                          public.record_card_review(uuid, text, text, int)
  to authenticated;
