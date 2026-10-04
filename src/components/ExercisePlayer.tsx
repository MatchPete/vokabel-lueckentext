"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveAttempt } from "@/app/actions";
import { grade, type GapSegment, type Result, type Segment } from "@/lib/exercise";
import StartExercise from "./StartExercise";
import Confetti from "./Confetti";

type Props = {
  exerciseId: string;
  childId: string;
  childName: string;
  unitId: string | null;
  segments: Segment[];
};

type Phase = "first" | "second" | "done";

// Drei feste Breiten, damit die Lücke die genaue Wortlänge nicht verrät
function gapWidth(answer: string): string {
  const n = answer.length;
  return n <= 5 ? "7ch" : n <= 10 ? "12ch" : `${Math.min(n + 3, 26)}ch`;
}

export default function ExercisePlayer({ exerciseId, childId, childName, unitId, segments }: Props) {
  const gaps = segments.filter((s): s is GapSegment => s.t === "gap");
  const [values, setValues] = useState<string[]>(() => gaps.map(() => ""));
  const [phase, setPhase] = useState<Phase>("first");
  const [first, setFirst] = useState<Result[] | null>(null);
  const [second, setSecond] = useState<(Result | null)[] | null>(null);
  const [firstValues, setFirstValues] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<{ correct: number; total: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const editable = (i: number) => phase === "first" || (phase === "second" && first?.[i] !== "correct");

  function focusNext(from: number) {
    for (let j = from + 1; j < gaps.length; j++) {
      if (editable(j)) {
        inputs.current[j]?.focus();
        return true;
      }
    }
    return false;
  }

  function finish(firstTry: string[], secondTry: (string | null)[]) {
    setPhase("done");
    startSaving(async () => {
      const res = await saveAttempt({ exerciseId, firstTry, secondTry });
      if (res.ok) setSaved({ correct: res.correct, total: res.total });
      else setSaveError(res.error);
    });
  }

  function check() {
    if (phase === "first") {
      const r = gaps.map((g, i) => grade(values[i], g));
      setFirst(r);
      setFirstValues(values);
      if (r.every((x) => x === "correct")) {
        finish(values, gaps.map(() => null));
      } else {
        setPhase("second");
        const firstWrong = r.findIndex((x) => x !== "correct");
        setTimeout(() => inputs.current[firstWrong]?.select(), 0);
      }
    } else if (phase === "second" && first && firstValues) {
      const r2 = gaps.map((g, i) => (first[i] === "correct" ? null : grade(values[i], g)));
      setSecond(r2);
      finish(firstValues, gaps.map((_, i) => (first[i] === "correct" ? null : values[i])));
    }
  }

  const status = (i: number): Result | "open" | "retry" => {
    if (phase === "first" || !first) return "open";
    if (phase === "second") return first[i] === "correct" ? "correct" : "retry";
    if (first[i] === "correct") return "correct";
    return second?.[i] ?? first[i];
  };

  const firstCorrect = first?.filter((x) => x === "correct").length ?? 0;
  // Zu jedem Segment die laufende Nummer der Lücke (Textsegmente: -1)
  const gapIndex = segments.reduce<number[]>((acc, s) => {
    const prev = acc.reduce((m, x) => Math.max(m, x), -1);
    acc.push(s.t === "gap" ? prev + 1 : -1);
    return acc;
  }, []);

  return (
    <>
      <div className="worksheet" lang="en">
        {segments.map((s, k) => {
          if (s.t === "text") return <span key={k}>{s.v.replace(/\\n/g, "\n")}</span>;
          const i = gapIndex[k];
          const st = status(i);
          const hintAlmost = phase === "second" && first?.[i] === "almost";
          return (
            <span key={k} className={`gap gap-${st}`}>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={values[i]}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!focusNext(i)) check();
                  }
                }}
                readOnly={!editable(i)}
                style={{ width: gapWidth(gap(i).answer) }}
                aria-label={`Lücke ${i + 1}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint={i === gaps.length - 1 ? "done" : "next"}
              />
              {phase === "done" && st !== "correct" ? (
                <span className="gap-hint">
                  <strong className="gap-solution" lang="en">{gap(i).answer}</strong>
                </span>
              ) : hintAlmost ? (
                <span className="gap-hint">fast! Schreibweise prüfen</span>
              ) : null}
            </span>
          );
        })}
      </div>

      {phase !== "done" ? (
        <div className="check-bar">
          {phase === "second" && (
            <p className="check-note">
              {firstCorrect} von {gaps.length} richtig. Die markierten Lücken darfst du noch einmal versuchen.
            </p>
          )}
          <button type="button" className="btn" onClick={check}>
            {phase === "first" ? "Prüfen" : "Nochmal prüfen"}
          </button>
        </div>
      ) : (
        <section className="card result" aria-live="polite">
          {saving && <p className="lead">Wird gespeichert …</p>}
          {saveError && <p className="error">{saveError}</p>}
          {saved && (
            <>
              <Confetti fire={saved.total > 0 && saved.correct / saved.total >= 0.8} />
              <p className="result-score">
                {saved.correct} von {saved.total}
              </p>
              <p className="lead">
                {saved.correct === saved.total
                  ? "Alles beim ersten Versuch richtig!"
                  : "beim ersten Versuch richtig. Die anderen Wörter kommen bald wieder dran."}
              </p>
            </>
          )}
          <div className="result-actions">
            {unitId && <StartExercise childId={childId} unitId={unitId} label="Neue Geschichte" />}
            <Link href={`/kind/${childId}`} className="link">Zurück zu {childName}</Link>
          </div>
        </section>
      )}
    </>
  );

  function gap(i: number) {
    return gaps[i];
  }
}
