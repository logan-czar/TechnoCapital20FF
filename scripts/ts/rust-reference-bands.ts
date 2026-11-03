// Builds a soak directory's bands.json from its years.csv (D951): for each year and each numeric
// metric, the p10, p50 and p90 across seeds. The parity gate checks that each yearly median of a new
// soak lands inside its reference's p10..p90 band. Written first for the Rust reference; since D1019
// the default reference is the TS baseline soak, test/fixtures/ts-soak/.
//
//   node scripts/ts/rust-reference-bands.ts [test/fixtures/rust-reference] [--source "what ran it"]

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Columns that are ids, hashes or labels, not metrics. */
const NOT_METRICS = new Set(["seed", "year", "state_hash", "phase", "ratings"]);

/** Linear-interpolated quantile of sorted values (numpy's default). */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? Number.NaN;
  const b = sorted[hi] ?? Number.NaN;
  return a + (b - a) * (pos - lo);
}

const args = process.argv.slice(2);
const sourceAt = args.indexOf("--source");
const source =
  sourceAt >= 0
    ? (args.splice(sourceAt, 2)[1] ?? "")
    : "Rust headless soak, main 17349f3 (2026-10-24), `headless soak --check`, default seeds and years";
const dir = args[0] ?? "test/fixtures/rust-reference";
const lines = readFileSync(join(dir, "years.csv"), "utf8").trim().split(/\r?\n/);
const header = (lines[0] ?? "").split(",");
const rows = lines.slice(1).map((l) => l.split(","));
const yearCol = header.indexOf("year");
const seedCol = header.indexOf("seed");

const byYear = new Map<string, string[][]>();
for (const r of rows) {
  const y = r[yearCol] ?? "";
  byYear.set(y, [...(byYear.get(y) ?? []), r]);
}

const years: Record<string, Record<string, [number, number, number]>> = {};
for (const [year, yr] of [...byYear.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const out: Record<string, [number, number, number]> = {};
  header.forEach((name, i) => {
    if (NOT_METRICS.has(name)) return;
    // An empty cell is a missing value, not 0 (`Number("")` is 0): the quantiles are over the
    // values present, and a metric with fewer than half its rows present, or any non-number, is
    // left out (as parity.ts `yearlyMedians` reads a TS soak).
    const cells = yr.map((r) => r[i] ?? "").filter((c) => c !== "");
    const vals = cells.map(Number);
    if (!vals.every((v) => Number.isFinite(v)) || vals.length === 0 || vals.length * 2 < yr.length) return;
    vals.sort((a, b) => a - b);
    out[name] = [quantile(vals, 0.1), quantile(vals, 0.5), quantile(vals, 0.9)];
  });
  years[year] = out;
}

const seeds = new Set(rows.map((r) => r[seedCol])).size;
const bands = {
  source,
  seeds,
  quantiles: ["p10", "p50", "p90"],
  years,
};
writeFileSync(join(dir, "bands.json"), `${JSON.stringify(bands, null, 1)}\n`);
console.log(`wrote ${join(dir, "bands.json")}: ${seeds} seeds, ${Object.keys(years).length} years`);
