// Einstellungen pro Kinderprofil (gespeichert in children.settings).
import type { TextType } from "./exercise";

export type HintMode = "never" | "tap" | "always";
export type LevelSetting = "auto" | 1 | 2 | 3;
export type Direction = "de_en" | "en_de" | "mixed";

export type Settings = {
  gapHint: HintMode;
  level: LevelSetting;
  textTypes: TextType[];
  direction: Direction;
  roundSize: 10 | 20 | 30;
  newPerRound: 5 | 8 | 12;
  caseSensitive: boolean;
  typoCountsCorrect: boolean;
  showOverride: boolean;
  requireCopy: boolean;
};

export const ALL_TEXT_TYPES: TextType[] = ["story", "dialogue", "email", "postcard", "voice_message"];

export const DEFAULT_SETTINGS: Settings = {
  gapHint: "never",
  level: "auto",
  textTypes: ALL_TEXT_TYPES,
  direction: "de_en",
  roundSize: 20,
  newPerRound: 8,
  caseSensitive: false,
  typoCountsCorrect: false,
  showOverride: true,
  requireCopy: true,
};

const oneOf = <T,>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Gespeicherte (evtl. unvollständige oder alte) Einstellungen mit Standardwerten auffüllen. */
export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const types = Array.isArray(r.textTypes) ? ALL_TEXT_TYPES.filter((t) => (r.textTypes as unknown[]).includes(t)) : d.textTypes;
  return {
    gapHint: oneOf(r.gapHint, ["never", "tap", "always"] as const, d.gapHint),
    level: oneOf(r.level, ["auto", 1, 2, 3] as const, d.level),
    textTypes: types.length > 0 ? types : d.textTypes,
    direction: oneOf(r.direction, ["de_en", "en_de", "mixed"] as const, d.direction),
    roundSize: oneOf(r.roundSize, [10, 20, 30] as const, d.roundSize),
    newPerRound: oneOf(r.newPerRound, [5, 8, 12] as const, d.newPerRound),
    caseSensitive: bool(r.caseSensitive, d.caseSensitive),
    typoCountsCorrect: bool(r.typoCountsCorrect, d.typoCountsCorrect),
    showOverride: bool(r.showOverride, d.showOverride),
    requireCopy: bool(r.requireCopy, d.requireCopy),
  };
}
