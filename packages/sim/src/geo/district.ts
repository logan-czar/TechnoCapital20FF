// Drawing one state's House districts from its counties (pivot 5.4, 5.5; D1028, D1039): the
// recursive bisection of tools/spikes/districts/README.md section 3, ported from its districts.py,
// with the county `spread` of D1028. A region holds each of its counties as one interval `[from,
// to]` of that county's people ordered from most party-A to most party-B; a cut that falls inside a
// county gives one side the A end of that county's interval and the other the B end, and which side
// gets which end is a choice the partisan drawer makes (both are scored).
//
// Deterministic: no random numbers but the one angle `theta0` the caller passes; every choice is a
// sort with the county's place as the last key; arrays only, in county order.

import { cosF, expF, sinF } from "../types/libm.ts";
import { maxF } from "../types/num.ts";

/** sd of a district's margin around its lean, in points: P(win) = Φ(lean / σ) (pivot 5.5, T; spike `SIGMA_PTS`). */
export const SEAT_SIGMA_PTS = 8.0;
/** Sweep directions over half a turn; each is swept from both ends (pivot 5.4, T; spike `N_ANGLES`). */
export const SWEEP_ANGLES = 8;
/** Expected seats one unit of a cut's compactness cost is worth at s = 0.5 (pivot 5.5, T; spike `KAPPA`). */
export const CUT_KAPPA = 1.0;
/** The weight compactness keeps at s = 1, as the tie-break (pivot 5.5, T; spike `TIE_COMPACT`). */
export const TIE_COMPACT = 0.01;
/** Relative float slack on people when cutting (spike `EPS`). */
const PEOPLE_EPS = 1e-9;
/** Cuts finished greedily before one is kept, partisan maps only (pivot 5.5, T; spike `ROLLOUTS`). */
export const ROLLOUTS = 4;
/** Cuts a region tries before it reports it cannot be finished contiguously (pivot 5.4, T; spike `BACKTRACK_TRIES`). */
export const BACKTRACK_TRIES = 6;
/** Expected seats one unit of a whole plan's sprawl is worth at s = 0.5 (pivot 5.5, T; spike `PLAN_KAPPA`). */
export const PLAN_KAPPA = 1.0;
/**
 * The slices a county interval with a spread is cut into when the drawer's optimistic bound sorts
 * people by lean (pivot 5.4, T): the interval's lean runs in a line, so a few slices stand for it.
 */
export const VALUE_SLICES = 4;
/** Points of lean: a vote share of 1 is 100 points. */
const LEAN_FULL_PTS = 100.0;

/** One state's counties as the drawer sees them: local places 0..n−1 in county id order. */
export interface StateGraph {
  /** Each local place's index in `GeoState.counties`. */
  ids: number[];
  pop: number[];
  lean: number[];
  spread: number[];
  x: number[];
  y: number[];
  /** In-state neighbours, local places, sorted. */
  nbr: number[][];
}

/** A county's part of a region: the interval `[from, to]` of its people (pivot 5.4). */
export interface Piece {
  i: number;
  from: number;
  to: number;
}

/** A region: at most one piece per county, sorted by `i`. */
export type Region = Piece[];

/** Work counters, for the measurements (README "Measured results"). */
export interface DrawStats {
  sweeps: number;
  backtracks: number;
  forced: number;
  kept_weaker: number;
}

/** Φ, the standard normal distribution (Abramowitz and Stegun 7.1.26 for erf, error below 1.5e-7). */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + 0.3275911 * x);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1.0 - poly * expF(-x * x);
  return z >= 0.0 ? 0.5 * (1.0 + erf) : 0.5 * (1.0 - erf);
}

/** People in a piece. */
function people(g: StateGraph, p: Piece): number {
  return (p.to - p.from) * (g.pop[p.i] as number);
}

/** The mean lean of a piece's people (pivot 5.4): `lean + spread × (1 − from − to)`. */
export function pieceLean(g: StateGraph, p: Piece): number {
  return (g.lean[p.i] as number) + (g.spread[p.i] as number) * (1.0 - p.from - p.to);
}

function regionPeople(g: StateGraph, r: Region): number {
  let s = 0.0;
  for (const p of r) s += people(g, p);
  return s;
}

/** A region's people-weighted mean lean (pivot 5.4). */
export function regionLean(g: StateGraph, r: Region): number {
  let w = 0.0;
  let l = 0.0;
  for (const p of r) {
    const a = people(g, p);
    w += a;
    l += a * pieceLean(g, p);
  }
  return w > 0.0 ? l / w : 0.0;
}

/** People-weighted second moment of the centroids about the region's own centre (lower is more compact). */
export function inertia(g: StateGraph, r: Region): number {
  let w = 0.0;
  let sx = 0.0;
  let sy = 0.0;
  let sq = 0.0;
  for (const p of r) {
    const a = people(g, p);
    const x = g.x[p.i] as number;
    const y = g.y[p.i] as number;
    w += a;
    sx += a * x;
    sy += a * y;
    sq += a * (x * x + y * y);
  }
  return w > 0.0 ? maxF(sq - (sx * sx + sy * sy) / w, 0.0) : 0.0;
}

function signature(r: Region, k: number): string {
  let s = `${k}|`;
  for (const p of r) s += `${p.i}:${p.from}:${p.to},`;
  return s;
}

/**
 * Marks reused by the searches of one map: a mark is "set" when it equals the current generation,
 * so clearing is a counter step. One per `drawPlan`; nothing in it outlives a call.
 */
interface Scratch {
  mark: Int32Array;
  mark2: Int32Array;
  gen: number;
  stack: Int32Array;
}

function scratchNew(n: number): Scratch {
  return { mark: new Int32Array(n), mark2: new Int32Array(n), gen: 0, stack: new Int32Array(n + 1) };
}

/** The connected pieces of `inSet` (a mark per place) without `skip`, each in breadth-first order. */
function components(g: StateGraph, inSet: Uint8Array, places: readonly number[], skip: number): number[][] {
  const seen = new Uint8Array(inSet.length);
  const out: number[][] = [];
  for (const start of places) {
    if (start === skip || seen[start] || !inSet[start]) continue;
    const comp = [start];
    seen[start] = 1;
    for (let q = 0; q < comp.length; q++) {
      for (const m of g.nbr[comp[q] as number] as number[]) {
        if (m !== skip && inSet[m] && !seen[m]) {
          seen[m] = 1;
          comp.push(m);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Is the set minus `v` connected? A cheap local test first, then a full search (spike `connected_without`). */
function connectedWithout(g: StateGraph, inSet: Uint8Array, size: number, v: number, sc: Scratch): boolean {
  if (size <= 2) return true;
  const ring = ++sc.gen;
  let around = 0;
  let first = -1;
  for (const m of g.nbr[v] as number[]) {
    if (inSet[m]) {
      sc.mark[m] = ring;
      around++;
      if (first < 0) first = m;
    }
  }
  if (around === 0) return false;
  // Local: v's neighbours in the set reach each other through each other.
  let seenGen = ++sc.gen;
  sc.mark2[first] = seenGen;
  let seen = 1;
  let top = 0;
  sc.stack[top++] = first;
  while (top > 0) {
    const u = sc.stack[--top] as number;
    for (const m of g.nbr[u] as number[]) {
      if (sc.mark[m] === ring && sc.mark2[m] !== seenGen) {
        sc.mark2[m] = seenGen;
        seen++;
        sc.stack[top++] = m;
      }
    }
  }
  if (seen === around) return true;
  seenGen = ++sc.gen;
  sc.mark2[first] = seenGen;
  let count = 1;
  top = 0;
  sc.stack[top++] = first;
  while (top > 0) {
    const u = sc.stack[--top] as number;
    for (const m of g.nbr[u] as number[]) {
      if (m !== v && inSet[m] && sc.mark2[m] !== seenGen) {
        sc.mark2[m] = seenGen;
        count++;
        sc.stack[top++] = m;
      }
    }
  }
  return count === size - 1;
}

interface Swept {
  order: number[];
  /** settled[j]: the rest was connected before step j; settled[order.length] is true. */
  settled: boolean[];
}

/**
 * Orders a region's counties by growing from the lowest key (spike `sweep`): each step takes the
 * lowest-key county touching what is taken whose removal leaves the rest connected; if none
 * qualifies, the lowest-key one and then, forced, everything that step cut off from the largest rest.
 */
function sweep(
  g: StateGraph,
  r: Region,
  amt: Float64Array,
  key: readonly number[],
  stats: DrawStats,
  sc: Scratch,
): Swept {
  stats.sweeps++;
  const n = g.pop.length;
  const inRest = new Uint8Array(n);
  const inFront = new Uint8Array(n);
  const places = r.map((p) => p.i);
  for (const i of places) inRest[i] = 1;
  let size = places.length;
  const byKey = (a: number, b: number): number => (key[a] as number) - (key[b] as number) || a - b;
  const lowest = (list: readonly number[]): number => {
    let best = -1;
    for (const i of list) if (inRest[i] && (best < 0 || byKey(i, best) < 0)) best = i;
    return best;
  };
  // The frontier is kept in key order, so the choices are read off it.
  const frontier: number[] = [];
  const insert = (m: number): void => {
    let lo = 0;
    let hi = frontier.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (byKey(frontier[mid] as number, m) < 0) lo = mid + 1;
      else hi = mid;
    }
    frontier.splice(lo, 0, m);
  };
  const order: number[] = [];
  const settled: boolean[] = [];
  const pending: number[] = [];
  let pendingAt = 0;
  while (size > 0) {
    settled.push(pendingAt >= pending.length);
    let v = -1;
    if (pendingAt < pending.length) {
      v = pending[pendingAt++] as number;
    } else {
      const choices = order.length === 0 || frontier.length === 0 ? [lowest(places)] : frontier;
      for (const c of choices) {
        if (connectedWithout(g, inRest, size, c, sc)) {
          v = c;
          break;
        }
      }
      if (v < 0) {
        v = choices[0] as number;
        const comps = components(g, inRest, places, v);
        const weight = comps.map((c) => c.reduce((s, i) => s + (amt[i] as number), 0.0));
        const rank = comps.map((_, j) => j);
        rank.sort(
          (a, b) =>
            (weight[b] as number) - (weight[a] as number) ||
            Math.min(...(comps[a] as number[])) - Math.min(...(comps[b] as number[])),
        );
        for (const j of rank.slice(1)) {
          const members = new Uint8Array(n);
          for (const m of comps[j] as number[]) members[m] = 1;
          const queue = (g.nbr[v] as number[]).filter((m) => members[m]);
          const seen = new Uint8Array(n);
          for (const m of queue) seen[m] = 1;
          for (let q = 0; q < queue.length; q++) {
            for (const m of g.nbr[queue[q] as number] as number[]) {
              if (members[m] && !seen[m]) {
                seen[m] = 1;
                queue.push(m);
              }
            }
          }
          for (const m of queue) pending.push(m);
        }
      }
    }
    inRest[v] = 0;
    size--;
    if (inFront[v]) {
      inFront[v] = 0;
      frontier.splice(frontier.indexOf(v), 1);
    }
    order.push(v);
    for (const m of g.nbr[v] as number[]) {
      if (inRest[m] && !inFront[m]) {
        inFront[m] = 1;
        insert(m);
      }
    }
  }
  settled.push(true);
  return { order, settled };
}

/** Which end of a split county's interval the first side of a cut takes (pivot 5.4, D1028). */
type End = "A" | "B";

/** A cut as found, before a strength scores it: the same for every strength above 0. */
interface RawCut {
  a: Region;
  b: Region;
  k1: number;
  ok: boolean;
  /** The share of the region's spread left inside the sides (lower is more compact). */
  cost: number;
  /** The drawer's optimistic seats from both sides (0 for the neutral map). */
  value: number;
}

/** Cuts found per region and seat count, shared by the maps of one drawer at strengths above 0. */
export type CutMemo = Map<string, RawCut[]>;

interface Cut extends RawCut {
  score: number;
}

interface CutSides {
  a: Region;
  b: Region;
  ok: boolean;
  /** The county split between the sides, or −1. */
  split: number;
  /** Whether that county has a spread, so the other end is a different cut. */
  splitSpread: boolean;
}

/**
 * Splits the swept region so the first side holds `k1 / k` of the people (spike `cut`). The county
 * the target falls inside is split; the first side takes its interval's A end or B end by `end`.
 * `pieceAt` is the region's piece by county; both sides keep county order.
 */
function cutAt(
  g: StateGraph,
  r: Region,
  pieceAt: readonly (Piece | undefined)[],
  amt: Float64Array,
  total: number,
  sw: Swept,
  k1: number,
  k: number,
  end: End,
  sc: Scratch,
): CutSides {
  const target = (total * k1) / k;
  const slack = PEOPLE_EPS * total;
  const { order, settled } = sw;
  let s = 0.0;
  for (let j = 0; j < order.length; j++) {
    const v = order[j] as number;
    const here = amt[v] as number;
    if (s + here < target - slack && j < order.length - 1) {
      s += here;
      continue;
    }
    const before = target - s;
    const after = s + here - target;
    const side = ++sc.gen;
    const a: Piece[] = [];
    const b: Piece[] = [];
    if (after <= slack && j < order.length - 1) {
      for (let t = 0; t <= j; t++) sc.mark[order[t] as number] = side;
      for (const p of r) (sc.mark[p.i] === side ? a : b).push(p);
      return { a, b, ok: settled[j + 1] as boolean, split: -1, splitSpread: false };
    }
    const p = pieceAt[v] as Piece;
    const w = p.to - p.from;
    const qa = (w * before) / here;
    let pa: Piece;
    let pb: Piece;
    if (end === "A") {
      const at = p.from + qa;
      pa = { i: v, from: p.from, to: at };
      pb = { i: v, from: at, to: p.to };
    } else {
      const at = p.to - qa;
      pa = { i: v, from: at, to: p.to };
      pb = { i: v, from: p.from, to: at };
    }
    for (let t = 0; t < j; t++) sc.mark[order[t] as number] = side;
    for (const q of r) {
      if (q.i === v) {
        a.push(pa);
        b.push(pb);
      } else (sc.mark[q.i] === side ? a : b).push(q);
    }
    return { a, b, ok: settled[j] as boolean, split: v, splitSpread: (g.spread[v] as number) > 0.0 };
  }
  throw new Error("cutAt: target beyond the region");
}

/** People as lean slices, in key order: from most hostile to the drawer to most friendly. */
interface Slices {
  cty: number[];
  amt: number[];
  /** `sign × lean`: the sort key. */
  key: number[];
}

/** The slices of one piece: `VALUE_SLICES` of them for a county with a spread, else one. */
function pieceSlices(g: StateGraph, p: Piece, sign: number, out: Slices): void {
  const sp = g.spread[p.i] as number;
  const slices = sp > 0.0 ? VALUE_SLICES : 1;
  const w = (p.to - p.from) / slices;
  const each = w * (g.pop[p.i] as number);
  for (let j = 0; j < slices; j++) {
    const f = p.from + j * w;
    out.cty.push(p.i);
    out.amt.push(each);
    out.key.push(sign * ((g.lean[p.i] as number) + sp * (1.0 - f - (f + w))));
  }
}

/** Slices sorted by key, ties by the order they were made in. */
function sortSlices(raw: Slices): Slices {
  const idx = raw.key.map((_, j) => j);
  idx.sort((a, b) => (raw.key[a] as number) - (raw.key[b] as number) || a - b);
  return {
    cty: idx.map((j) => raw.cty[j] as number),
    amt: idx.map((j) => raw.amt[j] as number),
    key: idx.map((j) => raw.key[j] as number),
  };
}

/** A region's slices in key order (ties by county, then by place in the county). */
function regionSlices(g: StateGraph, r: Region, sign: number): Slices {
  const raw: Slices = { cty: [], amt: [], key: [] };
  for (const p of r) pieceSlices(g, p, sign, raw);
  return sortSlices(raw);
}

/**
 * The optimistic seats the drawer (`sign` +1 party A, −1 party B) can win from one side of a cut,
 * of `k` seats, ignoring geography (spike `value`): its people from most hostile to most friendly,
 * cut into `k` equal slices; the most hostile `k − w` packed one seat each and the rest pooled over
 * `w` seats, the best `w` kept. A county interval with a spread is taken as `VALUE_SLICES` slices.
 * `whole` is the cut region's slices: the side's are read off it in order, merged with the slices of
 * the side's own piece of the split county.
 */
function sideValue(
  g: StateGraph,
  whole: Slices,
  side: Region,
  split: number,
  k: number,
  sign: number,
  sc: Scratch,
): number {
  const tag = ++sc.gen;
  let total = 0.0;
  const raw: Slices = { cty: [], amt: [], key: [] };
  for (const p of side) {
    sc.mark[p.i] = tag;
    total += people(g, p);
    if (p.i === split) pieceSlices(g, p, sign, raw);
  }
  const extra = sortSlices(raw);
  const step = total / k;
  const cumL: number[] = [0.0];
  let s = 0.0;
  let l = 0.0;
  let nxt = 1;
  const take = (a: number, key: number): void => {
    const lj = sign * key;
    while (nxt < k && s + a >= step * nxt) {
      cumL.push(l + (step * nxt - s) * lj);
      nxt++;
    }
    s += a;
    l += a * lj;
  };
  let e = 0;
  const n = whole.cty.length;
  for (let j = 0; j < n; j++) {
    const c = whole.cty[j] as number;
    if (c === split || sc.mark[c] !== tag) continue;
    const kj = whole.key[j] as number;
    while (e < extra.key.length && (extra.key[e] as number) < kj) {
      take(extra.amt[e] as number, extra.key[e] as number);
      e++;
    }
    take(whole.amt[j] as number, kj);
  }
  for (; e < extra.key.length; e++) take(extra.amt[e] as number, extra.key[e] as number);
  while (cumL.length < k) cumL.push(l);
  cumL.push(l);
  let best = -1.0;
  let packed = 0.0;
  for (let lost = 0; lost <= k; lost++) {
    const w = k - lost;
    let v = packed;
    if (w > 0) {
      const rest = total - step * lost;
      const mean = rest > 0.0 ? (l - (cumL[lost] as number)) / rest : 0.0;
      v += w * phi((sign * mean) / SEAT_SIGMA_PTS);
    }
    if (v > best) best = v;
    if (lost < k) {
      const m = ((cumL[lost + 1] as number) - (cumL[lost] as number)) / step;
      packed += phi((sign * m) / SEAT_SIGMA_PTS);
    }
  }
  return best;
}

/** Districts as regions, in the order drawn (that order numbers them). */
export type Plan = Region[];

/**
 * A state's districts (pivot 5.4, 5.5; spike `draw`): `seats` regions of equal people, contiguous
 * when the search finds a way (it always has on the real counties; `stats.forced` counts the cases
 * it did not). `s` is the strength 0..1, `sign` the drawer (+1 party A, −1 party B; ignored at 0),
 * `theta0` the angle the sweep fan starts at (one Governing draw per map).
 */
export function drawPlan(
  g: StateGraph,
  seats: number,
  s: number,
  sign: number,
  theta0: number,
  stats: DrawStats,
  guard = true,
  memo: CutMemo = new Map(),
): Plan {
  const n = g.pop.length;
  const geoKeys: number[][] = [];
  for (let j = 0; j < SWEEP_ANGLES; j++) {
    const t = theta0 + (j * Math.PI) / SWEEP_ANGLES;
    const c = cosF(t);
    const sn = sinF(t);
    const proj = g.x.map((x, i) => x * c + (g.y[i] as number) * sn);
    geoKeys.push(proj);
    geoKeys.push(proj.map((p) => -p));
  }
  const keysFor = (r: Region): number[][] => {
    if (s <= 0.0) return geoKeys;
    // pivot 5.5: the partisan sweeps, hostile first, friendly first, and rings round the hostile centre.
    const lean = new Array<number>(n).fill(0.0);
    let w = 0.0;
    let cx = 0.0;
    let cy = 0.0;
    for (const p of r) {
      const l = sign * pieceLean(g, p);
      lean[p.i] = l;
      const hostile =
        people(g, p) * Math.min(Math.max((LEAN_FULL_PTS - l) / (2.0 * LEAN_FULL_PTS), 0.0), 1.0);
      w += hostile;
      cx += hostile * (g.x[p.i] as number);
      cy += hostile * (g.y[p.i] as number);
    }
    let ring = new Array<number>(n).fill(0.0);
    if (w > 0.0) {
      cx /= w;
      cy /= w;
      ring = g.x.map((x, i) => (x - cx) * (x - cx) + ((g.y[i] as number) - cy) * ((g.y[i] as number) - cy));
    }
    return [...geoKeys, lean, lean.map((v) => -v), ring];
  };

  const sc = scratchNew(n);
  const cache = new Map<string, Cut[]>();
  const done = new Map<string, Plan | null>();
  const wCompact = maxF(1.0 - s, TIE_COMPACT);

  /** Every distinct cut of a region (spike `candidates`), unscored; memoised in `memo`. */
  const rawCuts = (r: Region, k: number, sig: string): RawCut[] => {
    const hit = memo.get(sig);
    if (hit !== undefined) return hit;
    const half = Math.floor(k / 2);
    let sizes: number[];
    if (s <= 0.0) sizes = [half];
    else {
      sizes = [...new Set([1, 2, half, k - half, k - 2, k - 1])]
        .filter((x) => x >= 1 && x < k)
        .sort((a, b) => a - b);
    }
    const amt = new Float64Array(n);
    const pieceAt: (Piece | undefined)[] = new Array(n);
    let total = 0.0;
    for (const p of r) {
      amt[p.i] = people(g, p);
      pieceAt[p.i] = p;
      total += amt[p.i] as number;
    }
    const whole = inertia(g, r);
    const slices = s > 0.0 ? regionSlices(g, r, sign) : null;
    const found: RawCut[] = [];
    const seen = new Set<string>();
    for (const key of keysFor(r)) {
      const sw = sweep(g, r, amt, key, stats, sc);
      for (const k1 of sizes) {
        for (const end of ["A", "B"] as const) {
          const c = cutAt(g, r, pieceAt, amt, total, sw, k1, k, end, sc);
          const sa = signature(c.a, k1);
          if (!seen.has(sa)) {
            seen.add(sa);
            const cost = whole > 0.0 ? (inertia(g, c.a) + inertia(g, c.b)) / whole : 0.0;
            const value =
              slices === null
                ? 0.0
                : sideValue(g, slices, c.a, c.split, k1, sign, sc) +
                  sideValue(g, slices, c.b, c.split, k - k1, sign, sc);
            found.push({ a: c.a, b: c.b, k1, ok: c.ok, cost, value });
          }
          // pivot 5.4: the other end of a split county is a different map only for the partisan drawer.
          if (s <= 0.0 || !c.splitSpread) break;
        }
      }
    }
    memo.set(sig, found);
    return found;
  };

  /** A region's cuts scored at this strength, best first (spike `candidates`). */
  const candidates = (r: Region, k: number): Cut[] => {
    const sig = signature(r, k);
    const hit = cache.get(sig);
    if (hit !== undefined) return hit;
    const found: Cut[] = rawCuts(r, k, sig).map((c) => {
      let score = -wCompact * CUT_KAPPA * c.cost;
      if (s > 0.0) score += s * c.value;
      return { ...c, score };
    });
    // Contiguous cuts first, then by score; a stable sort keeps sweep order on ties.
    found.sort((p, q) => Number(!p.ok) - Number(!q.ok) || q.score - p.score);
    cache.set(sig, found);
    return found;
  };

  const equalShares = (r: Region, k: number): Plan => {
    const p = r[0] as Piece;
    const at: number[] = [];
    for (let j = 0; j <= k; j++)
      at.push(j === 0 ? p.from : j === k ? p.to : p.from + ((p.to - p.from) * j) / k);
    const out: Plan = [];
    for (let j = 0; j < k; j++) out.push([{ i: p.i, from: at[j] as number, to: at[j + 1] as number }]);
    return out;
  };

  const greedy = (r: Region, k: number, force = false): Plan | null => {
    if (k === 1) return [r];
    if (r.length === 1) return equalShares(r, k);
    const sig = signature(r, k);
    if (!done.has(sig)) {
      let got: Plan | null = null;
      for (const c of candidates(r, k).slice(0, BACKTRACK_TRIES)) {
        if (!c.ok) break;
        const pa = greedy(c.a, c.k1);
        if (pa === null) {
          stats.backtracks++;
          continue;
        }
        const pb = greedy(c.b, k - c.k1);
        if (pb === null) {
          stats.backtracks++;
          continue;
        }
        got = pa.concat(pb);
        break;
      }
      done.set(sig, got);
    }
    const got = done.get(sig) as Plan | null;
    if (got === null && force) {
      stats.forced++;
      const c = candidates(r, k)[0] as Cut;
      return (greedy(c.a, c.k1, true) as Plan).concat(greedy(c.b, k - c.k1, true) as Plan);
    }
    return got;
  };

  const objective = (plan: Plan, whole: number): number => {
    let won = 0.0;
    let spread = 0.0;
    for (const d of plan) {
      won += phi((sign * regionLean(g, d)) / SEAT_SIGMA_PTS);
      spread += inertia(g, d);
    }
    const cost = whole > 0.0 ? (plan.length * spread) / whole : 0.0;
    return s * won - wCompact * PLAN_KAPPA * cost;
  };

  const split = (r: Region, k: number): Plan => {
    if (k === 1) return [r];
    if (r.length === 1 || s <= 0.0 || ROLLOUTS <= 1) return greedy(r, k) as Plan;
    const cands = candidates(r, k).filter((c) => c.ok);
    let tight = cands[0] as Cut;
    for (const c of cands) if (c.cost < tight.cost) tight = c;
    const whole = inertia(g, r);
    let best: { got: number; c: Cut } | null = null;
    let looked = 0;
    for (const c of cands) {
      if (looked >= ROLLOUTS && c !== tight) continue;
      const pa = greedy(c.a, c.k1);
      const pb = pa !== null ? greedy(c.b, k - c.k1) : null;
      if (pa === null || pb === null) continue;
      looked++;
      const got = objective(pa.concat(pb), whole);
      if (best === null || got > best.got + 1e-12) best = { got, c };
    }
    if (best === null) return greedy(r, k) as Plan;
    return split(best.c.a, best.c.k1).concat(split(best.c.b, k - best.c.k1));
  };

  const start: Region = g.pop.map((_, i) => ({ i, from: 0.0, to: 1.0 }));
  if (seats <= 1) return [start];
  if (greedy(start, seats) === null) return greedy(start, seats, true) as Plan;
  let plan = split(start, seats);
  if (guard && s > 0.0) {
    // Never worse for the drawer, by this strength's objective, than a weaker strength's map.
    const whole = inertia(g, start);
    for (const weaker of [0.5 * s, 0.0]) {
      // The half-strength map finds the same cuts (only their scores differ): it shares the memo.
      const other = drawPlan(g, seats, weaker, sign, theta0, stats, false, weaker > 0.0 ? memo : new Map());
      if (objective(other, whole) > objective(plan, whole) + 1e-12) {
        stats.kept_weaker++;
        plan = other;
      }
    }
  }
  return plan;
}

/** Expected seats for party A of a plan: Σ Φ(lean / σ) (pivot 5.5; the spike's "expected D seats"). */
export function expectedSeatsA(g: StateGraph, plan: Plan): number {
  let won = 0.0;
  for (const d of plan) won += phi(regionLean(g, d) / SEAT_SIGMA_PTS);
  return won;
}

/** Contiguity of one region on the county graph (a split county touches itself and its neighbours). */
export function regionContiguous(g: StateGraph, r: Region): boolean {
  if (r.length <= 1) return true;
  const inSet = new Uint8Array(g.pop.length);
  for (const p of r) inSet[p.i] = 1;
  const places = r.map((p) => p.i);
  return components(g, inSet, places, -1).length === 1;
}

/** People in a region (exported for the views and tests). */
export function regionPeopleOf(g: StateGraph, r: Region): number {
  return regionPeople(g, r);
}
