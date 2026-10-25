// Port of crates/sim/tests/spec_5_16.rs: spec 5.16 projections and consensus (21.5.1): `consensus =
// projection x (1 + e)`, e uniform +-15% (the spec's +-5% widened by the M10.7 tuning pass, D361);
// the shown range `+-30% x (1 - 0.6 x elapsed share) x (1 - 24 / 50) x 0.7`, x2 for a secret plan
// (all, for the observer), minimum +-3%. The range shrinks as the quarter passes.
//
// Expects:
//   ../../src/market/projection.ts  RANGE_VIEWER_OBSERVER (the Rust RangeViewer::OBSERVER const),
//                                   type RangeViewer { finance, has_pdoomberg, plan_secret },
//                                   consensus(projection, draws), elapsedShare(t),
//                                   range(centre, width) -> [low, high], rangeWidth(share, viewer)
//   ./common/rng.ts                 newRng, newNoNoise, newScripted, scriptedPush
//
// Changed from the Rust: RngStreams::new(5) is the new generator (D951). The uniform +-15% checks
// (range, mean, sd) are distribution checks and hold for any good generator at the same
// tolerances; the scripted draws keep their exact asserts. RangeViewer::OBSERVER is the exported
// constant RANGE_VIEWER_OBSERVER.
import { describe, expect, it } from "vitest";
import {
  consensus,
  elapsedShare,
  RANGE_VIEWER_OBSERVER,
  type RangeViewer,
  range,
  rangeWidth,
} from "../../src/market/projection.ts";
import { dateTimeAt, simDateYmd } from "../../src/time/calendar.ts";
import { newNoNoise, newRng, newScripted, scriptedPush } from "./common/rng.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b), 1.0), `${a} vs ${b}`).toBe(true);
}

describe("spec 5.16 projections and consensus", () => {
  it("observer_range_from_the_spec", () => {
    const o = RANGE_VIEWER_OBSERVER;
    // Start of the quarter: 0.30 x 1 x 0.52 x 0.7 x 2 = 0.2184.
    near(rangeWidth(0.0, o), 0.2184);
    // Half way: 0.30 x 0.7 x 0.52 x 0.7 x 2 = 0.15288.
    near(rangeWidth(0.5, o), 0.15288);
    // At the end: 0.30 x 0.4 x 0.52 x 0.7 x 2 = 0.08736.
    near(rangeWidth(1.0, o), 0.08736);
    // A viewer who can see the plan: half as wide.
    const open: RangeViewer = { ...o, plan_secret: false };
    near(rangeWidth(1.0, open), 0.04368);
    // Never under +-3%: Finance 40 without Pdoomberg gives 0.30 x 0.4 x 0.2 = 0.024.
    const sharp: RangeViewer = { finance: 40.0, has_pdoomberg: false, plan_secret: false };
    near(rangeWidth(1.0, sharp), 0.03);
    near(rangeWidth(0.0, { ...sharp, finance: 60.0 }), 0.03);
  });

  it("ranges_shrink_with_elapsed_share_to_the_minimum", () => {
    const o = RANGE_VIEWER_OBSERVER;
    let last = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 20; i++) {
      const w = rangeWidth(i / 20, o);
      expect(w < last, `${i}`).toBe(true);
      expect(w >= 0.03).toBe(true);
      last = w;
    }
    // Shares outside 0 to 1 clamp.
    near(rangeWidth(-1.0, o), rangeWidth(0.0, o));
    near(rangeWidth(2.0, o), rangeWidth(1.0, o));
  });

  it("elapsed_share_of_the_calendar_quarter", () => {
    // D252: hours since 00:00 on the quarter's first day / the quarter's hours (Q2 2021: 91 days).
    const at = (m: number, d: number, h: number) => dateTimeAt(simDateYmd(2021, m, d), h);
    near(elapsedShare(at(4, 1, 0)), 0.0);
    near(elapsedShare(at(4, 9, 0)), 8.0 / 91.0);
    near(elapsedShare(at(6, 30, 23)), (90.0 * 24.0 + 23.0) / (91.0 * 24.0));
    near(elapsedShare(at(7, 1, 0)), 0.0);
    // Q1 2020 (leap year): 91 days, the lock on 9 January is 8 days in.
    near(elapsedShare(dateTimeAt(simDateYmd(2020, 1, 9), 0)), 8.0 / 91.0);
  });

  it("range_around_a_centre", () => {
    // centre -+ |centre| x width.
    let [lo, hi] = range(100.0, 0.2);
    near(lo, 80.0);
    near(hi, 120.0);
    [lo, hi] = range(-50.0, 0.1);
    near(lo, -55.0);
    near(hi, -45.0);
  });

  it("consensus_is_the_projection_within_fifteen_percent", () => {
    // NoNoise (u = 0.5) gives e = 0.
    near(consensus(10.0e6, newNoNoise()), 10.0e6);
    // e = -15% + 30% x u (D361).
    const s = newScripted();
    scriptedPush(s, "Prices", [0.0, 0.75]);
    near(consensus(10.0e6, s), 8.5e6);
    near(consensus(10.0e6, s), 10.75e6);
    // Uniform +-15%: mean 0, sd 0.3 / sqrt(12).
    const r = newRng(5);
    const n = 100_000;
    const es: number[] = [];
    for (let i = 0; i < n; i++) es.push(consensus(1.0, r) - 1.0);
    expect(es.every((e) => e >= -0.15 && e < 0.15)).toBe(true);
    const mean = es.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(es.reduce((a, e) => a + (e - mean) ** 2, 0) / n);
    expect(Math.abs(mean) < 1.5e-3, `${mean}`).toBe(true);
    expect(Math.abs(sd / (0.3 / Math.sqrt(12)) - 1.0) < 0.01, `${sd}`).toBe(true);
  });
});
