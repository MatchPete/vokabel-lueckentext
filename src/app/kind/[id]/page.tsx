import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCurrentUnit } from "@/app/actions";
import StartExercise from "@/components/StartExercise";
import { unitTag, type Child, type Unit } from "@/lib/types";

export default async function ChildPage(props: PageProps<"/kind/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: child }, { data: units }, { data: vocab }] = await Promise.all([
    supabase.from("children").select("id, nickname, textbook_id, current_unit_id, created_at").eq("id", id).maybeSingle(),
    supabase
      .from("units")
      .select("id, child_id, textbook_unit_id, title, sort_order, textbook_units(code, kind)")
      .eq("child_id", id)
      .order("sort_order"),
    supabase.from("vocab").select("unit_id").eq("child_id", id),
  ]);
  if (!child) notFound();

  const kid = child as Child;
  const list = (units ?? []) as unknown as Unit[];
  const counts = new Map<string, number>();
  for (const v of (vocab ?? []) as { unit_id: string }[]) {
    counts.set(v.unit_id, (counts.get(v.unit_id) ?? 0) + 1);
  }
  const total = vocab?.length ?? 0;
  const current = list.find((u) => u.id === kid.current_unit_id);
  const currentOrder = current?.sort_order ?? 0;

  return (
    <main className="sheet">
      <Link href="/" className="back">← Profile</Link>
      <h1 className="title">{kid.nickname}</h1>
      <p className="lead">{total === 1 ? "1 Vokabel gespeichert" : `${total} Vokabeln gespeichert`}</p>

      {current && (
        <section className="card current" aria-labelledby="current-heading">
          <p className="eyebrow" id="current-heading">Gerade dran</p>
          <p className="current-title">
            <span className="tag">{unitTag(current.textbook_units?.code)}</span>
            {current.title.replace(/^[^:]+:\s*/, "")}
          </p>
          <div className="current-actions">
            <StartExercise childId={kid.id} unitId={current.id} label="Üben" />
            <Link href={`/kind/${kid.id}/unit/${current.id}`} className="btn-quiet">
              Vokabeln eintragen
            </Link>
          </div>

          <details className="change">
            <summary>Andere Unit ist dran</summary>
            <form action={setCurrentUnit} className="change-form">
              <input type="hidden" name="child_id" value={kid.id} />
              <select name="unit_id" defaultValue={current.id} aria-label="Aktuelle Unit">
                {list.map((u) => (
                  <option key={u.id} value={u.id}>{u.title}</option>
                ))}
              </select>
              <button className="btn-quiet">Speichern</button>
            </form>
          </details>
        </section>
      )}

      <section aria-labelledby="all-heading">
        <h2 className="subtitle" id="all-heading">Alle Abschnitte</h2>
        <ol className="units ruled ruled-2">
          {list.map((u) => {
            const n = counts.get(u.id) ?? 0;
            const isCurrent = u.id === kid.current_unit_id;
            const state = isCurrent ? "is-current" : u.sort_order > currentOrder ? "is-ahead" : "is-done";
            const isMain = u.textbook_units?.kind === "unit";
            const meta = [n === 0 ? "noch leer" : n === 1 ? "1 Vokabel" : `${n} Vokabeln`];
            if (isCurrent) meta.push("gerade dran");
            return (
              <li key={u.id}>
                <Link href={`/kind/${kid.id}/unit/${u.id}`} className={`unit ${state}${isMain ? " is-main" : ""}`}>
                  <span className="tag">{unitTag(u.textbook_units?.code)}</span>
                  <span className="unit-title">{u.title.replace(/^[^:]+:\s*/, "")}</span>
                  <span className="unit-meta">{meta.join(" · ")}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
