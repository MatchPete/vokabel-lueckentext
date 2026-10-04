// Schwierigkeitsstufen und Wortkontrolle für Lückentexte.
import { baseForms } from "./exercise";

export type Level = 1 | 2 | 3;

export const LEVELS: Record<Level, { label: string; maxTargets: number; maxUnknown: number; instructions: string }> = {
  1: {
    label: "Einsteiger",
    maxTargets: 5,
    maxUnknown: 1,
    instructions: `LEVEL: VERY EASY – the child is an absolute beginner.
- 5 to 7 sentences. Each sentence has AT MOST 8 words.
- Use ONLY: the target words, the child's known words, the basic word list, and first names. No other words at all.
- Present tense only. One idea per sentence. No "because", "when", "if" or "that"-clauses. At most one "and" per sentence.`,
  },
  2: {
    label: "Fortgeschritten",
    maxTargets: 7,
    maxUnknown: 3,
    instructions: `LEVEL: EASY – the child knows some English.
- 6 to 8 sentences. Each sentence has at most 12 words.
- Use mainly the target words, the child's known words, the basic word list and first names. At most 2 or 3 other very simple words in the whole text.
- Short, clear sentences. No long chains with "and".`,
  },
  3: {
    label: "Sicher",
    maxTargets: 8,
    maxUnknown: 6,
    instructions: `LEVEL: NORMAL for the first year of English.
- Short, clear sentences. Prefer the child's known words and the basic word list; only a few other common beginner words.`,
  },
};

/** Stufe nach Größe des Wortschatzes; bei schwachen letzten Lückentexten eine Stufe leichter. */
export function chooseLevel(knownWords: number, recentScores: number[]): Level {
  let level: Level = knownWords < 80 ? 1 : knownWords < 250 ? 2 : 3;
  if (recentScores.length >= 2) {
    const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    if (avg < 0.6 && level > 1) level = (level - 1) as Level;
  }
  return level;
}

/**
 * Grundwortschatz, den Kinder aus der Grundschule bzw. den ersten Englischstunden kennen.
 * Annahme auf Basis üblicher Anfänger-Wortlisten, nicht aus dem Lehrwerk übernommen.
 */
export const CORE_WORDS: string[] = `
a an the and or but so too also very not no yes ok okay oh wow please thanks thank you sorry hello hi bye goodbye
i me my mine you your he him his she her it its we us our they them their this that these those here there
am is are was were be can can't cannot do does don't doesn't have has got
what who where when how why which whose
in on at under next to from for of with up down out into near behind
one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty hundred
first second third
red blue green yellow black white orange pink purple brown grey gray
monday tuesday wednesday thursday friday saturday sunday
mum dad mother father brother sister grandma grandpa granny gran family baby friend friends boy girl man woman child children people teacher name
school class lesson house home flat room door window bed table chair desk book pen pencil bag ball toy toys game games
dog cat bird fish horse rabbit mouse pet animal
apple banana orange bread cake milk water juice tea pizza ice cream breakfast lunch dinner food sandwich
day days night morning afternoon evening week weekend today now time year
park street town car bus bike train shop garden tree flower sun rain
go goes come comes see sees look looks like likes love loves play plays eat eats drink drinks read reads write writes sing sings
run runs sit sits sleep sleeps make makes want wants help helps live lives say says open opens give gives take takes watch watches
listen listens find finds know knows swim swims ride rides walk walks talk talks
big small little good bad nice new old happy sad funny cool great hot cold long short tall fast slow favourite favorite
all every many lots lot of again together then now today here let's let
`.split(/\s+/).filter(Boolean);

const CORE = new Set(CORE_WORDS);

/** Mögliche Grundformen eines Wortes (einfaches Abschneiden typischer Endungen). */
function stems(w: string): string[] {
  const out = [w];
  if (w.endsWith("ies")) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("es")) out.push(w.slice(0, -2));
  if (w.endsWith("s")) out.push(w.slice(0, -1));
  if (w.endsWith("ing")) out.push(w.slice(0, -3), w.slice(0, -3) + "e");
  if (w.endsWith("ed")) out.push(w.slice(0, -2), w.slice(0, -1));
  return out;
}

/** Wortschatz des Kindes als Menge einzelner Wörter (inkl. aller Alternativen aus der Buch-Schreibweise). */
export function knownWordSet(entries: string[]): Set<string> {
  const set = new Set<string>();
  for (const en of entries) {
    for (const form of [en, ...baseForms(en)]) {
      for (const t of form.toLowerCase().match(/[a-z']+/g) ?? []) set.add(t.replace(/'s$/, ""));
    }
  }
  return set;
}

/** Wörter im Text, die weder bekannt noch Grundwortschatz noch Namen sind. */
export function unknownWords(text: string, known: Set<string>): string[] {
  const found = new Set<string>();
  for (const raw of text.match(/[A-Za-z][A-Za-z']*/g) ?? []) {
    const lower = raw.toLowerCase().replace(/'(s|re|m|ll|ve|d)$/, "").replace(/n't$/, "");
    if (!lower || lower === "i") continue;
    const ok = stems(lower).some((s) => CORE.has(s) || known.has(s));
    if (ok) continue;
    if (/^[A-Z]/.test(raw)) continue; // großgeschrieben und unbekannt: wahrscheinlich ein Name oder Satzanfang
    found.add(lower);
  }
  return [...found];
}
