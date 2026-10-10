import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlashCards from "@/components/FlashCards";
import { berlinToday, TODAY_SELECT, wordsUpToCurrent, type TodayRow } from "@/lib/progress";
import { parseSettings } from "@/lib/settings";

export default async function TodayPage(props: PageProps<"/kind/[id]/heute">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: child }, { data: vocab }] = await Promise.all([
    supabase
      .from("children")
      .select("id, nickname, settings, current_unit_id, current:units!children_current_unit_fk(sort_order, title)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("vocab").select(TODAY_SELECT).eq("child_id", id).eq("excluded", false),
  ]);
  if (!child) notFound();

  const cur = (child as unknown as { current: { sort_order: number; title: string } | null }).current;
  const today = berlinToday();
  const words = wordsUpToCurrent((vocab ?? []) as unknown as TodayRow[], today, child.current_unit_id, cur?.sort_order ?? null);
  const scope = cur ? `bis ${cur.title.split(":")[0]}` : "aus allen Lektionen";

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {child.nickname}</Link>
      <h1 className="title">Heute üben</h1>
      <p className="lead">
        Wörter {scope}: alles, was heute zum Wiederholen dran ist, und neue Wörter aus der aktuellen Lektion.
      </p>
      <FlashCards
        settings={parseSettings(child.settings)}
        childId={id}
        childName={child.nickname}
        scopeLabel={scope}
        cramLabel="Schwierigste Wörter üben"
        words={words}
        today={today}
      />
    </main>
  );
}
