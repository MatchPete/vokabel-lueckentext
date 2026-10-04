// Lernstand aus der Datenbank in Karteikarten-Daten umwandeln (Server und Client).
import { isNew, type CardWord } from "./cards";

type P = {
  due_date: string;
  ease: number | string;
  reps: number;
  lapses: number;
  correct_count: number;
  wrong_count: number;
  last_seen_at: string | null;
};

export type ProgressRow = {
  id: string;
  en: string;
  de: string;
  accepted_en: string[];
  vocab_progress: P | P[] | null;
};

export function berlinToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function toCardWords(rows: ProgressRow[], today: string): CardWord[] {
  return rows.map((r) => {
    const p = Array.isArray(r.vocab_progress) ? r.vocab_progress[0] : r.vocab_progress;
    return {
      id: r.id,
      en: r.en,
      de: r.de,
      accepted_en: r.accepted_en ?? [],
      due_date: p?.due_date ?? today,
      ease: Number(p?.ease ?? 2.5),
      reps: p?.reps ?? 0,
      lapses: p?.lapses ?? 0,
      seen: (p?.correct_count ?? 0) + (p?.wrong_count ?? 0),
    };
  });
}

/** Anzahl Karten, die heute anstehen (fällige Wiederholungen + neue, max. 8 neue). */
export function cardsToday(words: CardWord[], today: string): number {
  const due = words.filter((w) => !isNew(w) && w.due_date <= today).length;
  const fresh = Math.min(words.filter(isNew).length, 8);
  return Math.min(due + fresh, 20);
}
