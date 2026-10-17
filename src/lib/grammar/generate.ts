// Erzeugt Grammatikübungen mit Claude und prüft jede Aufgabe, bevor sie gespeichert wird.
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiClient, AiConfigError } from "../ai";
import { CHAPTER_BY_CODE, CHAPTERS, UNIT_ORDER, type Chapter } from "./catalog";
import { validateItem, type GrammarItem } from "./check";

export class GrammarError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

const TARGET = 8;
const MIN_ITEMS = 6;

const TOOL: Anthropic.Tool = {
  name: "submit_exercise",
  description: "Submit the grammar exercise items.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sentence: { type: "string", description: "English sentence with exactly one gap written as ___ (three underscores)." },
            cue: { type: "string", description: "Short cue shown after the gap, e.g. '(be)', '(no)', '(family)'. Empty string if none." },
            answers: { type: "array", items: { type: "string" }, description: "All correct answers for the gap. First = model answer." },
            tip_de: { type: "string", description: "German hint for a second try. Must NOT give away the answer." },
            explain_de: { type: "string", description: "Short German explanation of the correct answer (one sentence)." },
          },
          required: ["sentence", "cue", "answers", "tip_de", "explain_de"],
        },
      },
    },
    required: ["items"],
  },
};

/** Kapitel, die für eine Unit freigeschaltet sind (alles bis einschließlich dieser Unit). */
export function unlockedChapters(currentUnitCode: string | null): Chapter[] {
  const idx = currentUnitCode ? UNIT_ORDER.indexOf(currentUnitCode) : -1;
  // Pick-up/Across cultures/Focus: alles bis zur vorherigen Unit (Index über die Reihenfolge der Units)
  return CHAPTERS.filter((c) => UNIT_ORDER.indexOf(c.unit) <= idx);
}

function buildPrompt(ch: Chapter, known: string[], allowed: Chapter[], feedback?: string) {
  const system = `You write short grammar exercises for a German child aged 10–11 in the first year of English (Green Line 1 Bayern, CEFR A1). Setting: Greenwich / London. British English.
Rules:
- Every item is ONE short English sentence (max 14 words) with exactly one gap written as ___ .
- Use simple vocabulary: the child's known words, first names, numbers, colours, family, school, home.
- Use only grammar the child already knows (listed below). Nothing else.
- Every answer list must contain ALL correct answers and nothing wrong. Double-check each answer.
- tip_de is a friendly German hint that helps without giving the answer. explain_de explains the correct answer in one German sentence.
- Vary the sentences and the people (I, you, he, she, it, we, they, names).
Call the tool submit_exercise.`;

  const user = `Grammar topic: ${ch.code} – ${ch.titleEn} (${ch.title}).
Rule summary (German): ${ch.rule.join(" ")}

How the items must look:
${ch.task}

Write ${TARGET + 2} items (some will be checked out automatically).

Grammar the child knows: ${allowed.map((c) => c.titleEn).join("; ")}.
Words the child knows (use some of them): ${known.slice(0, 120).join(", ") || "(only basic words)"}.${feedback ? `\n\nYour last answer had problems, fix them:\n${feedback}` : ""}`;
  return { system, user };
}

export async function generateGrammarExercise(supabase: SupabaseClient, childId: string, code: string): Promise<string> {
  const ch = CHAPTER_BY_CODE.get(code);
  if (!ch) throw new GrammarError("Unbekanntes Grammatikkapitel.", 400);

  const { data: child } = await supabase
    .from("children")
    .select("id, textbooks(name), current:units!children_current_unit_fk(sort_order, textbook_units(code))")
    .eq("id", childId)
    .maybeSingle();
  if (!child) throw new GrammarError("Profil nicht gefunden.", 404);
  const c = child as unknown as {
    textbooks: { name: string } | null;
    current: { sort_order: number; textbook_units: { code: string } | null } | null;
  };
  if (c.textbooks?.name !== "Green Line 1 Bayern") throw new GrammarError("Grammatikübungen gibt es bisher nur für Green Line 1 Bayern.", 400);

  // Freigeschaltet: Units bis zur aktuellen (bei Pick-up & Co.: bis zur letzten Unit davor)
  const { data: units } = await supabase
    .from("units")
    .select("sort_order, textbook_units(code)")
    .eq("child_id", childId)
    .order("sort_order");
  const curSort = c.current?.sort_order ?? 0;
  const reached = ((units ?? []) as unknown as { sort_order: number; textbook_units: { code: string } | null }[])
    .filter((u) => u.sort_order <= curSort)
    .map((u) => u.textbook_units?.code ?? "")
    .filter((code) => UNIT_ORDER.includes(code));
  const lastUnit = reached[reached.length - 1] ?? null;
  const allowed = unlockedChapters(lastUnit);
  if (!allowed.some((a) => a.code === ch.code)) {
    throw new GrammarError(`${ch.code} ist erst ab ${ch.unit.replace("U", "Unit ")} dran.`, 400);
  }

  // Bekannte Wörter (kurze, einfache Einträge)
  const { data: vocab } = await supabase
    .from("vocab")
    .select("en, units!inner(sort_order)")
    .eq("child_id", childId)
    .lte("units.sort_order", curSort)
    .limit(400);
  const known = ((vocab ?? []) as { en: string }[])
    .map((v) => v.en.replace(/\(.*?\)/g, "").replace(/\bsth\.|\bsb\./g, "").trim())
    .filter((w) => w && w.split(/\s+/).length <= 3);

  let ai: ReturnType<typeof aiClient>;
  try {
    ai = aiClient();
  } catch (e) {
    if (e instanceof AiConfigError) throw new GrammarError(e.message, 500);
    throw e;
  }

  const good: GrammarItem[] = [];
  const seen = new Set<string>();
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 3 && good.length < TARGET; attempt++) {
    const { system, user } = buildPrompt(ch, known, allowed, feedback);
    const res = await ai.client.messages.create({
      model: ai.model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
    });
    const block = res.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
    const items = ((block?.input as { items?: GrammarItem[] } | undefined)?.items ?? []) as GrammarItem[];
    const problems: string[] = [];
    items.forEach((raw, i) => {
      const item: GrammarItem = {
        sentence: String(raw?.sentence ?? "").trim(),
        cue: String(raw?.cue ?? "").trim(),
        answers: Array.isArray(raw?.answers) ? raw.answers.map((a) => String(a).trim()).filter(Boolean) : [],
        tip_de: String(raw?.tip_de ?? "").trim(),
        explain_de: String(raw?.explain_de ?? "").trim(),
      };
      const err = validateItem(item, ch.check);
      const key = item.sentence.toLowerCase();
      if (err) problems.push(`Item ${i + 1} ("${item.sentence}"): ${err}`);
      else if (!seen.has(key) && good.length < TARGET) {
        seen.add(key);
        good.push(item);
      }
    });
    feedback = problems.length ? problems.slice(0, 8).join("\n") + `\nWrite new items; ${TARGET - good.length} more are needed.` : undefined;
  }

  if (good.length < MIN_ITEMS) {
    throw new GrammarError("Die Übung konnte gerade nicht zuverlässig erstellt werden. Bitte noch einmal versuchen.", 502);
  }

  const { data: saved, error } = await supabase
    .from("grammar_exercises")
    .insert({ child_id: childId, chapter: ch.code, items: good, model: ai.model })
    .select("id")
    .single();
  if (error || !saved) throw new GrammarError("Speichern hat nicht geklappt.", 500);
  return saved.id as string;
}
