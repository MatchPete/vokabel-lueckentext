import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoImport from "@/components/PhotoImport";
import { normalize } from "@/lib/exercise";
import { SECTION_ORDER, unitTag, type Section, type Unit } from "@/lib/types";

export default async function PhotoPage(props: PageProps<"/kind/[id]/unit/[unitId]/foto">) {
  const { id, unitId } = await props.params;
  const supabase = await createClient();

  const [{ data: unit }, { data: vocab }] = await Promise.all([
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind)")
      .eq("id", unitId)
      .eq("child_id", id)
      .maybeSingle(),
    supabase.from("vocab").select("en, de").eq("child_id", id),
  ]);
  if (!unit) notFound();

  const u = unit as unknown as Unit;
  const sections: Section[] = u.textbook_units?.kind === "unit" ? SECTION_ORDER : ["other"];
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
