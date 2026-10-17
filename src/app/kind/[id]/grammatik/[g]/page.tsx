import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHAPTER_BY_CODE, unitLabel } from "@/lib/grammar/catalog";
import { grammarContext, isUnlocked } from "@/lib/grammar/context";
import StartGrammar from "@/components/StartGrammar";

export default async function ChapterPage(props: PageProps<"/kind/[id]/grammatik/[g]">) {
  const { id, g } = await props.params;
  const ch = CHAPTER_BY_CODE.get(g);
  const supabase = await createClient();
  const ctx = await grammarContext(supabase, id);
  if (!ctx || !ch || !ctx.supported) notFound();
  const open = isUnlocked(ch.unit, ctx.lastUnit);

  const { data: attempts } = await supabase
    .from("grammar_attempts")
    .select("score, max_score, created_at")
    .eq("child_id", id)
    .eq("chapter", ch.code)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="sheet">
      <Link href={`/kind/${id}/grammatik`} className="back">← Grammatik</Link>
      <div>
        <p className="eyebrow">{unitLabel(ch.unit)} · {ch.code}</p>
        <h1 className="title">{ch.title}</h1>
        <p className="hint" lang="en">{ch.titleEn}</p>
      </div>

      <section className="card stack g-rule">
        <h2 className="subtitle">So geht&apos;s</h2>
        <ul className="g-rule-list">
          {ch.rule.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <p className="g-examples" lang="en">
          {ch.examples.map((e, i) => (
            <span key={i}>{e}</span>
          ))}
        </p>
        {ch.page && <p className="hint">Ausführlich im Buch auf Seite {ch.page}.</p>}
      </section>

      {open ? (
        <StartGrammar childId={id} chapter={ch.code} />
      ) : (
        <p className="lead">Dieses Kapitel kommt in {unitLabel(ch.unit)}. Üben kannst du es, sobald diese Unit dran ist.</p>
      )}

      {attempts && attempts.length > 0 && (
        <section className="stack">
          <h2 className="subtitle">Deine letzten Ergebnisse</h2>
          <ul className="g-history">
            {(attempts as { score: number; max_score: number; created_at: string }[]).map((a, i) => (
              <li key={i}>
                <strong>{a.score}/{a.max_score}</strong>{" "}
                <span className="hint">{new Date(a.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
