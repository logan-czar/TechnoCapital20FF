// Seeded RNG streams (spec 3.1 `rng_streams`, 12.3; build-plan 2.2, M1.2). Ported from the
// `Stream` enum and the `DrawSource` trait in crates/sim/src/rng.rs. Types and constants only:
// the generator, `RngStreams`, `NoNoise` ("no rolls", spec 5.16) and `ScriptedDraws` (replayed
// validate.py draws, build-plan 4.2) belong to the rng.ts port.
//
// One independent stream per system: cycle, growth (the quarterly draws), prices, AI and gen.
// All are seeded from the game seed and told apart by their stream number (D9), so a new draw in
// one system never shifts another system's numbers. The TS port need not use ChaCha (Logan allows
// a different seeded generator, e.g. sfc32 or xoshiro128**); only the stream split, the frozen
// numbers and the draw shapes below are the contract. Normal and Poisson draws are written in the
// rng port (Box-Muller with the spare kept in state, Knuth), never taken from a library.
//
// Jobs never hold an RNG: they draw through the DrawSource in their JobCtx (the pure step
// contract, world/mod.rs docs).

/**
 * The RNG streams, one per system (spec 3.1, 12.3).
 * - Cycle: the global business cycle: phase lengths, g_t, zone shocks (spec 5.1).
 * - Growth: the quarterly industry growth draws (spec 5.1).
 * - Prices: hourly share price noise (spec 5.14).
 * - Ai: Lite AI choices (spec 6; the 6.6 raise roll, D266). IPO votes are gen-stream draws
 *   (5.20.1, D276).
 * - Gen: world generation in play: simple characters, startups, names (spec 3.7.1, 5.19).
 */
export type Stream = "Cycle" | "Growth" | "Prices" | "Ai" | "Gen";

/** Number of streams. */
export const STREAM_COUNT = 5;

/** Rust `Stream::ALL`, in stream-number order. */
export const STREAM_VALUES = ["Cycle", "Growth", "Prices", "Ai", "Gen"] as const;

/**
 * Each stream's number, frozen forever (D9): it seeds the stream and indexes per-stream state
 * (spare normals, saved positions). Renumbering would reseed every saved game.
 */
export const STREAM_NUMBER: Readonly<Record<Stream, number>> = {
  Cycle: 0,
  Growth: 1,
  Prices: 2,
  Ai: 3,
  Gen: 4,
};

/** Rust `Stream::name`: the lowercase name used in messages. */
export const STREAM_NAME: Readonly<Record<Stream, string>> = {
  Cycle: "cycle",
  Growth: "growth",
  Prices: "prices",
  Ai: "ai",
  Gen: "gen",
};

/**
 * Largest Poisson mean Knuth's method is used for (D9). It is O(mean) and `exp(-mean)`
 * underflows near 745; the spec's only Poisson draw has mean 2 (5.19.1).
 */
export const POISSON_MAX_MEAN = 30.0;

/**
 * Where a job's random numbers come from (the pure step contract). Every draw names its stream.
 *
 * Rust's trait has default methods (uniform from next_u64, Poisson by Knuth over uniform,
 * int_inclusive by rejection over next_u64, chance as `uniform < p`); in TS every method is
 * required, and the rng port supplies shared helpers for the defaults.
 *
 * Deviation: Rust's raw draw is `next_u64(stream) -> u64`. A JS number cannot hold a u64, so the
 * raw draw here is `nextU32`. No sim code outside rng.rs calls the raw draw.
 */
export interface DrawSource {
  /** A raw 32-bit draw: a whole number in 0..2^32 (replaces Rust `next_u64`). */
  nextU32(stream: Stream): number;
  /** A float in [0, 1). */
  uniform(stream: Stream): number;
  /** A standard normal (mean 0, sd 1). */
  normal(stream: Stream): number;
  /** A Poisson count with `mean` (Knuth; 0 to POISSON_MAX_MEAN). Whole number (u32). */
  poisson(stream: Stream, mean: number): number;
  /**
   * A uniform whole number in `lo..=hi`, unbiased (spec 3.7.1 "uniform integer draws"). `lo` and
   * `hi` are whole numbers (i64 in Rust; safe integers here).
   */
  intInclusive(stream: Stream, lo: number, hi: number): number;
  /** True with probability `p`. */
  chance(stream: Stream, p: number): boolean;
}
