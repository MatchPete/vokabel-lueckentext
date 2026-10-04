"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordCardReview } from "@/app/actions";
import Confetti from "./Confetti";
import { grade as gradeAnswer, type Result } from "@/lib/exercise";
import { buildCramRound, buildRound, cardAnswer, gradeFor, isNew, nextDueDate, type CardWord, type Grade } from "@/lib/cards";

type Props = { childId: string; childName: string; unitId: string; words: CardWord[]; today: string };
type Item = { id: string; kind: "learn" | "ask" };
type Phase = "start" | "card" | "done";

const REQUEUE_GAP = 3; // falsch beantwortete Wörter kommen nach 3 Karten wieder
const MAX_REPEATS = 3;

export default function FlashCards({ childId, childName, unitId, words, today }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const regular = useMemo(() => buildRound(words, today), [words, today]);
  const newCount = regular.filter(isNew).length;

  const [phase, setPhase] = useState<Phase>("start");
  const [round, setRound] = useState<CardWord[]>([]);
  const [queue, setQueue] = useState<Item[]>([]);
  const [value, setValue] = useState("");
  const [copy, setCopy] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const [graded, setGraded] = useState<Record<string, Result>>({});
  const [repeats, setRepeats] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  // Falsche Antworten werden erst beim Weitergehen gespeichert, damit "Ich hatte es richtig" noch korrigieren kann
  const [pending, setPending] = useState<{ vocabId: string; grade: Grade; given: string; ms: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLInputElement>(null);

  const current = queue[0];
  const word = current ? byId.get(current.id) : undefined;
  const sol = word ? cardAnswer(word) : null;

  useEffect(() => {
    if (phase !== "card") return;
    if (result === null) inputRef.current?.focus();
    else if (result !== "correct") copyRef.current?.focus();
  }, [phase, current, result]);

  function start(list: CardWord[]) {
    setRound(list);
    setQueue(list.map((w) => ({ id: w.id, kind: isNew(w) ? "learn" : "ask" })));
    setGraded({});
    setRepeats({});
    setFinished(new Set());
    setResult(null);
    setValue("");
    setShownAt(Date.now());
    setPhase("card");
  }

  function advance(nextQueue: Item[]) {
    setResult(null);
    setValue("");
    setCopy("");
    if (nextQueue.length === 0) {
      setPhase("done");
      setQueue([]);
      return;
    }
    setQueue(nextQueue);
    setShownAt(Date.now());
  }

  function insertAt(list: Item[], item: Item, pos: number): Item[] {
    const p = Math.min(pos, list.length);
    return [...list.slice(0, p), item, ...list.slice(p)];
  }

  function learnDone() {
    if (!current) return;
    // Neues Wort gleich danach noch nicht abfragen, sondern nach zwei anderen Karten
    advance(insertAt(queue.slice(1), { id: current.id, kind: "ask" }, 2));
  }

  function submit(given: string) {
    if (!word || !sol || result !== null) return;
    const r = gradeAnswer(given, sol);
    setResult(r);

    // Nur die erste Abfrage eines Wortes in dieser Runde zählt für die Planung
    if (!(word.id in graded)) {
      setGraded((g) => ({ ...g, [word.id]: r }));
      const ms = Date.now() - shownAt;
      const g = gradeFor(r, ms, Math.min(...[sol.answer, ...sol.accepted].map((a) => a.length)), isNew(word));
      if (r === "correct") save({ vocabId: word.id, grade: g, given, ms });
      else setPending({ vocabId: word.id, grade: g, given, ms });
    }
    if (r === "correct") {
      setFinished((f) => new Set(f).add(word.id));
      setTimeout(() => continueAfter("correct"), 700);
    }
  }

  function save(entry: { vocabId: string; grade: Grade; given: string; ms: number }) {
    recordCardReview(entry)
      .then((res) => !res.ok && setSaveFailed(true))
      .catch(() => setSaveFailed(true));
  }

  /** Das Kind meldet: Meine Antwort war richtig. Zählt als gewusst, Wort ist für diese Runde erledigt. */
  function overrideCorrect() {
    if (!current) return;
    if (pending && pending.vocabId === current.id) {
      save({ ...pending, grade: "good" });
      setPending(null);
      setGraded((g) => ({ ...g, [current.id]: "correct" }));
    }
    setFinished((f) => new Set(f).add(current.id));
    advance(queue.slice(1));
  }

  function continueAfter(r: Result) {
    if (!current) return;
    if (pending && pending.vocabId === current.id) {
      save(pending);
      setPending(null);
    }
    const rest = queue.slice(1);
    if (r === "correct") return advance(rest);
    const n = (repeats[current.id] ?? 0) + 1;
    setRepeats((x) => ({ ...x, [current.id]: n }));
    if (n > MAX_REPEATS) {
      setFinished((f) => new Set(f).add(current.id));
      return advance(rest);
    }
    advance(insertAt(rest, { id: current.id, kind: "ask" }, REQUEUE_GAP));
  }

  // ------------------------------------------------------------------ Start
  if (phase === "start") {
    const next = nextDueDate(words, today);
    return (
      <section className="card stack">
        {regular.length > 0 ? (
          <>
            <p className="current-title">{regular.length} Karten</p>
            <p className="lead">
              {newCount > 0 && `${newCount} neu`}
              {newCount > 0 && regular.length - newCount > 0 && ", "}
              {regular.length - newCount > 0 && `${regular.length - newCount} zum Wiederholen`}
            </p>
            <button type="button" className="btn" onClick={() => start(regular)}>Los geht&apos;s</button>
          </>
        ) : (
          <>
            <p className="current-title">Alles erledigt!</p>
            <p className="lead">
              {words.length === 0
                ? "In dieser Unit gibt es noch keine Vokabeln."
                : next
                  ? `Heute ist nichts fällig. Die nächsten Wörter kommen am ${new Date(next + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })} wieder.`
                  : "Heute ist nichts fällig."}
            </p>
          </>
        )}
        {words.length > 0 && (
          <button type="button" className="btn-quiet" onClick={() => start(buildCramRound(words))}>
            Alle Wörter üben (vor einer Abfrage)
          </button>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------------ Ende
  if (phase === "done") {
    const firstRight = round.filter((w) => graded[w.id] === "correct");
    const missed = round.filter((w) => graded[w.id] && graded[w.id] !== "correct");
    const total = Object.keys(graded).length;
    const great = total >= 5 && firstRight.length / total >= 0.8;
    return (
      <section className="card result">
        <Confetti fire={great} />
        <p className="result-score">
          {firstRight.length} von {Object.keys(graded).length}
        </p>
        <p className="lead">{great ? "auf Anhieb gewusst. Klasse!" : "auf Anhieb gewusst."}</p>
        {missed.length > 0 && (
          <>
            <p className="eyebrow">Diese Wörter kommen bald wieder:</p>
            <ul className="vocab-list ruled">
              {missed.map((w) => (
                <li key={w.id} className="vocab card-missed">
                  <span className="vocab-en" lang="en">{w.en}</span>
                  <span className="vocab-de">{w.de}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {saveFailed && <p className="error">Einige Antworten konnten nicht gespeichert werden.</p>}
        <div className="result-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPhase("start");
              router.refresh();
            }}
          >
            Weiter üben
          </button>
          <Link href={`/kind/${childId}/unit/${unitId}`} className="link">Zur Unit</Link>
          <Link href={`/kind/${childId}`} className="link">Zu {childName}</Link>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------ Karte
  if (!word || !sol || !current) return null;
  const progress = finished.size / Math.max(round.length, 1);

  return (
    <>
      <div className="card-progress" aria-label={`${finished.size} von ${round.length} geschafft`}>
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {current.kind === "learn" ? (
        <section className="flashcard is-learn">
          <p className="eyebrow">Neues Wort</p>
          <p className="fc-en" lang="en">{word.en}</p>
          <p className="fc-de">{word.de}</p>
          <button type="button" className="btn" onClick={learnDone} autoFocus>
            Gemerkt
          </button>
        </section>
      ) : (
        <section className={`flashcard${result ? ` is-${result}` : ""}`}>
          <p className="eyebrow">Wie heißt das auf Englisch?</p>
          <p className="fc-de">{word.de}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
            }}
          >
            <input
              ref={inputRef}
              className="fc-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              readOnly={result !== null}
              lang="en"
              aria-label="Englisches Wort"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
            />
            {result === null && (
              <div className="fc-actions">
                <button className="btn" disabled={!value.trim()}>Prüfen</button>
                <button type="button" className="link" onClick={() => submit("")}>Weiß ich nicht</button>
              </div>
            )}
          </form>

          {result === "correct" && <p className="ok fc-feedback">Richtig!</p>}

          {result && result !== "correct" && (
            <form
              className="fc-correction"
              onSubmit={(e) => {
                e.preventDefault();
                if (gradeAnswer(copy, sol) === "correct") continueAfter(result);
              }}
            >
              <p className={result === "almost" ? "fc-feedback warn" : "fc-feedback error"}>
                {result === "almost" ? "Fast! So schreibt man es:" : "So heißt es:"}
              </p>
              <p className="fc-solution" lang="en">{sol.answer}</p>
              <label className="field">
                <span>Schreib es einmal ab</span>
                <input
                  ref={copyRef}
                  value={copy}
                  onChange={(e) => setCopy(e.target.value)}
                  lang="en"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                />
              </label>
              <button className="btn" disabled={gradeAnswer(copy, sol) !== "correct"}>Weiter</button>
              {value.trim() && (
                <button type="button" className="link fc-override" onClick={overrideCorrect}>
                  Meine Antwort „{value.trim()}“ war richtig
                </button>
              )}
            </form>
          )}
        </section>
      )}
    </>
  );
}
