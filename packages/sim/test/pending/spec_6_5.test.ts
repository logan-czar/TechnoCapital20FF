// Port of crates/sim/tests/spec_6_5.rs: spec 6.5 (financing) and 5.17 (dividend) through the Lite
// AI, build-plan M6.3: one test per row of the 6.5 table. Expected values worked by hand from the
// spec. Pure, no RNG.
//
// Expects:
//   ../../src/ai/archetype.ts   archetypeParams(archetype)
//   ../../src/ai/financing.ts   type Financing { draw, repay, dividend }, type FinancingInputs {
//                               cash, line, min_cash, planned_purchases, traits,
//                               last_quarter_net_income, archetype_payout_mult, status },
//                               financing(inputs) -> Financing
import { describe, expect, it } from "vitest";
import { archetypeParams } from "../../src/ai/archetype.ts";
import { type Financing, type FinancingInputs, financing } from "../../src/ai/financing.ts";
import type { Trait } from "../../src/types/state/people.ts";

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function base(cash: number, drawn: number, limit: number, traits: Trait[]): FinancingInputs {
  return {
    cash,
    line: { drawn, limit, excess_months_left: 0 },
    min_cash: 10.0e6,
    planned_purchases: 0.0,
    traits,
    last_quarter_net_income: 0.0,
    archetype_payout_mult: 1.0,
    status: "Active",
  };
}

describe("spec 6.5 financing", () => {
  it("row_draw_the_gap_after_planned_purchases", () => {
    // Cash 12M, purchases 5M: 7M left, 3M under min_cash 10M, so draw 3M.
    let i: FinancingInputs = { ...base(12.0e6, 0.0, 50.0e6, []), planned_purchases: 5.0e6 };
    const f = financing(i);
    expect(close(f.draw, 3.0e6) && f.repay === 0.0).toBe(true);
    // Up to the limit only: 1M undrawn.
    i = { ...base(12.0e6, 49.0e6, 50.0e6, []), planned_purchases: 5.0e6 };
    expect(close(financing(i).draw, 1.0e6)).toBe(true);
  });

  it("row_repay_from_own_cash_above_twice_min_cash", () => {
    // Cash 60M, drawn 20M: own cash 40M above 2 x 10M; repay min(20, 40 - 15) = 20M.
    let f = financing(base(60.0e6, 20.0e6, 100.0e6, []));
    expect(close(f.repay, 20.0e6)).toBe(true);
    // Own cash 25M, which is above 20M: repay min(20, 25 - 15) = 10M.
    f = financing(base(45.0e6, 20.0e6, 100.0e6, []));
    expect(close(f.repay, 10.0e6)).toBe(true);
    // Own cash 15M is not above 2 x min_cash: nothing.
    f = financing(base(35.0e6, 20.0e6, 100.0e6, []));
    const none: Financing = { draw: 0, repay: 0, dividend: 0 };
    expect(f).toEqual(none);
  });

  it("row_cautious_or_greedy_repays_first_to_25_percent", () => {
    // Cash 35M, drawn 20M of 40M (50%): own cash 15M does not reach the base row, but a Greedy
    // controller repays toward 25% of the limit (10M drawn) from cash above min_cash:
    // min(10M, 25M) = 10M.
    for (const t of ["Greedy", "Cautious"] as const) {
      const f = financing(base(35.0e6, 20.0e6, 40.0e6, [t]));
      expect(close(f.repay, 10.0e6), `${t} ${JSON.stringify(f)}`).toBe(true);
    }
    // No dividend while more than 25% stays drawn: cash 12M, drawn 20M of 40M, a quarter of 10M
    // profit; spare cash 2M repays 2M, 18M (45%) stays drawn.
    const i = base(12.0e6, 20.0e6, 40.0e6, ["Greedy"]);
    i.min_cash = 10.0e6;
    i.last_quarter_net_income = 10.0e6;
    const f = financing(i);
    expect(close(f.repay, 2.0e6)).toBe(true);
    expect(f.dividend).toBe(0.0);
  });

  it("row_brave_keeps_up_to_75_percent_drawn", () => {
    // Own cash 40M would repay 20M; a Brave controller keeps up to 75% of 100M drawn, so 20M
    // drawn stays.
    let f = financing(base(60.0e6, 20.0e6, 100.0e6, ["Brave"]));
    expect(f.repay).toBe(0.0);
    // Drawn 80M of 100M: repays only the 5M above 75%.
    f = financing(base(130.0e6, 80.0e6, 100.0e6, ["Brave"]));
    expect(close(f.repay, 5.0e6)).toBe(true);
  });

  it("row_dividend_with_the_archetype_payout_mult", () => {
    // Cash cow: 40% x 1.3 = 52% of last quarter 10M.
    const i = base(100.0e6, 0.0, 0.0, []);
    i.last_quarter_net_income = 10.0e6;
    i.archetype_payout_mult = archetypeParams("CashCow").payout_mult;
    expect(close(financing(i).dividend, 5.2e6)).toBe(true);
    // Startup pays none (payout mult 0).
    i.archetype_payout_mult = archetypeParams("Startup").payout_mult;
    expect(financing(i).dividend).toBe(0.0);
    // No dividend from a loss, while Distressed, or if own cash would fall to min_cash.
    i.archetype_payout_mult = 1.0;
    i.last_quarter_net_income = -1.0e6;
    expect(financing(i).dividend).toBe(0.0);
    i.last_quarter_net_income = 10.0e6;
    i.status = "Distressed";
    expect(financing(i).dividend).toBe(0.0);
    i.status = "Active";
    i.cash = 14.0e6; // 14 - 4 = 10, not above min_cash
    expect(financing(i).dividend).toBe(0.0);
  });

  it("min_cash_zero", () => {
    // D226: with no revenue min_cash is 0; any own cash repays and the dividend needs own cash
    // above 0 after it.
    let i = base(5.0e6, 2.0e6, 10.0e6, []);
    i.min_cash = 0.0;
    expect(close(financing(i).repay, 2.0e6)).toBe(true);
    i = base(1.0e6, 0.0, 0.0, []);
    i.min_cash = 0.0;
    i.last_quarter_net_income = 2.5e6;
    expect(financing(i).dividend).toBe(0.0); // 1.0 - 1.0 = 0 is not above 0
    i.cash = 1.1e6;
    expect(close(financing(i).dividend, 1.0e6)).toBe(true);
  });
});
