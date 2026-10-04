-- =====================================================================
-- 004_stats.sql
-- "Gelernt" = an zwei verschiedenen Tagen richtig (Abstand erreicht >= 3 Tage).
-- Der Zeitpunkt wird einmalig festgehalten und bleibt (für die Lernkurve).
-- =====================================================================

alter table public.vocab_progress add column learned_at timestamptz;

update public.vocab_progress
   set learned_at = coalesce(last_seen_at, now())
 where interval_days >= 3 and learned_at is null;

create index vocab_progress_learned_idx on public.vocab_progress (child_id, learned_at);

-- apply_review: zusätzlich learned_at setzen (Rest unverändert zu 003)
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
    last_seen_at  = now(),
    learned_at    = case when learned_at is null and v_int >= 3 then now() else learned_at end
  where vocab_id = p_vocab_id;
end;
$$;

-- Alle Antworten eines Kindes (Karteikarten + 1. Versuch im Lückentext) mit Tag
create or replace function public.child_activity(p_child_id uuid)
returns table (d date, ok boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select (c.created_at at time zone 'Europe/Berlin')::date, c.grade in ('good','easy')
    from public.card_reviews c
   where c.child_id = p_child_id
  union all
  select (aa.created_at at time zone 'Europe/Berlin')::date, aa.result = 'correct'
    from public.attempt_answers aa
    join public.attempts a on a.id = aa.attempt_id
   where a.child_id = p_child_id and aa.try_no = 1;
$$;

-- Kennzahlen für Kinderseite und Statistik
create or replace function public.child_stats(p_child_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today   date := (now() at time zone 'Europe/Berlin')::date;
  v_days    date[];
  v_day     date;
  v_streak  int := 0;
  v_curve   jsonb;
  v_act     jsonb;
  v_total   int;
  v_learned int;
begin
  if not exists (select 1 from public.children where id = p_child_id) then
    return null;
  end if;

  -- Ein Übungstag zählt ab 5 Antworten
  select coalesce(array_agg(x.d), '{}') into v_days
    from (select a.d from public.child_activity(p_child_id) a group by a.d having count(*) >= 5) x;

  v_day := case when v_today = any(v_days) then v_today else v_today - 1 end;
  while v_day = any(v_days) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  select count(*), count(*) filter (where p.learned_at is not null)
    into v_total, v_learned
    from public.vocab_progress p where p.child_id = p_child_id;

  select coalesce(jsonb_agg(jsonb_build_object('day', z.d, 'total', z.total) order by z.d), '[]')
    into v_curve
    from (
      select y.d, sum(y.n) over (order by y.d) as total
        from (select (p.learned_at at time zone 'Europe/Berlin')::date as d, count(*) as n
                from public.vocab_progress p
               where p.child_id = p_child_id and p.learned_at is not null
               group by 1) y
    ) z;

  select jsonb_agg(jsonb_build_object('day', s.d, 'answers', coalesce(c.n, 0), 'correct', coalesce(c.k, 0)) order by s.d)
    into v_act
    from (select v_today - i as d from generate_series(0, 13) as i) s
    left join (
      select a.d, count(*) as n, count(*) filter (where a.ok) as k
        from public.child_activity(p_child_id) a
       where a.d >= v_today - 13
       group by a.d
    ) c on c.d = s.d;

  return jsonb_build_object(
    'today', v_today,
    'total_words', v_total,
    'learned', v_learned,
    'streak', v_streak,
    'practiced_today', v_today = any(v_days),
    'curve', v_curve,
    'activity', coalesce(v_act, '[]')
  );
end;
$$;

revoke execute on function public.child_activity(uuid), public.child_stats(uuid) from public, anon;
grant execute on function public.child_activity(uuid), public.child_stats(uuid) to authenticated;
