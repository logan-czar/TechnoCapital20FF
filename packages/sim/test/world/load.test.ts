/// <reference types="node" />
// world/load.rs has no in-file tests; this exercises the ported data conversion with stub Step 2
// dependencies (the real golden test is crates/sim/tests/golden/world_load.rs, ported by W5).
import { dataErrorToString, parseWorld, type WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { buildWorld, type LoadDeps, loadErrorToString, UNPORTED_LOAD_DEPS } from "../../src/world/load.ts";

const STUBS: LoadDeps = {
  ...UNPORTED_LOAD_DEPS,
  archetypeAtLoad: () => "Incumbent",
  rdPlanAtLoad: () => 0,
  birthsStateFromData: () => ({ ok: true, value: {} as never }),
  zAvg: (cs) => cs.reduce((n, [gdp, k]) => n + gdp * k, 0) / cs.reduce((n, [gdp]) => n + gdp, 0),
  enterpriseShare: () => 0,
  fixedCostRateAtLoad: () => 0,
  sharedCostsAtLoadHook: () => 0,
  startLoadout: () => ({ stations: {} as never, load_bonus: 0 }),
  fringeAssetsAtLoad: (size, named, turnover) => Math.max(size - named, 0) / turnover,
  ratingParse: () => "Aaa",
  companyFinanceAtLoad: () => ({}) as never,
  stockAtLoad: () => ({}) as never,
  computeBill: () => ({}) as never,
  dataBookAtLoad: () => ({}) as never,
  dataBookStoredTb: () => 0,
  dataBookFreeRdFraction: () => 0,
  conversionCapacity: () => 0,
  fitStations: (s) => s,
  laborUnits: () => 1,
  productiveCompute: () => 0,
  nameBooksBuild: () => ({ ok: true, value: { books: [], by_country: [] } }),
  traitFromName: (n) => (n === "Greedy" ? "Greedy" : null),
};

function world(): WorldData {
  const w = loadWorld(defaultDataDir());
  if (!w.ok) throw new Error(dataErrorToString(w.error));
  return w.value;
}

describe("buildWorld", () => {
  it("builds the tables in id order with units converted once", () => {
    const data = world();
    const r = buildWorld(data, STUBS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.value;
    expect(w.zones.length).toBe(26);
    expect(w.countries.length).toBe(211);
    expect(w.provinces.length).toBe(3963);
    expect(w.industries.length).toBe(42);
    expect(w.companies.length).toBe(651);
    expect(w.characters.length).toBe(296);
    expect(w.units.length).toBe(651);
    // Ids ascend (D4), so ordinals follow them.
    for (const t of [w.zones, w.countries, w.provinces, w.industries, w.companies, w.characters]) {
      for (let i = 1; i < t.length; i++)
        expect((t[i - 1] as { key: string }).key < (t[i] as { key: string }).key).toBe(true);
    }
    // $bn to USD, bps to fractions; zone shares sum to 1 (spec 3.2.1).
    const usa = w.countries.find((c) => c.key === "USA");
    const row = data.countries.rows.find((c) => c.iso3 === "USA");
    expect(usa?.gdp_usd).toBe((row?.gdp_usd_bn ?? 0) * 1e9);
    expect(w.zones.reduce((n, z) => n + z.gdp_share, 0)).toBeCloseTo(1, 12);
    expect(w.cycle.g_history.length).toBe(Math.max(...w.zones.map((z) => z.lag_quarters)) + 1);
    expect(w.clock).toBe(0);
    expect(w.companies[0]?.holders[0]?.shares).toBe(w.companies[0]?.shares_out);
    expect(w.ai.schedule.boom_lt.length).toBeGreaterThan(0);
  });

  it("reports a duplicate id, a missing reference and a missing row as LoadError", () => {
    const dup = world();
    dup.countries.rows.push(structuredClone(dup.countries.rows[0]) as never);
    const d = buildWorld(dup, STUBS);
    expect(!d.ok && d.error).toEqual({
      kind: "Duplicate",
      table: "countries",
      key: dup.countries.rows[0]?.iso3,
    });

    const missing = world();
    (missing.companies.rows[0] as { hq_province: string }).hq_province = "ZZ-9999";
    const m = buildWorld(missing, STUBS);
    expect(!m.ok && loadErrorToString(m.error)).toContain("hq_province `ZZ-9999` is not a known province");

    const noStart = world();
    noStart.company_start.rows.pop();
    const n = buildWorld(noStart, STUBS);
    expect(!n.ok && n.error.kind).toBe("BadValue");
  });

  it("is reachable through parseWorld too", () => {
    expect(parseWorld({}).ok).toBe(false);
  });
});
