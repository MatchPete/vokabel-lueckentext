import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHAPTERS, UNIT_ORDER, unitLabel } from "@/lib/grammar/catalog";
import { grammarContext, isUnlocked } from "@/lib/grammar/context";

export default async function GrammarOverview(props: PageProps<"/kind/[id]/grammatik">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const ctx = await grammarContext(supabase, id);
  if (!ctx) notFound();

  if (!ctx.supported) {
    return (
      <main className="sheet">
        <Link href={`/kind/${id}`} className="back">← {ctx.nickname}</Link>
        <h1 className="title">Grammatik</h1>
        <p className="lead">Grammatikübungen gibt es bisher nur für Green Line 1 Bayern.</p>
      </main>
    );
  }

  const { data: attempts } = await supabase
    .from("grammar_attempts")
    .select("chapter, score, max_score, created_at")
    .eq("child_id", id)
    .order("created_at", { ascending: false });
  const last = new Map<string, { score: number; max: number; count: number }>();
  for (const a of (attempts ?? []) as { chapter: string; score: number; max_score: number }[]) {
    const e = last.get(a.chapter);
    if (!e) last.set(a.chapter, { score: a.score, max: a.max_score, count: 1 });
    else e.count++;
  }

  return (
    <main className="sheet">
      <Link href={`/kind/${id}`} className="back">← {ctx.nickname}</Link>
      <h1 className="title">Grammatik</h1>
      <p className="lead">
        Die Grammatik aus deinem Buch, Kapitel für Kapitel. Freigeschaltet ist alles bis {ctx.lastUnit ? unitLabel(ctx.lastUnit) : "Unit 1"};
        die weiteren Kapitel kommen dazu, sobald eure Klasse so weit ist.
      </p>
      {UNIT_ORDER.map((u) => {
        const chapters = CHAPTERS.filter((c) => c.unit === u);
        const open = isUnlocked(u, ctx.lastUnit);
        return (
          <section key={u} className={`g-unit${open ? "" : " is-locked"}`}>
            <h2 className="subtitle">{unitLabel(u)}{!open && <span className="hint"> · kommt noch</span>}</h2>
            <ul className="g-list">
              {chapters.map((c) => {
                const r = last.get(c.code);
                return (
                  <li key={c.code}>
                    {open ? (
                      <Link href={`/kind/${id}/grammatik/${c.code}`} className="g-row">
                        <span className="g-code">{c.code}</span>
                        <span className="g-title">{c.title}</span>
                        <span className={`g-score${r ? (r.score === r.max ? " is-full" : r.score >= r.max - 2 ? " is-good" : " is-low") : ""}`}>
                          {r ? `${r.score}/${r.max}` : "neu"}
                        </span>
                      </Link>
                    ) : (
                      <span className="g-row">
                        <span className="g-code">{c.code}</span>
                        <span className="g-title">{c.title}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
