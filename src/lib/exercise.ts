// Gemeinsame Logik für Übungen: Datenformat, Hinweise und Bewertung.
// Wird im Browser (sofortiges Feedback) und auf dem Server (Speichern) identisch verwendet.

export type GapForm = "base" | "plural" | "third_person" | "ing" | "past" | "genitive";

export type TextSegment = { t: "text"; v: string };
export type GapSegment = {
  t: "gap";
  vocab_id: string;
  answer: string;
  accepted: string[];
  hint_de: string;
  form: GapForm;
};
export type Segment = TextSegment | GapSegment;

export type TextType = "story" | "dialogue" | "email" | "postcard" | "voice_message";

export const TEXT_TYPE_LABELS: Record<TextType, string> = {
  story: "Geschichte",
  dialogue: "Dialog",
  email: "E-Mail",
  postcard: "Postkarte",
  voice_message: "Sprachnachricht",
};

export const FORM_HINTS: Record<GapForm, string> = {
  base: "",
  plural: "Mehrzahl",
  third_person: "er/sie/es",
  ing: "-ing-Form",
  past: "Vergangenheit",
  genitive: "’s-Form",
};

export type Result = "correct" | "almost" | "wrong";

export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u2018\u2019\u02BC`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** correct: exakt (nach Normalisierung); almost: ein Tippfehler bei Wörtern ab 4 Zeichen; sonst wrong. */
export function grade(given: string, gap: Pick<GapSegment, "answer" | "accepted">): Result {
  const g = normalize(given);
  if (!g) return "wrong";
  const options = [gap.answer, ...gap.accepted].map(normalize);
  if (options.includes(g)) return "correct";
  if (options.some((o) => o.length >= 4 && levenshtein(g, o) === 1)) return "almost";
  return "wrong";
}

/**
 * Alle Schreibweisen, die für eine Vokabel als richtig gelten. Lehrwerke ergänzen Wörter oft um Hinweise:
 *   "TV (= television)"   -> "TV", "television"
 *   "to look at sth."     -> "look at"
 *   "to help (sb.)"       -> "help"
 *   "(to) put"            -> "put", "to put"
 *   "colour (AE color)"   -> "colour", "color"
 *   "Mum / Mom", "a; b"   -> jede Alternative einzeln
 *   "I'm from …"          -> "I'm from"
 * "to" am Anfang entfällt hier; Karteikarten akzeptieren es zusätzlich.
 */
export function baseForms(en: string): string[] {
  // "(= …)" und "(AE …)/(BE …)" sind gleichwertige Alternativen
  const synRe = /\(\s*(?:=|AE\b|BE\b)\s*([^)]+)\)/gi;
  const synonyms = [...en.matchAll(synRe)].map((m) => m[1]);
  const core = en.replace(synRe, " ");
  const alternatives = [...core.split(/\s*[/;]\s*/), ...synonyms];

  const clean = (s: string) =>
    s
      .replace(/(\.\.\.|…)/g, " ")
      .replace(/\(\s*(sb|sth|so)\.?\s*\)/gi, " ")
      .replace(/(^|\s)(sb|sth|so)\.?(?=\s|$|[,;])/gi, " ")
      .replace(/^\s*to\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();

  const out: string[] = [];
  for (const alt of alternatives) {
    const withoutBrackets = clean(alt.replace(/\([^)]*\)/g, " "));
    const bracketsOpened = clean(alt.replace(/[()]/g, " "));
    for (const f of [withoutBrackets, bracketsOpened]) if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

export function gapsOf(segments: Segment[]): GapSegment[] {
  return segments.filter((s): s is GapSegment => s.t === "gap");
}
