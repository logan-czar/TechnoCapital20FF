// Port of crates/sim/tests/spec_6_3.rs: spec 6.3 (R&D plan), build-plan M6.2: one test per rule,
// and the 7.1 Arrowhead plan on the live load (Cash cow 0.7, Greedy 0.8: 2.8% less 1% free R&D),
// the function the M3 Arrowhead check applies by hand today.
//
// Expects:
//   ../src/ai/archetype.ts  archetype(inputs), archetypeParams(a), archetypeRdMult(a)
//                              [Archetype::rd_mult], rdPlanAtLoad(rd_norm, archetype, traits,
//                              free_rd_fraction)
//   ../src/ai/inputs.ts     planTraits(controller_traits | null, born)
//   ../src/ai/rd.ts         type RdInputs { rd_norm, archetype_rd_mult, productivity, traits,
//                              loss_q, free_rd_pct }, productivityAdj(productivity),
//                              rdPlan(inputs), rdTarget(inputs), traitMult(traits)
//   ../src/lib.ts           simNew, simWorld (via ./common)
import { describe, expect, it } from "vitest";
import { archetype, archetypeParams, archetypeRdMult, rdPlanAtLoad } from "../src/ai/archetype.ts";
import { planTraits } from "../src/ai/inputs.ts";
import { productivityAdj, type RdInputs, rdPlan, rdTarget, traitMult } from "../src/ai/rd.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { ARCHETYPE_VALUES } from "../src/types/state/ai.ts";
import type { Trait } from "../src/types/state/people.ts";
import { data, unwrap } from "./common/index.ts";
import { company } from "./common/ops.ts";

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-12;
}

function inputs(mult: number, productivity: number, traits: Trait[], lossQ: number, free: number): RdInputs {
  return {
    rd_norm: 0.05,
    archetype_rd_mult: mult,
    productivity,
    traits,
    loss_q: lossQ,
    free_rd_pct: free,
  };
}

describe("spec 6.3 R&D plan", () => {
  it("productivity_adjustment", () => {
    // +1.0 below 100 (D974; D360 tuned the spec +0.25 below 95 to +0.5); -0.2 above 110.
    expect(productivityAdj(99.9)).toBe(1.0);
    expect(productivityAdj(100.0)).toBe(0.0);
    expect(productivityAdj(110.0)).toBe(0.0);
    expect(productivityAdj(110.1)).toBe(-0.2);
    // Incumbent at 90: 0.05 x 2.0; at 120: 0.05 x 0.8.
    expect(close(rdTarget(inputs(1.0, 90.0, [], 0, 0)), 0.1)).toBe(true);
    expect(close(rdTarget(inputs(1.0, 120.0, [], 0, 0)), 0.04)).toBe(true);
  });

  it("trait_mults", () => {
    expect(traitMult(["Greedy"])).toBe(0.8);
    expect(traitMult(["Visionary"])).toBe(1.25);
    expect(traitMult(["Conservative"])).toBe(0.9);
    expect(traitMult(["Diligent"])).toBe(1.1);
    expect(traitMult(["Honest"])).toBe(1.0);
    // Several multiply (D264).
    expect(close(traitMult(["Greedy", "Diligent"]), 0.88)).toBe(true);
  });

  it("loss_cut_and_its_floor", () => {
    // Startup 1.2 x 0.05 = 6%; loss_q at least 2 cuts x0.8 to 4.8%.
    expect(close(rdTarget(inputs(1.2, 100.0, [], 2, 0)), 0.048)).toBe(true);
    expect(close(rdTarget(inputs(1.2, 100.0, [], 1, 0)), 0.06)).toBe(true);
    // Cash cow Greedy 2.8% x 0.8 = 2.24% is under 0.5 x rd_norm (2.5%): held at 2.5%.
    expect(close(rdTarget(inputs(0.7, 100.0, ["Greedy"], 3, 0)), 0.025)).toBe(true);
    // A target already under the floor is not lifted: 0.05 x 0.5 x 0.8 = 2%.
    expect(close(rdTarget(inputs(0.7, 120.0, ["Greedy"], 2, 0)), 0.02)).toBe(true);
  });

  it("free_rd_and_clamp", () => {
    // rd_plan = max(0, target - free): 2.8% - 1% = 1.8%; 5% free leaves 0.
    expect(close(rdPlan(inputs(0.7, 100.0, ["Greedy"], 0, 1)), 0.018)).toBe(true);
    expect(rdPlan(inputs(0.7, 100.0, ["Greedy"], 0, 5))).toBe(0.0);
    // Clamp at 3 x rd_norm (15%): a 4.0 mult would ask 20%.
    expect(close(rdPlan(inputs(4.0, 100.0, [], 0, 0)), 0.15)).toBe(true);
  });

  it("arrowhead_plan_at_load", () => {
    // Spec 7.1: R&D target 0.05 x 0.7 x 0.8 = 2.8%, less 1% free: paid R&D about 0.7M of 40M.
    const sim = unwrap(simNew(data(), 1));
    const w = simWorld(sim);
    const a = w.companies[company(w, "CO-0001")];
    if (a === undefined) throw new Error("no CO-0001");
    const u = w.units[a.units[0] as (typeof a.units)[number]];
    if (u === undefined) throw new Error("no unit");
    const ind = w.industries[u.industry];
    if (ind === undefined) throw new Error("no industry");
    const controller = a.controller === null ? null : (w.characters[a.controller]?.traits ?? null);
    const traits = planTraits(controller, false);
    const arch = archetype({
      state_controlled: false,
      revenue_usd: a.revenue_usd,
      tech: ind.sector === "Tech",
      traits,
    });
    expect(arch).toBe("CashCow");
    const book = (a.data[0] as (typeof a.data)[number]).book;
    expect(book.free_rd_pct).toBe(1);
    const i: RdInputs = {
      rd_norm: ind.params.rd_norm,
      archetype_rd_mult: archetypeParams(arch).rd_mult,
      productivity: u.productivity,
      traits,
      loss_q: 0,
      free_rd_pct: book.free_rd_pct,
    };
    expect(Math.abs(rdTarget(i) - 0.028) < 1e-12).toBe(true);
    const plan = rdPlan(i);
    expect(Math.abs(plan - 0.018) < 1e-12, `rd_plan ${plan}`).toBe(true);
    const paid = a.revenue_usd * plan;
    expect(Math.abs(paid - 0.72e6) < 0.005e6, `paid R&D ${paid}`).toBe(true);
  });

  it("m4_rd_plan_at_load_agrees_with_the_lock_rule", () => {
    // M4 load-time plan (finance::jobs reads it for the starting run rate) is this plan at
    // productivity 100 and loss_q 0; lane S should make it delegate to rd::rd_plan.
    const traitSets: Trait[][] = [
      [],
      ["Greedy"],
      ["Visionary", "Diligent"],
      ["Conservative"],
      ["Greedy", "Visionary", "Conservative", "Diligent"],
    ];
    for (const arch of ARCHETYPE_VALUES) {
      for (const traits of traitSets) {
        for (let free = 0; free <= 4; free++) {
          const lock = rdPlan({
            rd_norm: 0.05,
            archetype_rd_mult: archetypeRdMult(arch),
            productivity: 100.0,
            traits,
            loss_q: 0,
            free_rd_pct: free,
          });
          const load = rdPlanAtLoad(0.05, arch, traits, free / 100.0);
          expect(Math.abs(lock - load) < 1e-15, `${arch} ${JSON.stringify(traits)} ${free}`).toBe(true);
        }
      }
    }
  });
});
