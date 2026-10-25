// `headless parity <dir>` (D951, ts-migration-plan Step 4): compares a TS soak directory with the
// Rust reference in test/fixtures/rust-reference/. The gate:
//
// - every spec 10 target `summary.csv` marks MET in the Rust reference is MET in the TS soak;
// - the TS soak has at least as many distinct seeds as the Rust reference (`bands.seeds`, 50) and
//   a row for every band year for every seed: a smaller sample's medians stray outside the Rust
//   p10..p90 bands by chance (25 seeds gave false failures, 50 none), so it fails as
//   "insufficient seeds/years" before any metric is compared;
// - each yearly metric's TS median (across seeds, from `years.csv`) lies inside the Rust
//   p10..p90 band of `bands.json`; where the band has no width (a metric every seed shares, such
//   as `ticks`) the TS median must equal it. An empty cell is a missing value: the median is over
//   the values present, and a metric with fewer than half its rows present counts as missing.
//
// State hashes do not carry over (D953) and are not compared. The report also gives the largest
// `shares_out` the TS soak saw (D951: share counts are plain numbers and must stay safe
// integers), read from the optional `shares_out.csv` (`seed,max_shares_out`, `sharesOutCsv` in
// metrics.ts) or, failing that, a `shares_out_max` column of `years.csv`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@tc20ff/sim-data/node";
import { userPath } from "./args.ts";

/** `bands.json`: per year and metric, [p10, p50, p90] across the Rust seeds. */
export interface Bands {
  source?: string;
  seeds?: number;
  quantiles?: string[];
  years: Record<string, Record<string, [number, number, number]>>;
}

/** One way the TS soak differs from the Rust reference. */
export interface ParityFailure {
  kind: "target" | "metric" | "missing" | "insufficient";
  /** The target id or the years.csv column. */
  metric: string;
  /** The year of a metric failure. */
  year: number | null;
  /** The TS median (or the TS verdict, for a target). */
  value: number | string | null;
  /** The Rust [p10, p50, p90] band of a metric failure. */
  band: [number, number, number] | null;
  message: string;
}

export interface ParityReport {
  ok: boolean;
  failures: ParityFailure[];
  targets_checked: number;
  metrics_checked: number;
  /** The largest `shares_out` the TS soak saw, when recorded. */
  max_shares_out: number | null;
}

/** A band with no width needs equality; this is the float slack for "equal" (CSV precision). */
const EQUAL_SLACK = 1e-9;

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l !== "");
}

/** A CSV with no quoted fields (the soak's tables): header names and string rows. */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = splitLines(text);
  const header = (lines[0] ?? "").split(",");
  return { header, rows: lines.slice(1).map((l) => l.split(",")) };
}

/** The median of values (the mean of the middle two for an even count). */
export function median(values: readonly number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return Number.NaN;
  const mid = Math.trunc(n / 2);
  return n % 2 === 1 ? (v[mid] as number) : 0.5 * ((v[mid - 1] as number) + (v[mid] as number));
}

/** Whether a TS median is inside a Rust band: p10 <= m <= p90, or equal when the band has no width. */
export function inBand(m: number, [p10, , p90]: readonly [number, number, number]): boolean {
  if (!Number.isFinite(m)) return false;
  if (p10 === p90) return Math.abs(m - p10) <= EQUAL_SLACK * Math.max(1, Math.abs(p10));
  return m >= p10 && m <= p90;
}

/** The `target -> verdict` map of a `summary.csv`. */
export function summaryVerdicts(text: string): Map<string, string> {
  const { header, rows } = parseCsv(text);
  const t = header.indexOf("target");
  const v = header.indexOf("verdict");
  if (t < 0 || v < 0) throw new Error("summary.csv: needs `target` and `verdict` columns");
  const out = new Map<string, string>();
  for (const r of rows) out.set(r[t] as string, r[v] as string);
  return out;
}

/**
 * The yearly medians of a TS `years.csv`: year -> metric -> median across seeds. An empty cell is
 * a missing value (not 0): the median is over the values present, and a column with fewer than
 * half its rows present that year is left out (reported missing). Columns with a non-number in
 * any cell (hash, phase, ratings) are skipped.
 */
export function yearlyMedians(yearsCsv: string): Map<number, Map<string, number>> {
  const { header, rows } = parseCsv(yearsCsv);
  const yi = header.indexOf("year");
  if (yi < 0) throw new Error("years.csv: no `year` column");
  const byYear = new Map<number, string[][]>();
  for (const r of rows) {
    const y = Number(r[yi]);
    const list = byYear.get(y) ?? [];
    list.push(r);
    byYear.set(y, list);
  }
  const out = new Map<number, Map<string, number>>();
  for (const [y, yr] of byYear) {
    const m = new Map<string, number>();
    header.forEach((name, i) => {
      const cells = yr.map((r) => r[i] ?? "").filter((c) => c !== "");
      const vals = cells.map(Number);
      if (!vals.every((x) => Number.isFinite(x))) return;
      if (vals.length * 2 < yr.length || vals.length === 0) return;
      m.set(name, median(vals));
    });
    out.set(y, m);
  }
  return out;
}

/**
 * Why the TS soak is too small to compare (fewer distinct seeds than the reference, or a seed with
 * no row for a band year), or null when it covers the reference.
 */
export function coverageShortfall(yearsCsv: string, bands: Bands): string | null {
  const { header, rows } = parseCsv(yearsCsv);
  const si = header.indexOf("seed");
  const yi = header.indexOf("year");
  if (si < 0 || yi < 0) return "years.csv needs `seed` and `year` columns";
  const yearsBySeed = new Map<string, Set<string>>();
  for (const r of rows) {
    const seed = r[si] ?? "";
    const set = yearsBySeed.get(seed) ?? new Set<string>();
    set.add(String(Number(r[yi])));
    yearsBySeed.set(seed, set);
  }
  const need = bands.seeds ?? 1;
  if (yearsBySeed.size < need) return `${yearsBySeed.size} distinct seeds, the reference has ${need}`;
  const bandYears = Object.keys(bands.years).sort((a, b) => Number(a) - Number(b));
  for (const [seed, years] of [...yearsBySeed].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const lacking = bandYears.filter((y) => !years.has(y));
    if (lacking.length > 0) return `seed ${seed} has no row for ${lacking.join(", ")}`;
  }
  return null;
}

/** The largest value of a `max_shares_out` column in `shares_out.csv`, or of `shares_out_max` in years.csv. */
export function maxSharesOut(sharesCsv: string | null, yearsCsv: string): number | null {
  const fromCol = (text: string, col: string): number | null => {
    const { header, rows } = parseCsv(text);
    const i = header.indexOf(col);
    if (i < 0) return null;
    const vals = rows.map((r) => Number(r[i])).filter((x) => Number.isFinite(x));
    return vals.length === 0 ? null : vals.reduce((a, b) => Math.max(a, b));
  };
  if (sharesCsv !== null) {
    const v = fromCol(sharesCsv, "max_shares_out");
    if (v !== null) return v;
  }
  return fromCol(yearsCsv, "shares_out_max");
}

/** Compares a TS soak (its CSV texts) with the Rust reference. */
export function parityCheck(input: {
  tsYears: string;
  tsSummary: string;
  bands: Bands;
  rustSummary: string;
  tsShares?: string | null;
}): ParityReport {
  const failures: ParityFailure[] = [];
  const rust = summaryVerdicts(input.rustSummary);
  const ts = summaryVerdicts(input.tsSummary);
  let targetsChecked = 0;
  for (const [id, verdict] of rust) {
    if (verdict !== "MET") continue;
    targetsChecked += 1;
    const got = ts.get(id);
    if (got !== "MET") {
      failures.push({
        kind: "target",
        metric: id,
        year: null,
        value: got ?? "missing",
        band: null,
        message: `target ${id}: Rust MET, TS ${got ?? "missing"}`,
      });
    }
  }
  const short = coverageShortfall(input.tsYears, input.bands);
  if (short !== null) {
    failures.push({
      kind: "insufficient",
      metric: "years.csv",
      year: null,
      value: null,
      band: null,
      message: `insufficient seeds/years: ${short}`,
    });
    return {
      ok: false,
      failures,
      targets_checked: targetsChecked,
      metrics_checked: 0,
      max_shares_out: maxSharesOut(input.tsShares ?? null, input.tsYears),
    };
  }
  const medians = yearlyMedians(input.tsYears);
  let metricsChecked = 0;
  const years = Object.keys(input.bands.years)
    .map(Number)
    .sort((a, b) => a - b);
  for (const year of years) {
    const band = input.bands.years[String(year)] as Record<string, [number, number, number]>;
    const row = medians.get(year);
    for (const metric of Object.keys(band).sort()) {
      const b = band[metric] as [number, number, number];
      metricsChecked += 1;
      const m = row?.get(metric);
      if (m === undefined) {
        failures.push({
          kind: "missing",
          metric,
          year,
          value: null,
          band: b,
          message: `${metric} ${year}: no TS value (band ${fmtBand(b)})`,
        });
      } else if (!inBand(m, b)) {
        failures.push({
          kind: "metric",
          metric,
          year,
          value: m,
          band: b,
          message: `${metric} ${year}: TS median ${m} outside Rust ${fmtBand(b)}`,
        });
      }
    }
  }
  return {
    ok: failures.length === 0,
    failures,
    targets_checked: targetsChecked,
    metrics_checked: metricsChecked,
    max_shares_out: maxSharesOut(input.tsShares ?? null, input.tsYears),
  };
}

function fmtBand(b: readonly [number, number, number]): string {
  return b[0] === b[2] ? `= ${b[0]}` : `p10..p90 ${b[0]}..${b[2]} (p50 ${b[1]})`;
}

/** The printable report. */
export function formatParity(r: ParityReport): string[] {
  const lines: string[] = [];
  for (const f of r.failures) lines.push(`FAIL ${f.message}`);
  lines.push(
    `${r.targets_checked} Rust-MET targets and ${r.metrics_checked} yearly metric bands checked: ${r.failures.length} failure(s)`,
  );
  lines.push(
    r.max_shares_out === null
      ? "max shares_out: not recorded"
      : `max shares_out: ${r.max_shares_out}${Number.isSafeInteger(r.max_shares_out) ? " (safe integer)" : " (NOT a safe integer)"}`,
  );
  lines.push(r.ok ? "parity OK" : "parity FAILED");
  return lines;
}

/** Where the Rust reference lives, relative to the repository root. */
export const RUST_REFERENCE_DIR = "test/fixtures/rust-reference";

/** `headless parity <dir> [--reference DIR]`: reads the files, prints the report. Returns the exit code. */
export function parityCommand(args: string[], root = repoRoot()): number {
  let dir: string | null = null;
  let ref = join(root, RUST_REFERENCE_DIR);
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === "--reference") {
      const d = args[++i];
      if (d === undefined) return usageError();
      ref = userPath(d);
    } else if (dir === null && !a.startsWith("--")) {
      dir = userPath(a);
    } else {
      return usageError();
    }
  }
  if (dir === null) return usageError();
  try {
    const read = (d: string, n: string): string => readFileSync(join(d, n), "utf8");
    const sharesPath = join(dir, "shares_out.csv");
    const report = parityCheck({
      tsYears: read(dir, "years.csv"),
      tsSummary: read(dir, "summary.csv"),
      bands: JSON.parse(read(ref, "bands.json")) as Bands,
      rustSummary: read(ref, "summary.csv"),
      tsShares: existsSync(sharesPath) ? readFileSync(sharesPath, "utf8") : null,
    });
    for (const l of formatParity(report)) console.log(l);
    return report.ok ? 0 : 1;
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

function usageError(): number {
  console.error("usage: headless parity <soak-dir> [--reference DIR]");
  return 2;
}
