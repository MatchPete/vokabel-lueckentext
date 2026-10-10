"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordCardReview } from "@/app/actions";
import Confetti from "./Confetti";
import SpeakButton, { AutoSpeakToggle, useAutoSpeak } from "./SpeakButton";
import { speak, unlockSpeech } from "@/lib/speech";
import { alternativesOnLines, type Result } from "@/lib/exercise";
import { buildCramRound, buildRound, cardAnswer, gradeCard, gradeFor, isNew, nextDueDate, type CardWord, type Grade } from "@/lib/cards";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";

type Props = {
  childId: string;
  childName: string;
  unitId?: string | null; // fehlt bei "Heute üben" (mehrere Lektionen)
  scopeLabel?: string; // z. B. "bis Unit 3"
  cramLabel?: string; // Beschriftung des zweiten Knopfs
  words: CardWord[];
  today: string;
  settings?: Settings;
};
type Dir = "de_en" | "en_de";
type Item = { id: string; kind: "learn" | "ask"; dir: Dir };
type Phase = "start" | "card" | "done";

// Zeit und Zufall nur in Ereignissen verwenden (nie beim Rendern)
const now = () => Date.now();
const coin = () => Math.random() < 0.5;

const REQUEUE_GAP = 3; // falsch beantwortete Wörter kommen nach 3 Karten wieder
const MAX_REPEATS = 3;

export default function FlashCards({
  childId,
  childName,
  unitId = null,
  scopeLabel,
  cramLabel = "Alle Wörter üben (vor einer Abfrage)",
  words,
  today,
  settings = DEFAULT_SETTINGS,
}: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const regular = useMemo(
    () => buildRound(words, today, settings.roundSize, settings.newPerRound),
    [words, today, settings.roundSize, settings.newPerRound],
  );
  const gradeOpts = { caseSensitive: settings.caseSensitive, typoCountsCorrect: settings.typoCountsCorrect };
  const pickDir = (): Dir =>
    settings.direction === "mixed" ? (coin() ? "de_en" : "en_de") : settings.direction;
  const newCount = regular.filter(isNew).length;

  const [phase, setPhase] = useState<Phase>("start");
  const [round, setRound] = useState<CardWord[]>([]);
  const [queue, setQueue] = useState<Item[]>([]);
  const [value, setValue] = useState("");
  const [copy, setCopy] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [typoForgiven, setTypoForgiven] = useState(false);
  const [revealed, setRevealed] = useState(false); // Englisch → Deutsch: Lösung aufgedeckt
  const [shownAt, setShownAt] = useState(0);
  const [graded, setGraded] = useState<Record<string, Result>>({});
  const [repeats, setRepeats] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  // Falsche Antworten werden erst beim Weitergehen gespeichert, damit "Ich hatte es richtig" noch korrigieren kann
  const [pending, setPending] = useState<{ vocabId: string; grade: Grade; given: string; ms: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Nach einer richtigen Antwort bleibt die Karte kurz stehen; "Weiter" überspringt die Wartezeit
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  const copyRef = useRef<HTMLInputElement>(null);

  const current = queue[0];
  const word = current ? byId.get(current.id) : undefined;
  const sol = word ? cardAnswer(word) : null;
  const autoSpeak = useAutoSpeak();

  // Vorlesen direkt im Tipp-Ereignis auslösen (zuverlässiger auf iPhone/Safari als zeitversetzt)
  function say(id: string | undefined) {
    if (!autoSpeak || !id) return;
    const w = byId.get(id);
    if (w) speak(w.en);
  }

  useEffect(() => {
    if (phase !== "card" || current?.dir === "en_de") return;
    if (result === null) inputRef.current?.focus();
    else if (result === "correct") nextRef.current?.focus();
    else copyRef.current?.focus();
  }, [phase, current, result]);

  // Englisch sichtbar? Dann vorlesen (Lernkarte oder Abfrage Englisch → Deutsch)
  const speaksOnShow = (it: Item | undefined) => it && (it.kind === "learn" || it.dir === "en_de");

  function start(list: CardWord[]) {
    unlockSpeech();
    const items: Item[] = list.map((w) => ({ id: w.id, kind: isNew(w) ? "learn" : "ask", dir: pickDir() }));
    if (speaksOnShow(items[0])) say(items[0].id);
    setRound(list);
    setQueue(items);
    setGraded({});
    setRepeats({});
    setFinished(new Set());
    setResult(null);
    setValue("");
    setShownAt(now());
    setPhase("card");
  }

  function advance(nextQueue: Item[]) {
    setResult(null);
    setTypoForgiven(false);
    setRevealed(false);
    setValue("");
    setCopy("");
    if (nextQueue.length === 0) {
      setPhase("done");
      setQueue([]);
      return;
    }
    setQueue(nextQueue);
    setShownAt(now());
    if (speaksOnShow(nextQueue[0])) say(nextQueue[0].id);
  }

  function insertAt(list: Item[], item: Item, pos: number): Item[] {
    const p = Math.min(pos, list.length);
    return [...list.slice(0, p), item, ...list.slice(p)];
  }

  function learnDone() {
    if (!current) return;
    // Neues Wort gleich danach noch nicht abfragen, sondern nach zwei anderen Karten
    advance(insertAt(queue.slice(1), { id: current.id, kind: "ask", dir: current.dir }, 2));
  }

  function submit(given: string) {
    if (!word || !sol || result !== null) return;
    const { result: r, typoForgiven: forgiven } = gradeCard(given, sol, gradeOpts);
    setResult(r);
    setTypoForgiven(forgiven);
    say(word.id);

    // Nur die erste Abfrage eines Wortes in dieser Runde zählt für die Planung
    if (!(word.id in graded)) {
      setGraded((g) => ({ ...g, [word.id]: r }));
      const ms = now() - shownAt;
      // Verziehener Tippfehler zählt als richtig, wird aber etwas früher wiederholt
      const g = forgiven ? "hard" : gradeFor(r, ms, Math.min(...[sol.answer, ...sol.accepted].map((a) => a.length)), isNew(word));
      if (r === "correct") save({ vocabId: word.id, grade: g, given, ms });
      else setPending({ vocabId: word.id, grade: g, given, ms });
    }
    if (r === "correct") {
      setFinished((f) => new Set(f).add(word.id));
      // 2,5 Sekunden sichtbar lassen, damit sich die richtige Schreibweise einprägt
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        continueAfter("correct");
      }, 2500);
    }
  }

  /** Englisch → Deutsch: Kind bewertet sich nach dem Aufdecken selbst. */
  function selfRate(r: Result) {
    if (!word || !current) return;
    if (!(word.id in graded)) {
      setGraded((g) => ({ ...g, [word.id]: r }));
      const grade: Grade = r === "correct" ? "good" : r === "almost" ? "hard" : "again";
      save({ vocabId: word.id, grade, given: `[selbst: ${r}]`, ms: now() - shownAt });
    }
    if (r === "correct") setFinished((f) => new Set(f).add(word.id));
    continueAfter(r);
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

  function skipWait() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      continueAfter("correct");
    }
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
    advance(insertAt(rest, { id: current.id, kind: "ask", dir: current.dir }, REQUEUE_GAP));
  }

  // ------------------------------------------------------------------ Start
  if (phase === "start") {
    const next = nextDueDate(words, today);
    const total = words.length;
    const fresh = words.filter(isNew).length;
    const dueNow = words.filter((w) => !isNew(w) && w.due_date <= today).length;
    const later = total - fresh - dueNow;
    return (
      <>
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
          <button type="button" className="btn-quiet" onClick={() => start(buildCramRound(words, settings.roundSize))}>
            {cramLabel}
          </button>
        )}
        <AutoSpeakToggle />
      </section>

      {total > 0 && (
        <section className="card stack how-cards" aria-labelledby="how-h">
          <h2 className="subtitle" id="how-h">Deine Wörter {scopeLabel ?? "in dieser Unit"}</h2>
          <dl className="card-stats">
            <div><dt>{total}</dt><dd>insgesamt</dd></div>
            <div><dt>{fresh}</dt><dd>noch neu</dd></div>
            <div><dt>{dueNow}</dt><dd>heute wiederholen</dd></div>
            <div><dt>{later}</dt><dd>sitzen erst mal</dd></div>
          </dl>
          <details className="change">
            <summary>Warum nicht alle Wörter auf einmal?</summary>
            <div className="how-text">
              <p>
                Eine Runde enthält nur die Wörter, die <strong>heute dran</strong> sind: alle fälligen Wiederholungen und
                dazu höchstens {settings.newPerRound} neue Wörter. So kommen neue Wörter nach und nach dazu. Das prägt
                sich besser ein, als alle auf einmal zu pauken.
              </p>
              <p>
                <strong>Gewusste Wörter</strong> kommen erst nach einigen Tagen wieder, später nach Wochen.{" "}
                <strong>Schwierige Wörter</strong> kommen öfter, bis sie sitzen.
              </p>
              <p>
                Nach einer Runde kannst du mit <strong>„Weiter üben“</strong> gleich die nächsten neuen Wörter
                dazunehmen. Vor einer Abfrage in der Schule: die Lektion öffnen und dort{" "}
                <strong>„Alle Wörter üben“</strong>.
              </p>
              <p className="hint">Wie viele Karten und neue Wörter pro Runde, lässt sich in den Einstellungen ändern.</p>
            </div>
          </details>
        </section>
      )}
      </>
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
                  <span className="vocab-de" lang="de">{alternativesOnLines(w.de)}</span>
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
          {unitId && <Link href={`/kind/${childId}/unit/${unitId}`} className="link">Zur Unit</Link>}
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
          <p className="eyebrow">Neues Wort{word.unitLabel ? ` · ${word.unitLabel}` : ""}</p>
          <div className="fc-row">
            <p className="fc-en" lang="en">{word.en}</p>
            <SpeakButton text={word.en} />
          </div>
          <p className="fc-de">{alternativesOnLines(word.de)}</p>
          <button type="button" className="btn" onClick={learnDone} autoFocus>
            Gemerkt
          </button>
        </section>
      ) : current.dir === "en_de" ? (
        <section className="flashcard">
          <p className="eyebrow">Was heißt das auf Deutsch?{word.unitLabel ? ` · ${word.unitLabel}` : ""}</p>
          <div className="fc-row">
            <p className="fc-en" lang="en">{word.en}</p>
            <SpeakButton text={word.en} />
          </div>
          {!revealed ? (
            <button type="button" className="btn" onClick={() => setRevealed(true)} autoFocus>
              Aufdecken
            </button>
          ) : (
            <>
              <p className="fc-de fc-reveal" lang="de">{alternativesOnLines(word.de)}</p>
              <p className="eyebrow">Hast du es gewusst?</p>
              <div className="self-rate">
                <button type="button" className="btn rate-good" onClick={() => selfRate("correct")} autoFocus>Gewusst</button>
                <button type="button" className="btn-quiet rate-almost" onClick={() => selfRate("almost")}>Fast</button>
                <button type="button" className="btn-quiet rate-wrong" onClick={() => selfRate("wrong")}>Nicht gewusst</button>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className={`flashcard${result ? ` is-${result}` : ""}`}>
          <p className="eyebrow">Wie heißt das auf Englisch?{word.unitLabel ? ` · ${word.unitLabel}` : ""}</p>
          <p className="fc-de">{alternativesOnLines(word.de)}</p>

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

          {result === "correct" && (
            <div className="fc-correct">
              <p className="ok fc-feedback">{typoForgiven ? "Richtig! Kleiner Tippfehler – so schreibt man es:" : "Richtig!"}</p>
              <div className="fc-row">
                <p className="fc-solution fc-solution-ok" lang="en">{word.en}</p>
                <SpeakButton text={word.en} />
              </div>
              <button ref={nextRef} type="button" className="btn" onClick={skipWait}>
                Weiter
              </button>
            </div>
          )}

          {result && result !== "correct" && (
            <form
              className="fc-correction"
              onSubmit={(e) => {
                e.preventDefault();
                if (!settings.requireCopy || gradeCard(copy, sol, gradeOpts).result === "correct") continueAfter(result);
              }}
            >
              <p className={result === "almost" ? "fc-feedback warn" : "fc-feedback error"}>
                {result === "almost"
                  ? settings.caseSensitive && value.trim().toLowerCase() === sol.answer.trim().toLowerCase()
                    ? "Fast! Achte auf Groß- und Kleinschreibung:"
                    : "Fast! So schreibt man es:"
                  : "So heißt es:"}
              </p>
              <div className="fc-row">
                <p className="fc-solution" lang="en">{sol.answer}</p>
                <SpeakButton text={word.en} />
              </div>
              {settings.requireCopy && (
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
              )}
              <button className="btn" disabled={settings.requireCopy && gradeCard(copy, sol, gradeOpts).result !== "correct"}>Weiter</button>
              {settings.showOverride && value.trim() && (
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
