// D1059: a historical world's company shocks (1995-rework 9; finance/shock.ts). The charge is a
// statement line below EBIT that lowers pre-tax income and operating cash alike, so the month's
// books still roll; the chance and the size come from the Era stream.
import { describe, expect, it } from "vitest";
import {
  SHOCK_CAUSES,
  SHOCK_CONTRACTION_MULT,
  SHOCK_FRAGILE_MULT,
  SHOCK_REVENUE_MAX,
  SHOCK_REVENUE_MIN,
  SHOCK_YEARLY,
  shockChance,
  shockDraw,
} from "../../src/finance/shock.ts";
import {
  ledgerDefault,
  ledgerIncome,
  ledgerNetCashChange,
  ledgerNetIncome,
  ledgerOperatingCash,
  ledgerPlus,
  ledgerPreTaxIncome,
  ledgerScaled,
} from "../../src/finance/statements.ts";
import type { DrawSource, Stream } from "../../src/types/draws.ts";
import type { Ledger } from "../../src/types/state/finance.ts";
import { STATEMENT_LINE_DISPLAY, STATEMENT_LINE_VALUES } from "../../src/types/views/estimate.ts";
import { statementLineIsFlow } from "../../src/views/estimate.ts";

/** A month with every line set, so a charge's effect shows against the rest. */
function month(over: Partial<Ledger> = {}): Ledger {
  return {
    ...ledgerDefault(),
    revenue: 10e6,
    variable: 4e6,
    fixed_cash: 2e6,
    rd: 0.5e6,
    shared: 0.25e6,
    depreciation: 1e6,
    line_interest: 0.1e6,
    line_fee: 0.01e6,
    interest_income: 0.05e6,
    asset_sale_gain: 0.2e6,
    tax: 0.3e6,
    tax_paid: 0.2e6,
    ...over,
  };
}

/** Draws that answer from fixed lists, and record which streams were asked. */
function scripted(chances: boolean[], uniforms: number[]): DrawSource & { asked: Stream[] } {
  const asked: Stream[] = [];
  return {
    asked,
    nextU32: () => {
      throw new Error("not used");
    },
    uniform: (s) => {
      asked.push(s);
      return uniforms.shift() as number;
    },
    normal: () => {
      throw new Error("not used");
    },
    poisson: () => {
      throw new Error("not used");
    },
    intInclusive: (s, lo) => {
      asked.push(s);
      return lo;
    },
    chance: (s) => {
      asked.push(s);
      return chances.shift() as boolean;
    },
  };
}

describe("the special charge on the statements (D1059)", () => {
  it("lowers pre-tax income, net income before tax and operating cash by the charge", () => {
    const base = month();
    const hit = month({ special_charge: 3e6 });
    expect(ledgerPreTaxIncome(hit)).toBeCloseTo(ledgerPreTaxIncome(base) - 3e6, 6);
    expect(ledgerOperatingCash(hit)).toBeCloseTo(ledgerOperatingCash(base) - 3e6, 6);
    expect(ledgerNetCashChange(hit)).toBeCloseTo(ledgerNetCashChange(base) - 3e6, 6);
    expect(ledgerIncome(hit).special_charge).toBe(3e6);
  });

  it("keeps operating cash = net income + depreciation − gain + tax accrued − tax paid (3.9)", () => {
    const l = month({ special_charge: 7.5e6 });
    expect(ledgerOperatingCash(l)).toBeCloseTo(
      ledgerNetIncome(l) + l.depreciation - l.asset_sale_gain + l.tax - l.tax_paid,
      6,
    );
  });

  it("sums and scales like every other line", () => {
    const a = month({ special_charge: 1e6 });
    const b = month({ special_charge: 2e6 });
    expect(ledgerPlus(a, b).special_charge).toBe(3e6);
    expect(ledgerScaled(b, 0.25).special_charge).toBe(0.5e6);
  });

  it("joins the statement lines last, keeping every older line's discriminant, and shows under the gain", () => {
    expect(STATEMENT_LINE_VALUES.length).toBe(33);
    expect(STATEMENT_LINE_VALUES.indexOf("SpecialCharge")).toBe(32);
    expect(STATEMENT_LINE_VALUES.indexOf("OperatingCash")).toBe(15);
    expect(STATEMENT_LINE_DISPLAY.length).toBe(33);
    expect(STATEMENT_LINE_DISPLAY.indexOf("SpecialCharge")).toBe(
      STATEMENT_LINE_DISPLAY.indexOf("AssetSaleGain") + 1,
    );
    expect(statementLineIsFlow("SpecialCharge")).toBe(true);
    expect(statementLineIsFlow("GuidanceHigh")).toBe(false);
  });
});

describe("the shock's chance and size (D1059)", () => {
  it("is the yearly chance spread over 12 months, raised in a contraction and for a loser", () => {
    const base = SHOCK_YEARLY / 12;
    expect(shockChance(false, false)).toBeCloseTo(base, 15);
    expect(shockChance(true, false)).toBeCloseTo(base * SHOCK_CONTRACTION_MULT, 15);
    expect(shockChance(false, true)).toBeCloseTo(base * SHOCK_FRAGILE_MULT, 15);
    expect(shockChance(true, true)).toBeCloseTo(base * SHOCK_CONTRACTION_MULT * SHOCK_FRAGILE_MULT, 15);
  });

  it("draws nothing more on a miss, and a size and a cause on the Era stream on a hit", () => {
    const miss = scripted([false], []);
    expect(shockDraw(miss, false, false, 100e6)).toBeNull();
    expect(miss.asked).toEqual(["Era"]);

    const hit = scripted([true], [0.5]);
    const s = shockDraw(hit, true, false, 100e6);
    expect(s).not.toBeNull();
    expect(s?.charge).toBeCloseTo(
      (SHOCK_REVENUE_MIN + 0.5 * (SHOCK_REVENUE_MAX - SHOCK_REVENUE_MIN)) * 100e6,
      3,
    );
    expect(s?.cause).toBeGreaterThanOrEqual(0);
    expect(s?.cause).toBeLessThan(SHOCK_CAUSES.length);
    expect(hit.asked.every((x) => x === "Era")).toBe(true);
  });

  it("charges nothing to a company with no revenue yet", () => {
    expect(shockDraw(scripted([true], [0.9]), false, false, 0)?.charge).toBe(0);
  });
});
