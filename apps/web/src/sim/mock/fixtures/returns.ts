// The mock's election night (v_returns; pivot 9): counties report in batches from their state's
// poll-closing hour, early batches lean away from the final result by the state's counting rule,
// outlets call races from what is reported, one call is wrong and taken back, one race goes to a
// recount, and each race is certified days later. Only reported votes are ever in the view.
//
// A race's row carries its totals. Its county-by-county count is `countyReturns`, the slice the
// view's type describes (`RaceCountyReturns`); the protocol cannot carry it yet (README).

import type {
  DateTime,
  OutletId,
  Party,
  PersonId,
  RaceCall,
  RaceCountyReturns,
  RaceId,
  ReturnsView,
  SimDate,
  StateReturns,
} from "@tc20ff/sim";
import { normalCdf, type Outlook } from "./forecast.ts";
import type { MockCounty, MockGeo, MockState } from "./geo.ts";
import { ballotCandidate, type MockPolitics, type MockRace, needsRecount, type RaceUnit } from "./races.ts";
import type { MockRng } from "./rng.ts";
import { ELECTION_DATE, SCRIPT } from "./script.ts";

/** How far early batches lean from the final count: the exponent's offset (pivot 9.2). */
const BATCH_SKEW = 0.08;
/** A county with more than this share of its state's people counts slowly. */
const BIG_COUNTY_SHARE = 0.2;
const SMALL_COUNTY_POP = 40_000;
/** An estimate's uncertainty with nothing counted and with everything counted, in points. */
const SIGMA_OPEN = 10;
const SIGMA_DONE = 0.3;
/** The chance a caller needs before it calls the presidency, by how careful it is. */
const PRES_CALL_FLOOR = 0.9;
/** Hours after its polls close that the careless outlet wrongly calls the recount race (pivot 9.3). */
const WRONG_CALL_AFTER_HOURS = 3;

/** An outlet that calls races (pivot 9.3): how sure it must be, in standard deviations. */
export interface Caller {
  outlet: OutletId;
  threshold: number;
  /** A regional paper calls only its own state's races. */
  state: number | null;
  /** National desks leave House races to the wire and the local paper. */
  house: boolean;
  /** The one that makes the scripted wrong call. */
  careless: boolean;
}

export interface CountState {
  /** Per county: when each batch lands and the share counted once it has. */
  batches: { at: DateTime; share: number }[][];
  /** Per race: votes reported so far in ballot order, and the share of the expected vote in. */
  reported: number[][];
  reporting: number[];
  closed: (DateTime | null)[];
  calls: RaceCall[][];
  recount: boolean[];
  certified: (SimDate | null)[];
  /** The presidency: who the wire has called each state for, by `MockState.idx`. */
  state_called: (Party | null)[];
  /** Per race: what the count says of the final margin; null before its polls close. */
  outlooks: (Outlook | null)[];
  pres_states: (Outlook | null)[];
  /** The last tick anything was reported. */
  last_batch: DateTime;
  done: boolean;
}

/** What one hour of the count did, for the news, the feed and the market. */
export interface CountEvents {
  closed: MockRace[];
  moved: boolean;
  calls: { race: MockRace; call: RaceCall }[];
  retractions: { race: MockRace; call: RaceCall }[];
  /** Races whose count just finished. */
  complete: MockRace[];
}

export function genCount(pol: MockPolitics, geo: MockGeo, rng: MockRng): CountState {
  const batches = geo.counties.map((c) => {
    const st = geo.states[c.state] as MockState;
    const close = SCRIPT.election_day + st.close_hour;
    const big = c.population / st.population > BIG_COUNTY_SHARE;
    const n = big ? 6 : c.population < SMALL_COUNTY_POP ? 2 : 4;
    const out: { at: DateTime; share: number }[] = [];
    let at = close + 1 + rng.int(2);
    for (let k = 1; k <= n; k++) {
      out.push({ at, share: k === n ? 1 : Math.min(0.97, (k + rng.range(-0.3, 0.3)) / n) });
      at += (big ? 2 : 1) + rng.int(2);
    }
    // A mail-first state finishes its count over the following days.
    if (st.count_rule === "MailFirst" && n >= 4) {
      (out[n - 1] as { at: DateTime }).at = SCRIPT.election_day + 24 + 15 + rng.int(6);
      if (big) (out[n - 2] as { at: DateTime }).at = SCRIPT.election_day + 24 + 9 + rng.int(4);
      if (big) (out[n - 1] as { at: DateTime }).at = SCRIPT.election_day + 48 + 10 + rng.int(5);
    }
    return out;
  });
  const n = pol.races.length;
  return {
    batches,
    reported: pol.races.map((r) => r.ballot.map(() => 0)),
    reporting: new Array<number>(n).fill(0),
    closed: new Array<DateTime | null>(n).fill(null),
    calls: pol.races.map(() => []),
    recount: new Array<boolean>(n).fill(false),
    certified: new Array<SimDate | null>(n).fill(null),
    state_called: geo.states.map(() => null),
    outlooks: new Array<Outlook | null>(n).fill(null),
    pres_states: geo.states.map(() => null),
    last_batch: 0,
    done: false,
  };
}

/** The share of a county counted by `t`. */
function countyShare(cs: CountState, county: number, t: DateTime): number {
  let share = 0;
  for (const b of cs.batches[county] as { at: DateTime; share: number }[]) if (b.at <= t) share = b.share;
  return share;
}

/** A unit's reported votes with `share` of it counted (pivot 9.2): early batches lean by the state's rule. */
function unitReported(
  r: MockRace,
  u: RaceUnit,
  i: number,
  share: number,
  rule: MockState["count_rule"],
  recounted: boolean,
): number[] {
  const late = rule === "DayFirst" ? BATCH_SKEW : -BATCH_SKEW;
  return u.votes.map((v, k) => {
    if (share <= 0) return 0;
    const full =
      recounted || r.recount === null || r.recount.unit !== i ? v : v - (r.recount.delta[k] as number);
    if (share >= 1) return full;
    const e = k === r.dem ? 1 + late : k === r.rep ? 1 - late : 1;
    return Math.floor(full * share ** e);
  });
}

function estimate(reported: number[], dem: number, rep: number, share: number, prior: number): Outlook {
  const all = reported.reduce((a, b) => a + b, 0);
  const seen = all > 0 ? (((reported[dem] as number) - (reported[rep] as number)) / all) * 100 : prior;
  return {
    margin: share * seen + (1 - share) * prior,
    sigma: SIGMA_DONE + SIGMA_OPEN * (1 - share) ** 0.7,
  };
}

const recounted = (t: DateTime) => t >= SCRIPT.recount_done;

/**
 * One hour of the count. `priors` are the forecast's last outlooks by race and by state (public),
 * `presDem` gives party A's chance of the presidency from a set of state outlooks, and `callers`
 * are the outlets that call races.
 */
export function countStep(
  cs: CountState,
  pol: MockPolitics,
  geo: MockGeo,
  t: DateTime,
  priors: Outlook[],
  statePriors: Outlook[],
  presDem: (states: Outlook[]) => number,
  callers: readonly Caller[],
): CountEvents {
  const ev: CountEvents = { closed: [], moved: false, calls: [], retractions: [], complete: [] };
  if (cs.done || t < SCRIPT.election_day) return ev;
  const pres = pol.races[0] as MockRace;
  let open = false;
  for (const r of pol.races) {
    const close =
      SCRIPT.election_day +
      (r.state === null
        ? Math.min(...geo.states.map((s) => s.close_hour))
        : (geo.states[r.state] as MockState).close_hour);
    if (t < close) {
      open = true;
      continue;
    }
    if (cs.closed[r.id] === null) {
      cs.closed[r.id] = close;
      ev.closed.push(r);
      ev.moved = true;
    }
    const was = cs.reporting[r.id] as number;
    const sums = r.ballot.map(() => 0);
    let counted = 0;
    let expected = 0;
    r.units.forEach((u, i) => {
      const st = geo.states[u.state] as MockState;
      const share = t >= SCRIPT.election_day + st.close_hour ? countyShare(cs, u.county, t) : 0;
      const got = unitReported(r, u, i, share, st.count_rule, recounted(t));
      const total = u.votes.reduce((a, b) => a + b, 0);
      expected += total;
      counted += total * share;
      got.forEach((v, k) => {
        sums[k] = (sums[k] as number) + v;
      });
    });
    const before = cs.reported[r.id] as number[];
    if (sums.some((v, k) => v !== before[k])) {
      ev.moved = true;
      cs.last_batch = t;
    }
    cs.reported[r.id] = sums;
    cs.reporting[r.id] = counted / expected;
    const share = cs.reporting[r.id] as number;
    if (share < 1) open = true;
    if (share >= 1 && was < 1) {
      ev.complete.push(r);
      if (needsRecount(r)) cs.recount[r.id] = true;
    }
    cs.outlooks[r.id] = estimate(sums, r.dem, r.rep, share, (priors[r.id] as Outlook).margin);
  }
  if (cs.recount.some(Boolean)) {
    if (recounted(t)) {
      cs.recount.fill(false);
      ev.moved = true;
    } else open = true;
  }

  // The presidency by state, from the same count.
  const states: Outlook[] = geo.states.map((st, i) => {
    if (t < SCRIPT.election_day + st.close_hour) return statePriors[i] as Outlook;
    const sums = pres.ballot.map(() => 0);
    let counted = 0;
    let expected = 0;
    pres.units.forEach((u, k) => {
      if (u.state !== st.idx) return;
      const share = countyShare(cs, u.county, t);
      const got = unitReported(pres, u, k, share, st.count_rule, true);
      const total = u.votes.reduce((a, b) => a + b, 0);
      expected += total;
      counted += total * share;
      got.forEach((v, j) => {
        sums[j] = (sums[j] as number) + v;
      });
    });
    const o = estimate(sums, pres.dem, pres.rep, counted / expected, (statePriors[i] as Outlook).margin);
    cs.pres_states[i] = o;
    const wire = callers[0] as Caller;
    if (cs.state_called[i] === null && Math.abs(o.margin) / o.sigma > wire.threshold) {
      cs.state_called[i] = o.margin >= 0 ? "Democrats" : "Republicans";
      ev.moved = true;
    }
    return o;
  });
  const presChance = presDem(states);

  // Calls (pivot 9.3).
  for (const r of pol.races) {
    const o = cs.outlooks[r.id];
    if (o === null || o === undefined) continue;
    const share = cs.reporting[r.id] as number;
    const calls = cs.calls[r.id] as RaceCall[];
    const ahead = r.office === "President" ? presChance >= 0.5 : o.margin >= 0;
    const leader = ballotCandidate(r, ahead ? r.dem : r.rep).person;
    const held = cs.recount[r.id] === true || (share >= 1 && needsRecount(r) && !recounted(t));
    for (const c of callers) {
      if (c.state !== null && c.state !== r.state) continue;
      if (r.office === "House" && !c.house) continue;
      const mine = calls.findIndex((x) => x.outlet === c.outlet && !x.retracted);
      const add = (person: PersonId) => {
        const call: RaceCall = { outlet: c.outlet, person, time: t, retracted: false };
        calls.push(call);
        ev.calls.push({ race: r, call });
        ev.moved = true;
      };
      if (mine >= 0) {
        const call = calls[mine] as RaceCall;
        // A call for the candidate now behind is taken back once the count is clear (pivot 9.3).
        if (call.person !== leader && (share >= 0.85 || Math.abs(o.margin) / o.sigma > 1)) {
          const back = { ...call, retracted: true };
          calls[mine] = back;
          ev.retractions.push({ race: r, call: back });
          ev.moved = true;
        }
        continue;
      }
      if (c.careless && r.id === pol.recount_race) {
        // The scripted wrong call: the careless outlet calls the recount race for its loser, once.
        const due = (cs.closed[r.id] as DateTime) + WRONG_CALL_AFTER_HOURS;
        if (t === due) add(ballotCandidate(r, r.winner_ballot === r.dem ? r.rep : r.dem).person);
        else if (t > due && !held && share >= 1) add(leader);
        continue;
      }
      if (held) continue;
      if (r.office === "President") {
        // The presidency is called on the Electoral College, not on the popular count.
        const floor = Math.max(PRES_CALL_FLOOR, normalCdf(c.threshold));
        if (share >= 1 || Math.max(presChance, 1 - presChance) > floor) add(leader);
        continue;
      }
      if (share >= 1 || Math.abs(o.margin) / o.sigma > c.threshold) add(leader);
    }
  }
  if (!open && pol.races.every((r) => (cs.calls[r.id] as RaceCall[]).some((c) => !c.retracted)))
    cs.done = true;
  return ev;
}

/** The electoral votes of the states the wire has called, as [Democrats, Republicans]. */
export function electoralCalled(cs: CountState, geo: MockGeo): [number, number] {
  const out: [number, number] = [0, 0];
  cs.state_called.forEach((p, i) => {
    if (p !== null) out[p === "Democrats" ? 0 : 1] += (geo.states[i] as MockState).electoral_votes;
  });
  return out;
}

/** v_returns. Empty before the first polls close. */
export function returnsView(cs: CountState, pol: MockPolitics, geo: MockGeo, t: DateTime): ReturnsView {
  if (t < SCRIPT.election_day) return { election: null, races: [] };
  const ev = electoralCalled(cs, geo);
  return {
    election: ELECTION_DATE,
    races: pol.races.map((r) => ({
      race: r.id,
      polls_closed: cs.closed[r.id] ?? null,
      reporting: cs.reporting[r.id] as number,
      votes: (cs.reported[r.id] as number[]).map((votes, i) => ({
        person: ballotCandidate(r, i).person,
        votes,
      })),
      electoral_votes:
        r.office === "President"
          ? [
              { person: ballotCandidate(r, r.dem).person, votes: ev[0] },
              { person: ballotCandidate(r, r.rep).person, votes: ev[1] },
            ]
          : null,
      states: r.office === "President" ? stateReturns(cs, pol, geo, r, t) : null,
      calls: (cs.calls[r.id] as RaceCall[]).slice(),
      recount: cs.recount[r.id] === true,
      certified: cs.certified[r.id] ?? null,
    })),
  };
}

/** The presidency state by state (D1037): its counties' reported votes summed, and the wire's call. */
function stateReturns(
  cs: CountState,
  pol: MockPolitics,
  geo: MockGeo,
  r: MockRace,
  t: DateTime,
): StateReturns[] {
  const counted = countyReturns(cs, pol, geo, r.id, t);
  return geo.states.map((st, s) => {
    const votes = r.ballot.map(() => 0);
    let expected = 0;
    let reported = 0;
    r.units.forEach((u, k) => {
      if (u.state !== s) return;
      const all = u.votes.reduce((a, b) => a + b, 0);
      expected += all;
      reported += all * (counted?.reporting[k] ?? 0);
      (counted?.votes[k] ?? []).forEach((v, i) => {
        votes[i] = (votes[i] as number) + v;
      });
    });
    const closed = SCRIPT.election_day + st.close_hour;
    const party = cs.state_called[s] ?? null;
    return {
      state: st.id,
      polls_closed: t >= closed ? closed : null,
      reporting: expected > 0 ? reported / expected : 0,
      votes: votes.map((v, i) => ({ person: ballotCandidate(r, i).person, votes: v })),
      electoral_votes: st.electoral_votes,
      called: party === null ? null : ballotCandidate(r, party === "Democrats" ? r.dem : r.rep).person,
      certified: cs.certified[r.id] ?? null,
    };
  });
}

/** One race's count by county: the slice of v_returns (`RaceCountyReturns`). */
export function countyReturns(
  cs: CountState,
  pol: MockPolitics,
  geo: MockGeo,
  race: RaceId,
  t: DateTime,
): RaceCountyReturns | null {
  const r = pol.races[race];
  if (r === undefined || t < SCRIPT.election_day) return null;
  const reporting: number[] = [];
  const votes: number[][] = [];
  r.units.forEach((u, i) => {
    const st = geo.states[u.state] as MockState;
    const share = t >= SCRIPT.election_day + st.close_hour ? countyShare(cs, u.county, t) : 0;
    reporting.push(share);
    votes.push(unitReported(r, u, i, share, st.count_rule, recounted(t)));
  });
  return { race, counties: r.units.map((u) => u.county), reporting, votes };
}

/** Each county's presidential result once certified, for the map (v_usmap_layers). */
export function countyResults(
  pol: MockPolitics,
  counties: MockCounty[],
): { winner: Party; margin: number; votes: number }[] {
  const pres = pol.races[0] as MockRace;
  return counties.map((c) => {
    const u = pres.units[c.id] as RaceUnit;
    const d = u.votes[pres.dem] as number;
    const r = u.votes[pres.rep] as number;
    const margin =
      ((d - r) /
        Math.max(
          1,
          u.votes.reduce((a, b) => a + b, 0),
        )) *
      100;
    return {
      winner: margin >= 0 ? "Democrats" : "Republicans",
      margin: Math.floor(margin * 10 + 0.5) / 10,
      votes: u.votes.reduce((a, b) => a + b, 0),
    };
  });
}
