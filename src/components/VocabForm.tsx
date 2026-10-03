"use client";

import { useActionState, useEffect, useRef } from "react";
import { addVocab, type VocabFormState } from "@/app/actions";
import { SECTION_LABELS, type Section } from "@/lib/types";

type Props = { childId: string; unitId: string; sections: Section[] };

export default function VocabForm({ childId, unitId, sections }: Props) {
  const initial: VocabFormState = { ok: false, section: sections[0] };
  const [state, action, pending] = useActionState(addVocab, initial);
  const enRef = useRef<HTMLInputElement>(null);

  // React setzt das Formular nach dem Absenden zurück. Abschnitt und (bei Fehlern) die
  // Eingaben kommen über defaultValue aus dem Ergebnis zurück. Nach Erfolg: zurück ins erste Feld.
  useEffect(() => {
    if (state.ok) enRef.current?.focus();
  }, [state]);

  const noAutofix = { autoComplete: "off", autoCorrect: "off", autoCapitalize: "none", spellCheck: false } as const;

  return (
    <form action={action} className="card stack vocab-form">
      <input type="hidden" name="child_id" value={childId} />
      <input type="hidden" name="unit_id" value={unitId} />

      {sections.length > 1 ? (
        <label className="field">
          <span>Abschnitt im Buch</span>
          <select name="section" defaultValue={state.section}>
            {sections.map((s) => (
              <option key={s} value={s}>{SECTION_LABELS[s]}</option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="section" value={sections[0]} />
      )}

      <label className="field">
        <span>Englisch</span>
        <input ref={enRef} name="en" type="text" lang="en" required maxLength={120} defaultValue={state.ok ? "" : (state.en ?? "")} {...noAutofix} />
      </label>
      <label className="field">
        <span>Deutsch</span>
        <input name="de" type="text" lang="de" required maxLength={120} defaultValue={state.ok ? "" : (state.de ?? "")} {...noAutofix} />
      </label>

      <button className="btn" disabled={pending}>{pending ? "Speichern …" : "Hinzufügen"}</button>

      <p className="form-status" role="status" aria-live="polite">
        {state.error ? (
          <span className="error">{state.error}</span>
        ) : state.ok && state.added ? (
          <span className="ok">„{state.added}“ gespeichert.</span>
        ) : null}
      </p>
    </form>
  );
}
