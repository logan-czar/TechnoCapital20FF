// Port of crates/sim/tests/spec_5_10_sales.rs: spec 5.10 asset sales (10.0.7): capacity sold at
// cost, the same share of the book, cash book sold x sale factor (Boom 1.00, Normal 0.85, Glut
// 0.70, Bust 0.60), the difference a gain or loss in pre-tax income (build-plan M4.6: unit tests
// per phase label).
//
// Expects:
//   ../src/economy/assets.ts  applyAssetMonth(unit, params, label) -> { decay, depreciation,
//                                sold, book_sold, proceeds, gain } (mutates the unit),
//                                saleFactor(label)
//   ../src/finance/sales.ts   REMOVAL_SALE_FACTOR, sellAll(gross, book, factor),
//                                sellCapacity(gross, book, capacity, factor), sellForCash(gross,
//                                book, cash_needed, factor); AssetSale (types/state/finance.ts)
//   ../src/lib.ts             simNew, simWorld (via ./common)
import { describe, expect, it } from "vitest";
import { applyAssetMonth, saleFactor } from "../src/economy/assets.ts";
import { REMOVAL_SALE_FACTOR, sellAll, sellCapacity, sellForCash } from "../src/finance/sales.ts";
import { simNew, simWorld } from "../src/lib.ts";
import type { AssetSale } from "../src/types/state/finance.ts";
import type { PhaseLabel } from "../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) < 1e-6, `${a} vs ${b}`).toBe(true);
}

/** AssetSale::default(): nothing sold. */
const NO_SALE: AssetSale = {
  capacity_sold: 0,
  book_sold: 0,
  proceeds: 0,
  gain: 0,
  share: 0,
};

describe("spec 5.10 asset sales", () => {
  it("sale_factor_per_phase_label", () => {
    expect(saleFactor("Boom")).toBe(1.0);
    expect(saleFactor("Normal")).toBe(0.85);
    expect(saleFactor("Glut")).toBe(0.7);
    expect(saleFactor("Bust")).toBe(0.6);
    // 5.12 step 3: the removal sale is at the Bust factor.
    expect(REMOVAL_SALE_FACTOR).toBe(0.6);
  });

  it("ten_percent_of_a_unit_in_each_phase", () => {
    // Gross 100M at cost, book 60M; sell 10M of capacity: the book sold is the same 10%, 6M; cash
    // is 6M x factor; the gain is cash - book.
    const cases: [PhaseLabel, number, number][] = [
      ["Boom", 6.0e6, 0.0],
      ["Normal", 5.1e6, -0.9e6],
      ["Glut", 4.2e6, -1.8e6],
      ["Bust", 3.6e6, -2.4e6],
    ];
    for (const [phase, cash, gain] of cases) {
      const s = sellCapacity(100.0e6, 60.0e6, 10.0e6, saleFactor(phase));
      near(s.capacity_sold, 10.0e6);
      near(s.book_sold, 6.0e6);
      near(s.proceeds, cash);
      near(s.gain, gain);
      near(s.share, 0.1);
      expect(s.gain <= 0.0, `${phase}: a sale at or under book is never a gain`).toBe(true);
    }
  });

  it("growth_plan_sale_of_a_shrinking_unit", () => {
    // 5.10: g below -d_eff sells gross x |d_eff + g| / 12 a month. 50M of assets decays 400k a
    // year (d_eff 0.8%); at g -15% the month sells 50 x 0.142 / 12 = about 0.5917M of capacity.
    const gross = 50.0e6;
    const dEff = 0.4e6 / gross;
    const g = -0.15;
    const capacity = (gross * Math.abs(dEff + g)) / 12.0;
    near(capacity, 591_666.666_666_7);
    const s = sellCapacity(gross, 25.0e6, capacity, saleFactor("Normal"));
    near(s.book_sold, capacity / 2.0);
    near(s.proceeds, (capacity / 2.0) * 0.85);
    near(s.gain, (-capacity / 2.0) * 0.15);
  });

  it("forced_sale_raises_just_the_cash_needed", () => {
    // 5.12 step 1: sell at the sale factor until cash reaches 0. 3M needed at Normal from a 60M
    // book: 3M / 0.85 of book, the same share of capacity.
    let s = sellForCash(100.0e6, 60.0e6, 3.0e6, saleFactor("Normal"));
    near(s.proceeds, 3.0e6);
    near(s.book_sold, 3.0e6 / 0.85);
    near(s.capacity_sold, (100.0e6 * (3.0e6 / 0.85)) / 60.0e6);
    near(s.gain, 3.0e6 - 3.0e6 / 0.85);
    // Not enough: everything sells, at the Bust factor 36M.
    s = sellForCash(100.0e6, 60.0e6, 100.0e6, saleFactor("Bust"));
    expect(s.capacity_sold).toBe(100.0e6);
    expect(s.book_sold).toBe(60.0e6);
    near(s.proceeds, 36.0e6);
    expect(s.share).toBe(1.0);
    // Nothing needed, or no book to sell (D225): nothing sells.
    expect(sellForCash(100.0e6, 60.0e6, 0.0, 0.85)).toEqual(NO_SALE);
    expect(sellForCash(100.0e6, 0.0, 5.0e6, 0.85)).toEqual(NO_SALE);
  });

  it("caps_and_sell_all", () => {
    // Capacity is capped at what the unit has.
    let s = sellCapacity(10.0e6, 4.0e6, 25.0e6, 1.0);
    expect([s.capacity_sold, s.book_sold, s.share]).toEqual([10.0e6, 4.0e6, 1.0]);
    expect(sellCapacity(0.0, 0.0, 1.0e6, 1.0)).toEqual(NO_SALE);
    // The removal sale (5.12 step 3) sells the whole unit at the Bust factor.
    s = sellAll(80.0e6, 30.0e6, REMOVAL_SALE_FACTOR);
    expect([s.capacity_sold, s.book_sold]).toEqual([80.0e6, 30.0e6]);
    near(s.proceeds, 18.0e6);
    near(s.gain, -12.0e6);
  });

  it("sell_capacity_matches_the_growth_plan_sale_of_economy_assets", () => {
    // 4.3 step 11 sells through economy::assets::apply_asset_month (lane S); forced and removal
    // sales use finance::sales. Both must price a sale the same way: the same capacity, book
    // share, cash and gain.
    const sim = unwrap(simNew(data(), 42));
    const w = simWorld(sim);
    const first = w.units[0];
    if (first === undefined) throw new Error("no units");
    const u = structuredClone(first);
    u.gross_assets = 50.0e6;
    u.asset_book = 25.0e6;
    u.ramping = [];
    u.growth_plan = -0.15;
    const p = structuredClone((w.industries[u.industry] as (typeof w.industries)[number]).params);
    const labels: PhaseLabel[] = ["Boom", "Normal", "Glut", "Bust"];
    for (const label of labels) {
      const unit = structuredClone(u);
      const m = applyAssetMonth(unit, p, label);
      // apply_asset_month decays first, then sells on the decayed balances.
      const s = sellCapacity(50.0e6 - m.decay, 25.0e6 - m.depreciation, m.sold, saleFactor(label));
      near(s.capacity_sold, m.sold);
      near(s.book_sold, m.book_sold);
      near(s.proceeds, m.proceeds);
      near(s.gain, m.gain);
    }
  });
});
