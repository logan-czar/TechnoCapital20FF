// What colours the counties (pivot 15.3; D1048): one function a layer, each writing RGBA into a
// typed array the map owns (four bytes a county, in county order). The map uploads that array's
// colours again and never its shapes, so election night's waves cost a colour pass, not a
// re-triangulation. Pure functions; the party colours are those of apps/_shared/shared.css.

import type { Party, RaceCountyReturns, UsMapCounties, UsMapLayersView } from "@tc20ff/sim";
import { PARTY_VALUES } from "@tc20ff/sim";
import type { LayerId } from "./route.ts";

export type Rgb = readonly [number, number, number];

/** shared.css `--party-a`, `--party-b`, `--party-none`. */
export const PARTY_A_RGB: Rgb = [0x3f, 0xb6, 0xff];
export const PARTY_B_RGB: Rgb = [0xff, 0x4f, 0x8b];
export const PARTY_NONE_RGB: Rgb = [0xc9, 0xb2, 0x6b];
/** The ground a margin fades to: the app's sheet colour (usmap.css `--um-sheet`). */
export const GROUND_RGB: Rgb = [0x16, 0x1d, 0x2b];
/** A county with nothing to show in this layer. */
export const NO_DATA_RGB: Rgb = [0x2a, 0x30, 0x3c];
/** The sequential ramps' ends: population to highlighter yellow, turnout to bone. */
export const POP_RGB: Rgb = [0xf2, 0xc1, 0x4e];
export const TURNOUT_RGB: Rgb = [0xef, 0xe6, 0xcf];

/** A margin of this many points or more is drawn at the party's full colour. */
export const MARGIN_FULL_PTS = 40;
/** The weakest a margin is drawn (a near tie still shows whose it is). */
export const MARGIN_FLOOR = 0.28;
/** The population ramp: log10 of people at its two ends. */
export const POP_LOG_LO = 3;
export const POP_LOG_HI = 6.7;
/** The turnout ramp's ends (share of all people who vote, pivot 5.1). */
export const TURNOUT_LO = 0.25;
export const TURNOUT_HI = 0.6;
/** Live returns: a county's opacity runs from this (nothing reported) to opaque (all reported). */
export const LIVE_ALPHA_MIN = 46;
/** Counties outside the race shown: dimmed to this opacity. */
export const OUTSIDE_ALPHA = 70;

export function partyRgb(party: Party | null): Rgb {
  if (party === null) return PARTY_NONE_RGB;
  return party === PARTY_VALUES[0] ? PARTY_A_RGB : PARTY_B_RGB;
}

/** `a` to `b` by t in [0, 1]. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.floor(a[0] + (b[0] - a[0]) * k + 0.5),
    Math.floor(a[1] + (b[1] - a[1]) * k + 0.5),
    Math.floor(a[2] + (b[2] - a[2]) * k + 0.5),
  ];
}

/** How strongly a margin of `points` is drawn, MARGIN_FLOOR to 1. */
export function marginStrength(points: number): number {
  const t = Math.min(1, Math.abs(points) / MARGIN_FULL_PTS);
  return MARGIN_FLOOR + (1 - MARGIN_FLOOR) * Math.sqrt(t);
}

/** The colour of a margin toward party A (positive) or B (negative). */
export function marginRgb(points: number): Rgb {
  return mix(GROUND_RGB, points >= 0 ? PARTY_A_RGB : PARTY_B_RGB, marginStrength(points));
}

function put(out: Uint8Array, i: number, c: Rgb, alpha = 255): void {
  out[4 * i] = c[0];
  out[4 * i + 1] = c[1];
  out[4 * i + 2] = c[2];
  out[4 * i + 3] = alpha;
}

/** Every county one colour. */
export function paintAll(out: Uint8Array, count: number, c: Rgb, alpha = 255): void {
  for (let i = 0; i < count; i++) put(out, i, c, alpha);
}

/** The last certified presidential vote: the winner's colour, stronger with the margin. */
export function paintPresident(out: Uint8Array, c: UsMapCounties): void {
  const n = c.fips.length;
  for (let i = 0; i < n; i++) {
    const m = c.last_margin[i] ?? null;
    const w = c.last_winner[i] ?? null;
    if (m === null || w === null) put(out, i, NO_DATA_RGB);
    else put(out, i, mix(GROUND_RGB, partyRgb(w), marginStrength(m)));
  }
}

/** People, on a log scale. */
export function paintPopulation(out: Uint8Array, c: UsMapCounties): void {
  const n = c.fips.length;
  for (let i = 0; i < n; i++) {
    const p = c.population[i] ?? 0;
    const t = p > 0 ? (Math.log10(p) - POP_LOG_LO) / (POP_LOG_HI - POP_LOG_LO) : 0;
    put(out, i, mix(GROUND_RGB, POP_RGB, 0.08 + 0.92 * Math.max(0, Math.min(1, t))));
  }
}

/** The share of people who vote. */
export function paintTurnout(out: Uint8Array, c: UsMapCounties): void {
  const n = c.fips.length;
  for (let i = 0; i < n; i++) {
    const v = c.turnout[i] ?? 0;
    const t = (v - TURNOUT_LO) / (TURNOUT_HI - TURNOUT_LO);
    put(out, i, mix(GROUND_RGB, TURNOUT_RGB, 0.08 + 0.92 * Math.max(0, Math.min(1, t))));
  }
}

/**
 * The true lean (pivot 5.1). Hidden (pivot 5.11): false, and nothing painted, when the view's
 * `lean` is null (the game is not Omniscient).
 */
export function paintLean(out: Uint8Array, c: UsMapCounties): boolean {
  const lean = c.lean;
  if (lean === null) return false;
  for (let i = 0; i < c.fips.length; i++) put(out, i, marginRgb(lean[i] ?? 0));
  return true;
}

/**
 * The House as held: each county in its district's holder's party (`partyOfDistrict`, null for a
 * vacant seat or an independent), odd-numbered districts a shade lighter so neighbours of one party
 * part; counties no district holds have no data.
 */
export function paintDistricts(
  out: Uint8Array,
  district: Int32Array,
  partyOfDistrict: (id: number) => Party | null | undefined,
): void {
  for (let i = 0; i < district.length; i++) {
    const d = district[i] as number;
    if (d < 0) {
      put(out, i, NO_DATA_RGB);
      continue;
    }
    const party = partyOfDistrict(d);
    const base = party === undefined ? NO_DATA_RGB : partyRgb(party);
    put(out, i, mix(GROUND_RGB, base, d % 2 === 1 ? 0.85 : 0.62));
  }
}

/** One county's count in a race: votes in ballot order and the share reported. */
export interface CountyCount {
  votes: number[];
  reporting: number;
}

/**
 * A race's count by county (the v_returns `counties` slice), indexed by county; a county listed
 * twice (two pieces in one race) is summed, its reporting the weighted mean.
 */
export function countsByCounty(slice: RaceCountyReturns, count: number): (CountyCount | null)[] {
  const out: (CountyCount | null)[] = new Array(count).fill(null);
  slice.counties.forEach((cid, k) => {
    const c = cid as number;
    if (c < 0 || c >= count) return;
    const votes = slice.votes[k] ?? [];
    const rep = slice.reporting[k] ?? 0;
    const had = out[c];
    if (had === null || had === undefined) {
      out[c] = { votes: votes.slice(), reporting: rep };
      return;
    }
    const a = had.votes.reduce((s, v) => s + v, 0);
    const b = votes.reduce((s, v) => s + v, 0);
    had.votes = had.votes.map((v, j) => v + (votes[j] ?? 0));
    had.reporting = a + b > 0 ? (had.reporting * a + rep * b) / (a + b) : Math.max(had.reporting, rep);
  });
  return out;
}

/** Who leads a count and by how much: ballot index and margin in points of the votes counted. */
export function leaderOf(votes: readonly number[]): { lead: number; margin: number; total: number } | null {
  let total = 0;
  let lead = -1;
  let second = -1;
  votes.forEach((v, k) => {
    total += v;
    if (lead < 0 || v > (votes[lead] as number)) {
      second = lead;
      lead = k;
    } else if (second < 0 || v > (votes[second] as number)) second = k;
  });
  if (lead < 0 || total <= 0) return null;
  const gap = (votes[lead] as number) - (second < 0 ? 0 : (votes[second] as number));
  return { lead, margin: (gap / total) * 100, total };
}

/**
 * Live returns (pivot 9.2): each county in its leader's party colour, stronger with the lead, and
 * as opaque as the share of it reported; a county with nothing in yet is a faint ground, and
 * counties outside the race are dimmed.
 */
export function paintLive(
  out: Uint8Array,
  count: number,
  counts: readonly (CountyCount | null)[],
  ballotParty: readonly (Party | null)[],
): void {
  for (let i = 0; i < count; i++) {
    const c = counts[i];
    if (c === null || c === undefined) {
      put(out, i, NO_DATA_RGB, OUTSIDE_ALPHA);
      continue;
    }
    const l = leaderOf(c.votes);
    if (l === null) {
      put(out, i, NO_DATA_RGB, LIVE_ALPHA_MIN);
      continue;
    }
    const colour = mix(GROUND_RGB, partyRgb(ballotParty[l.lead] ?? null), marginStrength(l.margin));
    const a = LIVE_ALPHA_MIN + (255 - LIVE_ALPHA_MIN) * Math.max(0, Math.min(1, c.reporting));
    put(out, i, colour, Math.floor(a + 0.5));
  }
}

/** The layers the switcher offers: the true lean only when the view carries it (pivot 5.11). */
export function layerChoices(view: UsMapLayersView | undefined): LayerId[] {
  const out: LayerId[] = ["president", "population", "turnout", "districts", "live"];
  if (view?.counties.lean != null) out.splice(4, 0, "lean");
  return out;
}

export const LAYER_NAMES: Readonly<Record<LayerId, string>> = {
  president: "Last presidential",
  population: "Population",
  turnout: "Turnout",
  districts: "House seats",
  lean: "True lean",
  live: "Live returns",
};

/** Whole numbers with thin grouping commas, no locale: "1,234,567". */
export function formatInt(n: number): string {
  const s = String(Math.floor(Math.abs(n)));
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}
