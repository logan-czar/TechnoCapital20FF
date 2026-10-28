// D972: the focus experiment. Focus 0 is spec 6.2 and 6.3 untouched; a level moves reinvestment
// between R&D and growth with the dollars conserved. Pure, no RNG.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { applyFocus, FOCUS_RD_SHIFT_PER_LEVEL, type FocusInputs, focusOf } from "../src/ai/focus.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { rdEffect } from "../src/ops/productivity.ts";

const base: FocusInputs = {
  focus: 0,
  rd_plan: 0.05,
  growth: 0.1,
  rd_norm: 0.05,
  ttm_revenue: 100.0e6,
  gross_assets: 100.0e6,
  loss_q: 0,
  funding: {
    gross_assets: 100.0e6,
    d_eff: 0.008,
    liquidity: 1.0e12,
    min_cash: 0.0,
    purchases_stopped: false,
  },
};

describe("focus (D972)", () => {
  it("focus 0 changes nothing", () => {
    expect(applyFocus(base)).toEqual({ rd_plan: base.rd_plan, growth: base.growth });
  });

  it("R&D focus raises R&D and gives up the same dollars of growth", () => {
    const r = applyFocus({ ...base, focus: 1 });
    const shift = FOCUS_RD_SHIFT_PER_LEVEL * base.rd_norm;
    expect(r.rd_plan).toBeCloseTo(base.rd_plan + shift, 12);
    expect(r.growth).toBeCloseTo(base.growth - shift, 12);
  });

  it("growth focus cuts R&D and spends it on growth", () => {
    const r = applyFocus({ ...base, focus: -1 });
    expect(r.rd_plan).toBeLessThan(base.rd_plan);
    expect(r.growth).toBeGreaterThan(base.growth);
  });

  it("a loss leaves both plans alone", () => {
    expect(applyFocus({ ...base, focus: 2, loss_q: 2 })).toEqual({
      rd_plan: base.rd_plan,
      growth: base.growth,
    });
  });

  it("R&D never goes below zero", () => {
    expect(applyFocus({ ...base, focus: -5, rd_plan: 0.01 }).rd_plan).toBe(0);
  });

  it("the funding cap still limits growth bought by cutting R&D", () => {
    const tight = { ...base.funding, liquidity: 1.0e6 };
    expect(applyFocus({ ...base, focus: -2, growth: 0.01, funding: tight }).growth).toBeLessThan(0.05);
  });

  it("the level of company id cycles through the levels, 0 with none", () => {
    expect(focusOf(undefined, 3)).toBe(0);
    expect([0, 1, 2, 3].map((id) => focusOf([0, 1], id))).toEqual([0, 1, 0, 1]);
  });

  it("is off by default and set by the option", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    const off = simNew(structuredClone(r.value), 3);
    const on = simNew(structuredClone(r.value), 3, { focus_levels: [0, 1, -1] });
    if (!off.ok || !on.ok) throw new Error("sim");
    expect(simWorld(off.value).focus_levels).toBeUndefined();
    expect(simWorld(on.value).focus_levels).toEqual([0, 1, -1]);
  });
});

describe("R&D curve (D973)", () => {
  it("infinity is spec 5.6, underspend always counts in full", () => {
    expect(rdEffect(0.5, Number.POSITIVE_INFINITY)).toBe(0.5);
    expect(rdEffect(-0.5)).toBe(-0.5);
    expect(rdEffect(1.0)).toBeCloseTo(0.5, 12);
  });

  it("with the curve, overspend counts half at x and never reaches x", () => {
    expect(rdEffect(1.0, 1.0)).toBeCloseTo(0.5, 12);
    expect(rdEffect(100.0, 1.0)).toBeLessThan(1.0);
  });

  it("is left absent by default and set by the option", () => {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error("data");
    const on = simNew(structuredClone(r.value), 3, { rd_diminishing_x: 1.0 });
    const off = simNew(structuredClone(r.value), 3);
    if (!on.ok || !off.ok) throw new Error("sim");
    expect(simWorld(on.value).rd_diminishing_x).toBe(1.0);
    expect(simWorld(off.value).rd_diminishing_x).toBeUndefined();
  });
});
