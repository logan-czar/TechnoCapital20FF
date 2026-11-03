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
import { archetypeParams } from "../src/ai/archetype.ts";
import { type Financing, type FinancingInputs, financing } from "../src/ai/financing.ts";
import type { Trait } from "../src/types/state/people.ts";

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

describe("1995-rework 9 era leverage payout (D1012)", () => {
  const era = (
    cash: number,
    drawn: number,
    limit: number,
    target: number,
    traits: Trait[] = [],
  ): FinancingInputs => ({
    ...base(cash, drawn, limit, traits),
    leverage_target: target,
  });

  it("pays_a_quarter_of_the_gap_from_spare_cash", () => {
    // Cash 60M, nothing drawn, target 40M: net debt -60M, gap 100M, pays 25M from the 50M above
    // min_cash.
    const f = financing(era(60.0e6, 0.0, 100.0e6, 40.0e6));
    expect(f).toEqual({ draw: 0.0, repay: 0.0, dividend: 25.0e6 });
  });

  it("draws_the_line_for_what_spare_cash_does_not_cover", () => {
    // Cash 12M, 10M drawn of 50M, target 30M: net debt -2M, gap 32M, pays 8M: 2M spare cash and
    // 6M drawn, inside 60% of the limit (30M less 10M drawn).
    const f = financing(era(12.0e6, 10.0e6, 50.0e6, 30.0e6));
    expect(close(f.dividend, 8.0e6) && close(f.draw, 6.0e6) && f.repay === 0.0).toBe(true);
  });

  it("keeps_the_line_instead_of_repaying", () => {
    // Cash 60M, 20M drawn: 6.5 would repay 20M, but repaying leaves net debt where it is. Net
    // debt -40M, target 50M: gap 90M, pays 22.5M and repays nothing.
    const f = financing(era(60.0e6, 20.0e6, 100.0e6, 50.0e6));
    expect(close(f.dividend, 22.5e6) && f.repay === 0.0 && f.draw === 0.0).toBe(true);
  });

  it("counts_the_quarter_purchases", () => {
    // Cash 60M less 50M of purchases: net debt -10M after them, target 10M: gap 20M, pays 5M,
    // all drawn, since no cash is left above min_cash.
    const f = financing({ ...era(60.0e6, 0.0, 100.0e6, 10.0e6), planned_purchases: 50.0e6 });
    expect(close(f.dividend, 5.0e6) && close(f.draw, 5.0e6)).toBe(true);
  });

  it("pays_nothing_at_its_target_or_without_room", () => {
    // Net debt 30M already at the 30M target: 6.5 alone.
    expect(financing(era(10.0e6, 40.0e6, 100.0e6, 30.0e6))).toEqual({ draw: 0.0, repay: 0.0, dividend: 0.0 });
    // Under target, but no spare cash and 30M drawn is already 60% of 50M.
    expect(financing(era(10.0e6, 30.0e6, 50.0e6, 100.0e6)).dividend).toBe(0.0);
  });

  it("skips_repay_first_controllers_startups_and_distress", () => {
    expect(financing(era(60.0e6, 0.0, 100.0e6, 40.0e6, ["Greedy"])).dividend).toBe(0.0);
    expect(financing({ ...era(60.0e6, 0.0, 100.0e6, 40.0e6), archetype_payout_mult: 0.0 }).dividend).toBe(
      0.0,
    );
    expect(financing({ ...era(60.0e6, 0.0, 100.0e6, 40.0e6), status: "Distressed" }).dividend).toBe(0.0);
  });
});
