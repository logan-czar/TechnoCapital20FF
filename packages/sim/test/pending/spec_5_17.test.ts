// Port of crates/sim/tests/spec_5_17.rs: spec 5.17 dividends (10.5.5, 3.3.2): paid at the plan
// lock from the last quarter, dividend = payout ratio x NI if NI is above 0 and own cash after it
// stays above the minimum cash (6.5); payout ratio = the sector table typical ratio x the
// archetype payout mult (6.1). Build-plan M4.8, called from M6.3. Pure formulas, no RNG.
//
// Expects:
//   ../../src/finance/credit.ts     minCash(revenue)
//   ../../src/finance/dividends.ts  type DividendInputs { net_income, cash, line_drawn, min_cash,
//                                   payout_ratio, status }, SECTOR_PAYOUT, dividend(inputs),
//                                   payoutRatio(archetype_payout_mult)
import { describe, expect, it } from "vitest";
import { minCash } from "../../src/finance/credit.ts";
import { type DividendInputs, dividend, payoutRatio, SECTOR_PAYOUT } from "../../src/finance/dividends.ts";
import type { CompanyStatus } from "../../src/types/state/finance.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) < 1e-6, `${a} vs ${b}`).toBe(true);
}

/** 6.1 payout mults (T). */
const STATE_CHAMPION = 1.0;
const STARTUP = 0.0;
const AGGRESSIVE_GROWER = 0.5;
const CASH_COW = 1.3;
const INCUMBENT = 1.0;

function base(over: Partial<DividendInputs> = {}): DividendInputs {
  return {
    net_income: 10.0e6,
    cash: 60.0e6,
    line_drawn: 0.0,
    min_cash: minCash(200.0e6),
    payout_ratio: payoutRatio(INCUMBENT),
    status: "Active",
    ...over,
  };
}

describe("spec 5.17 dividends", () => {
  it("payout_ratio_is_the_sector_ratio_times_the_archetype_mult", () => {
    // D1: one shared sector default; D234: 40%, the median of the 3.3.2 typical payout column.
    expect(SECTOR_PAYOUT).toBe(0.4);
    near(payoutRatio(STATE_CHAMPION), 0.4);
    near(payoutRatio(INCUMBENT), 0.4);
    near(payoutRatio(CASH_COW), 0.52);
    near(payoutRatio(AGGRESSIVE_GROWER), 0.2);
    expect(payoutRatio(STARTUP)).toBe(0.0);
  });

  it("a_profitable_company_with_cash_pays", () => {
    // NI 10M at 40%: 4M; own cash 60M - 4M stays above min_cash 10M.
    near(dividend(base()), 4.0e6);
    near(dividend(base({ payout_ratio: payoutRatio(CASH_COW) })), 5.2e6);
    expect(dividend(base({ payout_ratio: payoutRatio(STARTUP) })), "Startups pay nothing").toBe(0.0);
  });

  it("no_dividend_on_a_loss_or_without_the_cash", () => {
    expect(dividend(base({ net_income: 0.0 }))).toBe(0.0);
    expect(dividend(base({ net_income: -5.0e6 }))).toBe(0.0);
    // Own cash is cash - line drawn (C10): 60M cash with 48M drawn is 12M own; after 4M it would
    // be 8M, under min_cash 10M: nothing (all or none, D234).
    expect(dividend(base({ line_drawn: 48.0e6 }))).toBe(0.0);
    // 46M drawn: 14M own, 10M after, not strictly above 10M: nothing.
    expect(dividend(base({ line_drawn: 46.0e6 }))).toBe(0.0);
    // 45M drawn: 15M own, 11M after: pays.
    near(dividend(base({ line_drawn: 45.0e6 })), 4.0e6);
  });

  it("distressed_and_frozen_companies_pay_nothing", () => {
    // 5.12 step 1: no dividends while Distressed; Bankrupt and Removed are frozen.
    const statuses: CompanyStatus[] = ["Distressed", "Bankrupt", "Removed"];
    for (const status of statuses) {
      expect(dividend(base({ status })), status).toBe(0.0);
    }
  });

  it("min_cash_zero", () => {
    // A company with no trailing revenue has min_cash 0 (D226): it pays while own cash after the
    // dividend stays above 0.
    const i = base({ net_income: 1.0e6, cash: 1.0e6, min_cash: minCash(0.0) });
    expect(i.min_cash).toBe(0.0);
    near(dividend(i), 0.4e6);
    // Own cash exactly the dividend leaves 0, not above 0.
    expect(dividend({ ...i, cash: 0.4e6 })).toBe(0.0);
  });
});
