// Port of crates/sim/tests/spec_5_13.rs: spec 5.13 fair value (10.0.8, 3.3.1; C8) and the 7.1
// engine value at load: build-plan M5.1 (profit and loss cases worked by hand from the spec) and
// M5.2 (company-start.csv engine_value_usd for all 651, read from the CSVs so a regenerated file
// is checked as is). Pure formulas, no RNG.
//
// Expects:
//   ../../src/market/engine_value.ts  type EngineValueInputs { book_equity, run_rate_ebit,
//                                     tax_rate, sector_multiple, g_sector, home_spread,
//                                     listing_confidence: number | null, book_floor_share },
//                                     MIN_ENGINE_VALUE_USD, engineValueAtLoad(inputs),
//                                     loadNetIncome(ebit, tax_rate)
//   ../../src/market/fair_value.ts    type FairValueInputs { basis, book_equity, sector_multiple,
//                                     home_spread, label, company_confidence, listing_confidence:
//                                     number | null, book_floor_share, shares_out },
//                                     fairValueBasisAtRelease(ttm_net_income | null, g, g_sector)
//                                     [FairValueBasis::at_release], bookFloorShare(industry_key),
//                                     clampGrowth, cycleFactor(label), eNorm(ni, g),
//                                     exchangeFactor(confidence | null), fairValue(inputs),
//                                     growthFactor(g, g_sector), perShare(value, shares),
//                                     rateFactor(home_spread), revenueGrowth(quarters),
//                                     shownValue(fair_value, shows_exact), y10(home_spread)
//   ../../src/people/management.ts    confidenceFactor(score)
//   ../../src/finance/credit.ts       homeSpread
import { describe, expect, it } from "vitest";
import { homeSpread } from "../../src/finance/credit.ts";
import {
  type EngineValueInputs,
  engineValueAtLoad,
  loadNetIncome,
  MIN_ENGINE_VALUE_USD,
} from "../../src/market/engine_value.ts";
import {
  bookFloorShare,
  clampGrowth,
  cycleFactor,
  eNorm,
  exchangeFactor,
  type FairValueInputs,
  fairValue,
  fairValueBasisAtRelease,
  growthFactor,
  perShare,
  rateFactor,
  revenueGrowth,
  shownValue,
  y10,
} from "../../src/market/fair_value.ts";
import { confidenceFactor } from "../../src/people/management.ts";
import {
  type CompanyFacts,
  data,
  facts,
  financeStart,
  sovereignSpread,
  zoneSpread,
} from "./finance_common/index.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1.0), `${a} vs ${b}`).toBe(true);
}

const M = 1e6;

/**
 * A profitable company: book 100M, TTM NI 10M, g 10% against a sector lt of 5%, M_sector 17, home
 * spread 50 bps (y10 4%), Boom, management score 50, exchange confidence +50.
 */
function profit(): FairValueInputs {
  return {
    basis: fairValueBasisAtRelease(10.0 * M, 0.1, 0.05),
    book_equity: 100.0 * M,
    sector_multiple: 17.0,
    home_spread: 0.005,
    label: "Boom",
    company_confidence: confidenceFactor(50.0),
    listing_confidence: 50.0,
    book_floor_share: bookFloorShare("oil"),
    shares_out: 10_000_000,
  };
}

describe("spec 5.13 fair value", () => {
  it("the_factors_match_the_spec", () => {
    // Step 1: E_norm = 0.6 x 10 + 0.4 x 10 x 1.1 = 10.4.
    near(eNorm(10.0 * M, 0.1), 10.4 * M);
    // g clamps to -30% to +60%.
    near(clampGrowth(1.0), 0.6);
    near(clampGrowth(-0.9), -0.3);
    near(eNorm(10.0 * M, 2.0), 0.6 * 10.0 * M + 0.4 * 10.0 * M * 1.6);
    // Step 2: G = clamp(1 + 2.5 x (g - g_sector), 0.5, 2.5).
    near(growthFactor(0.1, 0.05), 1.125);
    near(growthFactor(0.0, 0.05), 0.875);
    near(growthFactor(5.0, 0.05), 1.0 + 2.5 * (0.6 - 0.05));
    near(growthFactor(-0.5, 0.25), 0.5);
    // R = clamp(9% / (y10 + 5%), 0.4, 1.6), y10 = 3.5% + home spread (C24). 3.3.1: at y10 = 4% R
    // is 1.0; at 12% (emerging market) R is 0.53.
    near(y10(0.005), 0.04);
    near(rateFactor(0.005), 1.0);
    expect(Math.abs(rateFactor(0.085) - 0.53) < 0.005).toBe(true);
    near(rateFactor(0.0), 0.09 / 0.085);
    near(rateFactor(0.3), 0.4);
    // X = 1 + 0.10 x confidence / 100 (0.9 to 1.1); 1.0 for a private company.
    near(exchangeFactor(50.0), 1.05);
    near(exchangeFactor(-100.0), 0.9);
    near(exchangeFactor(100.0), 1.1);
    near(exchangeFactor(null), 1.0);
    // Cycle factor Boom 1.2, Normal 1.0, Glut 0.85, Bust 0.7; floor 0.9 for Real estate.
    near(cycleFactor("Boom"), 1.2);
    near(cycleFactor("Normal"), 1.0);
    near(cycleFactor("Glut"), 0.85);
    near(cycleFactor("Bust"), 0.7);
    near(bookFloorShare("real_estate"), 0.9);
    near(bookFloorShare("oil"), 0.6);
    // 5.7: confidence factor 0.8 + score / 250.
    near(confidenceFactor(50.0), 1.0);
  });

  it("profit_case", () => {
    // (0.3 x 100 + 0.7 x 10.4 x (17 x 1.125 x 1.0) x 1.2 x 1.0) x 1.05
    //   = (30 + 167.076) x 1.05 = 206.9298M.
    let fv = fairValue(profit());
    near(fv, 206.9298 * M);
    near(perShare(fv, 10_000_000), 20.69298);
    // A Normal cycle, a weaker board (score 25: 0.9) and no exchange confidence:
    // 30 + 0.7 x 10.4 x 19.125 x 1.0 x 0.9 = 30 + 125.3070 = 155.3070M.
    fv = fairValue({
      ...profit(),
      label: "Normal",
      company_confidence: confidenceFactor(25.0),
      listing_confidence: 0.0,
    });
    near(fv, 155.307 * M);
    // Private: X 1.0, shown at 0.7 x fair value (10.5.4).
    const priv = fairValue({ ...profit(), listing_confidence: null });
    near(priv, 197.076 * M);
    near(shownValue(priv, false), 0.7 * 197.076 * M);
    near(shownValue(priv, true), 197.076 * M);
  });

  it("a_thin_profit_falls_to_the_book_floor", () => {
    // NI 1M: 30 + 0.7 x 1.04 x 19.125 x 1.2 x 1.0 = 46.71, x 1.05 = 49.05: below 0.6 x 100.
    const i: FairValueInputs = {
      ...profit(),
      basis: fairValueBasisAtRelease(1.0 * M, 0.1, 0.05),
    };
    near(fairValue(i), 60.0 * M);
    // Real estate floors at 0.9 x book.
    const re: FairValueInputs = { ...i, book_floor_share: bookFloorShare("real_estate") };
    near(fairValue(re), 90.0 * M);
  });

  it("loss_case", () => {
    // Step 4: E_norm <= 0 values at book x cycle x X: 50 x 0.7 x 0.9 = 31.5M, above 0.6 x 50.
    const loss: FairValueInputs = {
      ...profit(),
      basis: fairValueBasisAtRelease(-5.0 * M, 0.1, 0.05),
      book_equity: 50.0 * M,
      label: "Bust",
      listing_confidence: -100.0,
    };
    near(fairValue(loss), 31.5 * M);
    // Glut: 50 x 0.85 x 0.9 = 38.25M; the company own confidence is not in the loss path.
    near(fairValue({ ...loss, label: "Glut", company_confidence: 0.8 }), 38.25 * M);
    // Real estate: the 0.9 x 50 = 45M floor wins.
    near(fairValue({ ...loss, book_floor_share: bookFloorShare("real_estate") }), 45.0 * M);
    // E_norm exactly 0 is a loss-maker: book x 1.2 x 1.05 = 63M.
    near(
      fairValue({
        ...profit(),
        basis: fairValueBasisAtRelease(0.0, 0.1, 0.05),
        book_equity: 50.0 * M,
      }),
      63.0 * M,
    );
  });

  it("edge_cases_newborn_negative_book_and_penny_floor", () => {
    // D253: no statements yet (trailing_four is None) values at book x cycle x X.
    const newborn: FairValueInputs = {
      ...profit(),
      basis: fairValueBasisAtRelease(null, 0.0, 0.05),
      book_equity: 20.0 * M,
    };
    near(fairValue(newborn), 20.0 * M * 1.2 * 1.05);
    // D242: a negative book has no book floor; the loss path is negative, so 0.01 dollars a share
    // (0.01 x 10M shares = 100,000) holds.
    const broke: FairValueInputs = {
      ...profit(),
      basis: fairValueBasisAtRelease(-3.0 * M, 0.0, 0.05),
      book_equity: -20.0 * M,
    };
    near(fairValue(broke), 100_000.0);
    near(perShare(fairValue(broke), 10_000_000), 0.01);
    // A profitable company with a negative book: (0.3 x -20 + 0.7 x 10.4 x 19.125 x 1.2) x 1.05
    // = (-6 + 167.076) x 1.05 = 169.1298M.
    near(fairValue({ ...profit(), book_equity: -20.0 * M }), 169.1298 * M);
    expect(perShare(1.0, 0)).toBe(0.0);
  });

  it("revenue_growth_over_four_quarters", () => {
    // D254: TTM over the prior TTM with 8+ quarters; matched quarters a year apart with 5 to 7;
    // 0 with 4 or fewer (no year-ago figure).
    near(revenueGrowth([10.0, 10.0, 10.0, 10.0, 11.0, 11.0, 11.0, 11.0]), 0.1);
    near(revenueGrowth([1.0, 10.0, 10.0, 10.0, 10.0, 11.0, 11.0, 11.0, 13.0]), 46.0 / 40.0 - 1.0);
    near(revenueGrowth([10.0, 10.0, 10.0, 10.0, 12.0]), 0.2);
    near(revenueGrowth([10.0, 20.0, 10.0, 10.0, 12.0, 18.0]), 30.0 / 30.0 - 1.0);
    near(revenueGrowth([10.0, 10.0, 10.0, 10.0]), 0.0);
    near(revenueGrowth([]), 0.0);
    // No revenue a year ago: +60% (the clamp top) if there is revenue now, else 0.
    near(revenueGrowth([0.0, 0.0, 0.0, 0.0, 5.0]), 0.6);
    near(revenueGrowth([0.0, 0.0, 0.0, 0.0, 0.0]), 0.0);
  });
});

/**
 * The 7.1 inputs of one starting company, from the CSVs: book equity (company-start.csv, D238),
 * the run-rate EBIT (validate.py starting margin x companies.csv revenue: finance-start.csv
 * margin, independent of the engine), the HQ tax, M_sector, the industry trend_growth as lt (D1),
 * the D223 home spread from the zone base spread (D235), X from confidence_start for listed
 * companies, and the industry 5.13 book floor.
 */
function loadInputs(f: CompanyFacts, ebit: number): EngineValueInputs {
  return {
    book_equity: f.start.book_equity_usd,
    run_rate_ebit: ebit,
    tax_rate: f.economy.corp_tax_rate,
    sector_multiple: f.industry.earnings_multiple,
    g_sector: f.industry.trend_growth,
    home_spread: homeSpread(zoneSpread(f), sovereignSpread(f)),
    listing_confidence: f.company.public ? f.zone.confidence_start : null,
    book_floor_share: bookFloorShare(f.industry.id),
  };
}

describe("spec 5.13 engine value at load", () => {
  it("engine_value_reproduces_company_start_for_all_651", () => {
    // Spec 7.1 (batch 161): the 5.13 fair value at load (D244).
    const d = data();
    const fixture = financeStart();
    expect(fixture.length).toBe(651);
    expect(d.company_start.rows.length).toBe(651);
    for (const row of fixture) {
      const f = facts(d, row.id());
      const margin = row.num("ebit") / row.num("revenue");
      const ebit = margin * f.company.revenue_usd_m * 1e6;
      const ev = engineValueAtLoad(loadInputs(f, ebit));
      const want = f.start.engine_value_usd;
      // company-start.csv rounds to whole dollars.
      expect(Math.abs(ev - want) <= 1.0, `${row.id()}: engine value ${ev} vs company-start.csv ${want}`).toBe(
        true,
      );
      expect(ev >= MIN_ENGINE_VALUE_USD).toBe(true);
      // shares = engine value / open_price, so P = V = open_price at load (7.1).
      expect(Math.abs(f.start.shares - want / f.start.open_price) <= 0.6, row.id()).toBe(true);
    }
  });

  it("engine_value_worked_cases", () => {
    // Spec 7.1: Arrowhead (ARDR) 9 dollars x about 6.67M shares = 60M (its 0.6 x book floor).
    const d = data();
    const f = facts(d, "CO-0001");
    expect(f.start.engine_value_usd).toBe(60.0 * M);
    expect(f.start.open_price).toBe(9.0);
    const row = financeStart().find((r) => r.id() === "CO-0001");
    if (row === undefined) throw new Error("no fixture row CO-0001");
    near(engineValueAtLoad(loadInputs(f, row.num("ebit"))), 0.6 * f.start.book_equity_usd);
    const base: EngineValueInputs = {
      book_equity: 100.0 * M,
      run_rate_ebit: 20.0 * M,
      tax_rate: 0.25,
      sector_multiple: 17.0,
      g_sector: 0.1,
      home_spread: 0.005,
      listing_confidence: 0.0,
      book_floor_share: bookFloorShare("oil"),
    };
    // NI = 20 x 0.75 = 15; G at g 0 = 1 - 2.5 x 0.10 = 0.75; R 1.0 (y10 4%):
    // 0.3 x 100 + 0.7 x 15 x 17 x 0.75 = 30 + 133.875 = 163.875M.
    near(loadNetIncome(20.0 * M, 0.25), 15.0 * M);
    near(engineValueAtLoad(base), 163.875 * M);
    // lt 0.25 hits the G floor 0.5: 30 + 0.7 x 15 x 17 x 0.5 = 119.25M.
    near(engineValueAtLoad({ ...base, g_sector: 0.25 }), 119.25 * M);
    // A thin earner in Real estate sits on the 0.9 floor: NI 0.75M gives 30 + 6.69 < 90.
    near(
      engineValueAtLoad({
        ...base,
        run_rate_ebit: 1.0 * M,
        book_floor_share: bookFloorShare("real_estate"),
      }),
      90.0 * M,
    );
    // The loss path and the barebones three (revenue 0, so NI 0): book x X.
    near(loadNetIncome(-2.0 * M, 0.25), -2.0 * M);
    near(
      engineValueAtLoad({
        ...base,
        book_equity: 1.0 * M,
        run_rate_ebit: 0.0,
        listing_confidence: null,
      }),
      1.0 * M,
    );
    // The 100,000 dollar floor.
    near(
      engineValueAtLoad({
        ...base,
        book_equity: 10_000.0,
        run_rate_ebit: -1.0,
        listing_confidence: null,
      }),
      MIN_ENGINE_VALUE_USD,
    );
  });
});
