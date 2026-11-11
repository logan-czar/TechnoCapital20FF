// The mock's forecast site (v_forecast; pivot 8.5): an in-world model that reads only published
// polls and public fundamentals, so it can be wrong. It never reads a race's true margin. The same
// arithmetic (`seatDist`) prices the chamber and bracket contracts (markets.ts), before the vote from
// this model and on election night from the count (returns.ts).

import {
  type DateTime,
  dateTimeDate,
  type ForecastRange,
  type ForecastView,
  type Poll,
  type SimDate,
  simDateDaysSinceEpoch,
} from "@tc20ff/sim";
import type { MockGeo, MockState } from "./geo.ts";
import { ballotCandidate, type MockPolitics, type MockRace } from "./races.ts";
import { unitHash } from "./rng.ts";
import { PARTIES, SCRIPT } from "./script.ts";

/** The hour of the day the site reruns its model, after the morning's polls. */
export const FORECAST_HOUR = 7;
/** A poll's weight halves every this many days. */
const POLL_HALF_LIFE_DAYS = 7;
/** Polls older than this are dropped. */
const POLL_WINDOW_DAYS = 28;
/** The weight of fundamentals, in polls. */
const FUNDAMENTALS_WEIGHT = 1;
/** The model's uncertainty, in points: a floor, a term that shrinks with polls, and one per day left. */
const SIGMA_FLOOR = 2.5;
const SIGMA_POLLS = 4;
const SIGMA_PER_DAY = 0.06;
/** The error every race shares (a national polling miss), in points. */
export const COMMON_SIGMA = 2;
/** How wrong the site's read of a state's lean is, in points (half the range). */
const STATE_LEAN_ERROR = 3;
/** A third candidate's chance. */
const OTHER_WIN = 0.005;

/** A guess at a margin in points toward party A, with its uncertainty. */
export interface Outlook {
  margin: number;
  sigma: number;
}

/** The standard normal distribution function (Abramowitz and Stegun 26.2.17). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export const pDem = (o: Outlook): number => normalCdf(o.margin / o.sigma);

/** A poll's margin between the two party nominees, in points toward party A. */
export function pollMargin(p: Poll, r: MockRace): number {
  const d = p.shares[r.dem]?.share ?? 0;
  const rep = p.shares[r.rep]?.share ?? 0;
  return ((d - rep) / Math.max(0.01, 1 - p.undecided)) * 100;
}

/** The model's read of one race from its general polls (oldest first) and its fundamentals. */
export function raceOutlook(r: MockRace, polls: readonly Poll[], t: DateTime): Outlook {
  const today = simDateDaysSinceEpoch(dateTimeDate(t));
  let n = 0;
  let sum = 0;
  for (let i = polls.length - 1; i >= 0; i--) {
    const p = polls[i] as Poll;
    const age = today - simDateDaysSinceEpoch(p.published);
    if (age > POLL_WINDOW_DAYS) break;
    const w = 0.5 ** (age / POLL_HALF_LIFE_DAYS) * Math.sqrt(p.sample / 1000);
    n += w;
    sum += w * pollMargin(p, r);
  }
  const daysLeft = Math.max(0, (SCRIPT.election_day - t) / 24);
  return {
    margin: (sum + FUNDAMENTALS_WEIGHT * r.fundamentals) / (n + FUNDAMENTALS_WEIGHT),
    sigma: SIGMA_FLOOR + SIGMA_POLLS / Math.sqrt(n + 0.5) + SIGMA_PER_DAY * daysLeft,
  };
}

/**
 * The distribution of party A's total over independent contests that share one common error:
 * `out[k]` is the chance its total is `k`, from `base` up to `size`. Each item adds `weight` when
 * its margin, shifted by the common error, comes out above zero.
 */
export function seatDist(
  items: readonly { o: Outlook; weight: number }[],
  common: number,
  base: number,
  size: number,
): number[] {
  const out = new Array<number>(size + 1).fill(0);
  const nodes = common > 0 ? [-3, -2, -1, 0, 1, 2, 3] : [0];
  const wsum = nodes.reduce((a, x) => a + Math.exp((-x * x) / 2), 0);
  for (const x of nodes) {
    let dist = new Array<number>(size + 1).fill(0);
    dist[base] = 1;
    for (const it of items) {
      const local = Math.sqrt(Math.max(0.25, it.o.sigma * it.o.sigma - common * common));
      const p = normalCdf((it.o.margin + x * common) / local);
      const next = new Array<number>(size + 1).fill(0);
      for (let k = 0; k <= size; k++) {
        const v = dist[k] as number;
        if (v === 0) continue;
        next[k] = (next[k] as number) + v * (1 - p);
        const up = Math.min(size, k + it.weight);
        next[up] = (next[up] as number) + v * p;
      }
      dist = next;
    }
    const w = Math.exp((-x * x) / 2) / wsum;
    for (let k = 0; k <= size; k++) out[k] = (out[k] as number) + w * (dist[k] as number);
  }
  return out;
}

/** The chance of a total in `[lo, hi]`. */
export function distBetween(dist: readonly number[], lo: number, hi: number): number {
  let s = 0;
  for (let k = Math.max(0, lo); k <= Math.min(dist.length - 1, hi); k++) s += dist[k] as number;
  return s;
}

/** The 10th, 50th and 90th percentiles of a total. */
export function distRange(dist: readonly number[]): ForecastRange {
  const at = (q: number) => {
    let s = 0;
    for (let k = 0; k < dist.length; k++) {
      s += dist[k] as number;
      if (s >= q) return k;
    }
    return dist.length - 1;
  };
  return [at(0.1), at(0.5), at(0.9)];
}

/** Everything the model works out in one run. Totals are party A's. */
export interface ForecastModel {
  /** By race id. */
  outlooks: Outlook[];
  /** The presidency by state, in `MockGeo.states` order. */
  pres_states: Outlook[];
  ev: number[];
  house: number[];
  senate: number[];
  /** Party A's chance of the presidency, and of each chamber with ties broken (see `controlOf`). */
  pres_dem: number;
  house_dem: number;
  senate_dem: number;
}

export const totalEv = (geo: MockGeo) => geo.states.reduce((a, s) => a + s.electoral_votes, 0);

/** Party A's chance of a body of `size`: more than half, or exactly half with the tie-break going its way. */
export function controlOf(dist: readonly number[], size: number, tieBreak: number): number {
  const half = size / 2;
  const tie = Number.isInteger(half) ? (dist[half] as number) : 0;
  return distBetween(dist, Math.floor(half) + 1, size) + tie * tieBreak;
}

/**
 * The seat and electoral-vote arithmetic over a set of per-race and per-state outlooks. A tied
 * Electoral College goes to the incumbent party, and a tied chamber to the president's party (the
 * Vice President's vote in the Senate; in the mock, the House too).
 */
export function chamberModel(
  pol: MockPolitics,
  geo: MockGeo,
  outlooks: Outlook[],
  presStates: Outlook[],
  common: number,
): ForecastModel {
  const size = totalEv(geo);
  const ev = seatDist(
    geo.states.map((st, i) => ({ o: presStates[i] as Outlook, weight: st.electoral_votes })),
    common,
    0,
    size,
  );
  const pres_dem = controlOf(ev, size, pol.incumbent_party === "Democrats" ? 1 : 0);
  const of = (office: "House" | "Senate") =>
    pol.races.filter((r) => r.office === office).map((r) => ({ o: outlooks[r.id] as Outlook, weight: 1 }));
  const holdDem = pol.senators.filter((s) => !s.up && s.party === "Democrats").length;
  const house = seatDist(of("House"), common, 0, pol.reps.length);
  const senate = seatDist(of("Senate"), common, holdDem, pol.senators.length);
  return {
    outlooks,
    pres_states: presStates,
    ev,
    house,
    senate,
    pres_dem,
    house_dem: controlOf(house, pol.reps.length, pres_dem),
    senate_dem: controlOf(senate, pol.senators.length, pres_dem),
  };
}

/** The site's read of a state's lean: public, and a little wrong. */
function stateFundamentals(st: MockState): number {
  return st.lean + (unitHash(st.name, 77) - 0.5) * 2 * STATE_LEAN_ERROR;
}

/** One run of the site's model at `t` (pivot 8.5). `pollsOf` gives a race's general polls, oldest first. */
export function runForecast(
  pol: MockPolitics,
  geo: MockGeo,
  pollsOf: (race: number) => readonly Poll[],
  t: DateTime,
): ForecastModel {
  const outlooks = pol.races.map((r) => raceOutlook(r, pollsOf(r.id), t));
  // The presidency by state: each state's lean, moved by how far the national polls stand from the
  // national lean. The mock cannot publish state polls of the presidency (README, contract requests).
  const funds = geo.states.map(stateFundamentals);
  const people = geo.states.reduce((a, s) => a + s.population, 0);
  const national = geo.states.reduce((a, s, i) => a + s.population * (funds[i] as number), 0) / people;
  const nat = outlooks[0] as Outlook;
  const presStates = funds.map((f) => ({
    margin: f + nat.margin - national,
    sigma: Math.sqrt(nat.sigma * nat.sigma + 9),
  }));
  return chamberModel(pol, geo, outlooks, presStates, COMMON_SIGMA);
}

/** Each ballot candidate's chance from party A's chance: the two nominees share what any others leave. */
export function ballotOdds(r: MockRace, dem: number): number[] {
  const others = r.ballot.length - 2;
  const rest = 1 - OTHER_WIN * others;
  return r.ballot.map((_, i) => (i === r.dem ? dem * rest : i === r.rep ? (1 - dem) * rest : OTHER_WIN));
}

const round3 = (x: number) => Math.floor(x * 1000 + 0.5) / 1000;
const round1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;

/** v_forecast. */
export function forecastView(
  m: ForecastModel | null,
  pol: MockPolitics,
  geo: MockGeo,
  updated: SimDate | null,
): ForecastView {
  if (m === null) return { updated: null, races: [], chambers: [], states: [], electoral_votes: null };
  const pres = pol.races.find((r) => r.office === "President");
  const seats = (dist: number[], size: number, control: number) =>
    PARTIES.map((party) => {
      const [lo, mid, hi] = distRange(dist);
      const dem = party === "Democrats";
      return {
        party,
        control: round3(dem ? control : 1 - control),
        seats: (dem ? [lo, mid, hi] : [size - hi, size - mid, size - lo]) as ForecastRange,
      };
    });
  return {
    updated,
    races: pol.races.map((r) => {
      const o = m.outlooks[r.id] as Outlook;
      const dem = r.office === "President" ? m.pres_dem : pDem(o);
      const lead = Math.abs(o.margin);
      return {
        race: r.id,
        odds: ballotOdds(r, dem).map((win, i) => ({
          person: ballotCandidate(r, i).person,
          win: round3(win),
        })),
        margin: [round1(lead - 1.28 * o.sigma), round1(lead), round1(lead + 1.28 * o.sigma)],
      };
    }),
    chambers: [
      { chamber: "House", parties: seats(m.house, pol.reps.length, m.house_dem) },
      { chamber: "Senate", parties: seats(m.senate, pol.senators.length, m.senate_dem) },
    ],
    // The presidency state by state (D1037): each state's chance, in the race's candidate order.
    states:
      pres === undefined
        ? []
        : geo.states.map((st, i) => {
            const o = m.pres_states[i] as Outlook;
            const lead = Math.abs(o.margin);
            return {
              state: st.id,
              electoral_votes: st.electoral_votes,
              odds: ballotOdds(pres, pDem(o)).map((win, k) => ({
                person: ballotCandidate(pres, k).person,
                win: round3(win),
              })),
              margin: [round1(lead - 1.28 * o.sigma), round1(lead), round1(lead + 1.28 * o.sigma)],
            };
          }),
    electoral_votes: distRange(m.ev),
  };
}
