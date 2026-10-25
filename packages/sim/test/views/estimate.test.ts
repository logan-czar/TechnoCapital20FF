// The in-file tests of crates/sim/src/views/estimate.rs, plus checks that the u32-halves hash is
// bit for bit splitmix64 as Rust computes it (a bigint reference, and values worked out from the
// Rust code's formulas in exact 64-bit arithmetic).
import { describe, expect, it } from "vitest";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import { DATETIME_START } from "../../src/types/calendar.ts";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import {
  ESTIMATE_BIAS_MAX,
  ESTIMATE_BIAS_MIN,
  ESTIMATE_FLOOR_USD,
  ESTIMATE_HASH_SALT,
  ESTIMATE_JITTER,
  type Figure,
  type Kind,
  type Subject,
} from "../../src/types/views/estimate.ts";
import {
  bandOf,
  error,
  estimateHash,
  figureBand,
  figureBandOf,
  figureOver,
  figureRatio,
  figureSum,
  periodCode,
  releaseQuarter,
} from "../../src/views/estimate.ts";

const company = (i: number): Subject => ({ kind: "Company", company: i as CompanyId });
const industry = (i: number): Subject => ({ kind: "Industry", industry: i as IndustryId });
const REVENUE: Kind = { kind: "Line", line: "Revenue" };
const VALUE: Kind = { kind: "Value" };

// A bigint splitmix64, the reference for the u32-halves one.
const M64 = (1n << 64n) - 1n;
function mixRef(z0: bigint): bigint {
  let z = (z0 + 0x9e3779b97f4a7c15n) & M64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
  return z ^ (z >> 31n);
}
function hashRef(seed: bigint, subj: bigint, kind: bigint, rest: bigint[]): bigint {
  let h = mixRef(ESTIMATE_HASH_SALT ^ seed);
  h = mixRef(h ^ subj);
  h = mixRef(h ^ kind);
  for (const x of rest) h = mixRef(h ^ x);
  return h;
}

describe("estimate", () => {
  it("the band holds the truth strictly inside", () => {
    const truths = [0.0, 1.0, -3.5e5, 4.2e7, -9.9e8, 1.3e12, 0.004];
    truths.forEach((truth, i) => {
      for (let k = 0; k < 2000; k++) {
        const s = company(i + k);
        const e = error(BigInt(k), s, VALUE, 2020 + (k % 9), k, truth);
        const b = bandOf(truth, e, ESTIMATE_FLOOR_USD);
        expect(b.low < truth && truth < b.high, `${truth} ${JSON.stringify(b)}`).toBe(true);
        expect(b.estimate).not.toBe(truth);
        const err = Math.abs(e);
        const lo = ESTIMATE_BIAS_MIN - ESTIMATE_JITTER;
        const hi = ESTIMATE_BIAS_MAX + ESTIMATE_JITTER;
        expect(lo <= err && err <= hi, `${err}`).toBe(true);
      }
    });
  });

  it("the bias keeps its sign and the hash differs by every input", () => {
    const c = company(3);
    const first = Math.sign(error(1n, c, REVENUE, 2020, 10, 5.0e8));
    for (let year = 2020; year < 2050; year++) {
      for (let v = 0; v < 20; v++) {
        const e = error(1n, c, REVENUE, year, v, 5.0e8 + v);
        // The sign is the subject's for the kind.
        expect(Math.sign(e)).toBe(first);
      }
    }
    const base = estimateHash(1n, c, REVENUE, [10]);
    expect(base).not.toBe(estimateHash(2n, c, REVENUE, [10]));
    expect(base).not.toBe(estimateHash(1n, company(4), REVENUE, [10]));
    expect(base).not.toBe(estimateHash(1n, c, VALUE, [10]));
    expect(base).not.toBe(estimateHash(1n, c, REVENUE, [12]));
    expect(base).not.toBe(estimateHash(1n, industry(3), REVENUE, [10]));
    expect(base).toBe(estimateHash(1n, c, REVENUE, [10]));
    expect(periodCode({ kind: "Year", year: 2020 })).not.toBe(
      periodCode({ kind: "Quarter", quarter: { year: 2020, q: 1 } }),
    );
  });

  it("derived bands keep the truth inside", () => {
    const s = company(0);
    const parts: [number, Figure][] = [1.0e8, 2.5e8, -3.0e5, 7.0e7].map((t, i) => {
      const e = error(5n, s, REVENUE, 2021, i, t);
      return [t, figureBandOf(bandOf(t, e, ESTIMATE_FLOOR_USD))];
    });
    let truth = 0.0;
    for (const p of parts) truth += p[0];
    const b = figureBand(figureSum(parts.map((p) => p[1])));
    if (b === null) throw new Error("a sum of bands is a band");
    expect(b.low < truth && truth < b.high && b.estimate !== truth).toBe(true);
    const per = figureBand(figureOver(figureBandOf(b), 4.0));
    if (per === null) throw new Error("a band over a whole is a band");
    expect(per.low < truth / 4.0 && truth / 4.0 < per.high).toBe(true);
  });

  it("the release quarter turns at the release", () => {
    const q = (year: number, n: number) => ({ year, q: n });
    expect(releaseQuarter(DATETIME_START)).toEqual(q(2019, 3));
    expect(releaseQuarter(dateTimeMidnight(simDateYmd(2020, 1, 2)))).toEqual(q(2019, 4));
    expect(releaseQuarter(dateTimeMidnight(simDateYmd(2020, 4, 2)))).toEqual(q(2020, 1));
  });

  // Not in Rust: the port's own checks of its 64-bit arithmetic.
  it("the hash is splitmix64 bit for bit", () => {
    for (let i = 0; i < 500; i++) {
      const seed = mixRef(BigInt(i)) & ((1n << 53n) - 1n);
      const ci = Number(mixRef(BigInt(i + 1000)) & 0xffffn);
      const rest = [mixRef(BigInt(i + 7)), BigInt(i)];
      expect(estimateHash(seed, company(ci), VALUE, rest)).toBe(hashRef(seed, BigInt(ci), 1n, rest));
      expect(estimateHash(seed, industry(ci), REVENUE, [])).toBe(
        hashRef(seed, (1n << 32n) | BigInt(ci), 100n, []),
      );
    }
    // Worked out from the Rust formulas in exact 64-bit arithmetic.
    expect(estimateHash(1n, company(3), REVENUE, [10])).toBe(1601858736043876113n);
    expect(
      estimateHash((1n << 60n) + 7n, industry(5), { kind: "Line", line: "OperatingCash" }, [
        (1n << 63n) + 1n,
        0,
      ]),
    ).toBe(14748975346009480973n);
    expect(error(1n, company(3), REVENUE, 2020, 10, 5.0e8)).toBe(0.08005004578199913);
    expect(error(42n, industry(7), { kind: "Supply" }, 2031, (2031 * 4 + 2) * 2, -3.25e5)).toBe(
      0.1192856994470236,
    );
    expect(error((1n << 53n) - 1n, company(650), VALUE, 2020, 0, 0.0)).toBe(-0.11594708060389908);
    expect(error(7n, company(0), { kind: "Line", line: "Rd" }, 2019, 4041, 1e12 + 0.5)).toBe(
      -0.14259398108763255,
    );
  });

  it("interval division keeps the true ratio inside", () => {
    const n = figureBandOf({ estimate: 10, low: 8, high: 12 });
    const d = figureBandOf({ estimate: 100, low: 90, high: 110 });
    expect(figureRatio(n, d)).toEqual({ kind: "Band", band: { estimate: 0.1, low: 8 / 110, high: 12 / 90 } });
    expect(figureRatio({ kind: "Exact", value: 3 }, { kind: "Exact", value: 0 })).toEqual({
      kind: "Exact",
      value: 0,
    });
  });
});
