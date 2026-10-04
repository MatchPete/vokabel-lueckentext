import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlashCards from "@/components/FlashCards";
import { berlinToday, toCardWords, type ProgressRow } from "@/lib/progress";
import { unitTag, type Unit } from "@/lib/types";

export default async function CardsPage(props: PageProps<"/kind/[id]/unit/[unitId]/karten">) {
  const { id, unitId } = await props.params;
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
      .select("id, en, de, accepted_en, created_at, vocab_progress(due_date, ease, reps, lapses, correct_count, wrong_count, last_seen_at)")
      .eq("unit_id", unitId)
      .order("created_at"),
  ]);
  if (!child || !unit) notFound();

  const u = unit as unknown as Unit;
  const today = berlinToday();
  const rows = (vocab ?? []) as unknown as ProgressRow[];
  const words = toCardWords(rows, today);

  return (
    <main className="sheet">
      <Link href={`/kind/${id}/unit/${unitId}`} className="back">← zurück zur Unit</Link>
      <h1 className="title">
        <span className="tag tag-lg">{unitTag(u.textbook_units?.code)}</span>
        Karteikarten
      </h1>
      <FlashCards childId={id} childName={child.nickname} unitId={unitId} words={words} today={today} />
    </main>
  );
}
