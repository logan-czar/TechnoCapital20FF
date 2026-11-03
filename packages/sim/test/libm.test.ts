// types/libm.ts (D1015) is a port of V8 13.6's fdlibm, so on Node 24 it must equal Math.* bit for
// bit. Each function is checked over more than 1,000,000 deterministic inputs (random bit patterns,
// its working range, magnitudes from 1e-300 to 1e300, structured edges and special values).
// The digests pin the port's own outputs: if a future Node changes its Math, the "matches Math"
// tests fail but the digests still hold, which says the port is unchanged and the sim's numbers too.

import { describe, expect, it } from "vitest";
import { cosF, expF, log10F, logF, sinF } from "../src/types/libm.ts";

const WORDS = new ArrayBuffer(8);
const F64 = new Float64Array(WORDS);
const U32 = new Uint32Array(WORDS);
const U64 = new BigUint64Array(WORDS);

function fromWords(hi: number, lo: number): number {
  U32[1] = hi;
  U32[0] = lo;
  return F64[0]!;
}

/** The double `steps` representable values away from x (finite x, no sign crossing). */
function nudge(x: number, steps: number): number {
  F64[0] = x;
  U64[0] = U64[0]! + BigInt(steps);
  return F64[0]!;
}

/** mulberry32: a fixed 32-bit stream, so the inputs are the same on every run. */
function stream(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Uniform in [0, 1) with 53 random bits. */
function unit(r: () => number): number {
  return ((r() >>> 5) * 67108864 + (r() >>> 6)) / 9007199254740992;
}

/** Any double: 64 random bits (NaNs and infinities included). */
function anyBits(r: () => number): number {
  return fromWords(r(), r());
}

/** ±10^e for e uniform in [lo, hi]: magnitudes spread evenly across decades. */
function logUniform(r: () => number, lo: number, hi: number, signed: boolean): number {
  const v = 10 ** (lo + unit(r) * (hi - lo));
  return signed && (r() & 1) === 1 ? -v : v;
}

const SPECIALS: readonly number[] = [
  0,
  -0,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.NaN,
  Number.MIN_VALUE,
  -Number.MIN_VALUE,
  fromWords(0x000fffff, 0xffffffff), // largest subnormal
  fromWords(0x00100000, 0), // smallest normal, 2^-1022
  fromWords(0x00080000, 0), // a mid subnormal
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  Number.EPSILON,
  1,
  -1,
  2,
  0.5,
  Math.PI,
  Math.E,
  2 ** -28,
  2 ** -27,
  2 ** -1074,
  1e-300,
  1e300,
  1e22,
  6381956970095103 * 2 ** 797, // the hardest double for pi/2 reduction
  5.319372648326541e255,
];

function addAround(out: number[], x: number, ulps: number): void {
  for (let d = -ulps; d <= ulps; d++) {
    if (x === 0 && d < 0) continue;
    out.push(nudge(Math.abs(x), d) * Math.sign(x || 1));
  }
}

function expInputs(): Float64Array {
  const r = stream(0xe0e0);
  const out: number[] = [...SPECIALS];
  // The thresholds and branch edges of exp.
  const o = fromWords(0x40862e42, 0xfefa39ef); // overflow threshold
  const u = fromWords(0xc0874910, 0xd52d3051); // underflow threshold
  for (const edge of [
    o,
    u,
    -708.3964185322641, // results turn subnormal
    709.782712893384,
    fromWords(0x40862e42, 0), // |x| >= 709.78 filter
    fromWords(0xc0862e42, 0),
    fromWords(0x3fd62e42, 0xffffffff), // 0.5 ln2
    fromWords(0xbfd62e42, 0xffffffff),
    fromWords(0x3ff0a2b2, 0), // 1.5 ln2
    fromWords(0xbff0a2b2, 0),
    fromWords(0x3e300000, 0), // 2^-28
    fromWords(0xbe300000, 0),
    1,
    -1,
    Math.LN2,
    -Math.LN2,
  ]) {
    addAround(out, edge, 200);
  }
  for (let k = -1080; k <= 1030; k++) addAround(out, k * Math.LN2, 3); // every scaling 2^k
  while (out.length < 1_050_000) {
    const pick = out.length % 4;
    if (pick === 0) out.push(anyBits(r));
    else if (pick === 1) out.push(unit(r) * 1500 - 750);
    else if (pick === 2) out.push(unit(r) * 20 - 10);
    else out.push(logUniform(r, -20, 3, true));
  }
  return Float64Array.from(out);
}

function logInputs(seed: number): Float64Array {
  const r = stream(seed);
  const out: number[] = [...SPECIALS];
  for (const edge of [1, Math.SQRT2, Math.SQRT1_2, 2, 0.5, 10, 0.1, Number.MIN_VALUE * 2 ** 20]) {
    addAround(out, edge, 300);
  }
  for (let e = -1074; e <= 1023; e++) addAround(out, 2 ** e, 2); // every binade edge
  for (let e = -323; e <= 308; e++) addAround(out, Number(`1e${e}`), 2); // powers of ten
  for (let i = 0; i < 20000; i++) out.push(1 + (unit(r) - 0.5) * 2 ** -18); // f within 2^-20 of 1
  for (let i = 0; i < 20000; i++) out.push(-logUniform(r, -300, 300, false)); // negative logs
  while (out.length < 1_050_000) {
    const pick = out.length % 4;
    if (pick === 0) out.push(Math.abs(anyBits(r)));
    else if (pick === 1) out.push(logUniform(r, -300, 300, false));
    else if (pick === 2) out.push(unit(r) * 4);
    else out.push(fromWords(r() & 0x000fffff, r())); // subnormals
  }
  return Float64Array.from(out);
}

function trigInputs(seed: number): Float64Array {
  const r = stream(seed);
  const out: number[] = [...SPECIALS];
  // Near multiples of pi/4 and pi/2, where the reduction and the kernel switch are delicate.
  for (let k = -2000; k <= 2000; k++) addAround(out, (k * Math.PI) / 4, 4);
  for (let i = 0; i < 4000; i++) addAround(out, Math.round(unit(r) * 2 ** 30) * (Math.PI / 2), 2);
  for (const edge of [
    fromWords(0x3fe921fb, 0xffffffff), // |x| ~<= pi/4
    fromWords(0x4002d97c, 0), // 3pi/4
    fromWords(0x413921fb, 0xffffffff), // 2^19 * pi/2, the medium/large switch
    fromWords(0x3e400000, 0), // 2^-27
    fromWords(0x3fd33333, 0), // 0.3, the kernel_cos switch
    fromWords(0x3fe90000, 0), // 0.78125
  ]) {
    addAround(out, edge, 200);
    addAround(out, -edge, 200);
  }
  for (let e = 0; e <= 1023; e++) addAround(out, 2 ** e, 2); // huge arguments, every binade
  while (out.length < 1_050_000) {
    const pick = out.length % 4;
    if (pick === 0) out.push(anyBits(r));
    else if (pick === 1) out.push(unit(r) * 2 * Math.PI);
    else if (pick === 2) out.push(unit(r) * 2000 - 1000);
    else out.push(logUniform(r, -10, 300, true));
  }
  return Float64Array.from(out);
}

/** Bits of each output (every NaN as the one canonical quiet NaN), folded by FNV-1a over 32-bit words. */
function digest(f: (x: number) => number, inputs: Float64Array): string {
  let a = 0x811c9dc5;
  let b = 0x050c5d1f;
  for (const x of inputs) {
    const y = f(x);
    F64[0] = Number.isNaN(y) ? Number.NaN : y;
    const lo = U32[0]!;
    const hi = U32[1]!;
    a = Math.imul(a ^ lo, 0x01000193);
    a = Math.imul(a ^ hi, 0x01000193);
    b = Math.imul(b ^ hi, 0x01000193);
    b = Math.imul(b ^ lo, 0x01000193);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

function bits(y: number): string {
  F64[0] = y;
  return `0x${U64[0]!.toString(16).padStart(16, "0")}`;
}

interface Case {
  name: string;
  port: (x: number) => number;
  math: (x: number) => number;
  inputs: () => Float64Array;
  /** Digest of the port's outputs. */
  pinned: string;
  /** Digest of the inputs themselves, so a change in how they are drawn is told apart from a change in the port. */
  inputsPinned: string;
}

const CASES: Case[] = [
  {
    name: "exp",
    port: expF,
    math: Math.exp,
    inputs: expInputs,
    pinned: "63fd750a19675896",
    inputsPinned: "01aba95628ff5462",
  },
  {
    name: "log",
    port: logF,
    math: Math.log,
    inputs: () => logInputs(0x1061),
    pinned: "79d850b99b0a189b",
    inputsPinned: "b97c46d2fca636ae",
  },
  {
    name: "log10",
    port: log10F,
    math: Math.log10,
    inputs: () => logInputs(0x1010),
    pinned: "e116e98c8540d5ac",
    inputsPinned: "39f163acd3dcf9e4",
  },
  {
    name: "sin",
    port: sinF,
    math: Math.sin,
    inputs: () => trigInputs(0x5151),
    pinned: "580d952ad44eb2a6",
    inputsPinned: "acf2b36fd2668235",
  },
  {
    name: "cos",
    port: cosF,
    math: Math.cos,
    inputs: () => trigInputs(0xc05c),
    pinned: "d0c273f75425ab81",
    inputsPinned: "3bd49edf54876ed9",
  },
];

describe("libm port of V8 13.6 fdlibm (D1015)", () => {
  for (const c of CASES) {
    describe(c.name, () => {
      const inputs = c.inputs();

      it("has more than a million inputs", () => {
        expect(inputs.length).toBeGreaterThanOrEqual(1_000_000);
      });

      it("matches Node's Math bit for bit", () => {
        const misses: string[] = [];
        for (const x of inputs) {
          const p = c.port(x);
          const m = c.math(x);
          // Object.is tells -0 from +0; NaN payloads are not compared (any NaN is NaN).
          if (!Object.is(p, m) && misses.length < 10) {
            misses.push(`${c.name}(${x}) [${bits(x)}]: port ${bits(p)}, Math ${bits(m)}`);
          }
        }
        expect(misses).toEqual([]);
        expect(digest(c.math, inputs), `${c.name} digest of Math`).toBe(c.pinned);
      });

      it("keeps its pinned digest", () => {
        expect(
          digest((x) => x, inputs),
          `${c.name} inputs digest`,
        ).toBe(c.inputsPinned);
        expect(digest(c.port, inputs), `${c.name} digest`).toBe(c.pinned);
      });
    });
  }
});
