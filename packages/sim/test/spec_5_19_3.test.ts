// Port of crates/sim/tests/spec_5_19_3.rs: spec 5.19.3 (each startup), build-plan M6.8: the size
// cap, the carve (supply unchanged by a birth before PC bonuses), stations by the 7.1 rules, the
// newborn fixed cost rate, the run rate, seed cash, rating, engine value, the 7.1 open price and
// shares, and the cap table. Expected values worked by hand from the spec and data.
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../src/births/startup.ts  birthFixedCostRate(gross, stations, params), birthRunRate(gross,
//                                stations, fixed_cost_rate, rd_share, params) -> RunRate
//                                [birth_run_rate], birthStations(
//                                gross, book, params) -> [labor, Stations], buildStartup(inputs:
//                                BirthInputs) -> Birth, capTable(shares_out, founders) ->
//                                CapTable { founders, seed_investors }, capTableTotal(t),
//                                carve(revenue, capital_per_dollar, fringe) -> { gross_assets,
//                                fringe_assets_after }, fringeRevenue(fringe_assets, turnover),
//                                openPrice(value, company_key), sharesFor(value, open_price),
//                                sizedRevenue(target, fringe_revenue) -> number | null,
//                                startupArchetype(revenue, sector)
//   ../src/births/names.ts    companyNamesFromData(data), companyNamesSuffixes(names, industry),
//                                companyNamesPrefixes(names, country), companyNamesDraw(names,
//                                country, industry, taken(name) -> boolean, draws) -> string,
//                                compose(prefix, suffix)
//   ../src/lib.ts             simNew, simWorld
//   "@tc20ff/sim-data"           company_start / companies / industry_suffixes row types
//
// Changed from the Rust: the name draws use RngStreams::new(4), the new generator (D951); they
// assert the properties (every name ends in one of the industry's suffixes, none repeats or is
// taken), which hold for any draws. Everything else is pure arithmetic on the spec and data.
import { describe, expect, it } from "vitest";
import {
  companyNamesDraw,
  companyNamesFromData,
  companyNamesPrefixes,
  companyNamesSuffixes,
  compose,
} from "../src/births/names.ts";
import {
  type BirthInputs,
  birthFixedCostRate,
  birthRunRate,
  birthStations,
  buildStartup,
  capTable,
  capTableTotal,
  carve,
  fringeRevenue,
  openPrice,
  sharesFor,
  sizedRevenue,
  startupArchetype,
} from "../src/births/startup.ts";
import { simNew, simWorld } from "../src/lib.ts";
import type { CountryId, IndustryId } from "../src/types/ids.ts";
import type { IndustryParams } from "../src/types/world.ts";
import { stationsOf } from "./common/defaults.ts";
import { data, unwrap } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

function params(key: string): IndustryParams {
  const sim = unwrap(simNew(data(), 1), "Sim::new");
  const ind = simWorld(sim).industries.find((i) => i.key === key);
  if (ind === undefined) throw new Error(`no industry ${key}`);
  return structuredClone(ind.params);
}

describe("spec 5.19.3 each startup", () => {
  it("size_is_capped_at_2_percent_of_the_fringe_and_skipped_under_1m", () => {
    // $500M of fringe revenue caps at $10M.
    expect(sizedRevenue(30.0e6, 500.0e6)).toBe(10.0e6);
    expect(sizedRevenue(8.0e6, 500.0e6)).toBe(8.0e6);
    // $40M of fringe caps a $5M target at $0.8M: skipped.
    expect(sizedRevenue(5.0e6, 40.0e6)).toBeNull();
    expect(sizedRevenue(5.0e6, 50.0e6)).toBe(1.0e6);
    // Fringe revenue is fringe assets x turnover (D268).
    expect(fringeRevenue(2.0e9, 1.0)).toBe(2.0e9);
    expect(fringeRevenue(-1.0, 1.0)).toBe(0.0);
  });

  it("carve_conserves_supply_before_pc_bonuses", () => {
    // Spec 5.2: supply = fringe x turnover + sum unit gross x turnover x p_pre / 100. At p_pre 100
    // (no PC bonus) a carved unit supplies exactly what left the fringe.
    const [fringe, turnover, cpd] = [3.0e9, 1.0, 1.0];
    let c = carve(12.0e6, cpd, fringe);
    expect(c.gross_assets).toBe(12.0e6);
    const before = fringe * turnover;
    const after = c.fringe_assets_after * turnover + (c.gross_assets * turnover * 100.0) / 100.0;
    expect(Math.abs(after - before) < 1e-6).toBe(true);
    // Never more than the fringe holds.
    c = carve(12.0e6, cpd, 5.0e6);
    expect([c.gross_assets, c.fringe_assets_after]).toEqual([5.0e6, 0.0]);
  });

  it("stations_by_the_7_1_rules", () => {
    const p = params("software");
    // $5M of assets at labor_value $100,000: 50 labor units; productivity round(12.5) = 12 (halves
    // to even, as gen.py); enterprise ceil(0.5 x 5 x 1 / 10.95) = 1; idle 37.
    const [l, s] = birthStations(5.0e6, 5.0e6, p);
    expect(l).toBe(50);
    expect(s).toEqual(stationsOf({ productivity: 12, enterprise: 1, fifty_fifty: 0, research: 0, idle: 37 }));
    // D200: the smallest startup ($1M) has 10 labor units, so all five seats open.
    expect(birthStations(1.0e6, 1.0e6, p)[0]).toBe(10);
  });

  it("newborn_fixed_cost_rate_and_run_rate", () => {
    const p = params("software");
    const [, s] = birthStations(5.0e6, 5.0e6, p);
    // D269: f x turnover - d_eff - shared / gross. No decay at $5M (under $10M); the 3.8 bill:
    // max(9, ceil(50 / 5)) = 10 extra base x $50 + 10 data compute x $10 + 1 licence x $30 = $630
    // a month, $7,560 a year: 0.45 - 7,560 / 5,000,000 = 0.448488.
    const fcr = birthFixedCostRate(5.0e6, s, p);
    expect(Math.abs(fcr - 0.448488) < 1e-12, `${fcr}`).toBe(true);
    // Run rate at productivity 100 + PC bonus 2 (PC 12), M 1.0: revenue $5.1M. With R&D at the
    // norm (5%): 5.1 - 2.55 (v 0.5) - 2.24244 (fixed) - 0.255 - 0.00756 = $45,000 (0.45 x 2% of
    // $5M from the bonus).
    let r = birthRunRate(5.0e6, s, fcr, 0.05, p);
    expect(r.pc_bonus).toBe(2);
    expect(Math.abs(r.revenue - 5.1e6) < 1e-6).toBe(true);
    expect(Math.abs(r.ebit - 45_000.0) < 1e-6, `${r.ebit}`).toBe(true);
    expect(r.ebitda).toBe(r.ebit);
    // A Tech Startup's 1.2 x norm R&D (6%) costs $51,000 more: -$6,000 (design fix 240).
    r = birthRunRate(5.0e6, s, fcr, 0.06, p);
    expect(Math.abs(r.ebit + 6_000.0) < 1e-6, `${r.ebit}`).toBe(true);
  });

  it("open_price_reproduces_company_start_for_all_651", () => {
    // Spec 7.1: open_price = clamp(round(25 x (value / $1B)^0.35 x jitter), 5, 200), jitter from
    // the company id (gen.py price_jitter); shares = value / open_price.
    const d = data();
    const wrong: string[] = [];
    for (const r of d.company_start.rows) {
      if (openPrice(r.engine_value_usd, r.id) !== r.open_price) wrong.push(r.id);
      expect(Math.abs(sharesFor(r.engine_value_usd, r.open_price) - r.shares) <= 1.0).toBe(true);
    }
    expect(wrong).toEqual([]);
    // Arrowhead (ARDR) $9 on $60M.
    const a = d.company_start.rows.find((r) => r.id === "CO-0001");
    if (a === undefined) throw new Error("no CO-0001");
    expect(openPrice(a.engine_value_usd, "CO-0001")).toBe(9.0);
  });

  it("cap_table_splits_60_40", () => {
    // Lead founder 30%, the others 30% in equal parts, seed investors 40%.
    let t = capTable(1_000_000, 3);
    expect(t.founders).toEqual([300_000, 150_000, 150_000]);
    expect(t.seed_investors).toBe(400_000);
    // A lone founder holds all 60% (D270).
    t = capTable(1_000_000, 1);
    expect([t.founders, t.seed_investors]).toEqual([[600_000], 400_000]);
    // Rounding goes to the seed investors; the parts always sum to shares_out.
    t = capTable(1_000_001, 4);
    expect(capTableTotal(t)).toBe(1_000_001);
    expect(t.founders).toEqual([300_000, 100_000, 100_000, 100_000]);
  });

  it("archetype_without_trait_rows", () => {
    // 5.19.3: a Tech startup under $50M is a Startup, else Incumbent.
    expect(startupArchetype(20.0e6, "Tech")).toBe("Startup");
    expect(startupArchetype(50.0e6, "Tech")).toBe("Incumbent");
    expect(startupArchetype(20.0e6, "Consumer")).toBe("Incumbent");
  });

  it("a_retail_startup_end_to_end", () => {
    // $20M Retail in the USA: gross $20M, book $20M, seed cash $10M, no line.
    const p = params("retail");
    const inputs: BirthInputs = {
      key: "CO-0652",
      revenue: 20.0e6,
      params: p,
      industry_key: "retail",
      sector: "Consumer",
      fringe_assets: 10.0e9,
      tax_rate: 0.258,
      sovereign: "Aaa",
      base_rate: 0.03,
      home_spread: 0.0,
      g_sector: 0.03,
      book_floor_share: 0.6,
    };
    const b = buildStartup(inputs);
    expect([b.gross_assets, b.asset_book, b.cash]).toEqual([20.0e6, 20.0e6, 10.0e6]);
    expect(b.fringe_assets_after).toBe(10.0e9 - 20.0e6);
    expect(b.archetype).toBe("Incumbent");
    expect(b.labor).toBe(200);
    // EBIT: 20.4 (bonus +2 from 50 productivity stations) - 10.2 - 20 x fcr - 1.02 - shared: the
    // bill is 40 x $50 + 10 x $10 + 1 x $30 = $2,130 a month, so fcr = 0.45 - 25,560 / 20M and
    // fixed + shared = 0.45 x $20M: EBIT = 20.4 - 10.2 - 9.0 - 1.02 = $180,000.
    expect(Math.abs(b.run_rate.ebit - 180_000.0) < 1e-6, `${b.run_rate.ebit}`).toBe(true);
    // Net cash with EBITDA above 0 is AAA, +1 cover, -1 size: AAA, under the AAA+1 ceiling.
    expect(b.rating).toBe("Aaa");
    // Engine value: 0.3 x $30M + 0.7 x NI x 17 x G x R is under the 0.6 x book floor of $18M.
    expect(Math.abs(b.engine_value - 18.0e6) < 1e-6).toBe(true);
    expect(b.open_price).toBe(openPrice(18.0e6, "CO-0652"));
    expect(b.shares_out).toBe(sharesFor(18.0e6, b.open_price));
  });

  it("company_names_from_the_world_gen_lists", () => {
    const d = data();
    const names = companyNamesFromData(d);
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    const countryId = (key: string): CountryId => {
      const i = w.countries.findIndex((c) => c.key === key);
      if (i < 0) throw new Error(`no country ${key}`);
      return i as CountryId;
    };
    const usa = countryId("USA");
    const chn = countryId("CHN");
    const sw = w.industries.findIndex((i) => i.key === "software") as IndustryId;
    const suffixes = d.industry_suffixes.rows.filter((s) => s.industry === "Software").map((s) => s.suffix);
    expect(companyNamesSuffixes(names, sw)).toEqual(suffixes);
    const rng = newRng(4);
    const made: string[] = [];
    for (let i = 0; i < 200; i++) {
      const n = companyNamesDraw(names, usa, sw, (x) => made.includes(x), rng);
      expect(
        suffixes.some((s) => n.endsWith(s)),
        n,
      ).toBe(true);
      expect(made).not.toContain(n);
      made.push(n);
    }
    // companies.csv names are taken: a draw never repeats one.
    const taken = (x: string): boolean => d.companies.rows.some((c) => c.name === x);
    for (let i = 0; i < 200; i++) expect(taken(companyNamesDraw(names, chn, sw, taken, rng))).toBe(false);
    // China draws its culture's prefixes (names/east-asia-oceania.csv, chinese).
    expect(companyNamesPrefixes(names, chn).length).toBeGreaterThan(0);
    expect(companyNamesPrefixes(names, chn)).not.toEqual(companyNamesPrefixes(names, usa));
    // gen.py puts Maison and Atelier first.
    expect(compose("Lumen", "Maison")).toBe("Maison Lumen");
    expect(compose("Ironbark", "Software")).toBe("Ironbark Software");
  });
});
