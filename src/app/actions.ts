"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECTION_ORDER, type Section } from "@/lib/types";
import { gapsOf, grade, normalize, type Segment } from "@/lib/exercise";
import { parseSettings, type Settings } from "@/lib/settings";
import { gradeItem, type GrammarItem } from "@/lib/grammar/check";
import { CHAPTER_BY_CODE } from "@/lib/grammar/catalog";

export async function createChild(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const textbookId = String(formData.get("textbook_id") ?? "");
  if (!nickname || nickname.length > 30 || !textbookId) return;

  const supabase = await createClient();

  // Gibt es den Spitznamen schon, wird einfach das bestehende Profil geöffnet (kein Doppel)
  const findExisting = async () => {
    const { data: kids } = await supabase.from("children").select("id, nickname");
    return (kids ?? []).find((k) => k.nickname.trim().toLowerCase() === nickname.toLowerCase());
  };
  const existing = await findExisting();
  if (existing) redirect(`/kind/${existing.id}`);

  const { data, error } = await supabase.rpc("create_child", {
    p_nickname: nickname,
    p_textbook_id: textbookId,
  });
  if (error?.code === "23505") {
    // Gleichzeitig doppelt abgeschickt: die Datenbank hat das zweite abgelehnt
    const again = await findExisting();
    if (again) redirect(`/kind/${again.id}`);
  }
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
  hinted?: number[]; // Lücken, bei denen der "Tipp" angezeigt wurde
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

  const hinted = new Set((input.hinted ?? []).filter((n) => Number.isInteger(n)));
  const rows: { attempt_id: string; vocab_id: string; given: string; result: string; try_no: number; hinted: boolean }[] = [];
  gaps.forEach((gap, i) => {
    const first = (input.firstTry[i] ?? "").slice(0, 120);
    const r1 = grade(first, gap);
    rows.push({ attempt_id: attempt.id, vocab_id: gap.vocab_id, given: first, result: r1, try_no: 1, hinted: hinted.has(i) });
    const second = input.secondTry[i];
    if (r1 !== "correct" && second != null) {
      const s = second.slice(0, 120);
      rows.push({ attempt_id: attempt.id, vocab_id: gap.vocab_id, given: s, result: grade(s, gap), try_no: 2, hinted: hinted.has(i) });
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
export type ImportRow = {
  en: string;
  de: string;
  section: Section;
  word_type: string | null;
  example_en: string | null;
  unit_id?: string; // Lektion pro Vokabel (beim Foto vorgewählt); sonst die Lektion des Aufrufs
};
export type ImportResult = { ok: true; inserted: number; skipped: number } | { ok: false; error: string };

const WORD_TYPES = new Set(["noun", "verb", "adjective", "adverb", "phrase", "other"]);

export async function saveVocabBatch(input: { childId: string; unitId: string; rows: ImportRow[] }): Promise<ImportResult> {
  if (!Array.isArray(input.rows) || input.rows.length === 0) return { ok: false, error: "Nichts zum Speichern ausgewählt." };
  if (input.rows.length > 300) return { ok: false, error: "Zu viele Vokabeln auf einmal." };

  const supabase = await createClient();
  // Alle Lektionen des Kindes: jede Vokabel darf nur in eine davon
  const { data: units } = await supabase.from("units").select("id").eq("child_id", input.childId);
  const validUnits = new Set((units ?? []).map((u) => u.id));
  if (!validUnits.has(input.unitId)) return { ok: false, error: "Unit nicht gefunden." };

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
      unit_id: r.unit_id && validUnits.has(r.unit_id) ? r.unit_id : input.unitId,
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

  revalidatePath(`/kind/${input.childId}`, "layout");
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

// ---------------------------------------------------------------------------
// Einstellungen, Profil, Vokabeln sperren
// ---------------------------------------------------------------------------

export async function updateSettings(input: { childId: string; settings: Settings }): Promise<{ ok: boolean }> {
  const clean = parseSettings(input.settings); // nur gültige Werte speichern
  const supabase = await createClient();
  const { error } = await supabase.from("children").update({ settings: clean }).eq("id", input.childId);
  revalidatePath(`/kind/${input.childId}`, "layout");
  return { ok: !error };
}

export async function renameChild(input: { childId: string; nickname: string }): Promise<{ ok: boolean; error?: string }> {
  const nickname = input.nickname.trim();
  if (!nickname || nickname.length > 30) return { ok: false, error: "Bitte einen Spitznamen mit 1 bis 30 Zeichen eingeben." };
  const supabase = await createClient();
  const { error } = await supabase.from("children").update({ nickname }).eq("id", input.childId);
  if (error?.code === "23505") return { ok: false, error: "Diesen Namen gibt es schon." };
  if (error) return { ok: false, error: "Umbenennen hat nicht geklappt." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Löscht ein Profil samt Vokabeln und Lernstand. Zur Sicherheit muss der Name eingetippt werden. */
export async function deleteChild(input: { childId: string; confirmName: string }): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: child } = await supabase.from("children").select("id, nickname").eq("id", input.childId).maybeSingle();
  if (!child) return { ok: false, error: "Profil nicht gefunden." };
  if (child.nickname.trim().toLowerCase() !== input.confirmName.trim().toLowerCase()) {
    return { ok: false, error: `Zum Löschen bitte genau „${child.nickname}“ eintippen.` };
  }
  const { error } = await supabase.from("children").delete().eq("id", input.childId);
  if (error) return { ok: false, error: "Löschen hat nicht geklappt." };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function setVocabExcluded(input: { childId: string; vocabIds: string[]; excluded: boolean }): Promise<BulkResult> {
  if (!input.vocabIds?.length) return { ok: false, error: "Keine Vokabeln ausgewählt." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocab")
    .update({ excluded: input.excluded })
    .in("id", input.vocabIds)
    .eq("child_id", input.childId)
    .select("id");
  if (error) return { ok: false, error: "Das hat nicht geklappt." };
  revalidatePath(`/kind/${input.childId}`, "layout");
  return { ok: true, count: data?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// Grammatikübungen: Ergebnis speichern (Bewertung erfolgt hier erneut auf dem Server)
// ---------------------------------------------------------------------------

export async function saveGrammarAttempt(input: {
  exerciseId: string;
  firstTry: string[];
  secondTry: (string | null)[];
}): Promise<{ ok: boolean; score?: number; max?: number; error?: string }> {
  const supabase = await createClient();
  const { data: ex } = await supabase
    .from("grammar_exercises")
    .select("id, child_id, chapter, items")
    .eq("id", input.exerciseId)
    .maybeSingle();
  if (!ex) return { ok: false, error: "Übung nicht gefunden." };
  const ch = CHAPTER_BY_CODE.get(ex.chapter);
  if (!ch) return { ok: false, error: "Unbekanntes Kapitel." };
  const items = ex.items as GrammarItem[];
  const first = items.map((it, i) => gradeItem(String(input.firstTry?.[i] ?? ""), it, ch.check));
  const second = items.map((it, i) =>
    first[i] ? null : input.secondTry?.[i] != null ? gradeItem(String(input.secondTry[i]), it, ch.check) : false,
  );
  const score = first.filter(Boolean).length;
  const { error } = await supabase.from("grammar_attempts").insert({
    child_id: ex.child_id,
    exercise_id: ex.id,
    chapter: ex.chapter,
    score,
    max_score: items.length,
    answers: items.map((_, i) => ({
      first: String(input.firstTry?.[i] ?? ""),
      first_ok: first[i],
      second: input.secondTry?.[i] ?? null,
      second_ok: second[i],
    })),
  });
  if (error) return { ok: false, error: "Speichern hat nicht geklappt." };
  revalidatePath(`/kind/${ex.child_id}/grammatik`, "layout");
  return { ok: true, score, max: items.length };
}
