// Port of crates/sim/tests/m2_load.rs: M2.6 and M2.7: units loaded from company-start.csv with
// the 7.1 PC bonus and fixed cost rate, fringe pools, supply, S and M (spec 5.2, 5.3, 7.1, 7.2).
// Done when named revenue matches companies.csv within 0.5% and every industry starts at S 1.00,
// M 1.00.
//
// Expects:
//   ./common/rng.ts                 newRng(seed) -> DrawSource            [RngStreams::new]
//   ../../src/economy/start.ts      BAREBONES_ASSETS_USD, BAREBONES_REVENUE_USD, startLoadout(key,
//                                   revenue, location_bonus, params) -> Loadout with assets_bonus
//                                   [start_loadout]
//   ../../src/ops/stations.ts       pcBonus(pc), productiveCompute(stations, pc_modifier)
//   ../../src/ops/data.ts           dataBookStoredTb(book)            [DataBook::stored_tb]
//   ./common/economy.ts             worldAtLoad, industry
//
// Changed from the Rust: RngStreams::new(1) is the new seeded generator (D951). These tests only
// read the load state, which the 7.3 start draws (the pop date, gen stream) do not move, so every
// assertion is unchanged. The println of the worst revenue error is dropped.
import { describe, expect, it } from "vitest";
import { BAREBONES_ASSETS_USD, BAREBONES_REVENUE_USD, startLoadout } from "../../src/economy/start.ts";
import { dataBookStoredTb } from "../../src/ops/data.ts";
import { pcBonus, productiveCompute } from "../../src/ops/stations.ts";

import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import { maxF, roundTiesEven, totalCmp } from "../../src/types/num.ts";
import { industry, worldAtLoad } from "./common/economy.ts";
import { data, idRows, rowOf } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

/**
 * Gross assets at load by the 7.1 rule, written from the spec:
 * R x capital_per_dollar x 100 / (100 + PC bonus + location bonus), location bonus 0.
 */
function grossBySpec(revenue: number, capitalPerDollar: number, bonus: number): number {
  return (revenue * capitalPerDollar * 100.0) / (100.0 + bonus);
}

describe("m2 load", () => {
  it("named_revenue_matches_companies_csv_within_half_a_percent", () => {
    const d = data();
    const w = worldAtLoad(d, newRng(1));
    expect(w.units.length).toBe(651);
    let worst = 0.0;
    let barebones = 0;
    for (const [cid, c] of idRows<CompanyId, (typeof w.companies)[number]>(w.companies)) {
      expect(c.units.length).toBe(1);
      const unit = rowOf(w.units, c.units[0] as (typeof c.units)[number]);
      expect(unit.company).toBe(cid);
      expect([unit.industry, unit.base_province]).toEqual([c.industry, c.hq_province]);
      expect(unit.productivity).toBe(100.0);
      const yearly = 12.0 * unit.revenue_m;
      if (c.revenue_usd < BAREBONES_REVENUE_USD) {
        // The barebones loadout (7.1): one $100,000 asset, the CEO station gives PC 1, bonus +1,
        // so it makes $101,000 a year whatever companies.csv says (D107).
        expect(unit.gross_assets, c.key).toBe(BAREBONES_ASSETS_USD);
        expect(c.pc_bonus).toBe(1.0);
        expect(Math.abs(yearly - 101_000.0) < 1.0, `${c.key} ${yearly}`).toBe(true);
        barebones += 1;
        continue;
      }
      const err = Math.abs(yearly - c.revenue_usd) / c.revenue_usd;
      worst = maxF(worst, err);
      expect(err < 0.005, `${c.key}: ${yearly} vs ${c.revenue_usd}`).toBe(true);
      // company-start.csv gross assets are the 7.1 rule at this bonus, rounded to dollars.
      const params = rowOf(w.industries, c.industry).params;
      const gross = grossBySpec(c.revenue_usd, params.capital_per_dollar, c.pc_bonus);
      expect(Math.abs(gross - unit.gross_assets) <= 0.5, c.key).toBe(true);
      // The bonus load holds is the loadout second pass (D106), lane F one implementation.
      const loadout = startLoadout(c.key, c.revenue_usd, 0.0, params);
      expect(c.pc_bonus, c.key).toBe(loadout.assets_bonus);
    }
    expect(barebones, "CO-0003, CO-0026 and CO-0027 start barebones").toBe(3);
    expect(worst).toBeLessThan(0.005);

    // Arrowhead (7.1 check): PC bonus +2, gross assets about $39.2M, book half of it, $80.4M cash.
    const a = rowOf(w.companies, 0 as CompanyId);
    const au = rowOf(w.units, a.units[0] as (typeof a.units)[number]);
    expect(a.pc_bonus).toBe(2.0);
    expect(Math.abs(au.gross_assets - 39.2e6) < 0.1e6).toBe(true);
    expect(Math.abs(au.asset_book - 0.5 * au.gross_assets) <= 1.0).toBe(true);
    expect(Math.abs(a.cash_usd - 80.4e6) < 0.1e6 && a.finance.line.drawn === 0.0).toBe(true);

    // D106 (design fix 201): the 7.1 two-pass bonus does not settle for the three big
    // companies of about 42 billion. The station rule on their loaded gross assets gives +6, but
    // company-start.csv was generated at +5, so load keeps +5 and revenue matches companies.csv.
    for (const key of ["CO-0154", "CO-0540", "CO-0651"]) {
      const c = w.companies.find((x) => x.key === key);
      if (c === undefined) throw new Error(`no company ${key}`);
      const u = rowOf(w.units, c.units[0] as (typeof c.units)[number]);
      const params = rowOf(w.industries, c.industry).params;
      expect(c.pc_bonus, key).toBe(5.0);
      // The station rule on the loaded gross: L = floor(gross / labor_value), stations
      // max(1, round(0.25 x L)), bonus floor(1 + log10(PC)) (5.8, 5.10, 7.1).
      const l = Math.floor(u.gross_assets / params.labor_value_usd);
      const stations = maxF(roundTiesEven(0.25 * l), 1.0);
      expect(stations * params.pc_modifier, key).toBe(c.pc);
      expect(Math.floor(1.0 + Math.log10(c.pc)), key).toBe(6.0);
      expect(pcBonus(productiveCompute(c.stations, params.pc_modifier))).toBe(6);
    }
  });

  it("fixed_cost_rate_at_load", () => {
    const w = worldAtLoad(data(), newRng(1));
    // f x turnover - d_eff - shared / gross (5.5, 7.1), with the shared costs a year of the 3.8
    // bill (M3.5): 50 dollars per extra base compute max(9, ceil(0.2 x stations)), 10 per data
    // compute max(10, ceil(1.2 x TB stored / 100)), 30 per enterprise licence, each a month.
    const rates: number[] = [];
    for (const u of w.units) {
      const c = rowOf(w.companies, u.company);
      const p = rowOf(w.industries, u.industry).params;
      const decay = p.asset_decay * maxF(u.gross_assets - p.asset_decay_threshold_usd, 0.0);
      const s = c.stations;
      const stations = s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle;
      let stored = 0;
      for (const dd of c.data) stored += dataBookStoredTb(dd.book);
      const extra = Math.max(Math.ceil(stations / 5), 9);
      const dataCompute = maxF(Math.ceil((1.2 * stored) / 100.0), 10.0);
      const licences = s.enterprise + s.fifty_fifty;
      const shared = 12.0 * (50.0 * extra + 10.0 * dataCompute + 30.0 * licences);
      const want = p.fixed_cost_share * p.asset_turnover - decay / u.gross_assets - shared / u.gross_assets;
      expect(Math.abs(u.fixed_cost_rate - want) < 1e-12, c.key).toBe(true);
      rates.push(u.fixed_cost_rate);
    }
    // Spec 5.5: 0.38 to 0.449, median 0.439 (the barebones three at 0.45 - 0.066, design fix
    // 207 gives 6,600 dollars, which rounds to 0.38).
    rates.sort(totalCmp);
    const lo = rates[0] as number;
    const hi = rates[rates.length - 1] as number;
    const median = rates[Math.floor(rates.length / 2)] as number;
    expect(`${lo.toFixed(2)} ${hi.toFixed(3)} ${median.toFixed(3)}`).toBe("0.38 0.449 0.439");
  });

  it("every_industry_starts_at_s_one_and_m_one", () => {
    const w = worldAtLoad(data(), newRng(1));
    for (const [id, ind] of idRows<IndustryId, (typeof w.industries)[number]>(w.industries)) {
      // Fringe = what named revenue leaves of the world size (5.3, 7.2).
      let named = 0;
      for (const c of w.companies) if (c.industry === id) named += c.revenue_usd;
      const fringeRevenue = ind.fringe_assets * ind.params.asset_turnover;
      expect(
        Math.abs(named + fringeRevenue - ind.world_size_2020_usd) < 1.0,
        `${ind.key} named + fringe = world demand`,
      ).toBe(true);
      expect(ind.supply_ratio.toFixed(2), `${ind.key} S`).toBe("1.00");
      expect(ind.market_factor.toFixed(2), `${ind.key} M`).toBe("1.00");
      expect(Math.abs(ind.supply_ratio - 1.0) < 1e-4, `${ind.key} S ${ind.supply_ratio}`).toBe(true);
    }
    // Named revenue is below world size everywhere: Oil 1.35T of 2.5T (7.2).
    const oil = industry(w, "oil");
    expect(Math.abs(rowOf(w.industries, oil).fringe_assets - 1.15e12) < 0.01e12).toBe(true);
  });
});
