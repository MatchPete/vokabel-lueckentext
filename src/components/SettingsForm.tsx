"use client";

import { useState, useTransition } from "react";
import { deleteChild, renameChild, updateSettings } from "@/app/actions";
import { TEXT_TYPE_LABELS, type TextType } from "@/lib/exercise";
import { ALL_TEXT_TYPES, type Settings } from "@/lib/settings";

type Props = { childId: string; nickname: string; initial: Settings };

function Choice<T extends string | number>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="setting">
      <legend>{label}</legend>
      <div className="segmented" role="radiogroup">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? "is-on" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export default function SettingsForm({ childId, nickname, initial }: Props) {
  const [s, setS] = useState<Settings>(initial);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [, startTransition] = useTransition();
  const [name, setName] = useState(nickname);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [delMsg, setDelMsg] = useState<string | null>(null);

  function change(patch: Partial<Settings>) {
    const next = { ...s, ...patch };
    setS(next);
    setStatus("saving");
    startTransition(async () => {
      const res = await updateSettings({ childId, settings: next });
      setStatus(res.ok ? "saved" : "error");
    });
  }

  function toggleType(t: TextType, on: boolean) {
    const list = on ? [...s.textTypes, t] : s.textTypes.filter((x) => x !== t);
    if (list.length === 0) return; // mindestens eine Textsorte
    change({ textTypes: ALL_TEXT_TYPES.filter((x) => list.includes(x)) });
  }

  return (
    <>
      <p className="save-status" role="status" aria-live="polite">
        {status === "saving" && "Wird gespeichert …"}
        {status === "saved" && <span className="ok">Gespeichert</span>}
        {status === "error" && <span className="error">Speichern hat nicht geklappt.</span>}
      </p>

      <section className="card stack settings-group">
        <h2 className="subtitle">Lückentext</h2>
        <Choice
          label="Deutsches Wort unter der Lücke"
          value={s.gapHint}
          options={[
            { value: "never", label: "Nie" },
            { value: "tap", label: "Auf Antippen" },
            { value: "always", label: "Immer" },
          ]}
          onChange={(v) => change({ gapHint: v })}
        />
        <Choice
          label="Schwierigkeit"
          value={s.level}
          options={[
            { value: "auto", label: "Automatisch" },
            { value: 1, label: "Leicht" },
            { value: 2, label: "Mittel" },
            { value: 3, label: "Schwer" },
          ]}
          onChange={(v) => change({ level: v })}
        />
        <p className="hint">Automatisch: richtet sich danach, wie viele Wörter schon gekonnt werden.</p>
        <fieldset className="setting">
          <legend>Textsorten</legend>
          <div className="checks">
            {ALL_TEXT_TYPES.map((t) => (
              <label key={t} className="check">
                <input
                  type="checkbox"
                  checked={s.textTypes.includes(t)}
                  disabled={s.textTypes.length === 1 && s.textTypes.includes(t)}
                  onChange={(e) => toggleType(t, e.target.checked)}
                />
                {TEXT_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card stack settings-group">
        <h2 className="subtitle">Karteikarten</h2>
        <Choice
          label="Abfragerichtung"
          value={s.direction}
          options={[
            { value: "de_en", label: "Deutsch → Englisch" },
            { value: "en_de", label: "Englisch → Deutsch" },
            { value: "mixed", label: "Gemischt" },
          ]}
          onChange={(v) => change({ direction: v })}
        />
        {s.direction !== "de_en" && (
          <p className="hint">Bei Englisch → Deutsch wird aufgedeckt und selbst bewertet („Gewusst“, „Fast“, „Nicht gewusst“), statt zu tippen.</p>
        )}
        <Choice
          label="Karten pro Runde"
          value={s.roundSize}
          options={[{ value: 10, label: "10" }, { value: 20, label: "20" }, { value: 30, label: "30" }]}
          onChange={(v) => change({ roundSize: v })}
        />
        <Choice
          label="Neue Wörter pro Runde (höchstens)"
          value={s.newPerRound}
          options={[{ value: 5, label: "5" }, { value: 8, label: "8" }, { value: 12, label: "12" }]}
          onChange={(v) => change({ newPerRound: v })}
        />
        <Toggle
          label="Groß- und Kleinschreibung beachten"
          hint="z. B. „Monday“, „I“, Ländernamen. „monday“ zählt dann als fast richtig."
          checked={s.caseSensitive}
          onChange={(v) => change({ caseSensitive: v })}
        />
        <Toggle
          label="Kleiner Tippfehler zählt als richtig"
          hint="Die richtige Schreibweise wird trotzdem gezeigt; das Wort kommt etwas früher wieder."
          checked={s.typoCountsCorrect}
          onChange={(v) => change({ typoCountsCorrect: v })}
        />
        <Toggle
          label="Bei Fehlern das Wort einmal abschreiben"
          checked={s.requireCopy}
          onChange={(v) => change({ requireCopy: v })}
        />
        <Toggle
          label="Knopf „Meine Antwort war richtig“ anzeigen"
          checked={s.showOverride}
          onChange={(v) => change({ showOverride: v })}
        />
      </section>

      <section className="card stack settings-group">
        <h2 className="subtitle">Vokabeln sperren</h2>
        <p className="lead">
          Auf der Seite einer Unit über „Auswählen“ → „Sperren“. Gesperrte Vokabeln bleiben gespeichert, kommen aber nicht
          mehr in Karteikarten und Lückentexten vor. „Freigeben“ macht das rückgängig.
        </p>
      </section>

      <section className="card stack settings-group">
        <h2 className="subtitle">Profil</h2>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await renameChild({ childId, nickname: name });
              setNameMsg(res.ok ? { ok: true, text: "Name geändert." } : { ok: false, text: res.error ?? "Fehler" });
            });
          }}
        >
          <label className="field">
            <span>Spitzname</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
          </label>
          <button className="btn-quiet" disabled={name.trim() === nickname || !name.trim()}>Umbenennen</button>
          {nameMsg && <p className={nameMsg.ok ? "ok" : "error"}>{nameMsg.text}</p>}
        </form>

        <details className="change danger-zone">
          <summary>Profil löschen</summary>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteChild({ childId, confirmName: confirm });
                if (res && !res.ok) setDelMsg(res.error ?? "Fehler");
              });
            }}
          >
            <p className="error">
              Achtung: Alle Vokabeln, Übungen und der gesamte Lernstand von {nickname} werden endgültig gelöscht.
            </p>
            <label className="field">
              <span>Zur Bestätigung „{nickname}“ eintippen</span>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </label>
            <button className="btn-quiet danger" disabled={confirm.trim().toLowerCase() !== nickname.trim().toLowerCase()}>
              Endgültig löschen
            </button>
            {delMsg && <p className="error">{delMsg}</p>}
          </form>
        </details>
      </section>
    </>
  );
}
