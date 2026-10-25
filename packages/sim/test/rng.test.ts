import { describe, expect, it } from "vitest";
import {
  intInRange,
  knuthPoisson,
  NoNoise,
  rngStreamsClone,
  rngStreamsDraws,
  rngStreamsEq,
  rngStreamsNew,
  scriptedDraws,
} from "../src/rng.ts";
import type { DrawSource, Stream } from "../src/types/draws.ts";
import { STREAM_COUNT, STREAM_NUMBER, STREAM_VALUES } from "../src/types/draws.ts";

/** Draws a mix of every kind from one stream; floats are compared by bits via their string. */
function draws(r: DrawSource, s: Stream, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    switch (i % 4) {
      case 0:
        out.push(String(r.nextU32(s)));
        break;
      case 1:
        out.push(String(r.uniform(s)));
        break;
      case 2:
        out.push(String(r.normal(s)));
        break;
      default:
        out.push(String(r.intInclusive(s, -5, 30)));
    }
  }
  return out;
}

describe("rng.ts", () => {
  it("same seed gives the same first 1000 draws per stream", () => {
    const a = rngStreamsDraws(rngStreamsNew(42));
    const b = rngStreamsDraws(rngStreamsNew(42));
    for (const s of STREAM_VALUES) {
      expect(draws(a, s, 1000)).toEqual(draws(b, s, 1000));
    }
    // Interleaving streams does not change any stream's draws.
    const c = rngStreamsDraws(rngStreamsNew(42));
    const per: number[][] = STREAM_VALUES.map(() => []);
    for (let i = 0; i < 1000; i++) {
      for (const s of [...STREAM_VALUES].reverse()) per[STREAM_NUMBER[s]]!.push(c.nextU32(s));
    }
    const d = rngStreamsDraws(rngStreamsNew(42));
    for (const s of STREAM_VALUES) {
      const alone = Array.from({ length: 1000 }, () => d.nextU32(s));
      expect(alone).toEqual(per[STREAM_NUMBER[s]]);
    }
  });

  it("streams and seeds differ", () => {
    const r = rngStreamsDraws(rngStreamsNew(42));
    const firsts = STREAM_VALUES.map((s) => r.nextU32(s));
    expect(new Set(firsts).size).toBe(STREAM_COUNT);
    expect(rngStreamsDraws(rngStreamsNew(1)).nextU32("Cycle")).not.toBe(
      rngStreamsDraws(rngStreamsNew(2)).nextU32("Cycle"),
    );
    // Seeds above 2^32 differ by their high half too.
    expect(rngStreamsDraws(rngStreamsNew(5)).nextU32("Gen")).not.toBe(
      rngStreamsDraws(rngStreamsNew(5 + 2 ** 32)).nextU32("Gen"),
    );
  });

  it("refuses seeds that are not whole non-negative numbers", () => {
    expect(() => rngStreamsNew(-1)).toThrow();
    expect(() => rngStreamsNew(1.5)).toThrow();
    expect(() => rngStreamsNew(2 ** 53)).toThrow();
    expect(() => rngStreamsNew(Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it("state is plain data that survives JSON and resumes mid-stream with a spare normal", () => {
    const a = rngStreamsNew(9);
    const da = rngStreamsDraws(a);
    for (const s of STREAM_VALUES) draws(da, s, 37);
    if (a.spare[STREAM_NUMBER.Prices] === null) da.normal("Prices"); // leaves a spare
    expect(a.spare[STREAM_NUMBER.Prices]).not.toBeNull();
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(rngStreamsEq(a, b)).toBe(true);
    const c = rngStreamsClone(a);
    expect(rngStreamsEq(a, c)).toBe(true);
    const db = rngStreamsDraws(b);
    for (const s of STREAM_VALUES) {
      expect(draws(da, s, 200)).toEqual(draws(db, s, 200));
    }
    expect(rngStreamsEq(a, b)).toBe(true);
    expect(rngStreamsEq(a, c)).toBe(false);
  });

  it("uniforms have the right mean and variance and stay in [0, 1)", () => {
    const r = rngStreamsDraws(rngStreamsNew(7));
    const n = 100_000;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const u = r.uniform("Growth");
      expect(u >= 0 && u < 1).toBe(true);
      sum += u;
      sq += u * u;
    }
    const mean = sum / n;
    const variance = sq / n - mean * mean;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.005);
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.002);
  });

  it("normals and Poisson draws have the right moments", () => {
    const r = rngStreamsDraws(rngStreamsNew(7));
    const n = 100_000;
    const zs = Array.from({ length: n }, () => r.normal("Prices"));
    const mean = zs.reduce((a, z) => a + z, 0) / n;
    const variance = zs.reduce((a, z) => a + (z - mean) ** 2, 0) / n;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.02);
    const ks = Array.from({ length: n }, () => r.poisson("Gen", 2.0));
    const pm = ks.reduce((a, k) => a + k, 0) / n;
    expect(Math.abs(pm - 2.0)).toBeLessThan(0.03);
    const zeros = ks.filter((k) => k === 0).length / n;
    expect(Math.abs(zeros - Math.exp(-2))).toBeLessThan(0.005);
    expect(() => r.poisson("Gen", 31)).toThrow();
    expect(() => r.poisson("Gen", -1)).toThrow();
    expect(knuthPoisson(0, () => 0.5)).toBe(0);
  });

  it("integer range is inclusive, unbiased and covers every value", () => {
    const r = rngStreamsDraws(rngStreamsNew(3));
    const seen = new Array<number>(7).fill(0);
    for (let i = 0; i < 7000; i++) {
      const v = r.intInclusive("Gen", 4, 10);
      seen[v - 4]!++;
    }
    expect(seen.every((c) => c > 800)).toBe(true);
    expect(r.intInclusive("Gen", 5, 5)).toBe(5);
    expect(() => r.intInclusive("Gen", 6, 5)).toThrow();
    // Rejection, not modulo: a source that returns only a low value skips it for a short block.
    const span = 0xc000_0000; // 2^32 mod span = 2^30, so x below 2^30 is rejected
    const queue = [5, 0x4000_0000 + 7];
    expect(intInRange(0, span - 1, () => queue.shift()!)).toBe(0x4000_0000 + 7);
    // A span wider than 2^32 draws 53 bits.
    const big = rngStreamsDraws(rngStreamsNew(4)).intInclusive("Gen", 0, 2 ** 40);
    expect(big).toBeGreaterThanOrEqual(0);
    expect(big).toBeLessThanOrEqual(2 ** 40);
    // A wide span: residues stay uniform (a 59-bit draw rounded in doubles gave multiples of 4).
    const wide = rngStreamsDraws(rngStreamsNew(6));
    const res = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) res[wide.intInclusive("Gen", 0, 2 ** 52) % 4]!++;
    expect(res.every((c) => c > 800)).toBe(true);
    // Negative ranges.
    for (let i = 0; i < 100; i++) {
      const v = r.intInclusive("Gen", -3, -1);
      expect(v >= -3 && v <= -1).toBe(true);
    }
  });

  it("no-noise and scripted sources", () => {
    expect(NoNoise.normal("Growth")).toBe(0);
    expect(NoNoise.uniform("Growth")).toBe(0.5);
    expect(NoNoise.poisson("Gen", 2.0)).toBe(2);
    expect(NoNoise.poisson("Gen", 2.5)).toBe(3);
    expect(NoNoise.intInclusive("Gen", 4, 10)).toBe(7);
    const s = scriptedDraws();
    s.push("Growth", [0.25, -1.5]);
    s.push("Gen", [3.0]);
    expect(s.normal("Growth")).toBe(0.25);
    expect(s.normal("Growth")).toBe(-1.5);
    expect(s.poisson("Gen", 2.0)).toBe(3);
    expect(s.remaining("Growth")).toBe(0);
    expect(() => s.normal("Growth")).toThrow(/ran out/);
    expect(() => s.nextU32("Gen")).toThrow();
    s.push("Gen", [Number.NaN]);
    expect(s.intInclusive("Gen", 0, 5)).toBe(0); // NaN as i64 is 0
    s.push("Gen", [9]);
    expect(() => s.intInclusive("Gen", 0, 5)).toThrow();
  });
});
