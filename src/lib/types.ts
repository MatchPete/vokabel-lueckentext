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
  textbook_units: { code: string; kind: UnitKind; sections?: string[] | null; topics?: string | null } | null;
};

export type Textbook = {
  id: string;
  name: string;
  edition: string | null;
  sections?: Section[];
};

export type Section =
  | "check_in"
  | "station_1"
  | "station_2"
  | "station_3"
  | "intro"
  | "part_a"
  | "part_b"
  | "part_c"
  | "text"
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
  intro: "Einstieg",
  part_a: "Part A",
  part_b: "Part B",
  part_c: "Part C",
  text: "Text",
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
  "intro",
  "part_a",
  "part_b",
  "part_c",
  "text",
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

/** Abschnitte, die für eine Unit dieses Buchs angeboten werden (Nebenkapitel: nur "Sonstiges"). */
export function sectionsFor(
  textbookSections: string[] | null | undefined,
  isMainUnit: boolean,
  unitSections?: string[] | null,
): Section[] {
  if (!isMainUnit) return ["other"];
  // Unit-genaue Abschnitte (z. B. nur Part A–B) haben Vorrang vor denen des Buchs
  const source = unitSections && unitSections.length ? unitSections : (textbookSections ?? []);
  const list = source.filter((x): x is Section => (SECTION_ORDER as string[]).includes(x));
  return list.length ? list : SECTION_ORDER;
}
