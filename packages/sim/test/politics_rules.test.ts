// The politics POC's rules (D980 to D988): the calendar, the vote, retirements, seat allocation and
// fifty years of US government driven through the job alone (the economy need not run for it).
import { loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../src/lib.ts";
import {
  electionDay,
  isElectionYear,
  isPoliticsDay,
  isPresidentYear,
  nextElectionAfter,
  senateClassUp,
} from "../src/politics/calendar.ts";
import {
  CABINET_RANGES,
  HOUSE_RANGES,
  JUDGE_RANGES,
  PRESIDENT_RANGES,
  SENATE_RANGES,
} from "../src/politics/generate.ts";
import {
  judgeRetireChance,
  otherParty,
  PRESIDENT_TERM_LIMIT,
  politicsJob,
  retireChance,
  START_PRESIDENT_PARTY,
} from "../src/politics/jobs.ts";
import { largestRemainder, partySeats } from "../src/politics/state.ts";
import { type Contender, shares, utility, type VoteClimate } from "../src/politics/vote.ts";
import { rngStreamsDraws, rngStreamsNew } from "../src/rng.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { SimDate } from "../src/types/calendar.ts";
import { TRAIT_VALUES } from "../src/types/state/people.ts";
import type { Politician, PoliticsState } from "../src/types/state/politics.ts";
import type { World } from "../src/types/world.ts";
import { worldMini } from "./common/world_mini.ts";

const loaded = loadWorld(worldMini().dir);
if (!loaded.ok) throw new Error("data does not load");
const DATA = loaded.value;

function ymd(d: SimDate): [number, number, number] {
  return [d.year, d.month, d.day];
}

describe("the calendar (D982, D985)", () => {
  it("finds Election Day", () => {
    expect(ymd(electionDay(2020))).toEqual([2020, 11, 3]);
    expect(ymd(electionDay(2022))).toEqual([2022, 11, 8]);
    expect(ymd(electionDay(2024))).toEqual([2024, 11, 5]);
    expect(ymd(electionDay(2026))).toEqual([2026, 11, 3]);
    expect(ymd(electionDay(2028))).toEqual([2028, 11, 7]);
  });

  it("holds the House every 2 years and the president every 4", () => {
    expect([2020, 2021, 2022, 2023, 2024].map(isElectionYear)).toEqual([true, false, true, false, true]);
    expect([2020, 2022, 2024, 2026, 2028].map(isPresidentYear)).toEqual([true, false, true, false, true]);
  });

  it("cycles the real Senate classes", () => {
    expect([2020, 2022, 2024, 2026, 2028, 2030].map(senateClassUp)).toEqual([2, 3, 1, 2, 3, 1]);
  });

  it("marks the days the politics view rebuilds", () => {
    expect(isPoliticsDay(simDateYmd(2021, 1, 1))).toBe(true);
    expect(isPoliticsDay(simDateYmd(2021, 1, 3))).toBe(true);
    expect(isPoliticsDay(simDateYmd(2021, 1, 20))).toBe(true);
    expect(isPoliticsDay(simDateYmd(2020, 11, 3))).toBe(true);
    expect(isPoliticsDay(simDateYmd(2021, 11, 2))).toBe(false);
    expect(isPoliticsDay(simDateYmd(2020, 11, 4))).toBe(false);
  });

  it("finds the next vote strictly after a date", () => {
    expect(ymd(nextElectionAfter(simDateYmd(2020, 1, 1)))).toEqual([2020, 11, 3]);
    expect(ymd(nextElectionAfter(simDateYmd(2020, 11, 3)))).toEqual([2022, 11, 8]);
  });
});

describe("the vote (D986, 4.6.3)", () => {
  const neutral: VoteClimate = { incumbent_party: "Democrats", growth: 0, swing: 0 };
  const dem: Contender = { party: "Democrats", persuasion: 10, incumbency: 0 };
  const rep: Contender = { party: "Republicans", persuasion: 10, incumbency: 0 };

  it("splits a level race evenly and sums to one", () => {
    expect(shares(0, dem, rep, neutral, 0)).toEqual([0.5, 0.5]);
    const [a, b] = shares(12, dem, rep, neutral, 0.1);
    expect(a + b).toBeCloseTo(1, 12);
  });

  it("moves each term the right way", () => {
    expect(utility(10, dem, neutral)).toBeGreaterThan(0);
    expect(utility(10, rep, neutral)).toBeLessThan(0);
    expect(utility(0, { ...dem, incumbency: 0.3 }, neutral)).toBeCloseTo(0.3, 12);
    expect(utility(0, dem, { ...neutral, growth: 0.04 })).toBeCloseTo(0.1, 12);
    expect(utility(0, dem, { ...neutral, growth: -0.04 })).toBeCloseTo(-0.1, 12);
    expect(utility(0, rep, { ...neutral, growth: 0.03 })).toBe(0);
    expect(utility(0, { ...dem, persuasion: 20 }, neutral)).toBeCloseTo(0.3, 12);
    expect(utility(0, dem, { ...neutral, swing: 0.1 })).toBeCloseTo(0.1, 12);
    expect(utility(0, rep, { ...neutral, swing: 0.1 })).toBeCloseTo(-0.1, 12);
  });

  it("makes a 10-point lean about a 10-point margin", () => {
    const [a, b] = shares(10, dem, rep, neutral, 0);
    expect(a - b).toBeGreaterThan(0.08);
    expect(a - b).toBeLessThan(0.12);
  });
});

describe("seat allocation and retirement", () => {
  it("splits by largest remainder, ties to the lower index", () => {
    expect(largestRemainder([1, 1, 1], 4)).toEqual([2, 1, 1]);
    expect(largestRemainder([3, 1], 2)).toEqual([2, 0]);
    expect(largestRemainder([5], 3)).toEqual([3]);
  });

  it("raises the retirement chance with age, to certainty", () => {
    expect(retireChance(40)).toBeCloseTo(0.05, 12);
    expect(retireChance(75)).toBeGreaterThan(retireChance(70));
    expect(retireChance(85)).toBeGreaterThanOrEqual(1);
    expect(judgeRetireChance(60)).toBe(0);
    expect(judgeRetireChance(88)).toBeGreaterThanOrEqual(1);
  });
});

function drive(seed: number): { w: World; p: PoliticsState; run: (d: SimDate) => void } {
  const r = simNew(DATA, seed);
  if (!r.ok) throw new Error("no world");
  const w = simWorld(r.value);
  const draws = rngStreamsDraws(rngStreamsNew(seed + 1000));
  const run = (date: SimDate): void => politicsJob(w, { facts: { date }, draws } as never);
  return { w, p: w.politics as PoliticsState, run };
}

function counts(p: PoliticsState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of p.politicians) out[c.office.kind] = (out[c.office.kind] ?? 0) + 1;
  return out;
}

const FULL = { President: 1, VicePresident: 1, Cabinet: 15, House: 435, Senate: 100, Judge: 34 };

function president(p: PoliticsState): Politician {
  return p.politicians.find((c) => c.office.kind === "President") as Politician;
}

describe("generated politicians (D980, D987)", () => {
  it("keep to their office's ranges and never hold an opposite trait pair", () => {
    const { p } = drive(3);
    expect(president(p).party).toBe(START_PRESIDENT_PARTY);
    const opposite = (a: string, b: string): boolean => {
      const i = (TRAIT_VALUES as readonly string[]).indexOf(a);
      const j = (TRAIT_VALUES as readonly string[]).indexOf(b);
      return Math.floor(i / 2) === Math.floor(j / 2);
    };
    for (const c of p.politicians) {
      const r =
        c.office.kind === "House"
          ? HOUSE_RANGES
          : c.office.kind === "Senate"
            ? SENATE_RANGES
            : c.office.kind === "President"
              ? PRESIDENT_RANGES
              : c.office.kind === "Judge"
                ? JUDGE_RANGES
                : CABINET_RANGES;
      expect(c.age).toBeGreaterThanOrEqual(r.age.lo);
      expect(c.age).toBeLessThanOrEqual(r.age.hi);
      expect(c.traits.length === 1 || c.traits.length === 2).toBe(true);
      if (c.traits.length === 2) expect(opposite(c.traits[0] as string, c.traits[1] as string)).toBe(false);
      expect((c.office.kind === "Judge") === (c.integrity !== null)).toBe(true);
    }
  });
});

describe("fifty years of US government", () => {
  it("keeps every office full and the rules holding", () => {
    let demWins = 0;
    let repWins = 0;
    let houseFlips = 0;
    for (const seed of [1, 2, 3, 4]) {
      const { w, p, run } = drive(seed);
      const zone = w.zones[
        (w.countries[p.country] as World["countries"][number]).zone
      ] as World["zones"][number];
      let prevMajority: boolean | null = null;
      let judgesReplaced = 0;
      const judges = new Set(p.politicians.filter((c) => c.office.kind === "Judge").map((c) => c.id));
      for (let y = 2020; y < 2070; y++) {
        if (y > 2020) {
          run(simDateYmd(y, 1, 1));
          run(simDateYmd(y, 1, 3));
          expect(counts(p).House, `House at ${y}`).toBe(435);
          expect(counts(p).Senate, `Senate at ${y}`).toBe(100);
          const before = president(p);
          const beforeCabinet = p.politicians.filter((c) => c.office.kind === "Cabinet").map((c) => c.id);
          run(simDateYmd(y, 1, 20));
          expect(counts(p)).toEqual(FULL);
          expect(p.pending).toBeNull();
          expect(p.president_terms).toBeLessThanOrEqual(PRESIDENT_TERM_LIMIT);
          const after = president(p);
          const cabinet = p.politicians.filter((c) => c.office.kind === "Cabinet").map((c) => c.id);
          if (before.id === after.id) expect(cabinet).toEqual(beforeCabinet);
          else {
            // A new president brings a whole new cabinet of their party (D983).
            expect(cabinet.some((id) => beforeCabinet.includes(id))).toBe(false);
            expect(
              p.politicians.filter((c) => c.office.kind === "Cabinet").every((c) => c.party === after.party),
            ).toBe(true);
          }
          expect(p.politicians.map((c) => c.id)).toEqual(
            p.politicians.map((c) => c.id).sort((a, b) => a - b),
          );
        }
        if (isElectionYear(y)) {
          // A stand-in for the cycle: the economy does not run here.
          zone.effect = (y % 8) * 0.01 - 0.03;
          run(electionDay(y));
          const e = p.elections[p.elections.length - 1];
          if (e === undefined) throw new Error("no result");
          expect(e.house[0] + e.house[1]).toBe(435);
          expect(e.senate[0] + e.senate[1]).toBe(100);
          // D986's tuned range, with room: no landslide leaves a party under 100 seats.
          expect(e.house[0]).toBeGreaterThan(100);
          expect(e.house[0]).toBeLessThan(335);
          const majority = e.house[0] >= e.house[1];
          if (prevMajority !== null && majority !== prevMajority) houseFlips++;
          prevMajority = majority;
          if (e.president !== null) {
            if (e.president.party === "Democrats") demWins++;
            else repWins++;
            expect(e.president.shares[0] + e.president.shares[1]).toBeCloseTo(1, 12);
            expect(Math.max(...e.president.shares)).toBeLessThan(0.66);
            expect(e.president.winner).not.toBe(e.president.loser);
          }
          // Results count the seats as the handover will leave them.
        }
      }
      for (const c of p.politicians) {
        if (c.office.kind === "Judge" && !judges.has(c.id)) judgesReplaced++;
        expect(c.age).toBeLessThan(100);
      }
      expect(judgesReplaced).toBeGreaterThan(0);
      // Every seat's result matches who sits after the last handover.
      const last = p.elections[p.elections.length - 1] as NonNullable<(typeof p.elections)[number]>;
      expect(partySeats(p.politicians.filter((c) => c.office.kind === "House"))).toEqual(last.house);
    }
    expect(demWins).toBeGreaterThan(5);
    expect(repWins).toBeGreaterThan(5);
    expect(houseFlips).toBeGreaterThan(3);
    expect(otherParty("Democrats")).toBe("Republicans");
  });

  it("nominates nobody past the age a member is certain to retire (D985, D988)", () => {
    const { p, run } = drive(1);
    const senators = p.politicians.filter(
      (c) =>
        c.office.kind === "Senate" &&
        c.office.senate_class !== senateClassUp(2020) &&
        c.party === "Republicans",
    );
    const young = senators.reduce((a, b) => (b.skills.persuasion < a.skills.persuasion ? b : a));
    for (const c of senators) c.age = 90;
    young.age = 60;
    run(electionDay(2020));
    const vote = p.elections[0]?.president;
    expect([vote?.winner, vote?.loser]).toContain(young.name);
  });

  it("does not run a sitting president past that age (D985, D988)", () => {
    const { p, run } = drive(1);
    const sitting = president(p);
    sitting.age = 90;
    const vp = p.politicians.find((c) => c.office.kind === "VicePresident") as Politician;
    run(electionDay(2020));
    const vote = p.elections[0]?.president;
    expect([vote?.winner, vote?.loser]).toContain(vp.name);
    expect([vote?.winner, vote?.loser]).not.toContain(sitting.name);
  });
});
