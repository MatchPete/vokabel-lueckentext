import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VocabForm from "@/components/VocabForm";
import VocabManager from "@/components/VocabManager";
import StartExercise from "@/components/StartExercise";
import { berlinToday, cardsBreakdown, cardsToday, toCardWords, type ProgressRow } from "@/lib/progress";
import { sectionsFor, unitTag, type Section, type Unit, type Vocab } from "@/lib/types";
import { parseSettings } from "@/lib/settings";
import CardsInfo from "@/components/CardsInfo";
import { CHAPTERS } from "@/lib/grammar/catalog";

export default async function UnitPage(props: PageProps<"/kind/[id]/unit/[unitId]">) {
  const { id, unitId } = await props.params;
  const sp = await props.searchParams;
  const imported = typeof sp.importiert === "string" && /^\d+$/.test(sp.importiert) ? Number(sp.importiert) : null;
  const supabase = await createClient();

  const [{ data: child }, { data: allUnits }, { data: vocab }] = await Promise.all([
    supabase.from("children").select("id, nickname, settings, textbooks(name, sections)").eq("id", id).maybeSingle(),
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind, sections)")
      .eq("child_id", id)
      .order("sort_order"),
    supabase
      .from("vocab")
      .select("id, unit_id, section, en, de, accepted_en, excluded, created_at, vocab_progress(due_date, ease, reps, lapses, correct_count, wrong_count, last_seen_at)")
      .eq("unit_id", unitId)
      .order("created_at"),
  ]);
  const units = (allUnits ?? []) as unknown as Unit[];
  const u = units.find((x) => x.id === unitId);
  if (!child || !u) notFound();

  const words = (vocab ?? []) as unknown as Vocab[];
  const isMain = u.textbook_units?.kind === "unit";
  const bookName = (child as unknown as { textbooks: { name: string } | null }).textbooks?.name;
  const unitGrammar =
    bookName === "Green Line 1 Bayern" ? CHAPTERS.filter((c) => c.unit === u.textbook_units?.code) : [];
  const bookSections = (child as unknown as { textbooks: { sections: string[] } | null }).textbooks?.sections;
  const sections: Section[] = sectionsFor(bookSections, isMain, u.textbook_units?.sections);
  const today = berlinToday();
  const settings = parseSettings(child.settings);
  const active = ((vocab ?? []) as unknown as (ProgressRow & { excluded: boolean })[]).filter((v) => !v.excluded);
  const activeWords = toCardWords(active, today);
  const dueToday = cardsToday(activeWords, today, settings.roundSize, settings.newPerRound);
  const breakdown = cardsBreakdown(activeWords, today, settings.roundSize, settings.newPerRound);
  const excludedCount = (vocab ?? []).length - active.length;

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {child.nickname}</Link>
      <h1 className="title">
        <span className="tag tag-lg">{unitTag(u.textbook_units?.code)}</span>
        {u.title.replace(/^[^:]+:\s*/, "")}
      </h1>

      {imported != null && (
        <p className="card ok" role="status">
          {imported === 1 ? "1 Vokabel" : `${imported} Vokabeln`} aus den Fotos gespeichert.
        </p>
      )}

      <div className="unit-actions">
        {active.length > 0 && (
          <span className="with-info">
            <Link href={`/kind/${id}/unit/${unitId}/karten`} className="btn">
              Karteikarten{dueToday > 0 ? ` · ${dueToday} heute` : ""}
            </Link>
            <CardsInfo b={breakdown} excluded={excludedCount} />
          </span>
        )}
        {active.length > 0 && <StartExercise childId={id} unitId={unitId} label="Lückentext" quiet />}
        <Link href={`/kind/${id}/unit/${unitId}/foto`} className="btn-quiet">Seiten fotografieren</Link>
      </div>

      {unitGrammar.length > 0 && (
        <section className="card stack">
          <h2 className="subtitle">Grammatik dieser Unit</h2>
          <ul className="g-list">
            {unitGrammar.map((c) => (
              <li key={c.code}>
                <Link href={`/kind/${id}/grammatik/${c.code}`} className="g-row">
                  <span className="g-code">{c.code}</span>
                  <span className="g-title">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <VocabForm childId={id} unitId={unitId} sections={sections} />

      <VocabManager
        childId={id}
        unitId={unitId}
        isMain={isMain}
        words={words.map((w) => ({ id: w.id, en: w.en, de: w.de, section: w.section, excluded: Boolean((w as Vocab & { excluded?: boolean }).excluded) }))}
        units={units.map((x) => ({ id: x.id, title: x.title, isMain: x.textbook_units?.kind === "unit" }))}
        mainSections={sectionsFor(bookSections, true)}
      />
    </main>
  );
}
