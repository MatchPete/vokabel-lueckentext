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
 * Mögliche Lückenformen einer gespeicherten Vokabel:
 * "to look at sth." -> ["look at"], "Mum / Mom" -> ["Mum", "Mom"], "to help (sb.)" -> ["help"].
 * Platzhalter sb./sth./so. stehen in Lehrwerken für "jemand/etwas" und gehören nicht in die Lücke.
 */
export function baseForms(en: string): string[] {
  return en
    .split(/\s*\/\s*/)
    .map((alt) =>
      alt
        .replace(/\(\s*(sb|sth|so)\.?\s*\)/gi, " ")
        .replace(/(^|\s)(sb|sth|so)\.?(?=\s|$|[,;])/gi, " ")
        .replace(/^\s*to\s+/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

export function gapsOf(segments: Segment[]): GapSegment[] {
  return segments.filter((s): s is GapSegment => s.t === "gap");
}
