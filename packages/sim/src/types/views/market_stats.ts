// v_market_stats (crates/sim/src/views/market_stats.rs): the engine's own market diagnostics for
// the headless soak (build-plan M5.8, M10.1), never a screen: how far prices sit from fair value
// across the quoted stocks (true V is never shown per company, spec 8, so only these aggregates
// leave the sim), the listed count and the mean zone confidence. Rebuilt daily (D144).
//
// Not ported: gap (`|P ÷ V − 1|`, D143) and the `ViewData` build (logic).

/** The M5.8 tracking band: a quoted company-day tracks V when `|P ÷ V − 1| ≤ 30%` (D143). */
export const TRACKING_BAND = 0.3;

export interface MarketStatsView {
  /** Listed companies (on an exchange, quoted or delisted at a bankruptcy). */
  listed: number;
  /** Quoted companies (listed and not delisted). */
  quoted: number;
  /** The median of `|P ÷ V − 1|` over the quoted companies (0 with none). */
  median_gap: number;
  /** Quoted companies with `|P ÷ V − 1| ≤ 30%`. */
  within_band: number;
  /** The mean investor confidence over the 26 zones (spec 5.1.2). */
  mean_confidence: number;
  /**
   * The last release's reports: companies not frozen with a quarter compared against its
   * consensus (5.15), and how many were tagged Beat or Big beat, Miss or Big miss (the spec 10
   * "30% to 60% of releases are beats" target, read by the headless soak).
   */
  reports: number;
  beats: number;
  misses: number;
}
