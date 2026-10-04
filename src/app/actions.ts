"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECTION_ORDER, type Section } from "@/lib/types";
import { gapsOf, grade, normalize, type Segment } from "@/lib/exercise";

export async function createChild(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const textbookId = String(formData.get("textbook_id") ?? "");
  if (!nickname || nickname.length > 30 || !textbookId) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_child", {
    p_nickname: nickname,
    p_textbook_id: textbookId,
  });
  if (error || !data) throw new Error("Profil konnte nicht angelegt werden.");
  redirect(`/kind/${data}`);
}

export async function setCurrentUnit(formData: FormData) {
  const childId = String(formData.get("child_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");
  if (!childId || !unitId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("children")
    .update({ current_unit_id: unitId })
    .eq("id", childId);
  if (error) throw new Error("Die Unit konnte nicht gesetzt werden.");
  revalidatePath(`/kind/${childId}`);
}

export type VocabFormState = {
  ok: boolean;
  error?: string;
  added?: string; // zuletzt gespeichertes Wort, für die Rückmeldung
  section: Section;
  en?: string; // bei Fehlern: Eingaben zurückgeben, damit nichts verloren geht
  de?: string;
};

export async function addVocab(prev: VocabFormState, formData: FormData): Promise<VocabFormState> {
  const childId = String(formData.get("child_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");
  const en = String(formData.get("en") ?? "").trim().replace(/\s+/g, " ");
  const de = String(formData.get("de") ?? "").trim().replace(/\s+/g, " ");
  const rawSection = String(formData.get("section") ?? "other");
  const section: Section = (SECTION_ORDER as string[]).includes(rawSection)
    ? (rawSection as Section)
    : "other";

  if (!en || !de) {
    return { ok: false, section, en, de, error: "Bitte Englisch und Deutsch ausfüllen." };
  }
  if (en.length > 120 || de.length > 120) {
    return { ok: false, section, en, de, error: "Das ist zu lang für eine Vokabel." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("vocab")
    .insert({ child_id: childId, unit_id: unitId, en, de, section });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, section, en, de, error: `„${en}“ ist schon gespeichert.` };
    }
    return { ok: false, section, en, de, error: "Speichern hat nicht geklappt. Bitte noch einmal versuchen." };
  }

  revalidatePath(`/kind/${childId}/unit/${unitId}`);
  revalidatePath(`/kind/${childId}`);
  return { ok: true, section, added: en };
}

export async function deleteVocab(formData: FormData) {
  const childId = String(formData.get("child_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");
  const vocabId = String(formData.get("vocab_id") ?? "");
  if (!vocabId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("vocab").delete().eq("id", vocabId);
  if (error) throw new Error("Löschen hat nicht geklappt.");
  revalidatePath(`/kind/${childId}/unit/${unitId}`);
  revalidatePath(`/kind/${childId}`);
}

// ---------------------------------------------------------------------------
// Übungen
// ---------------------------------------------------------------------------

export type SaveResult = { ok: true; correct: number; total: number } | { ok: false; error: string };

/** Speichert einen Durchgang. Bewertet serverseitig neu und schreibt die Leitner-Fächer fort. */
export async function saveAttempt(input: {
  exerciseId: string;
  firstTry: string[];
  secondTry: (string | null)[];
}): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: ex } = await supabase
    .from("exercises")
    .select("id, child_id, segments")
    .eq("id", input.exerciseId)
    .maybeSingle();
  if (!ex) return { ok: false, error: "Übung nicht gefunden." };

  const gaps = gapsOf(ex.segments as Segment[]);
  if (input.firstTry.length !== gaps.length) return { ok: false, error: "Antworten passen nicht zur Übung." };

  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .insert({ child_id: ex.child_id, exercise_id: ex.id })
    .select("id")
    .single();
  if (aErr || !attempt) return { ok: false, error: "Speichern hat nicht geklappt." };

  const rows: { attempt_id: string; vocab_id: string; given: string; result: string; try_no: number }[] = [];
  gaps.forEach((gap, i) => {
    const first = (input.firstTry[i] ?? "").slice(0, 120);
    const r1 = grade(first, gap);
    rows.push({ attempt_id: attempt.id, vocab_id: gap.vocab_id, given: first, result: r1, try_no: 1 });
    const second = input.secondTry[i];
    if (r1 !== "correct" && second != null) {
      const s = second.slice(0, 120);
      rows.push({ attempt_id: attempt.id, vocab_id: gap.vocab_id, given: s, result: grade(s, gap), try_no: 2 });
    }
  });

  const { error: rErr } = await supabase.from("attempt_answers").insert(rows);
  if (rErr) return { ok: false, error: "Antworten konnten nicht gespeichert werden." };

  const { data: fin, error: fErr } = await supabase.rpc("finish_attempt", { p_attempt_id: attempt.id });
  if (fErr || !fin?.[0]) return { ok: false, error: "Auswertung hat nicht geklappt." };

  revalidatePath(`/kind/${ex.child_id}`);
  return { ok: true, correct: fin[0].richtig, total: fin[0].gesamt };
}

export async function flagExercise(formData: FormData) {
  const exerciseId = String(formData.get("exercise_id") ?? "");
  if (!exerciseId) return;
  const supabase = await createClient();
  await supabase.from("exercises").update({ flagged: true }).eq("id", exerciseId);
  revalidatePath(`/`, "layout");
}

// ---------------------------------------------------------------------------
// Foto-Import: mehrere Vokabeln auf einmal speichern
// ---------------------------------------------------------------------------
export type ImportRow = { en: string; de: string; section: Section; word_type: string | null; example_en: string | null };
export type ImportResult = { ok: true; inserted: number; skipped: number } | { ok: false; error: string };

const WORD_TYPES = new Set(["noun", "verb", "adjective", "adverb", "phrase", "other"]);

export async function saveVocabBatch(input: { childId: string; unitId: string; rows: ImportRow[] }): Promise<ImportResult> {
  if (!Array.isArray(input.rows) || input.rows.length === 0) return { ok: false, error: "Nichts zum Speichern ausgewählt." };
  if (input.rows.length > 300) return { ok: false, error: "Zu viele Vokabeln auf einmal." };

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("id")
    .eq("id", input.unitId)
    .eq("child_id", input.childId)
    .maybeSingle();
  if (!unit) return { ok: false, error: "Unit nicht gefunden." };

  const { data: existing } = await supabase.from("vocab").select("en, de").eq("child_id", input.childId);
  const key = (en: string, de: string) => `${normalize(en)}|${normalize(de)}`;
  const seen = new Set((existing ?? []).map((v) => key(v.en, v.de)));

  const toInsert = [];
  let skipped = 0;
  for (const r of input.rows) {
    const en = String(r.en ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const de = String(r.de ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!en || !de || seen.has(key(en, de))) {
      skipped++;
      continue;
    }
    seen.add(key(en, de));
    toInsert.push({
      child_id: input.childId,
      unit_id: input.unitId,
      en,
      de,
      section: (SECTION_ORDER as string[]).includes(r.section) ? r.section : "other",
      word_type: r.word_type && WORD_TYPES.has(r.word_type) ? r.word_type : null,
      example_en: r.example_en ? String(r.example_en).slice(0, 200) : null,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("vocab").insert(toInsert);
    if (error) return { ok: false, error: "Speichern hat nicht geklappt. Bitte noch einmal versuchen." };
  }

  revalidatePath(`/kind/${input.childId}/unit/${input.unitId}`);
  revalidatePath(`/kind/${input.childId}`);
  return { ok: true, inserted: toInsert.length, skipped };
}

// ---------------------------------------------------------------------------
// Karteikarten
// ---------------------------------------------------------------------------
export async function recordCardReview(input: {
  vocabId: string;
  grade: "again" | "hard" | "good" | "easy";
  given: string;
  ms: number;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_card_review", {
    p_vocab_id: input.vocabId,
    p_grade: input.grade,
    p_given: String(input.given ?? "").slice(0, 120),
    p_ms: Math.round(Number(input.ms) || 0),
  });
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Vokabeln nachträglich verschieben oder mehrere löschen
// ---------------------------------------------------------------------------
export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

export async function moveVocab(input: {
  childId: string;
  fromUnitId: string;
  toUnitId: string;
  vocabIds: string[];
  section: Section | null; // null = Abschnitt beibehalten
}): Promise<BulkResult> {
  if (!input.vocabIds?.length) return { ok: false, error: "Keine Vokabeln ausgewählt." };
  if (input.vocabIds.length > 500) return { ok: false, error: "Zu viele auf einmal." };
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("units")
    .select("id")
    .eq("id", input.toUnitId)
    .eq("child_id", input.childId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Ziel-Unit nicht gefunden." };

  const patch: { unit_id: string; section?: Section } = { unit_id: input.toUnitId };
  if (input.section && (SECTION_ORDER as string[]).includes(input.section)) patch.section = input.section;

  const { data, error } = await supabase
    .from("vocab")
    .update(patch)
    .in("id", input.vocabIds)
    .eq("child_id", input.childId)
    .select("id");
  if (error) return { ok: false, error: "Verschieben hat nicht geklappt." };

  revalidatePath(`/kind/${input.childId}`, "layout");
  return { ok: true, count: data?.length ?? 0 };
}

export async function deleteVocabBatch(input: { childId: string; vocabIds: string[] }): Promise<BulkResult> {
  if (!input.vocabIds?.length) return { ok: false, error: "Keine Vokabeln ausgewählt." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocab")
    .delete()
    .in("id", input.vocabIds)
    .eq("child_id", input.childId)
    .select("id");
  if (error) return { ok: false, error: "Löschen hat nicht geklappt." };
  revalidatePath(`/kind/${input.childId}`, "layout");
  return { ok: true, count: data?.length ?? 0 };
}
