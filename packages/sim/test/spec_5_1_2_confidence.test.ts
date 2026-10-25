// Port of crates/sim/tests/spec_5_1_2_confidence.rs: spec 5.1.2 zone exchange investor confidence
// (batch 157, 2a; 3-markets 3.3.5): once a day, confidence = clamp(0.9 x confidence + 3 x r +
// news, -100, +100). Build-plan M5.7: it decays to 0 with no news. Pure formulas, no RNG.
//
// Expects:
//   ../src/market/confidence.ts   type ConfidenceHeadline = { kind: "BigBeat" } | { kind:
//                                    "Beat" } | { kind: "Miss" } | { kind: "BigMiss" } | { kind:
//                                    "Bankruptcy" } | { kind: "RatingChange"; notches: number },
//                                    confidenceHeadlinePoints(h) [ConfidenceHeadline::points],
//                                    newsPoints(headlines), updateConfidence(c, r, news)
//   ../src/market/fair_value.ts   exchangeFactor(confidence | null)
//   ../src/market/exchange_index.ts        exchangeIndexAtLoad(start) [ExchangeIndex::at_load],
//                                    exchangeIndexCloseDay(index, r_input) -> number
//                                    [ExchangeIndex::close_day]
import { describe, expect, it } from "vitest";
import {
  type ConfidenceHeadline,
  confidenceHeadlinePoints,
  newsPoints,
  updateConfidence,
} from "../src/market/confidence.ts";
import { exchangeIndexAtLoad, exchangeIndexCloseDay } from "../src/market/exchange_index.ts";
import { exchangeFactor } from "../src/market/fair_value.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b), 1.0), `${a} vs ${b}`).toBe(true);
}

describe("spec 5.1.2 exchange confidence", () => {
  it("headline_points", () => {
    // 5.1.2 (T): Big beat +4, Beat +2, Miss -2, Big miss -4, bankruptcy -5, rating change of 2+
    // notches +-3.
    const h = (kind: ConfidenceHeadline["kind"]): ConfidenceHeadline => ({ kind }) as ConfidenceHeadline;
    const rating = (notches: number): ConfidenceHeadline => ({ kind: "RatingChange", notches });
    near(confidenceHeadlinePoints(h("BigBeat")), 4.0);
    near(confidenceHeadlinePoints(h("Beat")), 2.0);
    near(confidenceHeadlinePoints(h("Miss")), -2.0);
    near(confidenceHeadlinePoints(h("BigMiss")), -4.0);
    near(confidenceHeadlinePoints(h("Bankruptcy")), -5.0);
    near(confidenceHeadlinePoints(rating(2)), 3.0);
    near(confidenceHeadlinePoints(rating(-3)), -3.0);
    near(confidenceHeadlinePoints(rating(1)), 0.0);
    near(confidenceHeadlinePoints(rating(-1)), 0.0);
    const day = [
      h("BigBeat"),
      h("Beat"),
      h("Miss"),
      h("BigMiss"),
      h("Bankruptcy"),
      rating(2),
      rating(-3),
      rating(1),
    ];
    near(newsPoints(day), 4.0 + 2.0 - 2.0 - 4.0 - 5.0 + 3.0 - 3.0);
    near(newsPoints([]), 0.0);
  });

  it("daily_update", () => {
    // 0.9 x 50 + 3 x 2% + 4 (a Big beat) = 45 + 6 + 4 = 55.
    near(updateConfidence(50.0, 2.0, 4.0), 55.0);
    // -0.9 x 20 - 3 x 1.5% - 2 = -24.5.
    near(updateConfidence(-20.0, -1.5, -2.0), -24.5);
    // Clamped to +-100.
    near(updateConfidence(95.0, 10.0, 10.0), 100.0);
    near(updateConfidence(-95.0, -10.0, -5.0), -100.0);
    near(updateConfidence(0.0, 0.0, 0.0), 0.0);
    // It feeds X = 1 + 0.10 x confidence / 100 (5.13).
    near(exchangeFactor(updateConfidence(95.0, 10.0, 10.0)), 1.1);
  });

  it("decays_to_zero_with_no_news", () => {
    // Build-plan M5.7. With r 0 and no news it keeps 90% a day; under 0.005 it reads 0 (D251).
    // From +100 that is the first n with 100 x 0.9^n below 0.005: n = 94.
    const n = Math.ceil(Math.log(0.005 / 100) / Math.log(0.9));
    expect(n).toBe(94);
    for (const start of [100.0, -100.0]) {
      let c = start;
      for (let day = 1; day <= n; day++) {
        c = updateConfidence(c, 0.0, 0.0);
        if (day < n) {
          expect(c !== 0.0, `${start}: 0 already on day ${day}`).toBe(true);
          near(c, start * 0.9 ** day);
        }
      }
      expect(c, String(start)).toBe(0.0);
      expect(updateConfidence(c, 0.0, 0.0)).toBe(0.0);
    }
    // An exchange with no listed company has r 0 and no news (5.1.2), so it decays to 0 too.
    const empty = exchangeIndexAtLoad(0.0);
    let c = 40.0;
    for (let i = 0; i < 200; i++) {
      c = updateConfidence(c, exchangeIndexCloseDay(empty, 0.0), newsPoints([]));
    }
    expect(c).toBe(0.0);
  });
});
