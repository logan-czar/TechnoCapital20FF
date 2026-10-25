// Port of crates/sim/tests/m2_assets.rs: M2.9: asset decay and growth plan purchases and sales
// (spec 5.10). Done when $50M of assets decays $400k a year.
//
// Expects:
//   ../../src/economy/assets.ts  RAMP_MONTHS, applyAssetMonth(unit, params, label) -> { decay,
//                                depreciation, purchases, ramping_added, sold, book_sold,
//                                proceeds, gain } (mutates the unit), dEff(gross, params),
//                                decayUsd(gross, params), saleFactor(label)
//   ./common/economy.ts          worldAtLoad;  ./common/m3.ts  unitAssetsEff  [assets_eff]
//   ./common/rng.ts              newNoNoise
// Changed from the Rust: none (NoNoise only).
import { describe, expect, it } from "vitest";
import { applyAssetMonth, dEff, decayUsd, RAMP_MONTHS, saleFactor } from "../../src/economy/assets.ts";
import type { BusinessUnit, IndustryParams, PhaseLabel } from "../../src/types/world.ts";
import { worldAtLoad } from "./common/economy.ts";
import { data } from "./common/index.ts";
import { unitAssetsEff } from "./common/m3.ts";
import { newNoNoise } from "./common/rng.ts";

function unitAndParams(gross: number, growth: number): [BusinessUnit, IndustryParams] {
  const w = worldAtLoad(data(), newNoNoise());
  const u = structuredClone(w.units[0] as BusinessUnit);
  u.gross_assets = gross;
  u.asset_book = 0.5 * gross;
  u.ramping = [];
  u.growth_plan = growth;
  const p = structuredClone((w.industries[u.industry] as (typeof w.industries)[number]).params);
  return [u, p];
}

const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) < tol;

describe("m2 assets", () => {
  it("fifty_million_decays_400k_a_year", () => {
    let [, p] = unitAndParams(50e6, 0.0);
    expect(decayUsd(50e6, p)).toBe(400_000.0);
    expect(near(dEff(50e6, p), 0.008, 1e-15)).toBe(true);
    expect(decayUsd(10e6, p), "nothing at $10M or less").toBe(0.0);
    expect(decayUsd(1e5, p)).toBe(0.0);

    // g = 0 holds the base flat and buys back the decay: $400k a year at $50M.
    let [u] = unitAndParams(50e6, 0.0);
    let bought = 0.0;
    for (let i = 0; i < 12; i++) {
      const m = applyAssetMonth(u, p, "Normal");
      expect(near(m.purchases, m.decay, 1e-9)).toBe(true);
      expect(m.ramping_added, "replacement does not ramp").toBe(0.0);
      bought += m.purchases;
    }
    expect(near(u.gross_assets, 50e6, 1e-6)).toBe(true);
    expect(near(bought, 400_000.0, 1e-6)).toBe(true);
    expect(u.ramping.length).toBe(0);

    // g = -d_eff buys and sells nothing: the base shrinks by decay alone (1% a year above $10M).
    [u, p] = unitAndParams(50e6, 0.0);
    let lost = 0.0;
    for (let i = 0; i < 12; i++) {
      u.growth_plan = -dEff(u.gross_assets, p);
      const m = applyAssetMonth(u, p, "Normal");
      expect(Math.abs(m.purchases) < 1e-6 && Math.abs(m.sold) < 1e-6).toBe(true);
      lost += m.decay;
    }
    expect(near(lost, 400_000.0, 2_000.0), `${lost}`).toBe(true);
    expect(near(50e6 - u.gross_assets - lost, 0, 1e-6)).toBe(true);
    // Book falls by the depreciation, which equals the decay.
    expect(near(25e6 - u.asset_book - lost, 0, 1e-6)).toBe(true);
  });

  it("growth_ramps_for_six_months", () => {
    const [u, p] = unitAndParams(50e6, 0.12);
    const m = applyAssetMonth(u, p, "Normal");
    // Purchases = gross x (d_eff + g) / 12; only the growth part ramps.
    expect(near(m.purchases, (50e6 * (0.008 + 0.12)) / 12.0, 1e-6)).toBe(true);
    expect(near(m.ramping_added, (50e6 * 0.12) / 12.0, 1e-6)).toBe(true);
    expect(u.ramping.length).toBe(1);
    const t = u.ramping[0] as { amount: number; months_left: number };
    expect(t.months_left).toBe(RAMP_MONTHS);
    expect(near(unitAssetsEff(u), u.gross_assets - 0.2 * t.amount, 1e-6)).toBe(true);
    u.growth_plan = 0.0;
    for (let k = 1; k <= RAMP_MONTHS; k++) {
      applyAssetMonth(u, p, "Normal");
      expect(u.ramping.length, `after ${k} more months`).toBe(k < RAMP_MONTHS ? 1 : 0);
    }
    expect(unitAssetsEff(u)).toBe(u.gross_assets);
  });

  it("sales_at_the_sale_factor", () => {
    const cases: [PhaseLabel, number][] = [
      ["Boom", 1.0],
      ["Normal", 0.85],
      ["Glut", 0.7],
      ["Bust", 0.6],
    ];
    for (const [label, factor] of cases) {
      expect(saleFactor(label)).toBe(factor);
      const [u, p] = unitAndParams(50e6, -0.15);
      const m = applyAssetMonth(u, p, label);
      // Sell gross x |d_eff + g| / 12 of capacity; the same share of the book; cash = book sold
      // x sale factor; the difference is the gain or loss.
      const sold = (50e6 * (0.15 - 0.008)) / 12.0;
      expect(near(m.sold, sold, 1e-6)).toBe(true);
      const afterDecay = 50e6 - m.decay;
      const bookAfterDecay = 25e6 - m.depreciation;
      expect(near(m.book_sold, (bookAfterDecay * sold) / afterDecay, 1e-6)).toBe(true);
      expect(near(m.proceeds, m.book_sold * factor, 1e-6)).toBe(true);
      expect(near(m.gain, (factor - 1.0) * m.book_sold, 1e-6)).toBe(true);
      expect(near(u.gross_assets, afterDecay - sold, 1e-6)).toBe(true);
      expect([u.sale_proceeds_m, u.sale_gain_m, u.capex_m]).toEqual([m.proceeds, m.gain, 0.0]);
    }
  });
});
