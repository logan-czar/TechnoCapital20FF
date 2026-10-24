// Seeded RNG streams (spec 3.1 `rng_streams`, 12.3; build-plan 2.2, M1.2). Ported from
// crates/sim/src/rng.rs.
//
// One xoshiro128** stream per system: cycle, growth (the quarterly draws), prices, AI and gen.
// All five are derived from the game seed and told apart by their stream number (decision D9), so
// a new draw in one system never shifts another system's numbers. D951 (Logan): the TS sim need
// not match Rust's ChaCha8 draws; the same gameplay outcomes is the bar. xoshiro128** (Blackman
// and Vigna, 128 bits of state) is implemented here in 32-bit integer math, with no dependency,
// so an upgrade can never change the draws. Each stream's state is derived from (seed, stream
// number) by splitmix32-style mixing so the streams are independent. Normal and Poisson draws are
// written here (Box-Muller, Knuth), never taken from a library.
//
// Jobs never hold an RNG: they draw through the DrawSource in their JobCtx (the pure step
// contract, types/world.ts docs). `RngStreams` is the game's source, plain data (number arrays)
// so it saves, hashes and structured-clones; `rngStreamsDraws` wraps it as a DrawSource. `NoNoise`
// gives "no rolls" for the spec 5.16 projections; `scriptedDraws` replays recorded draws, such as
// the validate.py fixture of the M2.10 growth check (build-plan 4.2).

import type { DrawSource, Stream } from "./types/draws.ts";
import { POISSON_MAX_MEAN, STREAM_COUNT, STREAM_NAME, STREAM_NUMBER, STREAM_VALUES } from "./types/draws.ts";
import { clamp, roundHalfAway, toI64Sat, toU32Sat } from "./types/num.ts";

/** Rust `Stream::index`: the stream's number, the slot in per-stream state (D9). */
export function streamIndex(stream: Stream): number {
  return STREAM_NUMBER[stream];
}

/** Rust `Stream::name`. */
export function streamName(stream: Stream): string {
  return STREAM_NAME[stream];
}

const TAU = 2 * Math.PI;
/** 2^32. */
const TWO_32 = 0x1_0000_0000;
/** 2^53. */
const TWO_53 = 9007199254740992;
/** 2^-53: turns 53 random bits into a float in [0, 1). */
const UNIT_SCALE = 1.0 / TWO_53;

/** A float in [0, 1) from 53 random bits: the top 27 bits of `hi` and the top 26 of `lo`. */
export function unitFromU32Pair(hi: number, lo: number): number {
  return ((hi >>> 5) * 67108864 + (lo >>> 6)) * UNIT_SCALE;
}

/** Box-Muller: two independent standard normals from `u1` in (0, 1] and `u2` in [0, 1). */
export function boxMuller(u1: number, u2: number): [number, number] {
  const r = Math.sqrt(-2.0 * Math.log(u1));
  const theta = TAU * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

/** Knuth's Poisson draw with `mean` (0 to POISSON_MAX_MEAN) from a uniform [0, 1) source. */
export function knuthPoisson(mean: number, uniform: () => number): number {
  // Rust asserts the range (no fallback above it): a larger mean is a caller bug.
  if (!(mean >= 0 && mean <= POISSON_MAX_MEAN)) {
    throw new RangeError(`Poisson mean ${mean} outside 0 to ${POISSON_MAX_MEAN}`);
  }
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1.0;
  for (;;) {
    p *= uniform();
    if (p <= limit) return k;
    k += 1;
  }
}

/**
 * An unbiased whole number in `lo..=hi` from a 32-bit source (rejection of the short last
 * block, never a bare modulo). Spans up to 2^32 take one draw per try; larger spans (up to 2^53)
 * take two draws per try and reject on 53 bits.
 */
export function intInRange(lo: number, hi: number, nextU32: () => number): number {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi)) {
    throw new RangeError(`range ${lo}..=${hi} is not whole numbers`);
  }
  if (lo > hi) throw new RangeError(`empty range ${lo}..=${hi}`);
  const span = hi - lo + 1;
  if (span > TWO_53) throw new RangeError(`range ${lo}..=${hi} is wider than 2^53`);
  if (span <= TWO_32) {
    // Values below `threshold` would make the low results slightly more likely.
    const threshold = TWO_32 % span;
    for (;;) {
      const x = nextU32();
      if (x >= threshold) return lo + (x % span);
    }
  }
  const threshold = TWO_53 % span;
  for (;;) {
    const hiW = nextU32();
    const loW = nextU32();
    const x = (hiW >>> 11) * TWO_32 + loW;
    if (x >= threshold) return lo + (x % span);
  }
}

/** The default `DrawSource::uniform`: two raw draws make 53 bits. */
function uniformFromRaw(nextU32: () => number): number {
  const hi = nextU32();
  const lo = nextU32();
  return unitFromU32Pair(hi, lo);
}

/**
 * A standard normal clamped to `lo..=hi` (a draw is always consumed, then bounded). Rust callers
 * clamp inline; this is the shared helper for them.
 */
export function clampedNormal(draws: DrawSource, stream: Stream, lo: number, hi: number): number {
  return clamp(draws.normal(stream), lo, hi);
}

// ---------------------------------------------------------------- the generator

/** 32-bit rotate left. */
function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

const GOLDEN = 0x9e3779b9;

/** The splitmix32 output function (a murmur-style finalizer) of state `a`. */
function splitmix32Out(a: number): number {
  let t = a ^ (a >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t ^= t >>> 15;
  t = Math.imul(t, 0x735a2d97);
  t ^= t >>> 15;
  return t >>> 0;
}

/**
 * The initial xoshiro128** state of one stream: splitmix32 over a start value mixed from the
 * seed's two halves and the stream number (D9), so streams and seeds are independent.
 */
function streamState(seed: number, stream: Stream): number[] {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RangeError(`seed ${seed} is not a whole number in 0..2^53`);
  }
  const lo = seed % TWO_32;
  const hi = Math.floor(seed / TWO_32);
  // Two mixing chains, so the four words depend on the low and high halves separately: the
  // first pair of words from (low half, stream), the second from the first chain and the high
  // half. Distinct (low, high, stream) give distinct starts (2^64 per stream).
  const streamMix = Math.imul(STREAM_NUMBER[stream] + 1, 0x85ebca6b);
  const a = splitmix32Out(((lo ^ streamMix) + GOLDEN) | 0);
  const b = splitmix32Out((a ^ (hi + 2 * GOLDEN) ^ Math.imul(streamMix, 3)) | 0);
  const s: number[] = [];
  // Words 1 to 3 depend on both halves (b), so the first draw already differs by either half.
  s.push(splitmix32Out((a + GOLDEN) | 0));
  s.push(splitmix32Out((b + GOLDEN) | 0));
  s.push(splitmix32Out((b + Math.imul(2, GOLDEN)) | 0));
  s.push(splitmix32Out(((a ^ b) + Math.imul(3, GOLDEN)) | 0));
  // All-zero is the one state xoshiro cannot leave; splitmix never gives it, but be sure.
  if (s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0) s[0] = 1;
  return s;
}

/** One xoshiro128** step on `s` (4 u32 words, updated in place): a 32-bit output. */
function xoshiroNext(s: number[]): number {
  const s0 = s[0]!;
  const s1 = s[1]!;
  let s2 = s[2]!;
  let s3 = s[3]!;
  const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  s2 ^= s0;
  s3 ^= s1;
  s[1] = (s1 ^ s2) >>> 0;
  s[0] = (s0 ^ s3) >>> 0;
  s[2] = (s2 ^ t) >>> 0;
  s[3] = rotl(s3 >>> 0, 11);
  return result;
}

// ---------------------------------------------------------------- RngStreams

/**
 * The game's five seeded streams, as plain data (saved and hashed as is, so a loaded game
 * continues with exactly the draws it would have made). Rust kept the seed, each ChaCha word
 * position and the spare normals; here the position IS the 4-word generator state.
 */
export interface RngStreams {
  /** The game seed. Whole number (u64; a safe integer here). */
  seed: number;
  /** Per stream (indexed by stream number): the 4 u32 words of xoshiro128** state. */
  state: number[][];
  /** Box-Muller makes normals in pairs; the second waits here for the next call. */
  spare: (number | null)[];
}

/** The five streams for a game seed (D9). */
export function rngStreamsNew(seed: number): RngStreams {
  return {
    seed,
    state: STREAM_VALUES.map((s) => streamState(seed, s)),
    spare: STREAM_VALUES.map(() => null),
  };
}

/** Rust `RngStreams::seed`. */
export function rngStreamsSeed(rng: RngStreams): number {
  return rng.seed;
}

/** A deep copy (Rust `Clone`). */
export function rngStreamsClone(rng: RngStreams): RngStreams {
  return { seed: rng.seed, state: rng.state.map((s) => s.slice()), spare: rng.spare.slice() };
}

/** Rust `PartialEq`: same seed, same positions, same spare normals (bit for bit). */
export function rngStreamsEq(a: RngStreams, b: RngStreams): boolean {
  if (a.seed !== b.seed) return false;
  for (let i = 0; i < STREAM_COUNT; i++) {
    const sa = a.state[i]!;
    const sb = b.state[i]!;
    for (let j = 0; j < 4; j++) if (sa[j] !== sb[j]) return false;
    if (!Object.is(a.spare[i], b.spare[i])) return false;
  }
  return true;
}

/** A raw 32-bit draw from `stream` (Rust `next_u64`, narrowed; see DrawSource). */
export function rngStreamsNextU32(rng: RngStreams, stream: Stream): number {
  return xoshiroNext(rng.state[STREAM_NUMBER[stream]]!);
}

/** A float in [0, 1) (Rust `DrawSource::uniform`). */
export function rngStreamsUniform(rng: RngStreams, stream: Stream): number {
  const s = rng.state[STREAM_NUMBER[stream]]!;
  return uniformFromRaw(() => xoshiroNext(s));
}

/** A standard normal: Box-Muller in pairs, the second kept as a saved spare. */
export function rngStreamsNormal(rng: RngStreams, stream: Stream): number {
  const i = STREAM_NUMBER[stream];
  const spare = rng.spare[i];
  if (spare !== null && spare !== undefined) {
    rng.spare[i] = null;
    return spare;
  }
  const u1 = 1.0 - rngStreamsUniform(rng, stream); // (0, 1], so ln is finite
  const u2 = rngStreamsUniform(rng, stream);
  const [z0, z1] = boxMuller(u1, u2);
  rng.spare[i] = z1;
  return z0;
}

/** A Poisson count with `mean` (Knuth). */
export function rngStreamsPoisson(rng: RngStreams, stream: Stream, mean: number): number {
  return knuthPoisson(mean, () => rngStreamsUniform(rng, stream));
}

/** A uniform whole number in `lo..=hi` (spec 3.7.1 "uniform integer draws"). */
export function rngStreamsIntInclusive(rng: RngStreams, stream: Stream, lo: number, hi: number): number {
  const s = rng.state[STREAM_NUMBER[stream]]!;
  return intInRange(lo, hi, () => xoshiroNext(s));
}

/** True with probability `p`. */
export function rngStreamsChance(rng: RngStreams, stream: Stream, p: number): boolean {
  return rngStreamsUniform(rng, stream) < p;
}

/**
 * `rng` as a DrawSource (Rust `impl DrawSource for RngStreams`). The wrapper holds no state of
 * its own: every draw reads and writes `rng`, so keep using the same `RngStreams` object (or
 * rebuild the wrapper after replacing it, as a load does).
 */
export function rngStreamsDraws(rng: RngStreams): DrawSource {
  return {
    nextU32: (stream) => rngStreamsNextU32(rng, stream),
    uniform: (stream) => rngStreamsUniform(rng, stream),
    normal: (stream) => rngStreamsNormal(rng, stream),
    poisson: (stream, mean) => rngStreamsPoisson(rng, stream, mean),
    intInclusive: (stream, lo, hi) => rngStreamsIntInclusive(rng, stream, lo, hi),
    chance: (stream, p) => rngStreamsChance(rng, stream, p),
  };
}

// ---------------------------------------------------------------- NoNoise

/** The middle of the u32 range. */
const U32_MIDDLE = 0x8000_0000;

/**
 * "No rolls" (spec 5.16 projections): every normal is 0, every uniform 0.5, every Poisson its
 * rounded mean, every integer the lower middle of its range. Stateless, so one shared value.
 */
export const NoNoise: DrawSource = {
  nextU32: () => U32_MIDDLE,
  uniform: () => 0.5,
  normal: () => 0.0,
  poisson: (_stream, mean) => toU32Sat(roundHalfAway(mean)),
  intInclusive: (_stream, lo, hi) => lo + Math.trunc((hi - lo) / 2),
  chance: (_stream, p) => 0.5 < p,
};

// ---------------------------------------------------------------- ScriptedDraws

/**
 * Replays recorded draws, one queue per stream (build-plan 4.2: validate.py's draws through the
 * engine). Each `normal`, `uniform`, `poisson` or `intInclusive` call takes the next recorded
 * value of its stream as the result; running out or asking for a raw draw throws, since either
 * means the engine and the recording disagree.
 */
export interface ScriptedDraws extends DrawSource {
  /** Adds recorded results to the end of `stream`'s queue. */
  push(stream: Stream, values: Iterable<number>): void;
  /** Recorded values not yet used. */
  remaining(stream: Stream): number;
}

/** Rust `ScriptedDraws::new`. */
export function scriptedDraws(): ScriptedDraws {
  const queues: number[][] = STREAM_VALUES.map(() => []);
  const heads: number[] = STREAM_VALUES.map(() => 0);
  const take = (stream: Stream): number => {
    const i = STREAM_NUMBER[stream];
    const q = queues[i]!;
    const h = heads[i]!;
    if (h >= q.length) throw new Error(`scripted ${STREAM_NAME[stream]} draws ran out`);
    heads[i] = h + 1;
    return q[h]!;
  };
  return {
    push(stream, values) {
      for (const v of values) queues[STREAM_NUMBER[stream]]!.push(v);
    },
    remaining(stream) {
      const i = STREAM_NUMBER[stream];
      return queues[i]!.length - heads[i]!;
    },
    nextU32(stream) {
      throw new Error(`scripted draws hold results, not raw draws (${STREAM_NAME[stream]})`);
    },
    uniform: take,
    normal: take,
    poisson(stream) {
      return toU32Sat(take(stream));
    },
    intInclusive(stream, lo, hi) {
      const v = toI64Sat(take(stream));
      if (!(v >= lo && v <= hi)) throw new RangeError(`scripted ${v} outside ${lo}..=${hi}`);
      return v;
    },
    chance(stream, p) {
      return take(stream) < p;
    },
  };
}
