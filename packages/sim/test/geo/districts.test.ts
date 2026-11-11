// Lane G (pivot 5.2 to 5.6; D1039): the House map on the 1995 world's real counties. The start's
// plans cover every county exactly once, are equal in people and contiguous, and sum to 435 seats;
// the partisan drawer moves expected seats its way; a big county can give districts leaning both
// ways; drift keeps each state's mean lean; a census moves seats; a court can strike a map.

import { beforeAll, describe, expect, it } from "vitest";
import { type DrawStats, drawPlan, expectedSeatsA, regionContiguous } from "../../src/geo/district.ts";
import { driftCountiesYear } from "../../src/geo/drift.ts";
import { geoDistrict, geoJob, geoPlanOf, geoStart, takeCensus } from "../../src/geo/index.ts";
import {
  countiesByState,
  DISTRICT_POP_TOLERANCE,
  districtNow,
  drawStatsNew,
  shareLean,
  stateGraph,
} from "../../src/geo/plans.ts";
import {
  CHALLENGE_STRENGTH,
  courtStrikes,
  gerrymanderStrength,
  type Judge,
} from "../../src/geo/redistrict.ts";
import { simNew, simWorld } from "../../src/lib.ts";
import { HOUSE_SEATS } from "../../src/politics/era.ts";
import { rngStreamsDraws, rngStreamsNew } from "../../src/rng.ts";
import { dateTimeMidnight } from "../../src/time/calendar.ts";
import { controlsDefault } from "../../src/time/control.ts";
import { jobCtxNew, tickFactsNew } from "../../src/time/scheduler.ts";
import type { SimDate } from "../../src/types/calendar.ts";
import type { County, DistrictPlan, GeoState } from "../../src/types/state/geo.ts";
import type { World } from "../../src/types/world.ts";
import { data1995, unwrap } from "../common/index.ts";

function world1995(seed: number): World {
  return simWorld(unwrap(simNew(data1995(), seed), "1995 world"));
}

function stateIndex(w: World, name: string): number {
  return w.politics.states.findIndex((s) => s.name === name);
}

/** Runs the geo job alone on `date` with a fresh draw source. */
function runGeoOn(w: World, date: SimDate, seed: number): void {
  const draws = rngStreamsDraws(rngStreamsNew(seed));
  const ctx = jobCtxNew(tickFactsNew(dateTimeMidnight(date)), draws, [], controlsDefault());
  geoJob(w, ctx);
}

/** Every property pivot 5.4 asks of a set of plans, as a list of failures. */
function planFaults(geo: GeoState, plans: readonly DistrictPlan[], states: number): string[] {
  const faults: string[] = [];
  const cover: [number, number][][] = geo.counties.map(() => []);
  const byState = countiesByState(geo, states);
  for (const p of plans) {
    const ids = byState[p.state] as number[];
    const g = stateGraph(geo, ids);
    const local = new Map(ids.map((id, i) => [id, i] as const));
    const total = ids.reduce((n, i) => n + (geo.counties[i] as County).population, 0);
    const ideal = total / p.districts.length;
    p.districts.forEach((d, k) => {
      if (d.number !== k + 1) faults.push(`${p.state}: district ${k} numbered ${d.number}`);
      for (const s of d.shares) cover[s.county]?.push([s.from, s.to]);
      const now = districtNow(geo, d);
      if (Math.abs(d.population - ideal) > DISTRICT_POP_TOLERANCE * ideal)
        faults.push(`${p.state}/${d.number}: ${d.population} people, ideal ${ideal}`);
      if (Math.abs(now.population - d.population) > 1) faults.push(`${p.state}/${d.number}: population`);
      const region = d.shares.map((s) => ({ i: local.get(s.county) as number, from: s.from, to: s.to }));
      if (!regionContiguous(g, region)) faults.push(`${p.state}/${d.number}: not contiguous`);
    });
  }
  geo.counties.forEach((c, i) => {
    const iv = (cover[i] as [number, number][]).sort((a, b) => a[0] - b[0]);
    const hasPlan = plans.some((p) => p.state === c.state);
    if (!hasPlan) {
      if (iv.length > 0) faults.push(`${c.fips}: covered with no plan`);
      return;
    }
    if (iv.length === 0) {
      faults.push(`${c.fips}: not covered`);
      return;
    }
    if (iv[0]?.[0] !== 0 || iv.at(-1)?.[1] !== 1) faults.push(`${c.fips}: ends ${JSON.stringify(iv)}`);
    for (let j = 1; j < iv.length; j++) {
      if (iv[j]?.[0] !== iv[j - 1]?.[1]) faults.push(`${c.fips}: gap or overlap ${JSON.stringify(iv)}`);
    }
  });
  return faults;
}

describe("the start's plans (pivot 5.3, 5.4)", () => {
  let w: World;
  beforeAll(() => {
    w = world1995(1);
  });

  it("apportions 435 seats from the 1990 people, one plan per state with a seat, neutral", () => {
    const geo = w.geo;
    expect(geo.seats.reduce((a, b) => a + b, 0)).toBe(HOUSE_SEATS);
    expect(geo.plans.reduce((n, p) => n + p.districts.length, 0)).toBe(HOUSE_SEATS);
    expect(geo.plans.length).toBe(50);
    for (const p of geo.plans) {
      expect(p.districts.length).toBe(geo.seats[p.state]);
      expect([p.drawn_by, p.strength, p.struck, p.census_year]).toEqual([null, 0, false, 1990]);
    }
    expect(geo.censuses).toEqual([]);
    expect(geo.seats[stateIndex(w, "California")]).toBeGreaterThanOrEqual(52);
    expect(geoDistrict(geo, geoPlanOf(geo, 0 as never)?.state ?? (0 as never), 1)).toBeDefined();
  });

  it("covers every county exactly once, equal in people and contiguous", () => {
    expect(planFaults(w.geo, w.geo.plans, w.politics.states.length)).toEqual([]);
  });

  it("is the same for the same seed", () => {
    expect(world1995(1).geo.plans).toEqual(w.geo.plans);
  });

  it("splits a big county into districts leaning both ways", () => {
    const geo = w.geo;
    const leans = geo.counties.map(() => [] as number[]);
    for (const p of geo.plans)
      for (const d of p.districts)
        for (const s of d.shares) leans[s.county]?.push(shareLean(geo.counties[s.county] as County, s));
    const both = leans.filter((l) => l.some((x) => x > 0) && l.some((x) => x < 0));
    expect(both.length).toBeGreaterThan(0);
  });
});

describe("the partisan drawer (pivot 5.5)", () => {
  const w = world1995(1);
  const byState = countiesByState(w.geo, w.politics.states.length);
  const seatsOf = (name: string): number => w.geo.seats[stateIndex(w, name)] as number;

  for (const name of ["Pennsylvania", "Wisconsin", "Maryland"]) {
    it(`moves ${name}'s expected seats the drawer's way, weakly with strength`, () => {
      const g = stateGraph(w.geo, byState[stateIndex(w, name)] as number[]);
      const stats: DrawStats = drawStatsNew();
      const exp = (s: number, sign: number): number =>
        expectedSeatsA(g, drawPlan(g, seatsOf(name), s, sign, 0.1, stats));
      const neutral = exp(0, 1);
      const a = [exp(0.5, 1), exp(1, 1)];
      const b = [exp(0.5, -1), exp(1, -1)];
      const slack = 0.05;
      expect(a[0]).toBeGreaterThanOrEqual(neutral - slack);
      expect(a[1]).toBeGreaterThanOrEqual((a[0] as number) - slack);
      expect(b[0]).toBeLessThanOrEqual(neutral + slack);
      expect(b[1]).toBeLessThanOrEqual((b[0] as number) + slack);
      expect((a[1] as number) - (b[1] as number)).toBeGreaterThan(0.2);
      expect(stats.forced).toBe(0);
    });
  }

  it("rises with intrigue and falls with integrity", () => {
    expect(gerrymanderStrength(30, 50, [])).toBeGreaterThan(gerrymanderStrength(15, 50, []));
    expect(gerrymanderStrength(15, 90, [])).toBeLessThan(gerrymanderStrength(15, 50, []));
    expect(gerrymanderStrength(15, 50, ["Honest"])).toBeLessThan(gerrymanderStrength(15, 50, []));
    expect(gerrymanderStrength(30, 0, ["Deceitful", "Ruthless"])).toBe(1);
  });
});

describe("drift and the census (pivot 5.2, 5.3)", () => {
  it("keeps each state's people-weighted mean lean on the state's lean", () => {
    const w = world1995(2);
    const states = w.politics.states.length;
    const byState = countiesByState(w.geo, states);
    const g = rngStreamsDraws(rngStreamsNew(5));
    const before = w.geo.counties.map((c) => c.lean);
    for (let y = 0; y < 5; y++) {
      for (const s of w.politics.states) s.lean_pts += 1.5;
      driftCountiesYear(w, w.geo, byState, g);
    }
    expect(w.geo.counties.map((c) => c.lean)).not.toEqual(before);
    let held = 0;
    w.politics.states.forEach((st, s) => {
      const ids = byState[s] as number[];
      // A state whose lean is beyond some county's limit (100 less its spread) cannot be met: DC.
      const room = Math.min(...ids.map((i) => 100 - (w.geo.counties[i] as County).spread));
      if (Math.abs(st.lean_pts) > room) return;
      held++;
      const people = ids.reduce((n, i) => n + (w.geo.counties[i] as County).population, 0);
      const mean =
        ids.reduce(
          (n, i) => n + (w.geo.counties[i] as County).population * (w.geo.counties[i] as County).lean,
          0,
        ) / people;
      expect(Math.abs(mean - st.lean_pts), st.name).toBeLessThan(0.01);
    });
    expect(held).toBeGreaterThanOrEqual(48);
    for (const c of w.geo.counties) {
      expect(Number.isInteger(c.population) && Math.abs(c.lean) + c.spread <= 100 + 1e-9, c.fips).toBe(true);
    }
  });

  it("moves seats to a state that grew, and redraws for them the next July", () => {
    const w = world1995(3);
    const texas = stateIndex(w, "Texas");
    for (const c of w.geo.counties) if (c.state === texas) c.population = Math.round(c.population * 1.4);
    const before = [...w.geo.seats];
    runGeoOn(w, { year: 2000, month: 4, day: 1 }, 1);
    const census = w.geo.censuses.at(-1);
    expect(census?.year).toBe(2000);
    expect(census?.seats.reduce((a, b) => a + b, 0)).toBe(HOUSE_SEATS);
    expect(census?.seats[texas]).toBeGreaterThan(before[texas] as number);
    expect(census?.seats.some((n, s) => n < (before[s] as number))).toBe(true);
    expect(w.geo.seats).toEqual(before);
    runGeoOn(w, { year: 2001, month: 7, day: 1 }, 1);
    expect(w.geo.seats).toEqual(census?.seats);
    expect(w.geo.history.length).toBe(50);
    expect(geoPlanOf(w.geo, texas as never)?.districts.length).toBe(census?.seats[texas]);
    expect(w.geo.plans.filter((p) => p.districts.length > 1).every((p) => p.drawn_by !== null)).toBe(true);
    expect(planFaults(w.geo, w.geo.plans, w.politics.states.length)).toEqual([]);
  });

  it("takes a census from the counties' people as they are", () => {
    const w = world1995(4);
    const c = takeCensus(w.geo, 2010, w.politics.states.length);
    expect(c.population.reduce((a, b) => a + b, 0)).toBe(
      w.geo.counties.reduce((n, x) => n + x.population, 0),
    );
  });
});

describe("court challenges (pivot 5.6)", () => {
  it("strikes a strong map before honest judges of the other party, and upholds it before friendly ones", () => {
    const honest: Judge[] = [0, 1, 2].map(() => ({ integrity: 100, party: "Republicans", leaning: null }));
    const friendly: Judge[] = [0, 1, 2].map(() => ({ integrity: 0, party: "Democrats", leaning: "State" }));
    const g = rngStreamsDraws(rngStreamsNew(1));
    let struck = 0;
    let upheld = 0;
    for (let i = 0; i < 20; i++) {
      if (courtStrikes(honest, 1, "Democrats", g)) struck++;
      if (!courtStrikes(friendly, 1, "Democrats", g)) upheld++;
    }
    expect(struck).toBeGreaterThan(15);
    expect(upheld).toBeGreaterThan(15);
  });

  it("redraws a struck map at lower strength and keeps the struck one in history", () => {
    let found = false;
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const w = world1995(1);
      const pa = stateIndex(w, "Maryland");
      const plan = geoPlanOf(w.geo, pa as never) as DistrictPlan;
      plan.drawn_by = "Democrats";
      plan.strength = 1;
      w.geo.challenges.push({
        state: plan.state,
        census_year: plan.census_year,
        filed: { year: 1995, month: 7, day: 1 },
        ruling: { year: 1995, month: 11, day: 1 },
        status: "Filed",
      });
      runGeoOn(w, { year: 1995, month: 11, day: 1 }, seed);
      const c = w.geo.challenges[0];
      expect(c?.status).not.toBe("Filed");
      if (c?.status !== "Struck") continue;
      found = true;
      const now = geoPlanOf(w.geo, pa as never) as DistrictPlan;
      expect(now.strength).toBeLessThan(CHALLENGE_STRENGTH);
      expect(now.drawn_by).toBe("Democrats");
      expect(w.geo.history.at(-1)?.struck).toBe(true);
      expect(planFaults(w.geo, [now], w.politics.states.length)).toEqual([]);
    }
    expect(found).toBe(true);
  });
});

describe("a world with no counties", () => {
  it("draws nothing at the start", () => {
    const w = world1995(1);
    w.geo.counties = [];
    w.geo.plans = [];
    w.geo.seats = [];
    geoStart(w, rngStreamsDraws(rngStreamsNew(1)));
    expect(w.geo.plans).toEqual([]);
  });
});
