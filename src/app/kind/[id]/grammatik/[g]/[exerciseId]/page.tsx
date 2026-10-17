import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHAPTER_BY_CODE, unitLabel } from "@/lib/grammar/catalog";
import type { GrammarItem } from "@/lib/grammar/check";
import GrammarPlayer from "@/components/GrammarPlayer";

export default async function GrammarExercisePage(props: PageProps<"/kind/[id]/grammatik/[g]/[exerciseId]">) {
  const { id, g, exerciseId } = await props.params;
  const ch = CHAPTER_BY_CODE.get(g);
  const supabase = await createClient();
  const { data: ex } = await supabase
    .from("grammar_exercises")
    .select("id, chapter, items")
    .eq("id", exerciseId)
    .eq("child_id", id)
    .maybeSingle();
  if (!ex || !ch || ex.chapter !== ch.code) notFound();

  return (
    <main className="sheet">
      <Link href={`/kind/${id}/grammatik/${ch.code}`} className="back">← Regel</Link>
      <div>
        <p className="eyebrow">{unitLabel(ch.unit)} · {ch.code}</p>
        <h1 className="title">{ch.title}</h1>
      </div>
      <p className="lead">Füll die Lücken aus. Steht etwas in Klammern dahinter, hilft es dir dabei.</p>
      <GrammarPlayer key={ex.id} childId={id} chapter={ch.code} exerciseId={ex.id} items={ex.items as GrammarItem[]} kind={ch.check} />
    </main>
  );
}
