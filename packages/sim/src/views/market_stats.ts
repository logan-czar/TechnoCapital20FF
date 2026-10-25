// v_market_stats: the engine's own market diagnostics for the headless soak (build-plan M5.8,
// M10.1), never a screen: how far prices sit from fair value across the quoted stocks (true V is
// never shown per company, spec 8, so only these aggregates leave the sim), the listed count and
// the mean zone confidence. Rebuilt daily (D144). Ported from
// crates/sim/src/views/market_stats.rs; TRACKING_BAND is in types/views/market_stats.ts.

import { companyStatusIsFrozen } from "../finance/distress.ts";
import { companyFinanceQuarters, companyFinanceStatus } from "../finance/state.ts";
import { totalCmp } from "../types/num.ts";
import { type MarketStatsView, TRACKING_BAND } from "../types/views/market_stats.ts";
import type { ViewInput } from "./index.ts";

export { TRACKING_BAND };

/** Rust `gap`: `|P ÷ V − 1|` (D143); a V at or below 0 counts as an infinite gap. */
export function gap(price: number, value: number): number {
  return value > 0.0 ? Math.abs(price / value - 1.0) : Number.POSITIVE_INFINITY;
}

/** Rust `impl ViewData for MarketStatsView`: `build`. */
export function buildMarketStats(input: ViewInput): MarketStatsView {
  const w = input.world;
  const gaps = w.market.stocks.filter((s) => s.quoted).map((s) => gap(s.price, s.value));
  gaps.sort(totalCmp);
  const n = gaps.length;
  let median_gap: number;
  if (n === 0) median_gap = 0.0;
  else if (n % 2 === 1) median_gap = gaps[Math.floor(n / 2)] as number;
  else median_gap = 0.5 * ((gaps[n / 2 - 1] as number) + (gaps[n / 2] as number));
  const zones = Math.max(w.zones.length, 1);
  let reports = 0;
  let beats = 0;
  let misses = 0;
  w.companies.forEach((c, i) => {
    if (
      companyStatusIsFrozen(companyFinanceStatus(c.finance)) ||
      companyFinanceQuarters(c.finance).length === 0
    )
      return;
    reports += 1;
    const tag = (w.market.stocks[i] as (typeof w.market.stocks)[number]).tags.surprise;
    if (tag === "Beat" || tag === "BigBeat") beats += 1;
    else if (tag === "Miss" || tag === "BigMiss") misses += 1;
  });
  let confidence = 0.0;
  for (const z of w.zones) confidence += z.confidence;
  return {
    listed: w.market.stocks.filter((s) => s.exchange !== null).length,
    quoted: n,
    median_gap,
    within_band: gaps.filter((g) => g <= TRACKING_BAND).length,
    mean_confidence: confidence / zones,
    reports,
    beats,
    misses,
  };
}
