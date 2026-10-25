// Port of crates/sim/tests/spec_5_19_1.rs: spec 5.19.1 (random startup events), build-plan M6.6:
// the industry weight (heat, fringe factor, the Glut and Bust zero and the all-zero fallback), the
// type table, the HQ province weight (2-map 2.3.1) and a 300-seed Monte-Carlo of the event rate
// (about 8 a year in the 2020s) over seeded streams.
//
// Expects:
//   ../../src/births/random.ts   TYPE_CUMULATIVE, TYPE_TABLE (rows with `chance`), drawRandomEvent(
//                                industries: [IndustryId, weight][], hq(industry) -> [ProvinceId,
//                                weight][], draws) -> EventDraft | null, drawRandomEvents(...) ->
//                                EventDraft[], drawType(draws) -> EventType, eventCount(draws),
//                                eventTypeRow(t) -> TypeRow { startups {lo, hi}, revenue_musd [lo,
//                                hi], full {lo, hi}, partial {lo, hi} }          [EventType::row]
//                                EventDraft { kind: EventKind, startups: StartupDraft[] },
//                                StartupDraft { industry, hq, target_revenue_usd, full, partial }
//   ../../src/births/weights.ts  developmentAboveFloor, fringeFactor, gdpPerHead, heat, hqWeight,
//                                industryWeight, provinceWeight, wealthFactor, weightedPick
//   ../../src/world/load.ts      buildWorld (World::from_data)
//   "@tc20ff/sim-data"           worldDataAllProvinces (ported)
//
// Changed from the Rust: the generator is new (D951), so the seeds (0..299, 7, 11, 5) do not
// reproduce Rust draws. The Monte-Carlo asserts keep their statistical tolerances (rate 8 +- 0.2
// over 3,000 seed-years, type shares +- 1.5 points, 1.225 startups an event +- 0.02); they hold
// for any good generator, and a failure at a tolerance edge means a bias, not a seed to change.
// The "gen stream only" check compares the other four streams' next draws between a stream set
// that drew events and a fresh one (rngStreamsNextU32 in place of next_u64: the raw draw is 32-bit
// in TS). The println of the run summary is dropped.
import { worldDataAllProvinces } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import {
  drawRandomEvent,
  drawRandomEvents,
  drawType,
  eventCount,
  eventTypeRow,
  TYPE_CUMULATIVE,
  TYPE_TABLE,
} from "../../src/births/random.ts";
import {
  developmentAboveFloor,
  fringeFactor,
  gdpPerHead,
  heat,
  hqWeight,
  industryWeight,
  provinceWeight,
  wealthFactor,
  weightedPick,
} from "../../src/births/weights.ts";
import { rngStreamsDraws, rngStreamsNextU32 } from "../../src/rng.ts";
import type { IndustryId, ProvinceId } from "../../src/types/ids.ts";
import { cmpStr, maxF } from "../../src/types/num.ts";
import type { EventType } from "../../src/types/state/births.ts";
import { EVENT_TYPE_VALUES } from "../../src/types/state/births.ts";
import type { PhaseLabel } from "../../src/types/world.ts";
import { buildWorld } from "../../src/world/load.ts";
import { data, unwrap } from "./common/index.ts";
import { newNoNoise, newRngStreams, newScripted, scriptedPush } from "./common/rng.ts";

const qOf = (yearRate: number): number => (1.0 + yearRate) ** 0.25 - 1.0;

describe("spec 5.19.1 random startup events", () => {
  it("heat_and_fringe_factor", () => {
    // h = max(0, (1 + q)^4 - 1 - 6%): 10% a year is 4 points of heat; 3% none.
    expect(Math.abs(heat(qOf(0.1)) - 0.04) < 1e-12).toBe(true);
    expect(heat(qOf(0.03))).toBe(0.0);
    // f = clamp(1 + log10(fringe $B), 0.5, 5).
    expect(Math.abs(fringeFactor(1.0e9) - 1.0) < 1e-12).toBe(true);
    expect(Math.abs(fringeFactor(100.0e9) - 3.0) < 1e-12).toBe(true);
    expect(fringeFactor(1.0e14)).toBe(5.0);
    expect(fringeFactor(0.1e9)).toBe(0.5);
    // D261: no fringe revenue reads the clamp floor.
    expect(fringeFactor(0.0)).toBe(0.5);
  });

  it("industry_weight_rule", () => {
    // w = f x (0.02 + h)^2: a $1B fringe on trend at 3% weighs 0.0004.
    expect(Math.abs(industryWeight(qOf(0.03), 1.0e9, "Normal") - 0.0004) < 1e-15).toBe(true);
    // Glut and Bust weigh 0; Boom does not.
    expect(industryWeight(qOf(0.5), 1.0e9, "Glut")).toBe(0.0);
    expect(industryWeight(qOf(0.5), 1.0e9, "Bust")).toBe(0.0);
    expect(industryWeight(qOf(0.5), 1.0e9, "Boom")).toBeGreaterThan(0);
    // The square makes hot industries win: AI labs at 100% a year (h 0.94) against Retail at 3%
    // with a fringe 100x larger: 0.96^2 x f(5) vs 0.02^2 x f(500).
    const ai = industryWeight(qOf(1.0), 5.0e9, "Boom");
    const retail = industryWeight(qOf(0.03), 500.0e9, "Normal");
    const f5 = 1.0 + Math.log10(5.0);
    const f500 = 1.0 + Math.log10(500.0);
    expect(Math.abs(ai - f5 * 0.96 ** 2) < 1e-9).toBe(true);
    expect(Math.abs(retail - f500 * 0.0004) < 1e-12).toBe(true);
    expect(ai / retail).toBeGreaterThan(500);
  });

  it("weighted_pick_and_fallback", () => {
    // All zero (every industry Glut or Bust, D261): no pick and no draw.
    const s = newScripted();
    expect(weightedPick([0.0, 0.0], s)).toBeNull();
    // u 0.5 of total 4: the cumulative walk lands in the second entry.
    scriptedPush(s, "Gen", [0.5]);
    expect(weightedPick([1.0, 2.0, 1.0], s)).toBe(1);
    // Zero entries are skipped.
    scriptedPush(s, "Gen", [0.0]);
    expect(weightedPick([0.0, 3.0], s)).toBe(1);
    // An event with every industry at 0 does not fire.
    const ind: [IndustryId, number][] = [
      [0 as IndustryId, 0.0],
      [1 as IndustryId, 0.0],
    ];
    const hq = (_: IndustryId): [ProvinceId, number][] => [[0 as ProvinceId, 1.0]];
    expect(drawRandomEvent(ind, hq, newNoNoise())).toBeNull();
  });

  it("type_table_and_count", () => {
    // Spec 5.19.1: 50 / 30 / 15 / 5.
    const chances = TYPE_TABLE.map((r) => r.chance);
    expect(chances).toEqual([0.5, 0.3, 0.15, 0.05]);
    let acc = 0.0;
    chances.forEach((c, i) => {
      acc += c;
      expect(Math.abs(acc - (TYPE_CUMULATIVE[i] as number)) < 1e-12).toBe(true);
    });
    const s = newScripted();
    scriptedPush(s, "Gen", [0.49, 0.5, 0.79, 0.8, 0.949, 0.95, 0.999]);
    const kinds: EventType[] = [];
    for (let i = 0; i < 7; i++) kinds.push(drawType(s));
    expect(kinds).toEqual([
      "GarageFounder",
      "SpinOutTeam",
      "SpinOutTeam",
      "HotCluster",
      "HotCluster",
      "BackedVenture",
      "BackedVenture",
    ]);
    // Rows: startups, revenue ($M), full and partial characters each.
    const hot = eventTypeRow("HotCluster");
    expect([hot.startups.lo, hot.startups.hi]).toEqual([2, 3]);
    expect(hot.revenue_musd).toEqual([5.0, 30.0]);
    const backed = eventTypeRow("BackedVenture");
    expect([backed.full.lo, backed.full.hi, backed.partial.lo, backed.partial.hi]).toEqual([3, 5, 3, 5]);
    // NoNoise's Poisson is its rounded mean: 2.
    expect(eventCount(newNoNoise())).toBe(2);
  });

  it("province_weight_from_2_map_2_3_1", () => {
    // G = sqrt(GDP per head / world GDP per head), clamped 0.1 to 4 (batch 160, D260).
    const d = data();
    let gdp = 0;
    let pop = 0;
    for (const c of d.countries.rows) {
      gdp += c.gdp_usd_bn;
      pop += c.population_m;
    }
    const world = gdpPerHead(gdp, pop);
    // About $11,209 (thousands of USD a head in CSV units).
    expect(Math.abs(world - 11.209) < 0.01, `world ${world}`).toBe(true);
    const g = (iso: string): number => {
      const c = d.countries.rows.find((x) => x.iso3 === iso);
      if (c === undefined) throw new Error(`no country ${iso}`);
      return wealthFactor(gdpPerHead(c.gdp_usd_bn, c.population_m), world);
    };
    const wants: [string, number][] = [
      ["USA", 2.53],
      ["CAN", 2.04],
      ["CHL", 1.15],
      ["MYS", 0.99],
      ["CHN", 0.95],
      ["NGA", 0.45],
      ["IND", 0.43],
      ["BDI", 0.15],
    ];
    for (const [iso, want] of wants) {
      expect(Math.abs(g(iso) - want) < 0.006, `${iso} G ${g(iso)}`).toBe(true);
    }
    // The safety clamp touches only Vatican City (5.17 to 4).
    expect(g("VAT")).toBe(4.0);
    const clamped = d.countries.rows
      .filter((c) => {
        const r = Math.sqrt(gdpPerHead(c.gdp_usd_bn, c.population_m) / world);
        return !(r >= 0.1 && r <= 4.0);
      })
      .map((c) => c.iso3);
    expect(clamped).toEqual(["VAT"]);
    // Examples: a US Metro core province at 75 weighs $56.9B; Penang (30, G 0.99) about $8.95B.
    expect(Math.abs(provinceWeight(75, g("USA")) / 1e9 - 56.9) < 0.1).toBe(true);
    expect(Math.abs(provinceWeight(30, g("MYS")) / 1e9 - 8.95) < 0.1).toBe(true);
    // HQ weight: x (1 + named companies of the industry there) x 3 with a key city listing it.
    expect(hqWeight(10.0e9, 2, true)).toBe(90.0e9);
    expect(hqWeight(10.0e9, 0, false)).toBe(10.0e9);
  });

  // D830 (Logan, 2026-10-24): the startup HQ weight counts development above the floor, so a
  // province at 1/1/1 draws no HQ; a country with every province at the floor keeps the 2.3.1
  // weight (none in the starting world).
  it("hq_weight_counts_development_above_the_floor", () => {
    expect(developmentAboveFloor(1, 1, 1)).toBe(0);
    expect(developmentAboveFloor(9, 15, 16)).toBe(37);
    expect(developmentAboveFloor(0, 2, 1)).toBe(1);
    const w = unwrap(buildWorld(data()), "World::from_data");
    const sites = w.births.sites;
    expect(sites.hq_fallback_countries.length).toBe(0);
    const floor = worldDataAllProvinces(data()).filter(
      ([, , p]) => p.commerce + p.industry + p.population === 3,
    ).length;
    const zero = sites.hq_weight.filter((x) => x === 0.0).length;
    expect(zero).toBe(floor);
    expect(floor, `the split giants' new parts sit at the floor (${floor})`).toBeGreaterThan(700);
    sites.hq_weight.forEach((h, i) => {
      expect(h <= (sites.weight[i] as number), `province ${i}`).toBe(true);
    });
  });
});

/**
 * The 2020s industry weights from the data: every industry Normal on trend (q_growth = lt_q of
 * trend_growth), fringe revenue = world size - named revenue (7.2), in id order.
 */
function dataWeights(): [IndustryId, number, string][] {
  const d = data();
  const rows = [...d.industries.rows].sort((a, b) => cmpStr(a.id, b.id));
  return rows.map((ind, i) => {
    let named = 0;
    for (const c of d.companies.rows) if (c.industry === ind.name) named += c.revenue_usd_m * 1e6;
    const fringe = maxF(ind.world_size_2020_usd_bn * 1e9 - named, 0.0);
    return [i as IndustryId, industryWeight(qOf(ind.trend_growth), fringe, "Normal" as PhaseLabel), ind.id];
  });
}

describe("spec 5.19.1 event rate", () => {
  it("rate_near_8_events_a_year_over_300_seeds", () => {
    const rows = dataWeights();
    const weights = rows.map(([i, w]): [IndustryId, number] => [i, w]);
    const hq = (_: IndustryId): [ProvinceId, number][] => [
      [0 as ProvinceId, 1.0],
      [1 as ProvinceId, 2.0],
      [2 as ProvinceId, 1.0],
    ];
    const retail = (rows.find((r) => r[2] === "retail") as [IndustryId, number, string])[0];
    const seeds = 300;
    const years = 10;
    let events = 0;
    let startups = 0;
    const byType = [0, 0, 0, 0];
    let retailEvents = 0;
    for (let seed = 0; seed < seeds; seed++) {
      const rng = rngStreamsDraws(newRngStreams(seed));
      for (let k = 0; k < years * 4; k++) {
        for (const e of drawRandomEvents(weights, hq, rng)) {
          events += 1;
          startups += e.startups.length;
          if (e.kind.kind === "Random") {
            const t = EVENT_TYPE_VALUES.indexOf(e.kind.event_type);
            byType[t] = (byType[t] as number) + 1;
          }
          if (e.startups[0]?.industry === retail) retailEvents += 1;
        }
      }
    }
    const perYear = events / (seeds * years);
    // Spec 5.19.1: Poisson mean 2 a lock, about 8 a year (3,000 seed-years: sd of the mean 0.05).
    expect(Math.abs(perYear - 8.0) < 0.2, `${perYear}`).toBe(true);
    // Types near 50 / 30 / 15 / 5%.
    byType.forEach((n, i) => {
      expect(Math.abs(n / events - [0.5, 0.3, 0.15, 0.05][i]!) < 0.015).toBe(true);
    });
    // Startups per event: 0.5 + 0.3 + 0.15 x 2.5 + 0.05 = 1.225.
    expect(Math.abs(startups / events - 1.225) < 0.02).toBe(true);
    // Retail (3%, Normal) almost never gets one.
    expect(retailEvents).toBeLessThan(0.03 * events);
  });

  it("ai_labs_take_most_events_in_the_boom", () => {
    const rows = dataWeights();
    const d = data();
    // Boom year 0: AI labs at 100% a year with the 2020 fringe.
    const aiI = rows.findIndex((r) => r[2] === "ai_labs");
    const aiInd = d.industries.rows.find((i) => i.id === "ai_labs");
    if (aiInd === undefined) throw new Error("no ai_labs industry");
    let named = 0;
    for (const c of d.companies.rows) if (c.industry === aiInd.name) named += c.revenue_usd_m * 1e6;
    (rows[aiI] as [IndustryId, number, string])[1] = industryWeight(
      qOf(1.0),
      aiInd.world_size_2020_usd_bn * 1e9 - named,
      "Boom",
    );
    const weights = rows.map(([i, w]): [IndustryId, number] => [i, w]);
    const hq = (_: IndustryId): [ProvinceId, number][] => [[0 as ProvinceId, 1.0]];
    const rng = rngStreamsDraws(newRngStreams(7));
    let all = 0;
    let ai = 0;
    for (let k = 0; k < 400; k++) {
      for (const e of drawRandomEvents(weights, hq, rng)) {
        all += 1;
        if (e.startups[0]?.industry === (rows[aiI] as [IndustryId, number, string])[0]) ai += 1;
      }
    }
    expect(ai * 2, `AI labs ${ai} of ${all}`).toBeGreaterThan(all);
  });

  it("hot_cluster_shares_one_province_and_ranges_hold", () => {
    const weights: [IndustryId, number][] = [[3 as IndustryId, 1.0]];
    const hq = (_: IndustryId): [ProvinceId, number][] =>
      Array.from({ length: 50 }, (_, p): [ProvinceId, number] => [p as ProvinceId, 1.0]);
    const rng = rngStreamsDraws(newRngStreams(11));
    let seenHot = false;
    for (let k = 0; k < 2000; k++) {
      const e = drawRandomEvent(weights, hq, rng);
      if (e === null) continue;
      if (e.kind.kind !== "Random") throw new Error("a random event");
      const t = e.kind.event_type;
      const row = eventTypeRow(t);
      const n = e.startups.length;
      expect(n >= row.startups.lo && n <= row.startups.hi).toBe(true);
      const hq0 = e.startups[0]?.hq;
      for (const s of e.startups) {
        expect(s.hq).toBe(hq0);
        const r = s.target_revenue_usd / 1e6;
        expect(r >= row.revenue_musd[0] - 1e-9 && r <= row.revenue_musd[1] + 1e-9).toBe(true);
        expect(s.full >= row.full.lo && s.full <= row.full.hi).toBe(true);
        expect(s.partial >= row.partial.lo && s.partial <= row.partial.hi).toBe(true);
      }
      seenHot ||= t === "HotCluster";
    }
    expect(seenHot).toBe(true);
    // The draws are on the gen stream only.
    const a = newRngStreams(5);
    const b = newRngStreams(5);
    drawRandomEvents(weights, hq, rngStreamsDraws(a));
    for (const s of ["Cycle", "Growth", "Prices", "Ai"] as const) {
      expect(rngStreamsNextU32(a, s)).toBe(rngStreamsNextU32(b, s));
    }
  });
});
