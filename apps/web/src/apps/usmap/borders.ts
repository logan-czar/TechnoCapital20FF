// Borders as filters over the map's edges (pivot 5.4; D1048): a district border is an edge between
// two counties of one state whose districts differ, a state border one between two states (or the
// coast), a selection's outline one with the selection on exactly one side. The district of a
// county is the district holding its largest share in the plan in force (v_districts), so the
// borders follow the plan and are derived again only when the plan moves.

import type { DistrictsView } from "@tc20ff/sim";
import type { Edge, XY } from "./geometry.ts";

/** One district's share of a county (pivot 5.4), as the hover card and the panel list it. */
export interface CountyPiece {
  /** `districtRefId(state, number)`. */
  district: number;
  /** The share of the county's people, 0 to 1. */
  share: number;
}

/** Where each county sits in a plan. */
export interface PlanIndex {
  /** Per county: the ref id of the district holding its largest share; -1 for none. */
  district: Int32Array;
  /** Per county: its pieces, largest first; empty for a county no district holds. */
  pieces: CountyPiece[][];
  /** Counties split between two or more districts, in county order. */
  split: number[];
  /** Per district ref id: its counties (whole or in part), in county order. */
  counties: Map<number, number[]>;
}

/**
 * Indexes a plan: each county's district by its largest share (ties to the lower district id) and
 * its pieces. `count` is the county table's length.
 */
export function planIndex(view: DistrictsView | undefined, count: number): PlanIndex {
  const pieces: CountyPiece[][] = Array.from({ length: count }, () => []);
  const counties = new Map<number, number[]>();
  for (const d of view?.districts ?? []) {
    const mine: number[] = [];
    for (const s of d.shares) {
      const c = s.county as number;
      if (c < 0 || c >= count) continue;
      const list = pieces[c] as CountyPiece[];
      const had = list.find((p) => p.district === d.id);
      if (had) had.share += s.to - s.from;
      else list.push({ district: d.id, share: s.to - s.from });
      if (mine[mine.length - 1] !== c) mine.push(c);
    }
    counties.set(d.id, mine);
  }
  const district = new Int32Array(count).fill(-1);
  const split: number[] = [];
  pieces.forEach((list, c) => {
    list.sort((x, y) => y.share - x.share || x.district - y.district);
    if (list.length > 0) district[c] = (list[0] as CountyPiece).district;
    if (list.length > 1) split.push(c);
  });
  return { district, pieces, split, counties };
}

/**
 * The edges between two counties whose keys differ, both keys known (>= 0): with keys by district
 * and `sameState`, the district borders of a plan.
 */
export function bordersBetween(
  edges: readonly Edge[],
  key: ArrayLike<number>,
  sameState?: (a: number, b: number) => boolean,
): XY[][] {
  const out: XY[][] = [];
  for (const e of edges) {
    if (e.b < 0) continue;
    const ka = key[e.a] as number;
    const kb = key[e.b] as number;
    if (ka < 0 || kb < 0 || ka === kb) continue;
    if (sameState !== undefined && !sameState(e.a, e.b)) continue;
    out.push(e.path);
  }
  return out;
}

/** The edges with counties of two different states on their sides, and every edge to the outside. */
export function stateBorders(edges: readonly Edge[], state: ArrayLike<number>): XY[][] {
  return edges.filter((e) => e.b < 0 || state[e.a] !== state[e.b]).map((e) => e.path);
}

/** A set of counties' outline: the edges with the set on exactly one side. */
export function outlineOf(edges: readonly Edge[], inSet: (county: number) => boolean): XY[][] {
  const out: XY[][] = [];
  for (const e of edges) {
    const a = inSet(e.a);
    const b = e.b >= 0 && inSet(e.b);
    if (a !== b) out.push(e.path);
  }
  return out;
}
