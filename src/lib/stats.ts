// Kennzahlen und Medaillen. "Gelernt" = an zwei verschiedenen Tagen richtig gewusst.

export type ChildStats = {
  today: string;
  total_words: number;
  learned: number;
  streak: number;
  practiced_today: boolean;
  curve: { day: string; total: number }[];
  activity: { day: string; answers: number; correct: number }[];
};

export type Medal = { at: number; tier: "bronze" | "silver" | "gold" };

export const MEDALS: Medal[] = [
  { at: 10, tier: "bronze" },
  { at: 25, tier: "bronze" },
  { at: 50, tier: "silver" },
  { at: 100, tier: "silver" },
  { at: 150, tier: "gold" },
  { at: 200, tier: "gold" },
  { at: 300, tier: "gold" },
  { at: 500, tier: "gold" },
];

export function medalInfo(learned: number) {
  const earned = MEDALS.filter((m) => learned >= m.at);
  const next = MEDALS.find((m) => learned < m.at) ?? null;
  return { earned, next, toNext: next ? next.at - learned : 0 };
}

/** Tägliche Kurve von der ersten gelernten Vokabel bis heute, Lücken aufgefüllt. */
export function fillCurve(curve: ChildStats["curve"], today: string): { day: string; total: number }[] {
  if (curve.length === 0) return [];
  const out: { day: string; total: number }[] = [];
  const map = new Map(curve.map((c) => [c.day, c.total]));
  let total = 0;
  const d = new Date(curve[0].day + "T12:00:00Z");
  const end = new Date(today + "T12:00:00Z");
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    total = map.get(key) ?? total;
    out.push({ day: key, total });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
