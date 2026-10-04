// Erzeugt einen Lückentext mit Claude. Läuft nur auf dem Server.
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient, AiConfigError } from "./ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { baseForms, FORM_HINTS, normalize, type GapForm, type Segment, type TextType } from "./exercise";

const MAX_TARGETS = 8;
const MIN_TARGETS = 3;
const TEXT_TYPES: TextType[] = ["story", "dialogue", "email", "postcard", "voice_message"];

// Annahme: Diese Grundbausteine kennen Kinder aus dem Englischunterricht der Grundschule
// zumindest als feste Wendungen. Ohne sie lässt sich kein Satz schreiben. Sie sind deshalb
// immer erlaubt und erscheinen nie auf der Verbotsliste, auch wenn das Buch sie erst in Unit 1/2 einführt.
const BASELINE_CODES = new Set([
  "pron_be", "be_negation", "be_questions", "possessive_det", "there_is_are",
  "indef_article", "def_article", "can_cant", "imperative", "demonstratives",
]);
const BASELINE_TEXT =
  "am/is/are (also short forms and questions), I/you/he/she/it/we/they, my/your/his/her, a/an/the, this/that, there is/there are, can/can't, imperatives (Look! Come here!), 'I like …' + noun, and/but";

const TEXT_TYPE_INSTRUCTIONS: Record<TextType, string> = {
  story: "a short story told in simple sentences (6–9 sentences)",
  dialogue: "a dialogue between two or three children (8–12 short lines, each line starts with the speaker's name and a colon, one line per speaker turn, separated by line breaks)",
  email: "an email from one child to a friend (greeting line, 5–8 sentences, closing line with name; use line breaks between greeting, body and closing)",
  postcard: "a holiday or weekend postcard (greeting, 5–7 sentences, closing with name; use line breaks between greeting, body and closing)",
  voice_message: "a voice message a child leaves for a friend (6–8 short spoken sentences, starts with 'Hi …, it's …')",
};

const FORM_RULES: Record<GapForm, string> = {
  base: "base: exactly the word/phrase as listed, but leave out 'to' before verbs and leave out the placeholders sb./sth. (if several alternatives are separated by '/', use one of them)",
  plural: "plural: plural form of a noun",
  third_person: "third_person: simple present he/she/it form ending in -s",
  ing: "ing: -ing form (present progressive)",
  past: "past: simple past form",
  genitive: "genitive: possessive form with 's",
};

type VocabRow = {
  id: string;
  unit_id: string;
  en: string;
  de: string;
  word_type: string | null;
  accepted_en: string[];
  vocab_progress: Progress | Progress[] | null;
  units: { sort_order: number } | { sort_order: number }[] | null;
};
type Topic = { id: string; code: string; label_de: string; forms: string[] };
type Progress = { box: number; due_date: string; last_seen_at: string | null; ease: number };

export class GenerateError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);

function berlinToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fällige zuerst, dann niedrige Stufe, dann schwierige Wörter, dann am längsten nicht gesehen. Gleichstand zufällig. */
function byPriority(words: VocabRow[], today: string): VocabRow[] {
  const key = (v: VocabRow) => {
    const p = one(v.vocab_progress);
    return {
      due: p && p.due_date <= today ? 0 : 1,
      box: p?.box ?? 1,
      ease: Number(p?.ease ?? 2.5),
      seen: p?.last_seen_at ?? "",
    };
  };
  return shuffle(words).sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka.due - kb.due || ka.box - kb.box || ka.ease - kb.ease || ka.seen.localeCompare(kb.seen);
  });
}

type Target = { n: number; vocab: VocabRow };

function buildPrompt(opts: {
  targets: Target[];
  known: string[];
  unitTitle: string;
  textType: TextType;
  allowedForms: GapForm[];
  unlocked: Topic[];
  locked: Topic[];
  feedback?: string;
}) {
  const system = `You write short English gap-fill (cloze) texts for a German child aged 10–11 in the first year of English at a Bavarian Gymnasium (textbook level: Green Line 1 Bayern, CEFR A1).

Absolute rules:
- Use ONLY grammar from the "already learned" list plus the most basic structures. Never use grammar from the "not learned yet" list.
- Vocabulary: use the target words, the child's known words, names, and only very common beginner words (numbers, colours, family, days, school things, food, animals, rooms, simple adjectives). No idioms, no rare words.
- Short, clear sentences. Friendly, everyday situations a 10-year-old enjoys. Setting: Greenwich / London, UK. Invent your own characters with common British first names. Do not use characters or storylines from any textbook.
- Every target word appears EXACTLY ONCE, and ONLY as a gap. Do not use target words anywhere else in the text.
- Write a gap as {{n|answer|form}} where n is the target number, answer is the exact text the child must type, and form is one of the allowed forms. The answer must be grammatically correct in the sentence.
- "sb." means somebody and "sth." means something. They are placeholders: replace them with a fitting word in the text, OUTSIDE the gap. Example: "to look at sth." -> "Look at {{3|look at|base}}" is WRONG; correct is "{{3|Look at|base}} the picture!".
- NO hint is shown below the gaps. Each gap must be solvable from the context alone: the surrounding words must point clearly to exactly one of the target words, and no other target word may fit that gap. Give helpful context, e.g. "It's raining, so I take my {{4|umbrella|base}}." If a non-base form is used (e.g. past), the sentence must make the form obvious (e.g. "Yesterday …").
- Write EVERY gap in the {{n|answer|form}} format. Never use underscores, dots or brackets as gaps.
- English only. No German words in the text.

Call the tool submit_exercise with your result.`;

  const targetList = opts.targets
    .map(({ n, vocab }) => `${n}. ${vocab.en} = ${vocab.de}${vocab.word_type ? ` (${vocab.word_type})` : ""}`)
    .join("\n");

  const user = `Text type: ${TEXT_TYPE_INSTRUCTIONS[opts.textType]}.
Topic inspiration: the textbook unit "${opts.unitTitle}". Choose a situation that fits the target words naturally.

Target words (each exactly once as a gap):
${targetList}

Allowed gap forms:
${opts.allowedForms.map((f) => `- ${FORM_RULES[f]}`).join("\n")}
Prefer the base form. Use another form only where it is the natural choice.

Always allowed basics: ${BASELINE_TEXT}.

Grammar already learned in class (German labels):
${opts.unlocked.length ? opts.unlocked.map((t) => `- ${t.label_de}`).join("\n") : "- (nothing beyond the basics yet)"}

Grammar NOT learned yet – do not use it:
${opts.locked.length ? opts.locked.map((t) => `- ${t.label_de}`).join("\n") : "- (none)"}

Words the child already knows (you may use these freely):
${opts.known.join(", ") || "(none yet)"}${opts.feedback ? `\n\nYour previous attempt had these problems. Avoid them:\n${opts.feedback}` : ""}`;

  return { system, user };
}

const TOOL: Anthropic.Tool = {
  name: "submit_exercise",
  description: "Submit the finished gap-fill text.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short English title, at most 6 words." },
      theme: { type: "string", description: "Topic of the text in German, 2–4 words." },
      text: { type: "string", description: "The full text with gaps written as {{n|answer|form}}. Use \\n for line breaks." },
    },
    required: ["title", "theme", "text"],
  },
};

type Parsed = { segments: Segment[]; problems: string[]; fatal: string[]; gapCount: number };

function parse(text: string, targets: Target[], allowedForms: GapForm[]): Parsed {
  const byN = new Map(targets.map((t) => [t.n, t.vocab]));
  const seen = new Set<number>();
  const segments: Segment[] = [];
  const problems: string[] = [];
  const fatal: string[] = [];
  const re = /\{\{\s*(\d+)\s*\|\s*([^|{}]+?)\s*\|\s*([a-z_]+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;

  const pushText = (v: string) => {
    if (!v) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.t === "text") prev.v += v;
    else segments.push({ t: "text", v });
  };

  while ((m = re.exec(text))) {
    pushText(text.slice(last, m.index));
    last = re.lastIndex;
    const n = Number(m[1]);
    const answer = m[2].trim();
    const form = m[3] as GapForm;
    const vocab = byN.get(n);

    let issue: string | null = null;
    if (!vocab) issue = `gap number ${n} does not exist`;
    else if (seen.has(n)) issue = `target ${n} (${vocab.en}) was used more than once`;
    else if (!allowedForms.includes(form)) issue = `target ${n}: form "${form}" is not allowed`;
    else if (form === "base") {
      const options = [...baseForms(vocab.en), ...vocab.accepted_en.flatMap(baseForms)];
      const ok = options.map(normalize).includes(normalize(answer));
      if (!ok) issue = `target ${n}: base form must be exactly "${options.join('" or "')}", not "${answer}"`;
    } else if (form === "third_person" && !/[a-z]s\b/i.test(answer)) issue = `target ${n}: third_person form needs a verb ending in -s`;
    else if (form === "ing" && !/[a-z]ing\b/i.test(answer)) issue = `target ${n}: ing form needs a verb ending in -ing`;
    else if (form === "genitive" && !/'/.test(answer.replace(/\u2019/g, "'"))) issue = `target ${n}: genitive needs 's`;

    if (issue || !vocab) {
      problems.push(issue ?? "invalid gap");
      pushText(answer); // ungültige Lücke wird zu normalem Text
      continue;
    }
    seen.add(n);
    const accepted =
      form === "base"
        ? Array.from(new Set([...baseForms(vocab.en), ...vocab.accepted_en.flatMap(baseForms)])).filter(
            (a) => normalize(a) !== normalize(answer),
          )
        : [];
    segments.push({
      t: "gap",
      vocab_id: vocab.id,
      answer,
      accepted,
      hint_de: FORM_HINTS[form] ? `${vocab.de} (${FORM_HINTS[form]})` : vocab.de,
      form,
    });
  }
  pushText(text.slice(last));

  for (const t of targets) if (!seen.has(t.n)) problems.push(`target ${t.n} (${t.vocab.en}) is missing`);
  if (/\{\{|\}\}/.test(text.replace(re, ""))) fatal.push("broken gap markers");
  if (/[äöüßÄÖÜ]/.test(text)) fatal.push("German words in the text");
  if (/_{2,}/.test(text.replace(re, ""))) fatal.push("underscores were used as gaps; write every gap as {{n|answer|form}}");
  if (text.length < 150 || text.length > 1600) fatal.push("text length out of range");

  return { segments, problems, fatal, gapCount: seen.size };
}

export async function generateExercise(supabase: SupabaseClient, childId: string, unitId: string) {
  let ai: ReturnType<typeof aiClient>;
  try {
    ai = aiClient();
  } catch (e) {
    if (e instanceof AiConfigError) throw new GenerateError(e.message, 500);
    throw e;
  }

  const [{ data: unit }, { data: vocab }, { data: overrides }, { data: lastEx }, { data: child }] = await Promise.all([
    supabase.from("units").select("id, title, sort_order, textbook_unit_id").eq("id", unitId).eq("child_id", childId).maybeSingle(),
    supabase
      .from("vocab")
      .select("id, unit_id, en, de, word_type, accepted_en, vocab_progress(box, due_date, last_seen_at, ease), units!inner(sort_order)")
      .eq("child_id", childId),
    supabase.from("child_grammar_overrides").select("topic_id, enabled").eq("child_id", childId),
    supabase.from("exercises").select("text_type").eq("child_id", childId).order("created_at", { ascending: false }).limit(1),
    supabase.from("children").select("textbook_id, current:units!children_current_unit_fk(sort_order)").eq("id", childId).maybeSingle(),
  ]);
  if (!unit || !child) throw new GenerateError("Unit nicht gefunden.", 404);

  const words = (vocab ?? []) as unknown as VocabRow[];
  const sortOf = (v: VocabRow) => one(v.units)?.sort_order ?? 0;
  const today = berlinToday();

  // Zielwörter: nur aus der gewählten Unit (fällige und schwierige zuerst).
  // Wiederholung älterer Units übernehmen die Karteikarten.
  const picked = byPriority(words.filter((v) => v.unit_id === unitId), today).slice(0, MAX_TARGETS);
  if (picked.length < MIN_TARGETS) {
    throw new GenerateError(`Für einen Lückentext braucht diese Unit mindestens ${MIN_TARGETS} Vokabeln.`);
  }
  const targets: Target[] = shuffle(picked).map((v, i) => ({ n: i + 1, vocab: v }));

  // Bekannter Wortschatz (nur Englisch), Grammatik, Textsorte
  const known = words
    .filter((v) => sortOf(v) <= unit.sort_order && !picked.includes(v))
    .map((v) => v.en)
    .slice(0, 400);

  // Freigeschaltet ist die Grammatik bis zur aktuellen Unit – oder bis zur geübten, falls die weiter ist
  // (wer Unit 1 übt, ist in Unit 1). Abweichungen der Lehrkraft (Overrides) gelten zusätzlich.
  const currentSort = one((child as unknown as { current: { sort_order: number } | { sort_order: number }[] | null }).current)?.sort_order ?? 0;
  const upTo = Math.max(currentSort, unit.sort_order);
  const { data: allTopics } = await supabase
    .from("grammar_topics")
    .select("id, code, label_de, forms, textbook_units!inner(textbook_id, sort_order)")
    .eq("textbook_units.textbook_id", child.textbook_id);
  const ov = new Map(((overrides ?? []) as { topic_id: string; enabled: boolean }[]).map((o) => [o.topic_id, o.enabled]));
  type TopicRow = Topic & { textbook_units: { sort_order: number } | { sort_order: number }[] | null };
  const topics = (allTopics ?? []) as unknown as TopicRow[];
  const isUnlocked = (t: TopicRow) => ov.get(t.id) ?? (one(t.textbook_units)?.sort_order ?? 999) <= upTo;
  const unlockedTopics: Topic[] = topics.filter(isUnlocked);
  const locked: Topic[] = topics.filter((t) => !isUnlocked(t) && !BASELINE_CODES.has(t.code));
  const allowedForms = Array.from(
    new Set<GapForm>(["base", ...(unlockedTopics.flatMap((t) => t.forms) as GapForm[])]),
  );

  const lastType = (lastEx?.[0]?.text_type as TextType | undefined) ?? null;
  const textType = shuffle(TEXT_TYPES.filter((t) => t !== lastType))[0];

  const { client, model: MODEL } = ai;
  let feedback: string | undefined;
  let best: (Parsed & { title: string; theme: string }) | null = null;
  const log: { attempt: number; text: string; problems: string[]; fatal: string[] }[] = [];
  const started = Date.now();

  // Bis zu 3 Versuche, ein dritter nur, wenn noch genug Zeit bis zum Funktions-Limit bleibt
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 3 && Date.now() - started > 30_000) break;
    const { system, user } = buildPrompt({
      targets,
      known,
      unitTitle: unit.title,
      textType,
      allowedForms,
      unlocked: unlockedTopics,
      locked,
      feedback,
    });

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: user }],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    const input = (block && block.type === "tool_use" ? block.input : null) as
      | { title?: string; theme?: string; text?: string }
      | null;
    if (!input?.text) {
      feedback = "- You did not return any text.";
      log.push({ attempt, text: "", problems: ["no text returned"], fatal: [] });
      continue;
    }

    const parsed = parse(input.text.replace(/\r\n/g, "\n").trim(), targets, allowedForms);
    log.push({ attempt, text: input.text.slice(0, 3000), problems: parsed.problems, fatal: parsed.fatal });
    const candidate = { ...parsed, title: (input.title ?? "").trim() || "Lückentext", theme: (input.theme ?? "").trim() };
    if (parsed.fatal.length === 0 && parsed.problems.length === 0) {
      best = candidate;
      break;
    }
    if (parsed.fatal.length === 0 && (!best || parsed.gapCount > best.gapCount)) best = candidate;
    feedback =
      [...parsed.fatal, ...parsed.problems].map((p) => `- ${p}`).join("\n") +
      "\n- Remember: write every gap exactly as {{n|answer|form}} and use each target number exactly once.";
  }

  // Notlösung: fehlerhafte Lücken wurden zu Text; reicht es trotzdem für eine Übung?
  if (!best || best.gapCount < MIN_TARGETS) {
    // Für die Fehlersuche festhalten, was schiefging (Rohtext und Prüfergebnis)
    await supabase
      .from("generation_failures")
      .insert({ child_id: childId, unit_id: unitId, model: MODEL, attempts: log })
      .then(() => undefined, () => undefined);
    throw new GenerateError("Die Geschichte ist diesmal nicht gelungen. Bitte noch einmal versuchen.", 502);
  }

  const { data: ex, error } = await supabase
    .from("exercises")
    .insert({
      child_id: childId,
      unit_id: unitId,
      title: best.title.slice(0, 120),
      text_type: textType,
      theme: best.theme.slice(0, 80) || null,
      segments: best.segments,
      model: MODEL,
    })
    .select("id")
    .single();
  if (error || !ex) throw new GenerateError("Die Übung konnte nicht gespeichert werden.", 500);
  return ex.id as string;
}
