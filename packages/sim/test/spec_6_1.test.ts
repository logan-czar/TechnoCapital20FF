// Port of crates/sim/tests/spec_6_1.rs: spec 6 (inputs) and 6.1 (archetype), build-plan M6.1:
// g_dem, ROA, loss_q, liquidity, min_cash, the traits read, and one test per row of the 6.1
// table. Expected values come from the spec text and data, worked by hand. Pure, no RNG.
//
// Expects:
//   ../../src/ai/archetype.ts  archetype(inputs) -> Archetype, type ArchetypeInputs {
//                              state_controlled, revenue_usd, tech, traits }, archetypeParams(a)
//                              -> { hurdle_roa, growth_adj, rd_mult, payout_mult, data_coverage }
//                              [Archetype::params]
//   ../../src/ai/inputs.ts     gDem(lt, q_growth), gapFade(), liquidity(cash, line), minCash(rev),
//                              nextLossQuarters(loss_q, ebit), planTraits(controller_traits |
//                              null, born) -> Trait[], roa(ebit, gross_assets)
//   ../../src/people/traits.ts traitFromName(name) -> Trait | null
import { describe, expect, it } from "vitest";
import { archetype, archetypeParams } from "../src/ai/archetype.ts";
import { gapFade, gDem, liquidity, minCash, nextLossQuarters, planTraits, roa } from "../src/ai/inputs.ts";
import { traitFromName } from "../src/people/traits.ts";
import type { Archetype } from "../src/types/state/ai.ts";
import type { CreditLine } from "../src/types/state/finance.ts";
import type { Trait } from "../src/types/state/people.ts";
import { data } from "./common/index.ts";

describe("spec 6 inputs", () => {
  it("retail_in_a_contraction_projects_1_8_percent", () => {
    // Spec 6: Retail (LT 3%) with q_growth -0.5% projects 1.8%.
    const g = gDem(0.03, -0.005);
    expect(Math.abs(g - 0.018) < 0.0005, `g_dem ${g}`).toBe(true);
    // The fade is phi + phi^2 + phi^3 + phi^4 = 0.5 + 0.25 + 0.125 + 0.0625 (spec: 0.94 x the gap).
    expect(gapFade()).toBe(0.9375);
    // On trend (q_growth = lt_q) the projection is LT itself.
    const ltQ = 1.03 ** 0.25 - 1.0;
    expect(Math.abs(gDem(0.03, ltQ) - 0.03) < 1e-15).toBe(true);
  });

  it("roa_loss_quarters_liquidity_and_min_cash", () => {
    // ROA = trailing EBIT / gross assets; no assets reads 0.
    expect(roa(5.0e6, 50.0e6)).toBe(0.1);
    expect(roa(5.0e6, 0.0)).toBe(0.0);
    // loss_q counts consecutive quarters of negative EBIT.
    expect(nextLossQuarters(0, -1.0)).toBe(1);
    expect(nextLossQuarters(3, -1.0)).toBe(4);
    expect(nextLossQuarters(3, 0.0)).toBe(0);
    // Liquidity = own cash (cash - drawn) + undrawn line.
    const line: CreditLine = { drawn: 30.0e6, limit: 50.0e6, excess_months_left: 0 };
    expect(liquidity(40.0e6, line)).toBe(10.0e6 + 20.0e6);
    // Own cash floors at 0: drawn above cash leaves only the undrawn line.
    expect(liquidity(10.0e6, line)).toBe(20.0e6);
    // min_cash = 5% of trailing revenue; 0 with no revenue (D226).
    expect(minCash(40.0e6)).toBe(2.0e6);
    expect(minCash(0.0)).toBe(0.0);
  });

  it("traits_read_are_the_controllers_never_founders", () => {
    const t: Trait[] = ["Greedy", "Brave"];
    expect(planTraits(t, false)).toEqual(t);
    // 5.19.5: a born company founders count as none.
    expect(planTraits(t, true)).toEqual([]);
    expect(planTraits(null, false)).toEqual([]);
  });
});

function arch(state: boolean, revenueMusd: number, tech: boolean, traits: Trait[]): Archetype {
  return archetype({
    state_controlled: state,
    revenue_usd: revenueMusd * 1e6,
    tech,
    traits,
  });
}

describe("spec 6.1 archetype", () => {
  it("one_test_per_archetype_row", () => {
    // Row 1: control_basis state wins over everything.
    expect(arch(true, 10.0, true, ["Ambitious"])).toBe("StateChampion");
    // Row 2: revenue below 50M in Tech.
    expect(arch(false, 49.9, true, ["Greedy"])).toBe("Startup");
    expect(arch(false, 50.0, true, [])).not.toBe("Startup");
    expect(arch(false, 10.0, false, [])).not.toBe("Startup");
    // Row 3: Ambitious or Brave.
    expect(arch(false, 500.0, false, ["Brave"])).toBe("AggressiveGrower");
    // Row 4: Greedy or Cautious.
    expect(arch(false, 500.0, false, ["Cautious"])).toBe("CashCow");
    // Row 5: otherwise.
    expect(arch(false, 500.0, false, ["Honest"])).toBe("Incumbent");
    expect(arch(false, 500.0, false, [])).toBe("Incumbent");
    // Rows match in table order (D120; Logan on design fix 105: table order), so a controller
    // with both Ambitious and Greedy is an Aggressive grower whichever trait it lists first.
    expect(arch(false, 500.0, false, ["Greedy", "Ambitious"])).toBe("AggressiveGrower");
    expect(arch(false, 500.0, false, ["Ambitious", "Greedy"])).toBe("AggressiveGrower");
  });

  it("archetype_table_values", () => {
    // Spec 6.1 table: hurdle, growth adj, R&D mult, payout mult, data coverage.
    const rows: [Archetype, number, number, number, number, number][] = [
      ["StateChampion", 0.06, 0.02, 1.0, 1.0, 0.5],
      ["Startup", 0.12, 0.04, 1.2, 0.0, 1.0],
      ["AggressiveGrower", 0.08, 0.05, 1.3, 0.5, 1.0],
      ["CashCow", 0.15, -0.03, 0.7, 1.3, 0.25],
      ["Incumbent", 0.1, 0.0, 1.0, 1.0, 0.5],
    ];
    for (const [a, hurdle, adj, rd, payout, coverage] of rows) {
      const p = archetypeParams(a);
      expect([p.hurdle_roa, p.growth_adj, p.rd_mult, p.payout_mult, p.data_coverage], a).toEqual([
        hurdle,
        adj,
        rd,
        payout,
        coverage,
      ]);
    }
  });

  it("arrowhead_is_a_cash_cow_from_terrys_traits", () => {
    // Spec 7.1: the Greedy trait of Terry makes Arrowhead (CO-0001, Oil) a Cash cow.
    const d = data();
    const co = d.companies.rows.find((c) => c.id === "CO-0001");
    if (co === undefined) throw new Error("no CO-0001");
    const ch = d.characters.rows.find((c) => c.id === co.controller);
    if (ch === undefined) throw new Error(`no controller ${co.controller}`);
    const traits: Trait[] = [];
    for (const t of ch.traits) {
      const parsed = traitFromName(t);
      if (parsed !== null) traits.push(parsed);
    }
    const ind = d.industries.rows.find((i) => i.name === co.industry);
    if (ind === undefined) throw new Error(`no industry ${co.industry}`);
    const a = arch(co.control_basis === "state", co.revenue_usd_m, ind.sector === "Tech", traits);
    expect(a).toBe("CashCow");
  });
});
