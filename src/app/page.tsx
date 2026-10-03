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

  return (
    <main className="page">
      <h1 className="title">Wer übt heute?</h1>

      {kids.length > 0 ? (
        <ul className="kid-list">
          {kids.map((kid) => (
            <li key={kid.id}>
              <Link href={`/kind/${kid.id}`} className="kid">
                <span className="kid-name">{kid.nickname}</span>
                {kid.current && <span className="kid-unit">{kid.current.title}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lead">Lege zuerst ein Profil für dein Kind an. Ein Spitzname genügt.</p>
      )}

      <form action={createChild} className="stack add-kid">
        <h2 className="subtitle">Profil hinzufügen</h2>
        <label className="field">
          <span>Spitzname</span>
          <input name="nickname" maxLength={30} required autoComplete="off" />
        </label>
        {books.length === 1 ? (
          <input type="hidden" name="textbook_id" value={books[0].id} />
        ) : (
          <label className="field">
            <span>Englischbuch</span>
            <select name="textbook_id" required>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {books.length === 1 && <p className="hint">Englischbuch: {books[0].name}</p>}
        <button className="btn">Profil anlegen</button>
      </form>

      <form action={signOut}>
        <button className="link">Abmelden</button>
      </form>
    </main>
  );
}
