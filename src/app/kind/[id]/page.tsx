import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCurrentUnit } from "@/app/actions";
import StartExercise from "@/components/StartExercise";
import MedalWatcher from "@/components/MedalWatcher";
import { medalInfo, type ChildStats } from "@/lib/stats";
import { berlinToday, cardsBreakdown, cardsToday, TODAY_SELECT, wordsUpToCurrent, type TodayRow } from "@/lib/progress";
import CardsInfo from "@/components/CardsInfo";
import { parseSettings } from "@/lib/settings";
import { unitTag, type Child, type Unit } from "@/lib/types";

export default async function ChildPage(props: PageProps<"/kind/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: child }, { data: units }, { data: vocab }, { data: statsRaw }] = await Promise.all([
    supabase.from("children").select("id, nickname, textbook_id, current_unit_id, created_at, settings").eq("id", id).maybeSingle(),
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind)")
      .eq("child_id", id)
      .order("sort_order"),
    supabase.from("vocab").select(TODAY_SELECT + ", excluded").eq("child_id", id),
    supabase.rpc("child_stats", { p_child_id: id }),
  ]);
  if (!child) notFound();

  const kid = child as Child;
  const list = (units ?? []) as unknown as Unit[];
  const counts = new Map<string, number>();
  for (const v of (vocab ?? []) as unknown as { unit_id: string }[]) {
    counts.set(v.unit_id, (counts.get(v.unit_id) ?? 0) + 1);
  }
  const total = vocab?.length ?? 0;
  const stats = statsRaw as ChildStats | null;
  const medals = medalInfo(stats?.learned ?? 0);
  const topMedal = medals.earned[medals.earned.length - 1];
  const current = list.find((u) => u.id === kid.current_unit_id);
  const currentOrder = current?.sort_order ?? 0;
  // "Heute üben": fällige Wörter aller Lektionen bis zur aktuellen + neue der aktuellen
  const settings = parseSettings((child as unknown as { settings: unknown }).settings);
  const today = berlinToday();
  const activeRows = ((vocab ?? []) as unknown as (TodayRow & { excluded: boolean })[]).filter((v) => !v.excluded);
  const todayWords = wordsUpToCurrent(activeRows, today, kid.current_unit_id, current ? current.sort_order : null);
  const todayCount = cardsToday(todayWords, today, settings.roundSize, settings.newPerRound);
  const todayBreakdown = cardsBreakdown(todayWords, today, settings.roundSize, settings.newPerRound);

  return (
    <main className="sheet">
      <div className="top-links">
        <Link href="/" className="back">← Profile</Link>
        <Link href={`/kind/${kid.id}/einstellungen`} className="back">Einstellungen</Link>
      </div>
      <h1 className="title">{kid.nickname}</h1>
      <p className="lead">{total === 1 ? "1 Vokabel gespeichert" : `${total} Vokabeln gespeichert`}</p>

      {stats && <MedalWatcher childId={kid.id} learned={stats.learned} />}

      {stats && (
        <Link href={`/kind/${kid.id}/statistik`} className="card stats-strip">
          <span className="strip-item">
            <strong>{stats.learned}</strong> gelernt
          </span>
          <span className="strip-item">
            <strong>{stats.streak}</strong> {stats.streak === 1 ? "Tag" : "Tage"} in Folge
            {!stats.practiced_today && stats.streak > 0 && <span className="strip-hint"> · heute noch üben</span>}
          </span>
          {topMedal ? (
            <span className={`medal medal-${topMedal.tier}`} aria-label={`Medaille ${topMedal.at}`}>{topMedal.at}</span>
          ) : (
            medals.next && <span className="strip-hint">noch {medals.toNext} bis zur 1. Medaille</span>
          )}
        </Link>
      )}

      {current && (
        <section className="card current" aria-labelledby="current-heading">
          <p className="eyebrow" id="current-heading">Gerade dran</p>
          <p className="current-title">
            <span className="tag">{unitTag(current.textbook_units?.code)}</span>
            {current.title.replace(/^[^:]+:\s*/, "")}
          </p>
          <div className="current-actions">
            <span className="with-info">
              <Link href={`/kind/${kid.id}/heute`} className="btn">
                Heute üben{todayCount > 0 ? ` · ${todayCount}` : ""}
              </Link>
              <CardsInfo b={todayBreakdown} scope={`allen Lektionen bis ${current.title.split(":")[0]}`} />
            </span>
            <StartExercise childId={kid.id} unitId={current.id} label="Lückentext" quiet />
          </div>
          <p className="hint">
            „Heute üben“ mischt fällige Wörter aus allen Lektionen bis hierher mit neuen Wörtern dieser Lektion.
            Einzelne Lektionen übst du unten über „Alle Abschnitte“.
          </p>
          <Link href={`/kind/${kid.id}/unit/${current.id}`} className="link">
            Vokabeln dieser Lektion eintragen
          </Link>

          <details className="change">
            <summary>Andere Unit ist dran</summary>
            <form action={setCurrentUnit} className="change-form">
              <input type="hidden" name="child_id" value={kid.id} />
              <select name="unit_id" defaultValue={current.id} aria-label="Aktuelle Unit">
                {list.map((u) => (
                  <option key={u.id} value={u.id}>{u.title}</option>
                ))}
              </select>
              <button className="btn-quiet">Speichern</button>
            </form>
          </details>
        </section>
      )}

      <section aria-labelledby="all-heading">
        <h2 className="subtitle" id="all-heading">Alle Abschnitte</h2>
        <ol className="units ruled ruled-2">
          {list.map((u) => {
            const n = counts.get(u.id) ?? 0;
            const isCurrent = u.id === kid.current_unit_id;
            const state = isCurrent ? "is-current" : u.sort_order > currentOrder ? "is-ahead" : "is-done";
            const isMain = u.textbook_units?.kind === "unit";
            const meta = [n === 0 ? "noch leer" : n === 1 ? "1 Vokabel" : `${n} Vokabeln`];
            if (isCurrent) meta.push("gerade dran");
            return (
              <li key={u.id}>
                <Link href={`/kind/${kid.id}/unit/${u.id}`} className={`unit ${state}${isMain ? " is-main" : ""}`}>
                  <span className="tag">{unitTag(u.textbook_units?.code)}</span>
                  <span className="unit-title">{u.title.replace(/^[^:]+:\s*/, "")}</span>
                  <span className="unit-meta">{meta.join(" · ")}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
