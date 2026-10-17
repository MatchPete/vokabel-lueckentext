// Bewertung und Prüfung von Grammatikaufgaben.
import type { CheckKind } from "./catalog";

export type GrammarItem = {
  sentence: string; // mit genau einer Lücke "___"
  cue: string; // z. B. "(be)" oder "(no)", darf leer sein
  answers: string[]; // alle richtigen Lösungen, erste = Musterlösung
  tip_de: string; // Hinweis nach dem ersten Fehlversuch (verrät die Lösung nicht)
  explain_de: string; // Erklärung zur Lösung
};

/** Für den Vergleich: Kleinschreibung, gerade Apostrophe, ohne Komma/Punkt/Ausrufe-/Fragezeichen. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u00b4`]/g, "'")
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Kurzantworten müssen exakt passen (bei "yes" Langform!) – dort keine automatische Gleichsetzung
const SHORT_ANSWER_KINDS: CheckKind[] = ["short_be", "short_have", "short_do", "short_did", "there"];

/** n't ↔ not, 'm ↔ am, 're ↔ are (nicht 's – das wäre auch der Genitiv) */
function expand(s: string): string {
  return s
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/n't\b/g, " not")
    .replace(/'m\b/g, " am")
    .replace(/'re\b/g, " are")
    .replace(/'ve\b/g, " have")
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeItem(given: string, item: GrammarItem, kind: CheckKind): boolean {
  const g = norm(given);
  if (!g) return false;
  const answers = item.answers.map(norm);
  if (answers.includes(g)) return true;
  if (SHORT_ANSWER_KINDS.includes(kind)) return false;
  return answers.map(expand).includes(expand(g));
}

// ---------------------------------------------------------------------------
// Plural nach Regeln (für G1). null = unsicher, dann wird nicht geprüft.
const IRREGULAR: Record<string, string> = {
  mouse: "mice", child: "children", man: "men", woman: "women", person: "people", foot: "feet",
  tooth: "teeth", sheep: "sheep", fish: "fish", goose: "geese", policeman: "policemen",
};
export function plural(noun: string): string | null {
  const w = noun.trim().toLowerCase();
  if (!/^[a-z]+$/.test(w)) return null;
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (/(o|f|fe)$/.test(w)) return null; // photo/potato, knife/roof: nicht sicher
  if (/(s|x|z|ch|sh)$/.test(w)) return w + "es";
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}

const ONE_OF = (list: string[]) => (a: string) => list.includes(norm(a));
const PRONOUNS = "(i|you|he|she|it|we|they)";
const SHORT_BE = new RegExp(`^(yes ${PRONOUNS} (am|is|are)|no (i'm not|${PRONOUNS} (isn't|aren't)))$`);
const SHORT_THERE = /^(yes there (is|are)|no there (isn't|aren't))$/;
const SHORT_HAVE = new RegExp(`^(yes ${PRONOUNS} (have|has)|no ${PRONOUNS} (haven't|hasn't))$`);
const SHORT_DO = new RegExp(`^(yes ${PRONOUNS} (do|does)|no ${PRONOUNS} (don't|doesn't))$`);
const SHORT_DID = new RegExp(`^(yes ${PRONOUNS} did|no ${PRONOUNS} didn't)$`);
const QUESTION_WORDS = ["where", "who", "what", "how", "how old", "whose", "when", "why", "which", "where from"];

/** Prüft die Musterlösung einer erzeugten Aufgabe; gibt einen Fehlertext zurück oder null. */
export function validateItem(item: GrammarItem, kind: CheckKind): string | null {
  if (!item || typeof item.sentence !== "string") return "missing sentence";
  const gaps = item.sentence.split("___").length - 1;
  if (gaps !== 1) return "sentence must contain exactly one gap ___";
  if (item.sentence.split(/\s+/).length > 22) return "sentence too long";
  if (/\b(und|der|die|das|ist|nicht|ich)\b/i.test(item.sentence.replace(/\(.*?\)/g, ""))) return "German words in the English sentence";
  if (!Array.isArray(item.answers) || item.answers.length === 0 || item.answers.length > 5) return "1–5 answers required";
  if (item.answers.some((a) => typeof a !== "string" || !/^[A-Za-z' ,.!?-]{1,40}$/.test(a.trim()))) return "answers must be short English text";
  if (!item.tip_de?.trim() || !item.explain_de?.trim()) return "tip_de and explain_de required";
  const main = norm(item.answers[0]);
  const cue = norm(item.cue ?? "").replace(/[()]/g, "").trim();

  switch (kind) {
    case "plural": {
      if (!cue) return "plural items need the singular noun as cue";
      const expected = plural(cue);
      if (!expected) return `"${cue}" is not a suitable noun (only +s, -y → -ies or mouse → mice)`;
      // In Unit 1 noch nicht gelernt: -es nach Zischlauten
      if (/(s|x|z|ch|sh)$/.test(cue)) return `"${cue}" needs -es, which is not taught yet`;
      if (main !== expected) return `plural of "${cue}" is "${expected}"`;
      return null;
    }
    case "be":
      return ONE_OF(["am", "is", "are", "i", "you", "he", "she", "it", "we", "they"])(main)
        ? null
        : "answer must be am, is, are or a personal pronoun";
    case "be_neg":
      return /^(am not|'m not|isn't|is not|aren't|are not)$/.test(main) ? null : "answer must be a negative form of be";
    case "short_be": {
      // Frage bilden: "Is Luke", "Are they"
      if (/^(am|is|are) [a-z]+( [a-z]+)?$/.test(main) && !/^(yes|no)/.test(main)) return null;
      if (!SHORT_BE.test(main)) return "short answer must be like 'Yes, she is.' or 'No, she isn't.' (yes = long form, no = short form)";
      if (cue && !main.startsWith(cue)) return "short answer must match the cue yes/no";
      return null;
    }
    case "there":
      if (/^(yes|no)/.test(main)) return SHORT_THERE.test(main) ? null : "short answer must be 'Yes, there is/are.' or 'No, there isn't/aren't.'";
      return ONE_OF(["is", "are", "isn't", "aren't"])(main.replace(/^there /, "")) ? null : "answer must be is/are (or isn't/aren't)";
    case "wh":
      return QUESTION_WORDS.includes(main) ? null : "answer must be a question word";
    case "possessive":
      return ONE_OF(["my", "your", "his", "her", "its", "our", "their", "you're", "it's"])(main) ? null : "answer must be a possessive determiner (or you're / it's in look-alike items)";
    case "article": {
      if (!ONE_OF(["a", "an", "the"])(main)) return "answer must be a, an or the";
      if (main === "a" || main === "an") {
        const next = (item.sentence.split("___")[1] ?? "").trim().toLowerCase().match(/^[a-z]+/)?.[0] ?? "";
        const vowelSound = /^[aeiou]/.test(next) && !/^(uni|use|usu|eu|one|once)/.test(next) || /^(hour|honest)/.test(next);
        if ((main === "an") !== vowelSound) return `"${next}" needs "${vowelSound ? "an" : "a"}"`;
      }
      return null;
    }
    case "have_got":
      return /\b(have|has|haven't|hasn't) (not )?got\b/.test(main) || /^(have|has) not got$/.test(main) ? null : "answer must contain have/has got";
    case "short_have":
      return SHORT_HAVE.test(main) ? null : "short answer must be like 'Yes, I have.' / 'No, she hasn't.' (no 'got')";
    case "modal":
      return ONE_OF(["can", "can't", "cannot", "must", "mustn't", "must not", "needn't", "need not"])(main) ? null : "answer must be a modal verb";
    case "genitive":
      return /('s|s')$/.test(main) ? null : "answer must end in 's or s'";
    case "demonstrative":
      return ONE_OF(["this", "that", "these", "those"])(main) ? null : "answer must be this/that/these/those";
    case "object_pronoun":
      return ONE_OF(["me", "you", "him", "her", "it", "us", "them"])(main) ? null : "answer must be an object pronoun";
    case "short_do":
      if (/^(yes|no)/.test(main)) return SHORT_DO.test(main) ? null : "short answer must be like 'Yes, I do.' / 'No, she doesn't.'";
      return ONE_OF(["do", "does"])(main) ? null : "answer must be Do or Does";
    case "do_neg":
      return /^(don't|doesn't|do not|does not) [a-z]+$/.test(main) ? null : "answer must be don't/doesn't + verb";
    case "do_q":
      return ONE_OF(["do", "does"])(main) ? null : "answer must be do or does";
    case "progressive":
      return /^(am|is|are|'m|'s|'re) [a-z]+ing$/.test(main) || /^(am|is|are) not [a-z]+ing$/.test(main) ? null : "answer must be am/is/are + -ing";
    case "short_did":
      if (/^(yes|no)/.test(main)) return SHORT_DID.test(main) ? null : "short answer must be 'Yes, I did.' / 'No, I didn't.'";
      return /^did [a-z]+ [a-z]+$/.test(main) || main === "did" ? null : "answer must start with Did";
    case "past_neg":
      return /^(didn't|did not) [a-z]+$/.test(main) ? null : "answer must be didn't + verb";
    case "past": {
      if (!/^[a-z]+$/.test(main)) return "answer must be one past verb";
      const verb = cue.split(/\s+/).pop() ?? "";
      if (/^[a-z]+$/.test(verb) && main === verb && !["put", "cut", "hit", "let", "read", "cost", "hurt", "shut", "set"].includes(verb))
        return "answer must be the past form, not the infinitive";
      return null;
    }
    case "conjunction":
      return ONE_OF(["because", "when", "if", "but", "and", "so", "or"])(main) ? null : "answer must be a conjunction";
    case "third_person":
      return /^[a-z]+$/.test(main) ? null : "answer must be one verb";
    case "frequency":
    case "quantity":
    case "word_order":
    case "imperative":
    case "free":
      return null;
  }
}

/** Nur der Apostroph fehlt oder ist zu viel? (z. B. "isnt" statt "isn't") */
export function apostropheMiss(given: string, item: GrammarItem): boolean {
  const strip = (s: string) => norm(s).replace(/'/g, "");
  const g = strip(given);
  return !!g && item.answers.some((a) => strip(a) === g);
}
