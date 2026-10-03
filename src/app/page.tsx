import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createChild } from "./actions";
import { signOut } from "./login/actions";
import type { Child, Textbook } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: children }, { data: textbooks }] = await Promise.all([
    supabase
      .from("children")
      .select("id, nickname, textbook_id, current_unit_id, created_at, current:units!children_current_unit_fk(title)")
      .order("created_at"),
    supabase.from("textbooks").select("id, name, edition").order("name"),
  ]);

  // current ist eine n:1-Beziehung, PostgREST liefert daher ein Objekt (oder null).
  const kids = (children ?? []) as unknown as (Child & { current: { title: string } | null })[];
  const books = (textbooks ?? []) as Textbook[];

  const addForm = (
    <form action={createChild} className="stack">
      <label className="field">
        <span>Spitzname</span>
        <input name="nickname" maxLength={30} required autoComplete="off" />
      </label>
      {books.length === 1 ? (
        <>
          <input type="hidden" name="textbook_id" value={books[0].id} />
          <p className="hint">Englischbuch: {books[0].name}</p>
        </>
      ) : (
        <label className="field">
          <span>Englischbuch</span>
          <select name="textbook_id" required>
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}
      <button className="btn">Profil anlegen</button>
    </form>
  );

  return (
    <main className="sheet">
      <h1 className="title">Wer übt heute?</h1>

      {kids.length > 0 ? (
        <>
          <ul className="kids">
            {kids.map((kid) => (
              <li key={kid.id}>
                <Link href={`/kind/${kid.id}`} className="card kid">
                  <span className="kid-name">{kid.nickname}</span>
                  {kid.current && <span className="kid-unit">{kid.current.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <details className="change">
            <summary>Weiteres Profil anlegen</summary>
            <div className="card">{addForm}</div>
          </details>
        </>
      ) : (
        <>
          <p className="lead">Lege zuerst ein Profil für dein Kind an. Ein Spitzname genügt.</p>
          <div className="card">{addForm}</div>
        </>
      )}

      <form action={signOut} className="footer">
        <button className="link">Abmelden</button>
      </form>
    </main>
  );
}
