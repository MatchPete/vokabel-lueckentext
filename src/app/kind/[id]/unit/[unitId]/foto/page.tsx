import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoImport from "@/components/PhotoImport";
import { normalize } from "@/lib/exercise";
import { sectionsFor, type Section, type Unit } from "@/lib/types";

export default async function PhotoPage(props: PageProps<"/kind/[id]/unit/[unitId]/foto">) {
  const { id, unitId } = await props.params;
  const supabase = await createClient();

  const [{ data: unit }, { data: vocab }, { data: child }, { data: allUnits }] = await Promise.all([
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind, sections)")
      .eq("id", unitId)
      .eq("child_id", id)
      .maybeSingle(),
    supabase.from("vocab").select("en, de").eq("child_id", id),
    supabase.from("children").select("textbooks(sections)").eq("id", id).maybeSingle(),
    supabase
      .from("units")
      .select("id, title, sort_order, textbook_units(code, kind, sections)")
      .eq("child_id", id)
      .order("sort_order"),
  ]);
  if (!unit) notFound();

  const u = unit as unknown as Unit;
  const bookSections = (child as unknown as { textbooks: { sections: string[] } | null } | null)?.textbooks?.sections;
  const sections: Section[] = sectionsFor(bookSections, u.textbook_units?.kind === "unit", u.textbook_units?.sections);
  const existingKeys = (vocab ?? []).map((v) => `${normalize(v.en)}|${normalize(v.de)}`);
  const unitOptions = ((allUnits ?? []) as unknown as Unit[]).map((x) => ({
    id: x.id,
    title: x.title,
    sections: sectionsFor(bookSections, x.textbook_units?.kind === "unit", x.textbook_units?.sections),
  }));

  return (
    <main className="sheet">
      <Link href={`/kind/${id}/unit/${unitId}`} className="back">← zurück zur Unit</Link>
      <h1 className="title">Seiten fotografieren</h1>
      <PhotoImport childId={id} unitId={unitId} sections={sections} units={unitOptions} existingKeys={existingKeys} />
    </main>
  );
}
