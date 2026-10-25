// Port of crates/sim/tests/spec_6_6.rs: spec 6.6 (raising money in cash-burning industries),
// build-plan M6.3: the rule is tested with a fake cash_burning flag and is silent with the real
// data (no industry is flagged).
//
// Expects:
//   ../../src/ai/raise.ts  type RaiseInputs { cash_burning, status, last_quarter_fcf, cash, line,
//                          rating, listed, price, shares_out, value_per_share, confidence_factor,
//                          label, failed_raises }, type RaiseMethod = "CreditLine" | "ShareIssue"
//                          (types/state/ai.ts), raisePlan(inputs) -> RaisePlan | null { method,
//                          burn, runway_quarters, target, gross, net, fees, chance, issue_price,
//                          new_shares, price_after }, rollRaise(plan, draws) -> boolean,
//                          successChance(confidence_factor, label, method, failed_raises)
//   ./common/rng.ts        newNoNoise (every uniform roll 0.5)
import { describe, expect, it } from "vitest";
import { type RaiseInputs, raisePlan, rollRaise, successChance } from "../src/ai/raise.ts";
import { data } from "./common/index.ts";
import { newNoNoise } from "./common/rng.ts";

/** A listed company burning 10M a quarter with 20M of own cash (runway 2 quarters). */
function burner(over: Partial<RaiseInputs> = {}): RaiseInputs {
  return {
    cash_burning: true,
    status: "Active",
    last_quarter_fcf: -10.0e6,
    cash: 20.0e6,
    line: { drawn: 0.0, limit: 100.0e6, excess_months_left: 0 },
    rating: "Bbb",
    listed: true,
    price: 10.0,
    shares_out: 100_000_000,
    value_per_share: 10.0,
    confidence_factor: 1.0,
    label: "Normal",
    failed_raises: 0,
    ...over,
  };
}

function must<T>(v: T | null): T {
  if (v === null) throw new Error("expected a raise plan");
  return v;
}

describe("spec 6.6 raising money", () => {
  it("silent_with_the_real_data", () => {
    const d = data();
    expect(d.industries.rows.every((i) => !i.cash_burning)).toBe(true);
    for (const ind of d.industries.rows) {
      expect(raisePlan(burner({ cash_burning: ind.cash_burning })), ind.id).toBeNull();
    }
  });

  it("line_draw_when_rated_and_covered", () => {
    // Burn 10M, own cash 20M: runway 2 < 4; target 8 x 10 - 20 = 60M; BBB with 100M undrawn draws
    // it. Chance 50% + 0 (confidence 1.0) + 0 (Normal) + 20 (line) = 70%.
    const p = must(raisePlan(burner()));
    expect(p.method).toBe("CreditLine");
    expect([p.burn, p.runway_quarters, p.target]).toEqual([10.0e6, 2.0, 60.0e6]);
    expect([p.gross, p.net, p.fees]).toEqual([60.0e6, 60.0e6, 0.0]);
    expect(Math.abs(p.chance - 0.7) < 1e-12).toBe(true);
    // NoNoise rolls 0.5: a 70% raise succeeds.
    expect(rollRaise(p, newNoNoise())).toBe(true);
  });

  it("share_issue_when_unrated_or_uncovered", () => {
    // Rated CCC (factor 0): a share issue. Market value 1B is a small cap: 8% off 10 = 9.20;
    // shares to net 60M after 3% fees: ceil(60M / (9.2 x 0.97)) = 6,723,443, under the 20% cap of
    // 20,000,000.
    const p = must(raisePlan(burner({ rating: "Ccc" })));
    expect(p.method).toBe("ShareIssue");
    expect(Math.abs(p.issue_price - 9.2) < 1e-12).toBe(true);
    expect(p.new_shares).toBe(6_723_443);
    expect(Math.abs(p.gross - 6_723_443.0 * 9.2) < 1e-3).toBe(true);
    expect(Math.abs(p.net - 0.97 * p.gross) < 1e-3).toBe(true);
    // Announcement: P x (1 - (2% + 0.5 x dilution)), dilution = new / (old + new).
    const dil = 6_723_443.0 / 106_723_443.0;
    expect(Math.abs(p.price_after - 10.0 * (1.0 - (0.02 + 0.5 * dil))) < 1e-12).toBe(true);
    // Share issue method adj is 0: 50%.
    expect(Math.abs(p.chance - 0.5) < 1e-12).toBe(true);

    // Large cap (10B+): 4% off. The 20% cap binds for a small share count.
    const big = burner({ rating: "Ccc", price: 100.0, shares_out: 100_000_000 });
    expect(Math.abs(must(raisePlan(big)).issue_price - 96.0) < 1e-12).toBe(true);
    const few = burner({ rating: "Ccc", shares_out: 1_000_000 });
    expect(must(raisePlan(few)).new_shares).toBe(200_000);

    // Private: 0.7 x V less 8%, no price effect.
    const priv = must(raisePlan(burner({ rating: "Ccc", listed: false })));
    expect(Math.abs(priv.issue_price - 0.7 * 10.0 * 0.92) < 1e-12).toBe(true);
    expect(priv.price_after).toBe(10.0);
  });

  it("no_raise_without_burn_or_with_runway", () => {
    const i = burner();
    i.last_quarter_fcf = 1.0;
    expect(raisePlan(i)).toBeNull();
    i.last_quarter_fcf = -5.0e6; // runway 4 quarters: no raise
    expect(raisePlan(i)).toBeNull();
    i.last_quarter_fcf = -10.0e6;
    i.status = "Bankrupt";
    expect(raisePlan(i)).toBeNull();
    i.status = "Distressed";
    expect(raisePlan(i)).not.toBeNull();
  });

  it("success_chance_terms_and_clamp", () => {
    // Confidence factor 1.2 is +20 pp; Boom +30; line +20: 120% clamps to 95%.
    expect(successChance(1.2, "Boom", "CreditLine", 0)).toBe(0.95);
    // Glut -15, two failures -20: 50 - 15 - 20 = 15%.
    expect(Math.abs(successChance(1.0, "Glut", "ShareIssue", 2) - 0.15) < 1e-12).toBe(true);
    // Bust -35 with confidence 0.8 (-20): clamps to 5%.
    expect(successChance(0.8, "Bust", "ShareIssue", 0)).toBe(0.05);
  });
});
