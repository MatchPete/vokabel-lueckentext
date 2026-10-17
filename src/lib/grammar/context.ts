import type { SupabaseClient } from "@supabase/supabase-js";
import { GREEN_LINE_BAYERN, UNIT_ORDER } from "./catalog";

/** Buch des Kindes und die letzte erreichte Unit (für die Freischaltung der Grammatikkapitel). */
export async function grammarContext(supabase: SupabaseClient, childId: string) {
  const [{ data: child }, { data: units }] = await Promise.all([
    supabase
      .from("children")
      .select("id, nickname, textbooks(name), current:units!children_current_unit_fk(sort_order)")
      .eq("id", childId)
      .maybeSingle(),
    supabase.from("units").select("sort_order, textbook_units(code)").eq("child_id", childId).order("sort_order"),
  ]);
  if (!child) return null;
  const c = child as unknown as { id: string; nickname: string; textbooks: { name: string } | null; current: { sort_order: number } | null };
  const curSort = c.current?.sort_order ?? 0;
  const reached = ((units ?? []) as unknown as { sort_order: number; textbook_units: { code: string } | null }[])
    .filter((u) => u.sort_order <= curSort)
    .map((u) => u.textbook_units?.code ?? "")
    .filter((code) => UNIT_ORDER.includes(code));
  return {
    id: c.id,
    nickname: c.nickname,
    supported: c.textbooks?.name === GREEN_LINE_BAYERN,
    lastUnit: reached[reached.length - 1] ?? null,
  };
}

export const isUnlocked = (chapterUnit: string, lastUnit: string | null) =>
  lastUnit != null && UNIT_ORDER.indexOf(chapterUnit) <= UNIT_ORDER.indexOf(lastUnit);
