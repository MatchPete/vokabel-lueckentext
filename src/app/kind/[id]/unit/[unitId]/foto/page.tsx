import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoImport from "@/components/PhotoImport";
import { normalize } from "@/lib/exercise";
import { sectionsFor, unitTag, type Section, type Unit } from "@/lib/types";

export default async function PhotoPage(props: PageProps<"/kind/[id]/unit/[unitId]/foto">) {
  const { id, unitId } = await props.params;
  const supabase = await createClient();

  const [{ data: unit }, { data: vocab }, { data: child }] = await Promise.all([
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind, sections)")
      .eq("id", unitId)
      .eq("child_id", id)
      .maybeSingle(),
    supabase.from("vocab").select("en, de").eq("child_id", id),
    supabase.from("children").select("textbooks(sections)").eq("id", id).maybeSingle(),
  ]);
  if (!unit) notFound();

  const u = unit as unknown as Unit;
  const bookSections = (child as unknown as { textbooks: { sections: string[] } | null } | null)?.textbooks?.sections;
  const sections: Section[] = sectionsFor(bookSections, u.textbook_units?.kind === "unit", u.textbook_units?.sections);
  const existingKeys = (vocab ?? []).map((v) => `${normalize(v.en)}|${normalize(v.de)}`);

  return (
    <main className="sheet">
      <Link href={`/kind/${id}/unit/${unitId}`} className="back">← zurück zur Unit</Link>
      <h1 className="title">
        <span className="tag tag-lg">{unitTag(u.textbook_units?.code)}</span>
        Seiten fotografieren
      </h1>
      <PhotoImport childId={id} unitId={unitId} sections={sections} existingKeys={existingKeys} />
    </main>
  );
}
