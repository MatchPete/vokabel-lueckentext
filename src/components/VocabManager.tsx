"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVocabBatch, moveVocab } from "@/app/actions";
import { SECTION_LABELS, SECTION_ORDER, type Section } from "@/lib/types";

type Word = { id: string; en: string; de: string; section: Section };

/** "Ich kann Sherlock sehen.; Ich sehe Sherlock." -> Alternativen untereinander (gleiche Vokabel). */
function alternativesOnLines(text: string): string {
  return text.split(/\s*;\s*/).filter(Boolean).join("\n");
}
type UnitOption = { id: string; title: string; isMain: boolean };
type Props = { childId: string; unitId: string; isMain: boolean; words: Word[]; units: UnitOption[] };

export default function VocabManager({ childId, unitId, isMain, words, units }: Props) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState("");
  const [section, setSection] = useState<"" | Section>("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = SECTION_ORDER.map((s) => ({ section: s, items: words.filter((w) => w.section === s) })).filter(
    (g) => g.items.length > 0,
  );
  const targetUnit = units.find((u) => u.id === target);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleGroup(items: Word[]) {
    const all = items.every((w) => selected.has(w.id));
    setSelected((s) => {
      const n = new Set(s);
      items.forEach((w) => (all ? n.delete(w.id) : n.add(w.id)));
      return n;
    });
  }
  function reset() {
    setSelecting(false);
    setSelected(new Set());
    setMoving(false);
    setTarget("");
    setSection("");
  }

  function doMove() {
    if (!target) return;
    const ids = [...selected];
    startTransition(async () => {
      const res = await moveVocab({ childId, fromUnitId: unitId, toUnitId: target, vocabIds: ids, section: section || null });
      if (res.ok) {
        setMessage({ ok: true, text: `${res.count === 1 ? "1 Vokabel" : `${res.count} Vokabeln`} nach „${targetUnit?.title}“ verschoben.` });
        reset();
        router.refresh();
      } else setMessage({ ok: false, text: res.error });
    });
  }

  function doDelete() {
    const ids = [...selected];
    if (!window.confirm(`${ids.length === 1 ? "1 Vokabel" : `${ids.length} Vokabeln`} wirklich löschen? Der Lernstand dieser Wörter geht dabei verloren.`)) return;
    startTransition(async () => {
      const res = await deleteVocabBatch({ childId, vocabIds: ids });
      if (res.ok) {
        setMessage({ ok: true, text: `${res.count === 1 ? "1 Vokabel" : `${res.count} Vokabeln`} gelöscht.` });
        reset();
        router.refresh();
      } else setMessage({ ok: false, text: res.error });
    });
  }

  return (
    <section aria-labelledby="list-heading">
      <div className="list-head">
        <h2 className="subtitle" id="list-heading">
          {words.length === 0 ? "Noch keine Vokabeln" : words.length === 1 ? "1 Vokabel" : `${words.length} Vokabeln`}
        </h2>
        {words.length > 0 && (
          <button type="button" className="link" onClick={() => (selecting ? reset() : setSelecting(true))}>
            {selecting ? "Fertig" : "Auswählen"}
          </button>
        )}
      </div>
      {selecting && <p className="hint">Wähle Vokabeln aus, um sie in eine andere Unit zu verschieben oder zu löschen.</p>}
      {message && <p className={message.ok ? "ok" : "error"} role="status">{message.text}</p>}

      {groups.map((g) => (
        <div key={g.section} className="vocab-group">
          {(isMain || selecting) && (
            <h3 className="group-title">
              {selecting ? (
                <label className="group-check">
                  <input type="checkbox" checked={g.items.every((w) => selected.has(w.id))} onChange={() => toggleGroup(g.items)} />
                  {isMain ? SECTION_LABELS[g.section] : "Alle"}
                </label>
              ) : (
                SECTION_LABELS[g.section]
              )}
            </h3>
          )}
          <ul className="vocab-list ruled">
            {g.items.map((w) => (
              <li key={w.id} className={`vocab${selecting && selected.has(w.id) ? " is-selected" : ""}`}>
                <span className="vocab-en" lang="en">{alternativesOnLines(w.en)}</span>
                <span className="vocab-de" lang="de">{alternativesOnLines(w.de)}</span>
                {selecting ? (
                  <label className="row-check">
                    <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} aria-label={`${w.en} auswählen`} />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {selecting && selected.size > 0 && (
        <div className="check-bar">
          {!moving ? (
            <div className="bulk-actions">
              <span>{selected.size} ausgewählt</span>
              <button type="button" className="btn" onClick={() => setMoving(true)} disabled={pending}>Verschieben</button>
              <button type="button" className="btn-quiet danger" onClick={doDelete} disabled={pending}>Löschen</button>
            </div>
          ) : (
            <div className="card stack">
              <label className="field">
                <span>In welche Unit?</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Bitte wählen</option>
                  {units.filter((u) => u.id !== unitId).map((u) => (
                    <option key={u.id} value={u.id}>{u.title}</option>
                  ))}
                </select>
              </label>
              {targetUnit?.isMain && (
                <label className="field">
                  <span>Abschnitt</span>
                  <select value={section} onChange={(e) => setSection(e.target.value as "" | Section)}>
                    <option value="">unverändert lassen</option>
                    {SECTION_ORDER.map((s) => (
                      <option key={s} value={s}>{SECTION_LABELS[s]}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="bulk-actions">
                <button type="button" className="btn" onClick={doMove} disabled={!target || pending}>
                  {pending ? "Wird verschoben …" : `${selected.size} verschieben`}
                </button>
                <button type="button" className="link" onClick={() => setMoving(false)}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
