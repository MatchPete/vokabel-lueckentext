import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCurrentUnit } from "@/app/actions";
import type { Child, Unit } from "@/lib/types";

export default async function ChildPage(props: PageProps<"/kind/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: child }, { data: units }, { data: vocab }] = await Promise.all([
    supabase.from("children").select("id, nickname, textbook_id, current_unit_id, created_at").eq("id", id).maybeSingle(),
    supabase.from("units").select("id, child_id, textbook_unit_id, title, sort_order").eq("child_id", id).order("sort_order"),
    supabase.from("vocab").select("unit_id").eq("child_id", id),
  ]);
  if (!child) notFound();

  const kid = child as Child;
  const list = (units ?? []) as Unit[];
  const counts = new Map<string, number>();
  for (const v of (vocab ?? []) as { unit_id: string }[]) {
    counts.set(v.unit_id, (counts.get(v.unit_id) ?? 0) + 1);
  }
  const current = list.find((u) => u.id === kid.current_unit_id);
  const currentOrder = current?.sort_order ?? 0;

  return (
    <main className="page">
      <Link href="/" className="link back">Profile</Link>
      <h1 className="title">{kid.nickname}</h1>
      {current && <p className="lead">Gerade dran: {current.title}</p>}

      <ol className="unit-list">
        {list.map((u) => {
          const isCurrent = u.id === kid.current_unit_id;
          const isAhead = u.sort_order > currentOrder;
          const n = counts.get(u.id) ?? 0;
          return (
            <li key={u.id} className={`unit${isCurrent ? " is-current" : ""}${isAhead ? " is-ahead" : ""}`}>
              <div className="unit-text">
                <span className="unit-title">{u.title}</span>
                <span className="unit-meta">{n === 1 ? "1 Vokabel" : `${n} Vokabeln`}</span>
              </div>
              {!isCurrent && (
                <form action={setCurrentUnit}>
                  <input type="hidden" name="child_id" value={kid.id} />
                  <input type="hidden" name="unit_id" value={u.id} />
                  <button className="btn-quiet">Ist gerade dran</button>
                </form>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
