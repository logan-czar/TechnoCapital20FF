// The D951 parity checker on synthetic soak directories, plus the real Rust reference against
// itself (it must pass its own gate).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Bands,
  formatParity,
  inBand,
  maxSharesOut,
  median,
  parityCheck,
  parityCommand,
  yearlyMedians,
} from "../src/parity.ts";

const bands: Bands = {
  years: {
    "2020": { ticks: [8784, 8784, 8784], g_t: [0.0, 0.01, 0.02], named: [600, 650, 700] },
    "2021": { ticks: [8760, 8760, 8760], g_t: [0.0, 0.01, 0.02], named: [610, 660, 710] },
  },
};
const rustSummary =
  "target,evaluated,passed,pass_share,required_share,verdict,value_min,value_median,value_max\n" +
  "a,50,50,1.00,1.00,MET,1,1,1,spec a\nb,50,49,0.98,1.00,WAIVED,1,1,1,spec b\nc,50,50,1.00,1.00,MET,1,1,1,spec c\n";

/** A TS years.csv with `seeds` rows per year, metric values per year from `vals`. */
function yearsCsv(vals: Record<number, [number, number, number][]>, extra = ""): string {
  let out = `seed,year,state_hash,ticks,g_t,named${extra === "" ? "" : ",shares_out_max"}\n`;
  for (const [y, rows] of Object.entries(vals)) {
    rows.forEach(([ticks, g, named], seed) => {
      out += `${seed + 1},${y},abc,${ticks},${g},${named}${extra === "" ? "" : `,${extra}`}\n`;
    });
  }
  return out;
}

const goodYears = yearsCsv({
  2020: [
    [8784, 0.005, 640],
    [8784, 0.015, 660],
    [8784, 0.01, 650],
  ],
  2021: [
    [8760, 0.01, 650],
    [8760, 0.01, 670],
    [8760, 0.01, 660],
  ],
});
const tsSummary =
  "target,evaluated,passed,pass_share,required_share,verdict,value_min,value_median,value_max\n" +
  "a,3,3,1.00,1.00,MET,1,1,1,x\nb,3,0,0.00,1.00,WAIVED,1,1,1,x\nc,3,3,1.00,1.00,MET,1,1,1,x\n";

describe("headless parity", () => {
  it("median_and_inband", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(inBand(0.01, [0, 0.01, 0.02])).toBe(true);
    expect(inBand(0.03, [0, 0.01, 0.02])).toBe(false);
    // A band with no width needs equality.
    expect(inBand(8784, [8784, 8784, 8784])).toBe(true);
    expect(inBand(8785, [8784, 8784, 8784])).toBe(false);
    expect(inBand(Number.NaN, [0, 1, 2])).toBe(false);
  });

  it("a_matching_run_passes", () => {
    const r = parityCheck({ tsYears: goodYears, tsSummary, bands, rustSummary });
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.targets_checked).toBe(2);
    expect(r.metrics_checked).toBe(6);
    expect(formatParity(r).at(-1)).toBe("parity OK");
  });

  it("a_metric_outside_its_band_is_reported_with_metric_year_value_and_band", () => {
    const bad = yearsCsv({
      2020: [
        [8784, 0.5, 640],
        [8784, 0.5, 660],
        [8784, 0.5, 650],
      ],
      2021: [
        [8760, 0.01, 650],
        [8760, 0.01, 670],
        [8760, 0.01, 660],
      ],
    });
    const r = parityCheck({ tsYears: bad, tsSummary, bands, rustSummary });
    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatchObject({
      kind: "metric",
      metric: "g_t",
      year: 2020,
      value: 0.5,
      band: [0, 0.01, 0.02],
    });
    expect(formatParity(r).join("\n")).toContain("g_t 2020");
  });

  it("a_width_free_band_fails_on_any_difference", () => {
    const bad = yearsCsv({
      2020: [[8783, 0.01, 650]],
      2021: [[8760, 0.01, 660]],
    });
    const r = parityCheck({ tsYears: bad, tsSummary, bands, rustSummary });
    expect(r.failures.map((f) => [f.metric, f.year])).toEqual([["ticks", 2020]]);
  });

  it("a_seed_missing_a_year_is_insufficient", () => {
    const r = parityCheck({
      tsYears: yearsCsv({ 2020: [[8784, 0.01, 650]] }),
      tsSummary,
      bands,
      rustSummary,
    });
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual([
      expect.objectContaining({
        kind: "insufficient",
        message: "insufficient seeds/years: seed 1 has no row for 2021",
      }),
    ]);
    expect(r.metrics_checked).toBe(0);
  });

  it("a_missing_metric_fails", () => {
    const noNamed = goodYears
      .split("\n")
      .map((l) => l.split(",").slice(0, 5).join(","))
      .join("\n");
    const r = parityCheck({ tsYears: noNamed, tsSummary, bands, rustSummary });
    expect(r.failures.filter((f) => f.kind === "missing").map((f) => [f.metric, f.year])).toEqual([
      ["named", 2020],
      ["named", 2021],
    ]);
  });

  it("fewer_seeds_than_the_reference_is_insufficient", () => {
    const r = parityCheck({ tsYears: goodYears, tsSummary, bands: { ...bands, seeds: 4 }, rustSummary });
    expect(r.failures.map((f) => f.message)).toEqual([
      "insufficient seeds/years: 3 distinct seeds, the reference has 4",
    ]);
  });

  it("empty_cells_are_missing_not_zero", () => {
    const csv = "seed,year,x,y\n1,2020,10,\n2,2020,,\n3,2020,30,5\n";
    const m = yearlyMedians(csv).get(2020);
    // x: 10 and 30 present (2 of 3): their median, not the median of 0, 10, 30.
    expect(m?.get("x")).toBe(20);
    // y: 1 of 3 present: too few, reported missing.
    expect(m?.has("y")).toBe(false);
  });

  it("a_rust_met_target_that_is_not_met_in_ts_fails_but_waived_ones_are_skipped", () => {
    const ts = tsSummary.replace("c,3,3,1.00,1.00,MET", "c,3,2,0.67,1.00,NOT MET");
    const r = parityCheck({ tsYears: goodYears, tsSummary: ts, bands, rustSummary });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatchObject({ kind: "target", metric: "c", value: "NOT MET" });
    // A target missing from the TS summary also fails.
    const none = parityCheck({
      tsYears: goodYears,
      tsSummary: "target,verdict\na,MET\n",
      bands,
      rustSummary,
    });
    expect(none.failures.map((f) => f.metric)).toEqual(["c"]);
  });

  it("reports_the_max_shares_out", () => {
    const withCol = yearsCsv({ 2020: [[8784, 0.01, 650]] }, "123456");
    expect(maxSharesOut(null, withCol)).toBe(123456);
    expect(maxSharesOut("seed,max_shares_out\n1,10\n2,99\n", goodYears)).toBe(99);
    expect(maxSharesOut(null, goodYears)).toBeNull();
    const r = parityCheck({
      tsYears: goodYears,
      tsSummary,
      bands,
      rustSummary,
      tsShares: "seed,max_shares_out\n1,7\n",
    });
    expect(r.max_shares_out).toBe(7);
    expect(formatParity(r).join("\n")).toContain("max shares_out: 7 (safe integer)");
  });

  it("yearly_medians_skip_non_numeric_columns", () => {
    const m = yearlyMedians(goodYears);
    expect(m.get(2020)?.get("named")).toBe(650);
    expect(m.get(2020)?.has("state_hash")).toBe(false);
  });

  it("the_rust_reference_passes_its_own_gate", () => {
    const ref = join(import.meta.dirname, "..", "..", "..", "test", "fixtures", "rust-reference");
    const read = (n: string): string => readFileSync(join(ref, n), "utf8");
    const r = parityCheck({
      tsYears: read("years.csv"),
      tsSummary: read("summary.csv"),
      bands: JSON.parse(read("bands.json")) as Bands,
      rustSummary: read("summary.csv"),
    });
    expect(r.failures).toEqual([]);
    expect(r.targets_checked).toBe(19);
  });

  it("half_the_rust_seeds_is_insufficient", () => {
    const ref = join(import.meta.dirname, "..", "..", "..", "test", "fixtures", "rust-reference");
    const read = (n: string): string => readFileSync(join(ref, n), "utf8");
    const lines = read("years.csv").split(/\r?\n/);
    const half = [lines[0], ...lines.slice(1).filter((l) => l !== "" && Number(l.split(",")[0]) <= 25)].join(
      "\n",
    );
    const r = parityCheck({
      tsYears: half,
      tsSummary: read("summary.csv"),
      bands: JSON.parse(read("bands.json")) as Bands,
      rustSummary: read("summary.csv"),
    });
    expect(r.failures.map((f) => f.kind)).toEqual(["insufficient"]);
  });

  it("the_command_finds_the_reference_from_any_directory", () => {
    // pnpm --filter @tc20ff/headless start parity <dir> runs in apps/headless: the soak dir is the
    // user's (INIT_CWD), the reference is the repository's.
    const saved = process.env.INIT_CWD;
    process.env.INIT_CWD = join(import.meta.dirname, "..");
    try {
      expect(parityCommand([join("..", "..", "test", "fixtures", "rust-reference")])).toBe(0);
    } finally {
      if (saved === undefined) delete process.env.INIT_CWD;
      else process.env.INIT_CWD = saved;
    }
  });
});
