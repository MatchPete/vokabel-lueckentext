import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VocabForm from "@/components/VocabForm";
import VocabManager from "@/components/VocabManager";
import StartExercise from "@/components/StartExercise";
import { berlinToday, cardsToday, toCardWords, type ProgressRow } from "@/lib/progress";
import { SECTION_ORDER, unitTag, type Section, type Unit, type Vocab } from "@/lib/types";

export default async function UnitPage(props: PageProps<"/kind/[id]/unit/[unitId]">) {
  const { id, unitId } = await props.params;
  const sp = await props.searchParams;
  const imported = typeof sp.importiert === "string" && /^\d+$/.test(sp.importiert) ? Number(sp.importiert) : null;
  const supabase = await createClient();

  const [{ data: child }, { data: allUnits }, { data: vocab }] = await Promise.all([
    supabase.from("children").select("id, nickname").eq("id", id).maybeSingle(),
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind)")
      .eq("child_id", id)
      .order("sort_order"),
    supabase
      .from("vocab")
      .select("id, unit_id, section, en, de, accepted_en, created_at, vocab_progress(due_date, ease, reps, lapses, correct_count, wrong_count, last_seen_at)")
      .eq("unit_id", unitId)
      .order("created_at"),
  ]);
  const units = (allUnits ?? []) as unknown as Unit[];
  const u = units.find((x) => x.id === unitId);
  if (!child || !u) notFound();

  const words = (vocab ?? []) as unknown as Vocab[];
  const isMain = u.textbook_units?.kind === "unit";
  const sections: Section[] = isMain ? SECTION_ORDER : ["other"];
  const today = berlinToday();
  const dueToday = cardsToday(toCardWords((vocab ?? []) as unknown as ProgressRow[], today), today);

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
        {words.length > 0 && (
          <Link href={`/kind/${id}/unit/${unitId}/karten`} className="btn">
            Karteikarten{dueToday > 0 ? ` · ${dueToday}` : ""}
          </Link>
        )}
        {words.length > 0 && <StartExercise childId={id} unitId={unitId} label="Lückentext" quiet />}
        <Link href={`/kind/${id}/unit/${unitId}/foto`} className="btn-quiet">Seiten fotografieren</Link>
      </div>

      <VocabForm childId={id} unitId={unitId} sections={sections} />

      <VocabManager
        childId={id}
        unitId={unitId}
        isMain={isMain}
        words={words.map((w) => ({ id: w.id, en: w.en, de: w.de, section: w.section }))}
        units={units.map((x) => ({ id: x.id, title: x.title, isMain: x.textbook_units?.kind === "unit" }))}
      />
    </main>
  );
}
