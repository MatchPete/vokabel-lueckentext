"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGrammarAttempt } from "@/app/actions";
import { apostropheMiss, gradeItem, type GrammarItem } from "@/lib/grammar/check";
import type { CheckKind } from "@/lib/grammar/catalog";
import Confetti from "./Confetti";

type Props = { childId: string; chapter: string; exerciseId: string; items: GrammarItem[]; kind: CheckKind };
type Phase = "first" | "second" | "done";

/** Lücke im Satz: Text davor, Eingabe, Text danach */
function splitGap(sentence: string): [string, string] {
  const i = sentence.indexOf("___");
  return [sentence.slice(0, i), sentence.slice(i + 3)];
}

export default function GrammarPlayer({ childId, chapter, exerciseId, items, kind }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("first");
  const [first, setFirst] = useState<string[]>(() => items.map(() => ""));
  const [second, setSecond] = useState<string[]>(() => items.map(() => ""));
  const [ok1, setOk1] = useState<boolean[]>([]);
  const [ok2, setOk2] = useState<boolean[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [startingNew, setStartingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFilled = (arr: string[], mask?: boolean[]) => arr.every((v, i) => (mask && mask[i]) || v.trim().length > 0);

  function check() {
    if (phase === "first") {
      const r = items.map((it, i) => gradeItem(first[i], it, kind));
      setOk1(r);
      if (r.every(Boolean)) finish(r, items.map(() => false));
      else setPhase("second");
    } else if (phase === "second") {
      const r = items.map((it, i) => (ok1[i] ? false : gradeItem(second[i], it, kind)));
      setOk2(r);
      finish(ok1, r);
    }
  }

  function finish(r1: boolean[], r2: boolean[]) {
    setOk2(r2);
    setPhase("done");
    setScore(r1.filter(Boolean).length);
    startSaving(async () => {
      const res = await saveGrammarAttempt({
        exerciseId,
        firstTry: first,
        secondTry: second.map((v, i) => (r1[i] ? null : v)),
      });
      if (!res.ok) setError(res.error ?? "Speichern hat nicht geklappt.");
    });
  }

  async function newExercise() {
    setStartingNew(true);
    setError(null);
    try {
      const res = await fetch("/api/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, chapter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      router.push(`/kind/${childId}/grammatik/${chapter}/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setStartingNew(false);
    }
  }

  return (
    <>
      <ol className="g-items">
        {items.map((it, i) => {
          const [before, after] = splitGap(it.sentence);
          const right1 = ok1[i];
          const inSecond = phase !== "first" && !right1;
          const value = inSecond ? second[i] : first[i];
          const state =
            phase === "first" ? "" : right1 ? "is-correct" : phase === "done" ? (ok2[i] ? "is-almost" : "is-wrong") : "is-retry";
          return (
            <li key={i} className={`g-item ${state}`}>
              <p className="g-sentence" lang="en">
                {before}
                <input
                  className="g-input"
                  value={value}
                  readOnly={phase === "done" || (phase === "second" && right1)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (inSecond) setSecond((s) => s.map((x, j) => (j === i ? v : x)));
                    else setFirst((s) => s.map((x, j) => (j === i ? v : x)));
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={`Lücke ${i + 1}`}
                  size={Math.max(6, (it.answers[0] ?? "").length + 2)}
                />
                {after}
                {it.cue && <span className="g-cue"> {it.cue}</span>}
              </p>
              {phase === "second" && !right1 && (
                <p className="g-tip">
                  {apostropheMiss(first[i], it) ? "Fast! Achte auf den Apostroph. " : ""}
                  {it.tip_de}
                </p>
              )}
              {phase === "done" && !right1 && (
                <p className="g-solution">
                  {ok2[i] ? "Im zweiten Versuch richtig. " : "Lösung: "}
                  {!ok2[i] && <strong lang="en">{it.answers[0]}</strong>}
                  <span className="g-explain"> {it.explain_de}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {phase !== "done" ? (
        <div className="check-bar">
          <button
            type="button"
            className="btn"
            onClick={check}
            disabled={phase === "first" ? !allFilled(first) : !allFilled(second, ok1)}
          >
            {phase === "first" ? "Prüfen" : "Nochmal prüfen"}
          </button>
          {phase === "second" && <p className="hint">Rot markiert: Lies den Tipp und versuch es noch einmal.</p>}
        </div>
      ) : (
        <section className="card stack result">
          <Confetti fire={score === items.length} />
          <p className="result-score">
            {score} von {items.length}
          </p>
          <p className="lead">
            {score === items.length
              ? "Alles auf Anhieb richtig!"
              : score! >= items.length - 2
                ? "Sehr gut! Schau dir die Erklärungen bei den Fehlern an."
                : "Lies die Regel noch einmal und probier eine neue Übung."}
          </p>
          {saving && <p className="hint">Wird gespeichert …</p>}
          <button type="button" className="btn" onClick={newExercise} disabled={startingNew}>
            {startingNew ? "Neue Übung wird erstellt …" : "Neue Übung zu diesem Kapitel"}
          </button>
          <Link href={`/kind/${childId}/grammatik/${chapter}`} className="link">Zur Regel</Link>
          <Link href={`/kind/${childId}/grammatik`} className="link">Alle Grammatikkapitel</Link>
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
