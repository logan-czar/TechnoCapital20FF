// The state hash (build-plan M1.8, 4.3): a fast hash over every table in id order plus the RNG
// state. Ported from crates/sim/src/hash.rs. D953: used only by determinism tests (same seed,
// same hash; Node and browser worker, same hash), so it is a fast non-cryptographic hash, not
// blake3.
//
// It hashes the canonical JSON (./canonical.ts) of `{ format, rng, world }`, so every field any
// milestone adds is covered with no extra code. Floats are hashed by their exact round-trip text
// (NaN, infinities and -0 explicitly tagged), tables are arrays in id order and maps are written
// sorted, so the order is fixed. The controls (speed, pause, alerts, watchlist) are not hashed:
// they never change the world (D13).
//
// The hash is FNV-1a 64 run in two lanes over the same UTF-8 bytes, with different offset bases,
// written in-house with 32-bit halves (no BigInt, no dependency, so no upgrade can move it). The
// 128 bits come out as 32 lowercase hex digits. Rust's was 256 bits (64 digits); 128 is plenty
// for a test-only hash, and a longer one only costs more lanes.

import { canonicalEncode } from "./canonical.ts";
import type { RngStreams } from "./rng.ts";
import type { StateHash } from "./types/sim-api.ts";
import type { World } from "./types/world.ts";

/** Bumped when the hashed layout changes on purpose, so old hashes cannot match by accident. */
export const HASH_FORMAT = 1;

/** FNV-1a 64 offset basis, as (hi, lo) 32-bit halves. */
const BASIS_A: readonly [number, number] = [0xcbf29ce4, 0x84222325];
/** A second, unrelated basis for the other lane (the golden-ratio constant and the sqrt(2) fraction). */
const BASIS_B: readonly [number, number] = [0x9e3779b9, 0x7f4a7c15];

/**
 * FNV-1a 64 over bytes, as two 32-bit halves. The prime is 2^40 + 0x1b3, so `h * prime mod 2^64`
 * is `h * 0x1b3 + (h << 40)`; every partial product stays under 2^53, so the double math is exact.
 */
class Fnv64 {
  hi: number;
  lo: number;

  constructor(basis: readonly [number, number]) {
    this.hi = basis[0];
    this.lo = basis[1];
  }

  update(bytes: Uint8Array): void {
    let hi = this.hi;
    let lo = this.lo;
    for (let i = 0; i < bytes.length; i++) {
      lo = (lo ^ bytes[i]!) >>> 0;
      const p = lo * 0x1b3;
      const carry = Math.floor(p / 0x1_0000_0000);
      const newLo = p >>> 0;
      hi = ((hi * 0x1b3 + carry + ((lo << 8) >>> 0)) % 0x1_0000_0000) >>> 0;
      lo = newLo;
    }
    this.hi = hi;
    this.lo = lo;
  }

  hex(): string {
    return this.hi.toString(16).padStart(8, "0") + this.lo.toString(16).padStart(8, "0");
  }
}

/** FNV-1a 64 of `bytes` with the standard offset basis, 16 hex digits (for the test vectors). */
export function fnv1a64Hex(bytes: Uint8Array): string {
  const f = new Fnv64(BASIS_A);
  f.update(bytes);
  return f.hex();
}

/** The hash of the simulation state: 32 lowercase hex digits. */
export function stateHash(world: World, rng: RngStreams): StateHash {
  const a = new Fnv64(BASIS_A);
  const b = new Fnv64(BASIS_B);
  const encoder = new TextEncoder();
  // The encoder writes a field at a time; a buffer in front of the hasher turns millions of small
  // writes (ten years of daily bars) into a few large ones. The bytes hashed are the same.
  let buf = "";
  const flush = () => {
    const bytes = encoder.encode(buf);
    a.update(bytes);
    b.update(bytes);
    buf = "";
  };
  canonicalEncode({ format: HASH_FORMAT, rng, world }, (piece) => {
    buf += piece;
    if (buf.length >= HASH_BUFFER_CHARS) flush();
  });
  flush();
  return a.hex() + b.hex();
}

/** The write buffer in front of the hasher, UTF-16 code units. */
const HASH_BUFFER_CHARS = 1 << 16;

/** The first 16 hex digits, for logs (Rust `StateHash::short`). */
export function stateHashShort(hash: StateHash): string {
  return hash.slice(0, 16);
}
