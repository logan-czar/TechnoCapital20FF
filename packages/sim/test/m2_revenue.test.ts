// Port of crates/sim/tests/m2_revenue.rs: M2.8: revenue and expenses with productivity held at
// 100 (spec 5.4, 5.5). Done when the barebones company breaks even before R&D plans exist (R&D
// at the norm, the plan every unit runs until the M6 Lite AI sets one).
//
// Expects:
//   ../src/economy/revenue.ts  unitRevenueMonth(assets_eff, turnover, p_pre, m),
//                                 monthExpenses(revenue, gross, book, fixed_cost_rate, rd,
//                                 params, shared_m) -> MonthExpenses { depreciation, ... },
//                                 monthExpensesTotal(e)                  [MonthExpenses::total]
//   ../src/economy/start.ts    BAREBONES_ASSETS_USD, fixedCostRateAtLoad(gross, shared_year,
//                                 params)
//   ../src/economy/supply.ts   pPre(unit, company), unitSupply(assets_eff, turnover, p_pre)
//   ./common/economy.ts           economyScheduler, rel, runMonth, worldAtLoad
//   ./common/m3.ts                unitAssetsEff, unitEbitM  [BusinessUnit::assets_eff, ebit_m]
//
// Changed from the Rust: RngStreams::new(1) and (8) are the new generator (D951). The load state
// and the first three monthly closes are checked against formulas written from the spec, never
// against a draw, so every assertion is unchanged.
import { describe, expect, it } from "vitest";
import { monthExpenses, monthExpensesTotal, unitRevenueMonth } from "../src/economy/revenue.ts";
import { BAREBONES_ASSETS_USD, fixedCostRateAtLoad } from "../src/economy/start.ts";
import { pPre, unitSupply } from "../src/economy/supply.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import { economyScheduler, rel, runMonth, worldAtLoad } from "./common/economy.ts";
import { data } from "./common/index.ts";
import { unitAssetsEff, unitEbitM } from "./common/m3.ts";
import { newRng } from "./common/rng.ts";

describe("m2 revenue", () => {
  it("the_barebones_company_breaks_even", () => {
    const w = worldAtLoad(data(), newRng(1));
    const params = (w.industries[0] as (typeof w.industries)[number]).params;
    // C18: break-even is with R&D at the norm.
    const rd = params.rd_norm;
    expect(rd).toBe(0.05);
    // 10.0.11.1: one $100,000 asset at productivity 100 and M 1.0 makes $100,000 a year. With
    // the $7,000 of shared costs of spec 5.5 the fixed cost rate is 0.38; with M2's 0 (the M3.5
    // hook) it is 0.45. Either way revenue equals expenses with R&D at the norm.
    for (const sharedYear of [7_000.0, 0.0]) {
      const rate = fixedCostRateAtLoad(BAREBONES_ASSETS_USD, sharedYear, params);
      const wantRate = sharedYear > 0.0 ? 0.38 : 0.45;
      expect(Math.abs(rate - wantRate) < 1e-12, `${rate}`).toBe(true);
      const revenue = unitRevenueMonth(BAREBONES_ASSETS_USD, 1.0, 100.0, 1.0);
      expect(Math.abs(revenue - 100_000.0 / 12.0) < 1e-9).toBe(true);
      const e = monthExpenses(
        revenue,
        BAREBONES_ASSETS_USD,
        0.5 * BAREBONES_ASSETS_USD,
        rate,
        rd,
        params,
        sharedYear / 12.0,
      );
      expect(e.depreciation, "no decay under $10M").toBe(0.0);
      expect(
        Math.abs(revenue - monthExpensesTotal(e)) < 1e-9,
        `EBIT ${revenue - monthExpensesTotal(e)}`,
      ).toBe(true);
    }

    // The loaded barebones company (CO-0003) carries its +1 PC bonus: at R&D at the norm its only
    // profit is the 0.45 x bonus / (100 + bonus) of revenue that productivity above 100 gives
    // (spec 2.2), at the load M (1.00 to two decimals); the plan at load pays its 6.3 plan
    // instead of the norm (D283), so the margin moves by the norm less that plan.
    const c = w.companies.find((x) => x.key === "CO-0003");
    if (c === undefined) throw new Error("no CO-0003");
    const u = w.units[c.units[0] as number] as (typeof w.units)[number];
    const fixedAndDep = (0.45 * BAREBONES_ASSETS_USD) / 12.0;
    const saved = params.rd_norm - u.rd_plan;
    expect(Math.abs(unitEbitM(u) - ((0.45 + saved) * u.revenue_m - fixedAndDep)) < 1e-9).toBe(true);
    expect(Math.abs(unitEbitM(u) / u.revenue_m - (0.45 / 101.0 + saved)) < 1e-4).toBe(true);
  });

  it("every_company_at_load_earns_only_its_pc_bonus", () => {
    // At load S = M = 1.0 and productivity 100, so EBIT after R&D at the norm is exactly
    // f x bonus / (100 + bonus) of revenue (spec 2.2 "Built-table checks", 5.5). The units book
    // their 6.3 plan at load (D283), so the check puts R&D back at the norm.
    const w = worldAtLoad(data(), newRng(1));
    for (const u of w.units) {
      const c = w.companies[u.company] as (typeof w.companies)[number];
      const ind = w.industries[u.industry] as (typeof w.industries)[number];
      const f = ind.params.fixed_cost_share;
      const m = ind.market_factor;
      // Variable and R&D scale with M; fixed cash and depreciation sum to f x gross x turnover.
      const rev100 = (u.gross_assets * ind.params.asset_turnover) / 12.0;
      expect(Math.abs(u.rd_m - u.revenue_m * u.rd_plan) < 1e-9 * Math.max(u.revenue_m, 1.0)).toBe(true);
      const atNorm = unitEbitM(u) + u.rd_m - u.revenue_m * ind.params.rd_norm;
      const want = u.revenue_m * (1.0 - 0.5 - 0.05) - f * rev100;
      expect(Math.abs(atNorm - want) < 1e-6 * Math.max(u.revenue_m, 1.0), c.key).toBe(true);
      const atM1 = (c.pc_bonus / (100.0 + c.pc_bonus)) * f;
      expect(
        Math.abs(atNorm / u.revenue_m - atM1) < 1e-3,
        `${c.key}: margin ${atNorm / u.revenue_m} vs ${atM1} (M ${m})`,
      ).toBe(true);
    }
  });

  it("units_share_industry_revenue_by_supply", () => {
    const rng = newRng(8);
    const w = worldAtLoad(data(), rng);
    const s = economyScheduler();
    for (const date of [simDateYmd(2020, 2, 1), simDateYmd(2020, 3, 1), simDateYmd(2020, 4, 1)]) {
      runMonth(s, w, rng, date);
    }
    w.industries.forEach((ind, id) => {
      // Total industry revenue = supply x M (5.4), a month.
      let named = 0;
      for (const u of w.units) if (u.industry === id) named += u.revenue_m;
      const total = named + ind.fringe_revenue_m;
      expect(rel(total, (ind.supply * ind.market_factor) / 12.0) < 1e-12, ind.key).toBe(true);
      for (const u of w.units) {
        if (u.industry !== id) continue;
        const sup = unitSupply(
          unitAssetsEff(u),
          ind.params.asset_turnover,
          pPre(u, w.companies[u.company] as (typeof w.companies)[number]),
        );
        expect(rel(u.revenue_m / total, sup / ind.supply) < 1e-12).toBe(true);
      }
    });
  });
});
