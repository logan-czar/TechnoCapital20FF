// The mock's pollsters and polls (v_polls; pivot 8.4): named firms with a house effect, a sample
// size and a schedule. A poll samples the race's true margin that day (races.ts `raceMarginAt`) with
// sampling error, the house effect and a likely-voter error. Small races are polled rarely.

import {
  type DateTime,
  dateTimeDate,
  dateTimeHour,
  type Poll,
  type PollsterId,
  type PollsView,
  simDateAddDays,
} from "@tc20ff/sim";
import { ballotCandidate, type MockPolitics, type MockRace, other, raceMarginAt } from "./races.ts";
import type { MockRng } from "./rng.ts";
import { MOCK_HISTORY_START, SCRIPT, ymd } from "./script.ts";

/** name, house effect in points toward party A, sample size, likely-voter error in points. */
const POLLSTER_TABLE: readonly (readonly [string, number, number, number])[] = [
  ["Halcyon Research", 0.4, 1200, 1.0],
  ["Redwood Strategies", -2.3, 800, 1.5],
  ["Blue Harbor Polling", 2.6, 700, 1.5],
  ["Circuit/Meridian Poll", 0.2, 1000, 1.2],
  ["Prairie State Survey", -0.8, 600, 2.0],
  ["Quantia Analytics", 1.1, 1500, 2.5],
];

/** The hour of the day polls are published. */
export const POLL_HOUR = 6;
/** A House race is polled only when it looks this close on fundamentals, in points. */
const HOUSE_POLL_MARGIN = 8;
/** The days a poll is in the field, ending the day before it is published. */
const FIELD_DAYS = 4;
/** The undecided share far from and close to the election. */
const UNDECIDED_FAR = 0.08;
const UNDECIDED_NEAR = 0.03;

export interface MockPollster {
  id: PollsterId;
  name: string;
  /** Hidden (pivot 8.4). */
  house_effect: number;
  sample: number;
  lv_error: number;
}

/** A pollster polls a race every `every` days. */
export interface PollPlan {
  pollster: number;
  race: number;
  every: number;
  phase: number;
}

export interface MockPolling {
  pollsters: MockPollster[];
  plans: PollPlan[];
}

const round3 = (x: number) => Math.floor(x * 1000 + 0.5) / 1000;

export function genPolling(pol: MockPolitics, rng: MockRng): MockPolling {
  const pollsters: MockPollster[] = POLLSTER_TABLE.map(([name, house, sample, lv], i) => ({
    id: i as PollsterId,
    name,
    house_effect: house + 0.4 * rng.normal(),
    sample,
    lv_error: lv,
  }));
  const plans: PollPlan[] = [];
  const plan = (race: number, firms: number, lo: number, hi: number) => {
    const first = rng.int(pollsters.length);
    for (let k = 0; k < firms; k++) {
      const every = lo + rng.int(hi - lo + 1);
      plans.push({ pollster: (first + k) % pollsters.length, race, every, phase: rng.int(every) });
    }
  };
  for (const r of pol.races) {
    const close = Math.abs(r.fundamentals) < HOUSE_POLL_MARGIN;
    if (r.office === "President") plan(r.id, pollsters.length, 6, 10);
    else if (r.office === "Senate") plan(r.id, close ? 2 : 1, 12, 20);
    else if (r.office === "Governor") plan(r.id, close ? 2 : 1, 12, 20);
    else if (close) plan(r.id, 1, 18, 24);
  }
  return { pollsters, plans };
}

/** One poll of a race's general, published on the day of `t`. */
function generalPoll(pg: MockPolling, p: PollPlan, r: MockRace, t: DateTime, id: number, rng: MockRng): Poll {
  const firm = pg.pollsters[p.pollster] as MockPollster;
  const published = dateTimeDate(t);
  const sample = Math.floor(firm.sample * rng.range(0.8, 1.2));
  const left = Math.min(1, Math.max(0, (SCRIPT.election_day - t) / (60 * 24)));
  const margin =
    raceMarginAt(r, t - 24) +
    firm.house_effect +
    (100 / Math.sqrt(sample)) * rng.normal() +
    firm.lv_error * rng.normal();
  const undecided = round3(UNDECIDED_NEAR + (UNDECIDED_FAR - UNDECIDED_NEAR) * left + rng.range(0, 0.02));
  const ind = r.ballot.length > 2 ? r.ind_share * rng.range(0.7, 1.3) : 0;
  const dem = Math.min(96 - ind, Math.max(4, (100 - ind) / 2 + margin / 2));
  const shares = r.ballot.map((_, i) => {
    const pct = i === r.dem ? dem : i === r.rep ? 100 - ind - dem : ind / (r.ballot.length - 2);
    return { person: ballotCandidate(r, i).person, share: round3((pct / 100) * (1 - undecided)) };
  });
  return {
    id,
    pollster: firm.id,
    race: r.id,
    stage: "General",
    party: null,
    from: simDateAddDays(published, -FIELD_DAYS),
    to: simDateAddDays(published, -1),
    published,
    sample,
    shares,
    undecided,
    margin_of_error: Math.floor(980 / Math.sqrt(sample) + 0.5) / 10,
  };
}

/** The polls of the challenging party's presidential primary, from the spring (pivot 6.1). */
export function primaryPolls(pg: MockPolling, pol: MockPolitics, rng: MockRng): Poll[] {
  const pres = pol.races[0] as MockRace;
  const party = other(pol.incumbent_party);
  const field = pres.candidates.filter((c) => c.party === party);
  const out: Poll[] = [];
  for (let k = 0; k < 6; k++) {
    const published = ymd(2, 3 + 4 * k);
    const sample = 500 + rng.int(500);
    const undecided = round3(0.18 - 0.02 * k);
    // The eventual nominee pulls away as the field thins.
    const weights = field.map((c) => (c.person === pol.challenger ? 1.6 + 0.35 * k : rng.range(0.5, 1.3)));
    const sum = weights.reduce((a, b) => a + b, 0);
    out.push({
      id: out.length,
      pollster: ((k * 2) % pg.pollsters.length) as PollsterId,
      race: pres.id,
      stage: "Primary",
      party,
      from: simDateAddDays(published, -FIELD_DAYS),
      to: simDateAddDays(published, -1),
      published,
      sample,
      shares: field.map((c, i) => ({
        person: c.person,
        share: round3(((weights[i] as number) / sum) * (1 - undecided)),
      })),
      undecided,
      margin_of_error: Math.floor(980 / Math.sqrt(sample) + 0.5) / 10,
    });
  }
  return out;
}

/** The polls published at tick `t` (pivot 8.4): each plan's turn, at `POLL_HOUR`, up to the eve of the vote. */
export function pollsDue(
  pg: MockPolling,
  pol: MockPolitics,
  t: DateTime,
  nextId: number,
  rng: MockRng,
): Poll[] {
  if (dateTimeHour(t) !== POLL_HOUR || t >= SCRIPT.election_day) return [];
  const day = Math.floor((t - MOCK_HISTORY_START) / 24);
  const out: Poll[] = [];
  for (const p of pg.plans) {
    if ((day + p.phase) % p.every !== 0) continue;
    out.push(generalPoll(pg, p, pol.races[p.race] as MockRace, t, nextId + out.length, rng));
  }
  return out;
}

/** v_polls: house effects only for Omniscient (pivot 8.4). */
export function pollsView(pg: MockPolling, polls: Poll[], omniscient: boolean): PollsView {
  return {
    pollsters: pg.pollsters.map((f) => ({
      id: f.id,
      name: f.name,
      house_effect: omniscient ? f.house_effect : null,
    })),
    polls: polls.slice(),
  };
}
