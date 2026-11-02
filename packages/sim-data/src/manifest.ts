// A starting world's manifest (1995-rework 3.2): what differs between the worlds beyond their CSVs.
// The 2020 world has no file; its manifest is `MANIFEST_2020`, so docs/design/data does not change.
// A later world keeps its CSVs and a `manifest.json` in `assets/worlds/<id>/`.

import { type DataError, dataErrorFile, err, ok, type Result } from "./error.ts";

/** The manifest's file name in a world's folder. */
export const MANIFEST_FILE = "manifest.json";

/** The worlds in this repository other than the 2020 world, each a folder of `assets/worlds`. */
export const WORLD_IDS: readonly string[] = ["1995"];

/** A calendar date in a manifest (the sim's `SimDate`). */
export interface ManifestDate {
  year: number;
  month: number;
  day: number;
}

/** Which of the 2020 world's scripted parts a world plays. */
export interface WorldFeatures {
  /** Plays a scenario and keeps a long history (1995-rework 3.3). */
  era: boolean;
  /** The scripted AI boom and pop (spec 5.1.1). */
  ai_boom: boolean;
  /** The fixed startup events F1 to F9 (spec 5.19.2). */
  fixed_events: boolean;
  /** CO-0001 is Arrowhead, with its own starting loadout (spec 7.1). */
  arrowhead: boolean;
}

export interface WorldManifest {
  id: string;
  /** The first day of the game (1995-rework 2.1). */
  start_date: ManifestDate;
  /** When a run ends and shows its scenario (1995-rework 8.3); null for a world with no end. */
  reveal_date: ManifestDate | null;
  /** Expected row counts by table name (`worldDataCounts`). */
  expected_counts: readonly (readonly [string, number])[];
  /** The policy rate and neutral rate at the start (1995-rework 6.2). */
  base_rate: number;
  neutral_rate: number;
  /** The 10-year yield's term over the policy rate, in an era world (1995-rework 6.2). */
  y10_term: number;
  /** The US cabinet's seats in politics-usa-offices.csv. */
  cabinet_seats: number;
  features: WorldFeatures;
}

/** Expected row counts of the 2020 world (spec 10 M0, build-plan M0.2). */
export const EXPECTED_COUNTS: readonly (readonly [string, number])[] = [
  ["countries", 211],
  ["provinces", 3963],
  ["companies", 651],
  ["characters", 296],
  ["industries", 42],
  ["country-economy", 211],
  ["financial-zones", 26],
  ["ai-boom", 15],
  ["key-cities", 88],
  ["company-start", 651],
  ["startup-events", 9],
  ["politics-usa", 51],
  ["politics-usa-offices", 31],
];

/** The 2020 world (D983: 15 departments). */
export const MANIFEST_2020: WorldManifest = {
  id: "2020",
  start_date: { year: 2020, month: 1, day: 1 },
  reveal_date: null,
  expected_counts: EXPECTED_COUNTS,
  base_rate: 0.03,
  neutral_rate: 0.03,
  y10_term: 0.005,
  cabinet_seats: 15,
  features: { era: false, ai_boom: true, fixed_events: true, arrowhead: true },
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The `manifest.json` of a world, or the error naming what is wrong with it. */
export function parseManifest(text: string): Result<WorldManifest, DataError> {
  const bad = (what: string): Result<WorldManifest, DataError> => err(dataErrorFile(MANIFEST_FILE, what));
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    return bad(e instanceof Error ? e.message : String(e));
  }
  if (typeof v !== "object" || v === null) return bad("not an object");
  const m = v as Record<string, unknown>;
  if (typeof m.id !== "string" || m.id === "") return bad("id: not a name");
  const date = typeof m.start_date === "string" ? ISO_DATE.exec(m.start_date) : null;
  if (date === null) return bad("start_date: not YYYY-MM-DD");
  const reveal = typeof m.reveal_date === "string" ? ISO_DATE.exec(m.reveal_date) : null;
  if (m.reveal_date !== undefined && reveal === null) return bad("reveal_date: not YYYY-MM-DD");
  if (typeof m.cabinet_seats !== "number") return bad("cabinet_seats: not a number");
  for (const k of ["base_rate", "neutral_rate", "y10_term"]) {
    if (typeof m[k] !== "number") return bad(`${k}: not a number`);
  }
  const counts = m.expected_counts;
  if (typeof counts !== "object" || counts === null) return bad("expected_counts: not an object");
  const pairs = Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [name, n] of pairs) {
    if (typeof n !== "number") return bad(`expected_counts.${name}: not a number`);
  }
  const f = m.features as Record<string, unknown> | null | undefined;
  if (
    typeof f?.era !== "boolean" ||
    typeof f.ai_boom !== "boolean" ||
    typeof f.fixed_events !== "boolean" ||
    typeof f.arrowhead !== "boolean"
  ) {
    return bad("features: needs era, ai_boom, fixed_events and arrowhead as booleans");
  }
  return ok({
    id: m.id,
    start_date: { year: Number(date[1]), month: Number(date[2]), day: Number(date[3]) },
    reveal_date:
      reveal === null ? null : { year: Number(reveal[1]), month: Number(reveal[2]), day: Number(reveal[3]) },
    expected_counts: pairs as [string, number][],
    base_rate: m.base_rate as number,
    neutral_rate: m.neutral_rate as number,
    y10_term: m.y10_term as number,
    cabinet_seats: m.cabinet_seats,
    features: { era: f.era, ai_boom: f.ai_boom, fixed_events: f.fixed_events, arrowhead: f.arrowhead },
  });
}
