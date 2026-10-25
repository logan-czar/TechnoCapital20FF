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
// written in-house (no BigInt, no dependency, so no upgrade can move it): a tiny hand-assembled
// WebAssembly module where it runs, else the same lanes in 16-bit limbs (D966); the canonical
// text is hashed as it is written, in pieces, never held whole. The
// 128 bits come out as 32 lowercase hex digits. Rust's was 256 bits (64 digits); 128 is plenty
// for a test-only hash, and a longer one only costs more lanes.

import { canonicalEncodeChunked } from "./canonical.ts";
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
 * FNV-1a 64 over bytes, held as four 16-bit limbs (h0 lowest) so every step is small-integer math
 * the JIT keeps in registers. The prime is 2^40 + 0x1b3, so `h * prime mod 2^64` is
 * `h * 0x1b3 + (h << 40)`: each limb times 0x1b3, plus limbs 0 and 1 shifted up 8 bits into limbs
 * 2 and 3, then the carries. Every partial stays under 2^31.
 */
class Fnv64 {
  h0: number;
  h1: number;
  h2: number;
  h3: number;

  constructor(basis: readonly [number, number]) {
    this.h3 = basis[0] >>> 16;
    this.h2 = basis[0] & 0xffff;
    this.h1 = basis[1] >>> 16;
    this.h0 = basis[1] & 0xffff;
  }

  update(bytes: Uint8Array): void {
    let h0 = this.h0;
    let h1 = this.h1;
    let h2 = this.h2;
    let h3 = this.h3;
    for (let i = 0; i < bytes.length; i++) {
      h0 ^= bytes[i] as number;
      const t0 = h0 * 0x1b3;
      let t1 = h1 * 0x1b3;
      let t2 = h2 * 0x1b3 + (h0 << 8);
      const t3 = h3 * 0x1b3 + (h1 << 8);
      t1 += t0 >>> 16;
      h0 = t0 & 0xffff;
      t2 += t1 >>> 16;
      h1 = t1 & 0xffff;
      h3 = (t3 + (t2 >>> 16)) & 0xffff;
      h2 = t2 & 0xffff;
    }
    this.h0 = h0;
    this.h1 = h1;
    this.h2 = h2;
    this.h3 = h3;
  }

  hex(): string {
    const hi = ((this.h3 << 16) | this.h2) >>> 0;
    const lo = ((this.h1 << 16) | this.h0) >>> 0;
    return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
  }
}

/** FNV-1a 64 of `bytes` with the standard offset basis, 16 hex digits (for the test vectors). */
export function fnv1a64Hex(bytes: Uint8Array): string {
  const f = new Fnv64(BASIS_A);
  f.update(bytes);
  return f.hex();
}

/**
 * The two lanes of the state hash over the UTF-8 bytes of a string, without building the bytes:
 * an ASCII code unit is its own byte (nearly all of the canonical text), anything else is encoded
 * as TextEncoder does (a lone surrogate as U+FFFD) and fed byte by byte. The digests equal
 * `Fnv64.update` over `TextEncoder.encode` of the same text, for each lane.
 */
class Fnv64Pair {
  readonly a: Fnv64;
  readonly b: Fnv64;
  private readonly one = new Uint8Array(1);

  constructor() {
    this.a = new Fnv64(BASIS_A);
    this.b = new Fnv64(BASIS_B);
  }

  updateString(s: string): void {
    const a = this.a;
    const b = this.b;
    let a0 = a.h0;
    let a1 = a.h1;
    let a2 = a.h2;
    let a3 = a.h3;
    let b0 = b.h0;
    let b1 = b.h1;
    let b2 = b.h2;
    let b3 = b.h3;
    const n = s.length;
    for (let i = 0; i < n; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0x80) {
        a.h0 = a0;
        a.h1 = a1;
        a.h2 = a2;
        a.h3 = a3;
        b.h0 = b0;
        b.h1 = b1;
        b.h2 = b2;
        b.h3 = b3;
        i = this.wide(s, i);
        a0 = a.h0;
        a1 = a.h1;
        a2 = a.h2;
        a3 = a.h3;
        b0 = b.h0;
        b1 = b.h1;
        b2 = b.h2;
        b3 = b.h3;
        continue;
      }
      // Fnv64.update's step, once per lane.
      a0 ^= c;
      const ta0 = a0 * 0x1b3;
      let ta1 = a1 * 0x1b3;
      let ta2 = a2 * 0x1b3 + (a0 << 8);
      const ta3 = a3 * 0x1b3 + (a1 << 8);
      ta1 += ta0 >>> 16;
      a0 = ta0 & 0xffff;
      ta2 += ta1 >>> 16;
      a1 = ta1 & 0xffff;
      a3 = (ta3 + (ta2 >>> 16)) & 0xffff;
      a2 = ta2 & 0xffff;
      b0 ^= c;
      const tb0 = b0 * 0x1b3;
      let tb1 = b1 * 0x1b3;
      let tb2 = b2 * 0x1b3 + (b0 << 8);
      const tb3 = b3 * 0x1b3 + (b1 << 8);
      tb1 += tb0 >>> 16;
      b0 = tb0 & 0xffff;
      tb2 += tb1 >>> 16;
      b1 = tb1 & 0xffff;
      b3 = (tb3 + (tb2 >>> 16)) & 0xffff;
      b2 = tb2 & 0xffff;
    }
    a.h0 = a0;
    a.h1 = a1;
    a.h2 = a2;
    a.h3 = a3;
    b.h0 = b0;
    b.h1 = b1;
    b.h2 = b2;
    b.h3 = b3;
  }

  /** Feeds the UTF-8 bytes of the non-ASCII character at `i`; returns its last code unit's index. */
  private wide(s: string, i: number): number {
    const c = s.charCodeAt(i);
    let cp = c;
    let last = i;
    if (c >= 0xd800 && c <= 0xdfff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) {
        cp = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        last = i + 1;
      } else {
        cp = 0xfffd; // a lone surrogate, as TextEncoder writes it
      }
    }
    if (cp < 0x800) {
      this.byte(0xc0 | (cp >> 6));
    } else if (cp < 0x10000) {
      this.byte(0xe0 | (cp >> 12));
      this.byte(0x80 | ((cp >> 6) & 0x3f));
    } else {
      this.byte(0xf0 | (cp >> 18));
      this.byte(0x80 | ((cp >> 12) & 0x3f));
      this.byte(0x80 | ((cp >> 6) & 0x3f));
    }
    this.byte(0x80 | (cp & 0x3f));
    return last;
  }

  private byte(x: number): void {
    this.one[0] = x;
    this.a.update(this.one);
    this.b.update(this.one);
  }
}

/**
 * The same two lanes in WebAssembly (64-bit integer multiplies, several times quicker than the
 * limbs; a ten-year world is a third of a billion bytes): 247 bytes assembled by hand, with no
 * toolchain or dependency, so no upgrade can change it. In the text format it is:
 *
 *   (module
 *     (memory (export "mem") 4)                                   ;; 256 KiB
 *     (global $a (mut i64) (i64.const 0)) (global $b (mut i64) (i64.const 0))
 *     (func (export "init") (param i32 i32 i32 i32)               ;; a_hi a_lo b_hi b_lo
 *       (global.set $a (i64.or (i64.shl (i64.extend_i32_u (local.get 0)) (i64.const 32))
 *                              (i64.extend_i32_u (local.get 1))))
 *       (global.set $b (i64.or (i64.shl (i64.extend_i32_u (local.get 2)) (i64.const 32))
 *                              (i64.extend_i32_u (local.get 3)))))
 *     (func (export "update") (param $n i32) (local $i i32) (local $a i64) (local $b i64)
 *       (local $c i64)                                            ;; FNV-1a 64 over mem[0..n)
 *       (local.set $a (global.get $a)) (local.set $b (global.get $b))
 *       (block (br_if 0 (i32.eqz (local.get $n)))
 *         (loop
 *           (local.set $c (i64.extend_i32_u (i32.load8_u (local.get $i))))
 *           (local.set $a (i64.mul (i64.xor (local.get $a) (local.get $c)) (i64.const 0x100000001b3)))
 *           (local.set $b (i64.mul (i64.xor (local.get $b) (local.get $c)) (i64.const 0x100000001b3)))
 *           (br_if 0 (i32.lt_u (local.tee $i (i32.add (local.get $i) (i32.const 1))) (local.get $n)))))
 *       (global.set $a (local.get $a)) (global.set $b (local.get $b)))
 *     (func (export "ahi") (result i32) (i32.wrap_i64 (i64.shr_u (global.get $a) (i64.const 32))))
 *     (func (export "alo") (result i32) (i32.wrap_i64 (global.get $a)))
 *     (func (export "bhi") (result i32) (i32.wrap_i64 (i64.shr_u (global.get $b) (i64.const 32))))
 *     (func (export "blo") (result i32) (i32.wrap_i64 (global.get $b))))
 *
 * The text reaches the memory through `TextEncoder.encodeInto`, so the bytes are the UTF-8 the JS
 * lanes hash. Integer math is exact on every engine, so the digests are the JS lanes' (tested in
 * results_pinned.test.ts); where WebAssembly cannot run, the JS lanes do.
 */
const FNV_WASM: readonly number[] = [
  0, 97, 115, 109, 1, 0, 0, 0, 1, 16, 3, 96, 4, 127, 127, 127, 127, 0, 96, 1, 127, 0, 96, 0, 1, 127, 3, 7, 6,
  0, 1, 2, 2, 2, 2, 5, 3, 1, 0, 4, 6, 11, 2, 126, 1, 66, 0, 11, 126, 1, 66, 0, 11, 7, 47, 7, 3, 109, 101, 109,
  2, 0, 4, 105, 110, 105, 116, 0, 0, 6, 117, 112, 100, 97, 116, 101, 0, 1, 3, 97, 104, 105, 0, 2, 3, 97, 108,
  111, 0, 3, 3, 98, 104, 105, 0, 4, 3, 98, 108, 111, 0, 5, 10, 142, 1, 6, 26, 0, 32, 0, 173, 66, 32, 134, 32,
  1, 173, 132, 36, 0, 32, 2, 173, 66, 32, 134, 32, 3, 173, 132, 36, 1, 11, 83, 2, 1, 127, 3, 126, 35, 0, 33,
  2, 35, 1, 33, 3, 2, 64, 32, 0, 69, 13, 0, 3, 64, 32, 1, 45, 0, 0, 173, 33, 4, 32, 2, 32, 4, 133, 66, 179,
  131, 128, 128, 128, 32, 126, 33, 2, 32, 3, 32, 4, 133, 66, 179, 131, 128, 128, 128, 32, 126, 33, 3, 32, 1,
  65, 1, 106, 34, 1, 32, 0, 73, 13, 0, 11, 11, 32, 2, 36, 0, 32, 3, 36, 1, 11, 8, 0, 35, 0, 66, 32, 136, 167,
  11, 5, 0, 35, 0, 167, 11, 8, 0, 35, 1, 66, 32, 136, 167, 11, 5, 0, 35, 1, 167, 11,
];

/** The module's exports, as the hash uses them. */
interface FnvWasm {
  readonly bytes: Uint8Array;
  init(aHi: number, aLo: number, bHi: number, bLo: number): void;
  update(n: number): void;
  ahi(): number;
  alo(): number;
  bhi(): number;
  blo(): number;
}

/** The part of the WebAssembly API used here (the sim's lib has no DOM or Node types). */
interface WasmApi {
  Module: new (bytes: Uint8Array) => object;
  Instance: new (module: object) => { exports: Record<string, unknown> };
}

let fnvWasmCache: FnvWasm | null | undefined;

/** The instantiated module, or null where WebAssembly cannot run. */
function fnvWasm(): FnvWasm | null {
  if (fnvWasmCache !== undefined) return fnvWasmCache;
  fnvWasmCache = null;
  const api = (globalThis as { WebAssembly?: WasmApi }).WebAssembly;
  if (api === undefined) return null;
  try {
    const e = new api.Instance(new api.Module(new Uint8Array(FNV_WASM))).exports;
    const mem = e.mem as { buffer: ArrayBuffer };
    fnvWasmCache = {
      bytes: new Uint8Array(mem.buffer),
      init: e.init as FnvWasm["init"],
      update: e.update as FnvWasm["update"],
      ahi: e.ahi as FnvWasm["ahi"],
      alo: e.alo as FnvWasm["alo"],
      bhi: e.bhi as FnvWasm["bhi"],
      blo: e.blo as FnvWasm["blo"],
    };
  } catch {
    fnvWasmCache = null;
  }
  return fnvWasmCache;
}

const hex8 = (x: number): string => (x >>> 0).toString(16).padStart(8, "0");

/** The state hash's two lanes over UTF-8 text fed in pieces. */
interface TextLanes {
  update(text: string): void;
  hex(): string;
}

function wasmLanes(w: FnvWasm): TextLanes {
  const encoder = new TextEncoder();
  w.init(BASIS_A[0], BASIS_A[1], BASIS_B[0], BASIS_B[1]);
  return {
    update(text: string): void {
      let rest = text;
      for (;;) {
        // encodeInto writes whole characters only, so a piece never splits one.
        const r = encoder.encodeInto(rest, w.bytes);
        w.update(r.written);
        if (r.read >= rest.length) return;
        rest = rest.slice(r.read);
      }
    },
    hex: () => hex8(w.ahi()) + hex8(w.alo()) + hex8(w.bhi()) + hex8(w.blo()),
  };
}

function jsLanes(): TextLanes {
  const lanes = new Fnv64Pair();
  return {
    update: (text) => lanes.updateString(text),
    hex: () => lanes.a.hex() + lanes.b.hex(),
  };
}

/** WebAssembly lanes where they run; `useWasm` false forces the JS lanes. */
function textLanes(useWasm: boolean): TextLanes {
  const w = useWasm ? fnvWasm() : null;
  return w === null ? jsLanes() : wasmLanes(w);
}

/** The hash of the simulation state: 32 lowercase hex digits. */
export function stateHash(world: World, rng: RngStreams): StateHash {
  return hashOfCanonical({ format: HASH_FORMAT, rng, world }, true);
}

/**
 * The state hash's digest of `value`'s canonical text; `useWasm` false runs the JS lanes (the
 * digests are the same, tested).
 */
export function hashOfCanonical(value: unknown, useWasm: boolean): StateHash {
  const lanes = textLanes(useWasm);
  // The encoder hands the text over in pieces of about HASH_BUFFER_CHARS, hashed as they come;
  // the bytes hashed are the UTF-8 of the whole canonical text, however it is cut.
  canonicalEncodeChunked(value, (piece) => lanes.update(piece), HASH_BUFFER_CHARS);
  return lanes.hex();
}

/** The write buffer in front of the hasher, UTF-16 code units. */
const HASH_BUFFER_CHARS = 1 << 16;

/** The two lanes over `text`'s UTF-8 bytes, as `stateHash` hashes its canonical text (tests). */
export function stateHashOfText(text: string, useWasm: boolean): StateHash {
  const lanes = textLanes(useWasm);
  lanes.update(text);
  return lanes.hex();
}

/** The first 16 hex digits, for logs (Rust `StateHash::short`). */
export function stateHashShort(hash: StateHash): string {
  return hash.slice(0, 16);
}
