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

/** Anzahl Karten, die heute anstehen (fällige Wiederholungen + neue, begrenzt wie eine Runde). */
export function cardsToday(words: CardWord[], today: string, roundSize = 20, newPerRound = 8): number {
  const due = words.filter((w) => !isNew(w) && w.due_date <= today).length;
  const fresh = Math.min(words.filter(isNew).length, newPerRound);
  return Math.min(due + fresh, roundSize);
}

type TodayRow = ProgressRow & {
  unit_id: string;
  created_at: string;
  units: { sort_order: number; title: string } | null;
};

/**
 * Wörter für "Heute üben": alle Lektionen bis zur aktuellen (ohne gesperrte).
 * Neue Wörter der aktuellen Lektion stehen vorn, damit sie zuerst eingeführt werden.
 */
export function wordsUpToCurrent(rows: TodayRow[], today: string, currentUnitId: string | null, currentSort: number | null) {
  const inScope = rows.filter((r) => currentSort == null || (r.units?.sort_order ?? 0) <= currentSort);
  const sorted = [...inScope].sort((a, b) => {
    const ac = a.unit_id === currentUnitId ? 0 : 1;
    const bc = b.unit_id === currentUnitId ? 0 : 1;
    return ac - bc || (a.units?.sort_order ?? 0) - (b.units?.sort_order ?? 0) || a.created_at.localeCompare(b.created_at);
  });
  const words = toCardWords(sorted, today);
  // Lesbarer Name der Lektion: "Unit 1", "Hello!", "Kaleidoscope", "Across cultures 1" …
  sorted.forEach((r, i) => {
    const title = r.units?.title ?? "";
    words[i].unitLabel = title ? title.split(":")[0].trim() : undefined;
  });
  return words;
}

export const TODAY_SELECT =
  "id, en, de, accepted_en, unit_id, created_at, vocab_progress(due_date, ease, reps, lapses, correct_count, wrong_count, last_seen_at), units!inner(sort_order, title)";
export type { TodayRow };

/** Aufschlüsselung, wie die heutige Karteikarten-Runde zustande kommt (für die Erklärung). */
export function cardsBreakdown(words: CardWord[], today: string, roundSize = 20, newPerRound = 8) {
  const fresh = words.filter(isNew).length;
  const dueNow = words.filter((w) => !isNew(w) && w.due_date <= today).length;
  const later = words.length - fresh - dueNow;
  const dueToday = Math.min(dueNow, roundSize);
  const newToday = Math.min(fresh, newPerRound, roundSize - dueToday);
  return { total: words.length, fresh, dueNow, later, dueToday, newToday, inRound: dueToday + newToday, roundSize, newPerRound };
}
export type CardsBreakdown = ReturnType<typeof cardsBreakdown>;
