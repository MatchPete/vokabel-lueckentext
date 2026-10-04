import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteVocab } from "@/app/actions";
import VocabForm from "@/components/VocabForm";
import StartExercise from "@/components/StartExercise";
import { SECTION_LABELS, SECTION_ORDER, unitTag, type Section, type Unit, type Vocab } from "@/lib/types";

export default async function UnitPage(props: PageProps<"/kind/[id]/unit/[unitId]">) {
  const { id, unitId } = await props.params;
  const sp = await props.searchParams;
  const imported = typeof sp.importiert === "string" && /^\d+$/.test(sp.importiert) ? Number(sp.importiert) : null;
  const supabase = await createClient();

  const [{ data: child }, { data: unit }, { data: vocab }] = await Promise.all([
    supabase.from("children").select("id, nickname").eq("id", id).maybeSingle(),
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind)")
      .eq("id", unitId)
      .eq("child_id", id)
      .maybeSingle(),
    supabase
      .from("vocab")
      .select("id, unit_id, section, en, de, created_at")
      .eq("unit_id", unitId)
      .order("created_at"),
  ]);
  if (!child || !unit) notFound();

  const u = unit as unknown as Unit;
  const words = (vocab ?? []) as Vocab[];
  const isMain = u.textbook_units?.kind === "unit";
  const sections: Section[] = isMain ? SECTION_ORDER : ["other"];

  const grouped = SECTION_ORDER.map((s) => ({ section: s, items: words.filter((w) => w.section === s) })).filter(
    (g) => g.items.length > 0,
  );

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
        {words.length > 0 && <StartExercise childId={id} unitId={unitId} label="Diese Unit üben" />}
        <Link href={`/kind/${id}/unit/${unitId}/foto`} className="btn-quiet">Seiten fotografieren</Link>
      </div>

      <VocabForm childId={id} unitId={unitId} sections={sections} />

      <section aria-labelledby="list-heading">
        <h2 className="subtitle" id="list-heading">
          {words.length === 0 ? "Noch keine Vokabeln" : words.length === 1 ? "1 Vokabel" : `${words.length} Vokabeln`}
        </h2>

        {grouped.map((g) => (
          <div key={g.section} className="vocab-group">
            {isMain && <h3 className="group-title">{SECTION_LABELS[g.section]}</h3>}
            <ul className="vocab-list ruled">
              {g.items.map((w) => (
                <li key={w.id} className="vocab">
                  <span className="vocab-en" lang="en">{w.en}</span>
                  <span className="vocab-de">{w.de}</span>
                  <form action={deleteVocab}>
                    <input type="hidden" name="child_id" value={id} />
                    <input type="hidden" name="unit_id" value={unitId} />
                    <input type="hidden" name="vocab_id" value={w.id} />
                    <button className="icon-btn" aria-label={`${w.en} löschen`} title="Löschen">×</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
