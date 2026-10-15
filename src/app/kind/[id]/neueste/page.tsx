import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlashCards from "@/components/FlashCards";
import { berlinToday, toCardWords, type ProgressRow } from "@/lib/progress";
import { parseSettings } from "@/lib/settings";

const CHOICES = [10, 20, 30, 50] as const;

export default async function NewestPage(props: PageProps<"/kind/[id]/neueste">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const wanted = Number(Array.isArray(sp.anzahl) ? sp.anzahl[0] : sp.anzahl);
  const count = (CHOICES as readonly number[]).includes(wanted) ? wanted : 20;

  const supabase = await createClient();
  const [{ data: child }, { data: vocab }] = await Promise.all([
    supabase.from("children").select("id, nickname, settings").eq("id", id).maybeSingle(),
    supabase
      .from("vocab")
      .select("id, en, de, accepted_en, created_at, vocab_progress(due_date, ease, reps, lapses, correct_count, wrong_count, last_seen_at), units(title)")
      .eq("child_id", id)
      .eq("excluded", false)
      .order("created_at", { ascending: false })
      .limit(count),
  ]);
  if (!child) notFound();

  const today = berlinToday();
  const rows = (vocab ?? []) as unknown as (ProgressRow & { units: { title: string } | null })[];
  const words = toCardWords(rows, today).map((w, i) => ({ ...w, unitLabel: rows[i].units?.title.split(":")[0].trim() }));

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {child.nickname}</Link>
      <h1 className="title">Neueste Vokabeln</h1>
      <p className="lead">Die zuletzt eingetragenen Wörter, egal aus welcher Lektion. Wie viele?</p>
      <nav className="segmented" aria-label="Anzahl">
        {CHOICES.map((n) => (
          <Link
            key={n}
            href={`/kind/${id}/neueste?anzahl=${n}`}
            className={`seg-link${n === count ? " is-on" : ""}`}
            aria-current={n === count ? "true" : undefined}
            replace
          >
            {n}
          </Link>
        ))}
      </nav>
      {words.length === 0 ? (
        <p className="lead">Es sind noch keine Vokabeln eingetragen.</p>
      ) : (
        <FlashCards
          key={count}
          fixedRound
          settings={parseSettings(child.settings)}
          childId={id}
          childName={child.nickname}
          scopeLabel="(neueste)"
          words={words}
          today={today}
        />
      )}
    </main>
  );
}
