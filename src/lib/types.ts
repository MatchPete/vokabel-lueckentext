// Von Hand gepflegte Typen für die Tabellen, die die App nutzt.

export type Child = {
  id: string;
  nickname: string;
  textbook_id: string | null;
  current_unit_id: string | null;
  created_at: string;
};

export type UnitKind = "pick_up" | "unit" | "across_cultures" | "focus";

export type Unit = {
  id: string;
  child_id: string;
  textbook_unit_id: string | null;
  title: string;
  sort_order: number;
  textbook_units: { code: string; kind: UnitKind } | null;
};

export type Textbook = {
  id: string;
  name: string;
  edition: string | null;
};

export type Section =
  | "check_in"
  | "station_1"
  | "station_2"
  | "station_3"
  | "story"
  | "skills"
  | "unit_task"
  | "other";

export type Vocab = {
  id: string;
  unit_id: string;
  section: Section;
  en: string;
  de: string;
  created_at: string;
};

export const SECTION_LABELS: Record<Section, string> = {
  check_in: "Check-in",
  station_1: "Station 1",
  station_2: "Station 2",
  station_3: "Station 3",
  story: "Story",
  skills: "Skills",
  unit_task: "Unit task",
  other: "Sonstiges",
};

export const SECTION_ORDER: Section[] = [
  "check_in",
  "station_1",
  "station_2",
  "station_3",
  "story",
  "skills",
  "unit_task",
  "other",
];

// "PUA" -> "PU A", "AC1" -> "AC 1", "F1" -> "F 1", "U3" -> "U3"
export function unitTag(code: string | undefined): string {
  if (!code) return "";
  return code.replace(/^PU(?=[A-Z])/, "PU ").replace(/^AC(?=\d)/, "AC ").replace(/^F(?=\d)/, "F ");
}
