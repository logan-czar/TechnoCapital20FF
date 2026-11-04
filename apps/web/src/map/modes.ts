// The map modes (crates/game/src/map/modes.rs; spec 8 Map row; D700): the mode and every mode's
// remembered parameter, the steppers of the bar's second column, and the key the map refetches
// its layer on (the mode and the versions of the views it reads), so a mode change or a moved
// view rewrites the colors and nothing else does. Pure, tested in node.

import type { CountryId, DevTrack, HqFilter, IndustryId, MapLayersView, MapMode } from "@tc20ff/sim";

/** A mode without its parameter: the bar's first column. */
export type ModeKind = MapMode["kind"];

export const MODE_KINDS: readonly ModeKind[] = [
  "Political",
  "Development",
  "Industry",
  "CompanyHqs",
  "FinancialZones",
];

/** The mode and every mode's remembered parameter, so going back to a mode keeps its track, industry or filters. */
export interface MapModeState {
  mode: MapMode;
  dev: DevTrack;
  industry: IndustryId | null;
  hq: HqFilter;
  /** The Metro outlines over any mode (spec 8). */
  metros: boolean;
}

export const DEFAULT_MODE_STATE: MapModeState = {
  mode: { kind: "Political" },
  dev: "Total",
  industry: null,
  hq: { industry: null, country: null, listed: null },
  metros: false,
};

/** The mode of `kind` with its remembered parameter. */
export function modeOf(s: MapModeState, kind: ModeKind): MapMode {
  switch (kind) {
    case "Political":
      return { kind };
    case "Development":
      return { kind, track: s.dev };
    case "Industry":
      return { kind, industry: s.industry };
    case "CompanyHqs":
      return { kind, filter: s.hq };
    case "FinancialZones":
      return { kind };
  }
}

/** Switches to `mode`, remembering its parameter. */
export function setMode(s: MapModeState, mode: MapMode): MapModeState {
  switch (mode.kind) {
    case "Development":
      return { ...s, mode, dev: mode.track };
    case "Industry":
      return { ...s, mode, industry: mode.industry };
    case "CompanyHqs":
      return { ...s, mode, hq: mode.filter };
    default:
      return { ...s, mode };
  }
}

/** Steps through null then `options` in order, wrapping. */
export function stepIn<T>(cur: T | null, d: number, options: readonly T[]): T | null {
  const n = options.length + 1;
  const i = cur === null ? -1 : options.indexOf(cur);
  const at = i < 0 ? 0 : i + 1;
  const next = (((at + d) % n) + n) % n;
  return next > 0 ? (options[next - 1] as T) : null;
}

/** Steps an optional industry through null (all, or the track) and every one of `n` industries. */
export function stepIndustry(cur: IndustryId | null, d: number, n: number): IndustryId | null {
  return stepIn(
    cur,
    d,
    Array.from({ length: n }, (_, i) => i as IndustryId),
  );
}

/** The countries with an HQ, in ordinal order (the HQ country filter's choices). */
export function hqCountries(v: Pick<MapLayersView, "hqs">): CountryId[] {
  return [...new Set(v.hqs.map((h) => h.country))].sort((a, b) => a - b);
}

/** The next listed filter: all, listed only, private only. */
export function nextListed(l: boolean | null): boolean | null {
  return l === null ? true : l ? false : null;
}

/** The listed filter's button text. */
export function listedLabel(l: boolean | null): string {
  return l === null ? "Listed and private" : l ? "Listed only" : "Private only";
}

/** The mode as a string, for memo keys. */
export function modeKey(m: MapMode): string {
  return JSON.stringify(m);
}
