// Karteikarten: Auswahl einer Runde und Bewertung einer Antwort.
// Die Langzeitplanung pro Wort passiert in der Datenbank (apply_review).
import { baseForms, normalize, type Result } from "./exercise";

export type Grade = "again" | "hard" | "good" | "easy";

export type CardWord = {
  id: string;
  en: string;
  de: string;
  accepted_en: string[];
  due_date: string;
  ease: number;
  reps: number;
  lapses: number;
  seen: number; // wie oft schon abgefragt (richtig + falsch)
};

const ROUND_SIZE = 20;
const NEW_PER_ROUND = 8;

/**
 * Lösung, die angezeigt wird (wie im Buch, z. B. "to tell sb. sth."),
 * und alle akzeptierten Schreibweisen ("tell", "to tell", Alternativen mit "/").
 */
export function cardAnswer(w: Pick<CardWord, "en" | "accepted_en">) {
  const forms = [...baseForms(w.en), ...w.accepted_en.flatMap(baseForms)];
  const answer = w.en.trim();
  // "to look at" gilt ebenfalls, wenn das Buch das Verb mit "to" angibt
  const withTo = /^\s*\(?to\)?\s/i.test(w.en) ? forms.map((f) => `to ${f}`) : [];
  const accepted = Array.from(new Set([w.en, ...forms, ...withTo, ...w.accepted_en])).filter(
    (a) => normalize(a) !== normalize(answer),
  );
  return { answer, accepted };
}

export const isNew = (w: CardWord) => w.seen === 0 && w.reps === 0 && w.lapses === 0;

/**
 * Normale Runde: fällige Wörter (zuerst die überfälligsten und schwierigsten),
 * dazu bis zu 8 neue. Neue werden zwischen die Wiederholungen gemischt.
 */
export function buildRound(words: CardWord[], today: string): CardWord[] {
  const due = words
    .filter((w) => !isNew(w) && w.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.ease - b.ease);
  const fresh = words.filter(isNew);
  const dueTake = due.slice(0, ROUND_SIZE);
  const newTake = fresh.slice(0, Math.min(NEW_PER_ROUND, ROUND_SIZE - dueTake.length));

  const out: CardWord[] = [];
  let d = 0, n = 0;
  while (d < dueTake.length || n < newTake.length) {
    // Muster: zwei Wiederholungen, ein neues Wort
    for (let k = 0; k < 2 && d < dueTake.length; k++) out.push(dueTake[d++]);
    if (n < newTake.length) out.push(newTake[n++]);
  }
  return out;
}

/** Prüfungsvorbereitung: alle Wörter, die schwierigsten zuerst (je Runde 20). */
export function buildCramRound(words: CardWord[]): CardWord[] {
  return [...words]
    .sort(() => Math.random() - 0.5)
    .sort((a, b) => a.ease - b.ease || b.lapses - a.lapses)
    .slice(0, ROUND_SIZE);
}

/** Bewertung für die Planung. Schnelle, richtige Antworten bei bekannten Wörtern gelten als "leicht". */
export function gradeFor(result: Result, ms: number, answerLength: number, firstTimeEver: boolean): Grade {
  if (result === "wrong") return "again";
  if (result === "almost") return "hard";
  if (firstTimeEver) return "good";
  return ms < 3000 + 200 * answerLength ? "easy" : "good";
}

export function nextDueDate(words: CardWord[], today: string): string | null {
  const future = words.map((w) => w.due_date).filter((d) => d > today).sort();
  return future[0] ?? null;
}
