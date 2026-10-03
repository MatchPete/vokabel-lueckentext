"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECTION_ORDER, type Section } from "@/lib/types";

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
