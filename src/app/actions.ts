"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
