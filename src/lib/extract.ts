// Liest Vokabeln aus einem Foto einer Buchseite (Claude Vision). Läuft nur auf dem Server.
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient, AiConfigError } from "./ai";
import { SECTION_LABELS, SECTION_ORDER, type Section } from "./types";

const WORD_TYPES = ["noun", "verb", "adjective", "adverb", "phrase", "other"] as const;

export type ExtractedEntry = {
  en: string;
  de: string;
  section: Section | null;
  word_type: (typeof WORD_TYPES)[number] | null;
  example_en: string | null;
  uncertain: boolean;
};

function buildTool(sections: Section[]): Anthropic.Tool {
  return {
    name: "submit_vocabulary",
    description: "Submit all vocabulary entries found on the page, in reading order.",
    input_schema: {
      type: "object",
      properties: {
        is_vocabulary_page: { type: "boolean", description: "false if the photo does not show a vocabulary list" },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              en: { type: "string", description: "English word or phrase exactly as printed (keep 'to' before verbs if printed). No phonetic transcription." },
              de: { type: "string", description: "German translation as printed. Several meanings separated by ', '." },
              section: {
                type: "string",
                enum: [...sections, "unknown"],
                description: `Book section heading this entry belongs to (${sections.filter((x) => x !== "other").map((x) => SECTION_LABELS[x]).join(", ")}). 'unknown' if no heading is visible for it.`,
              },
              word_type: { type: "string", enum: [...WORD_TYPES], description: "Only if obvious." },
              uncertain: { type: "boolean", description: "true if any part was hard to read or might be wrong" },
            },
            required: ["en", "de", "section", "uncertain"],
          },
        },
      },
      required: ["is_vocabulary_page", "entries"],
    },
  };
}

function buildPrompt(bookName: string, sections: Section[]): string {
  const headings = sections.filter((x) => x !== "other").map((x) => `"${SECTION_LABELS[x]}"`).join(", ");
  return `This photo shows a page from the vocabulary section of the English textbook "${bookName || "an English textbook for German students"}". Typically there are columns: English word or phrase, sometimes phonetic transcription and an English example sentence, and the German translation.

Extract every vocabulary entry on the page in reading order.
- Copy the English and German exactly as printed. Do not correct, translate or add anything yourself.
- Ignore phonetic transcriptions, example sentences, page numbers, pictures, grammar boxes, tips and exercises.
- Keep abbreviations like "sb." and "sth." exactly as printed.
- Section headings such as ${headings} mark which section the following entries belong to.
- If an entry is cut off at the edge of the photo or unreadable, skip it. Never guess missing letters.
- Mark an entry as uncertain if you are not fully sure you read it correctly.

Call the tool submit_vocabulary with the result.`;
}

export class ExtractError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function extractVocabulary(
  image: Uint8Array,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  book: { name: string; sections: Section[] } = { name: "", sections: SECTION_ORDER },
) {
  const TOOL = buildTool(book.sections);
  let ai: ReturnType<typeof aiClient>;
  try {
    ai = aiClient();
  } catch (e) {
    if (e instanceof AiConfigError) throw new ExtractError(e.message, 500);
    throw e;
  }

  const res = await ai.client.messages.create({
    model: ai.model,
    max_tokens: 8000,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: Buffer.from(image).toString("base64") } },
          { type: "text", text: buildPrompt(book.name, book.sections) },
        ],
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  const input = (block && block.type === "tool_use" ? block.input : null) as {
    is_vocabulary_page?: boolean;
    entries?: Array<Record<string, unknown>>;
  } | null;
  if (!input) throw new ExtractError("Die Seite konnte nicht ausgewertet werden.", 502);
  if (input.is_vocabulary_page === false) {
    throw new ExtractError("Auf dem Foto ist keine Vokabelliste zu erkennen.");
  }

  const clean = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const entries: ExtractedEntry[] = [];
  for (const e of input.entries ?? []) {
    const en = clean(e.en, 120);
    const de = clean(e.de, 120);
    if (!en || !de) continue;
    const section = (book.sections as string[]).includes(String(e.section)) ? (e.section as Section) : null;
    const wt = (WORD_TYPES as readonly string[]).includes(String(e.word_type)) ? (e.word_type as ExtractedEntry["word_type"]) : null;
    entries.push({
      en,
      de,
      section,
      word_type: wt,
      example_en: null,
      uncertain: e.uncertain === true || res.stop_reason === "max_tokens",
    });
  }
  return { entries, truncated: res.stop_reason === "max_tokens" };
}
