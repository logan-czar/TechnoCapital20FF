// A historical world's US politics (1995-rework 7): the real Congress at the start, then 25 years of
// government through the politics and elections jobs alone (the economy need not run for it), and the levers.
import { describe, expect, it } from "vitest";
import {
  eraPolicyJob,
  LEVER_STEP_SPLIT,
  LEVER_STEP_UNIFIED,
  leverStep,
  PARTY_LEVERS,
} from "../src/era/policy.ts";
import { fiscalDemandMult } from "../src/governing/levers.ts";
import { simNew, simViews, simWorld } from "../src/lib.ts";
import { equalProportions, eraBlocs, HOUSE_SEATS, IDEOLOGY_WINDOWS } from "../src/politics/era.ts";
import { eraTide, FATIGUE_PER_TERM, MIDTERM_PENALTY, partyTermsHeld } from "../src/politics/jobs.ts";
import { partySeats } from "../src/politics/state.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { Politician, PoliticsState } from "../src/types/state/politics.ts";
import type { World } from "../src/types/world.ts";
import { data, data1995 } from "./common/index.ts";
import { runDays, runDraws } from "./elections/harness.ts";

function start(seed: number): World {
  const made = simNew(data1995(), seed, { scenario: "stable" });
  if (!made.ok) throw new Error("did not load");
  return simWorld(made.value);
}

function holders(p: PoliticsState, kind: Politician["office"]["kind"]): Politician[] {
  return p.politicians.filter((c) => c.office.kind === kind);
}

/** Runs the politics and elections jobs on every day of `first` to the end of `last`'s January. */
function runYears(w: World, seed: number, first: number, last: number): void {
  runDays(w, runDraws(seed), simDateYmd(first, 1, 1), simDateYmd(last, 1, 31));
}

describe("the tides of a November (1995-rework 7.3)", () => {
  const dem = (year: number) => ({ year, party: "Democrats" as const });
  const rep = (year: number) => ({ year, party: "Republicans" as const });

  it("counts the whole terms the president's party has held", () => {
    expect(partyTermsHeld([dem(1993)], 1996)).toBe(1);
    expect(partyTermsHeld([dem(1993)], 2000)).toBe(2);
    expect(partyTermsHeld([dem(1993), dem(1997), dem(2001)], 2004)).toBe(3);
    expect(partyTermsHeld([dem(1993), rep(2001)], 2004)).toBe(1);
  });

  it("runs against the president's party at a midterm, whichever it is", () => {
    const w = start(1);
    const date = simDateYmd(1998, 11, 3);
    expect(eraTide(w, "Democrats", date)).toBe(-MIDTERM_PENALTY);
    expect(eraTide(w, "Republicans", date)).toBe(MIDTERM_PENALTY);
  });

  it("leaves a first re-election alone and grows against a party long in the White House", () => {
    const w = start(1);
    const era = w.era;
    if (era === undefined) throw new Error("no era");
    const name = "";
    era.history.presidents = [{ ...dem(1993), name }];
    expect(eraTide(w, "Democrats", simDateYmd(1996, 11, 5))).toBeCloseTo(0);
    era.history.presidents = [
      { ...dem(1993), name },
      { ...dem(1997), name },
    ];
    expect(eraTide(w, "Democrats", simDateYmd(2000, 11, 7))).toBeCloseTo(-FATIGUE_PER_TERM);
    era.history.presidents = [
      { ...rep(1993), name },
      { ...rep(1997), name },
      { ...rep(2001), name },
    ];
    expect(eraTide(w, "Republicans", simDateYmd(2004, 11, 2))).toBeCloseTo(2 * FATIGUE_PER_TERM);
  });

  it("is not in the 2020 world", () => {
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    expect(eraTide(simWorld(made.value), "Democrats", simDateYmd(2022, 11, 8))).toBe(0);
  });
});

describe("the start (1995-rework 7.2)", () => {
  it("is the 104th Congress under a first-term Democrat", () => {
    const p = start(1).politics;
    expect(partySeats(holders(p, "House"))).toEqual([205, 230]);
    expect(partySeats(holders(p, "Senate"))).toEqual([47, 53]);
    expect(holders(p, "President")[0]?.party).toBe("Democrats");
    expect(p.president_terms).toBe(1);
    expect(holders(p, "Cabinet").length).toBe(14);
  });

  it("gives each state its real delegation, its Democrats in its most Democratic districts", () => {
    const d = data1995();
    const p = start(2).politics;
    p.states.forEach((s, si) => {
      const row = d.politics_era.rows.find((r) => r.state === s.name);
      const house = holders(p, "House").filter((c) => c.office.kind === "House" && c.office.state === si);
      const senate = holders(p, "Senate").filter((c) => c.office.kind === "Senate" && c.office.state === si);
      expect(partySeats(house)[0]).toBe(row?.start_house_dem);
      expect(partySeats(senate)[0]).toBe(row?.start_senate_dem);
      const lean = (c: Politician): number =>
        c.office.kind === "House" ? (p.districts[c.office.district]?.lean_pts ?? 0) : 0;
      const dems = house.filter((c) => c.party === "Democrats").map(lean);
      const reps = house.filter((c) => c.party === "Republicans").map(lean);
      if (dems.length > 0 && reps.length > 0)
        expect(Math.min(...dems)).toBeGreaterThanOrEqual(Math.max(...reps));
    });
  });

  it("has 1990-census seats, and no name twice", () => {
    const p = start(3).politics;
    const of = (name: string): number | undefined => p.states.find((s) => s.name === name)?.house_seats;
    expect([of("California"), of("New York"), of("Texas"), of("Florida")]).toEqual([52, 31, 30, 23]);
    const names = p.politicians.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(names.map((n) => n.split(" ").at(-1))).size).toBeGreaterThan(200);
  });

  it("starts without the later ideologies, which its view names for the time", () => {
    const made = simNew(data1995(), 4, { scenario: "stable" });
    if (!made.ok) throw new Error("did not load");
    const held = new Set(simWorld(made.value).politics.politicians.map((c) => c.ideology));
    for (const [ideology] of IDEOLOGY_WINDOWS) expect(held.has(ideology)).toBe(false);
    expect(simViews(made.value).politics.data.ideology_names?.Chuds).toBe("Social Conservatives");
  });

  it("leaves the 2020 world's view without those names", () => {
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    expect("ideology_names" in simViews(made.value).politics.data).toBe(false);
  });
});

describe("equal proportions (1995-rework 7.4)", () => {
  it("fills the House with a seat for each state, none for a seatless one", () => {
    const seats = equalProportions([10, 0, 1, 5], 9);
    expect(seats).toEqual([5, 0, 1, 3]);
  });

  it("comes close to the 1990 House from the 1990 census", () => {
    const d = data1995();
    const seats = equalProportions(
      d.politics_era.rows.map((r, i) => (d.politics_states.rows[i]?.house_seats ? r.pop_1990_m : 0)),
      HOUSE_SEATS,
    );
    expect(seats.reduce((a, b) => a + b, 0)).toBe(HOUSE_SEATS);
    let off = 0;
    seats.forEach((n, i) => {
      off += Math.abs(n - (d.politics_states.rows[i]?.house_seats ?? 0));
    });
    // The real count added overseas personnel, which moved one seat in 1990.
    expect(off).toBeLessThanOrEqual(2);
  });
});

// The vote and the handovers are lane E's elections in a world with counties (D1040), which keep the
// POC's table as a mirror; the lean drift and the census are lane G's (pivot 5.2, 5.3).
describe("25 years of government (1995-rework 7.3, 7.6; pivot 6)", () => {
  it("keeps every seat full, with the mirror's members in their states' districts", () => {
    const w = start(5);
    const p = w.politics;
    // Through the handovers of the last vote.
    runYears(w, 5, 1995, 2021);
    expect(p.states.map((s) => s.house_seats).reduce((a, b) => a + b, 0)).toBe(HOUSE_SEATS);
    expect(p.districts.length).toBe(HOUSE_SEATS);
    const house = holders(p, "House");
    expect(house.length).toBe(HOUSE_SEATS);
    const seated = house.map((c) => (c.office.kind === "House" ? c.office.district : -1));
    expect(new Set(seated).size).toBe(HOUSE_SEATS);
    house.forEach((c) => {
      if (c.office.kind !== "House") return;
      expect(p.districts[c.office.district]?.state).toBe(c.office.state);
    });
    // A senator who became president leaves a seat empty until its special election.
    expect(holders(p, "Senate").length).toBeGreaterThanOrEqual(99);
    const last = p.elections.at(-1);
    expect(partySeats(house)).toEqual(last?.house);
    expect(p.elections).toHaveLength(13);
  });

  it("brings each new ideology in at its year, and draws it no sooner", () => {
    const era = start(8).era;
    const rows = era?.politics.ideologies ?? [];
    expect(rows.length).toBe(IDEOLOGY_WINDOWS.length);
    for (const r of rows) {
      const [, first, last] = IDEOLOGY_WINDOWS.find(([i]) => i === r.ideology) as readonly [
        string,
        number,
        number,
      ];
      expect(r.from_year).toBeGreaterThanOrEqual(first);
      expect(r.from_year).toBeLessThanOrEqual(last);
      const weight = (year: number): number => {
        const all = Object.values(eraBlocs(rows, year)).flat();
        return (all.find(([i]) => i === r.ideology) as readonly [string, number])[1];
      };
      expect(weight(r.from_year - 1)).toBe(0);
      expect(weight(r.from_year)).toBeGreaterThan(0);
      expect(weight(r.from_year + 10)).toBeGreaterThan(weight(r.from_year));
    }
  });

  it("is the same for the same seed", () => {
    const a = start(9);
    const b = start(9);
    runYears(a, 9, 1995, 2005);
    runYears(b, 9, 1995, 2005);
    expect(a.politics.elections).toEqual(b.politics.elections);
  });
});

describe("the levers (1995-rework 7.5)", () => {
  const job = (w: World): void => eraPolicyJob(w, {} as never);
  const usa = (w: World): World["countries"][number] => w.countries[w.politics.country] as never;
  const giveChamber = (w: World, kind: "House" | "Senate", party: Politician["party"]): void => {
    for (const c of holders(w.politics, kind)) c.party = party;
  };

  it("step by who holds what", () => {
    expect(leverStep(true, true)).toBe(LEVER_STEP_UNIFIED);
    expect(leverStep(true, false)).toBe(LEVER_STEP_SPLIT);
    expect(leverStep(false, true)).toBe(LEVER_STEP_SPLIT);
    expect(leverStep(false, false)).toBe(0);
  });

  it("freeze under the start's opposed Congress", () => {
    const w = start(10);
    const tax = usa(w).corp_tax_rate;
    job(w);
    expect(usa(w).corp_tax_rate).toBe(tax);
    expect(w.levers.corp_tax).toBe(tax);
    expect(fiscalDemandMult(w)).toBe(1);
    expect(w.levers.rate_bias).toBe(0);
  });

  it("move toward the president's party, and the fiscal push lifts demand", () => {
    const w = start(11);
    giveChamber(w, "House", "Democrats");
    giveChamber(w, "Senate", "Democrats");
    const core = w.industries.map((i) => i.demand_core);
    job(w);
    // The drift writes the levers (pivot 4.3), and the USA's row shows the tax lever.
    expect(w.levers.fiscal).toBeCloseTo(LEVER_STEP_UNIFIED * PARTY_LEVERS.Democrats.fiscal);
    expect(w.levers.rate_bias).toBeLessThan(0);
    expect(fiscalDemandMult(w)).toBeGreaterThan(1);
    expect(usa(w).corp_tax_rate).toBe(w.levers.corp_tax);
    expect(w.industries.map((i) => i.demand_core)).toEqual(core);
  });

  it("cut the tax rate under a Republican government, slowly with one chamber", () => {
    const unified = start(12);
    const tax = usa(unified).corp_tax_rate;
    (holders(unified.politics, "President")[0] as Politician).party = "Republicans";
    job(unified);
    expect(usa(unified).corp_tax_rate).toBeCloseTo(
      tax + LEVER_STEP_UNIFIED * (PARTY_LEVERS.Republicans.corp_tax_rate - tax),
    );
    const split = start(12);
    (holders(split.politics, "President")[0] as Politician).party = "Republicans";
    giveChamber(split, "Senate", "Democrats");
    job(split);
    expect(usa(split).corp_tax_rate).toBeCloseTo(
      tax + LEVER_STEP_SPLIT * (PARTY_LEVERS.Republicans.corp_tax_rate - tax),
    );
  });

  it("are not in the 2020 world", () => {
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    const w = simWorld(made.value);
    const tax = usa(w).corp_tax_rate;
    job(w);
    expect(usa(w).corp_tax_rate).toBe(tax);
  });
});
