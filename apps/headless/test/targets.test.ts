// Port of the `#[cfg(test)] mod tests` of crates/headless/src/targets.rs: hand-made rows. A seed
// inside every bound passes every target, and pushing one column past a bound fails exactly that
// target.
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_LABS_SEED_SHARE,
  ALL_SEEDS,
  checkDir,
  DEMAND_TREND_SEED_SHARE,
  evaluate,
  type Kind,
  parse,
  START_PRIVATE_LISTED_SEED_SHARE,
  type Summary,
  summaryVerdict,
  TARGETS,
} from "../src/targets.ts";

/** The columns the checker reads, in a smaller hand-made table. */
const Y_HEADER =
  "seed,year,start_alive_share,median_productivity,demand_dev_max_pp,demand_dev_out,startups_in_year," +
  "ai_lab_startups_in_year,named_companies,listings_in_year,start_private_listed,full_characters_made," +
  "full_characters,casts_in_year,cast_full_min,cast_full_max,cast_simple_min,cast_simple_max," +
  "born_empty_seats_max";
const Q_HEADER =
  "seed,year,quarter,released,reports,beats,industries,industry_months,boom_months,bust_months," +
  "rev_demand_min,rev_demand_max,rev_demand_out_of_band,demand_trend_min,demand_trend_max," +
  "demand_trend_out_of_band,m_clamp_max_run_counted,m_clamp_max_run_waived,rev_demand_min_counted," +
  "rev_demand_max_counted,rev_demand_out_counted,rev_demand_min_waived,rev_demand_max_waived," +
  "rev_demand_out_waived";

type Rows = string[][];

/**
 * A good 30-year seed: 10 startups a year (4 AI labs in 2030 to 2035, 24 in all), 700 named
 * companies, 4 listings a year (120), 3 starting private companies listed a year to 2024 (15), 20
 * full characters made a year (200 a decade, 896 in 2050), casts of 1 to 4.
 */
function good(): [Rows, Rows] {
  const years: Rows = [];
  for (let y = 2020; y < 2050; y++) {
    const n = y - 2019;
    const ai = y >= 2030 && y <= 2035 ? 4 : 0;
    years.push([
      "1",
      String(y),
      "0.94",
      "98.5",
      "1.2",
      "0",
      "10",
      String(ai),
      "700",
      "4",
      String(3 * Math.min(n, 5)),
      String(20 * n),
      String(296 + 20 * n),
      "10",
      "1",
      "4",
      "2",
      "5",
      "0",
    ]);
  }
  const quarters: Rows = [];
  for (let y = 2020; y < 2050; y++) {
    for (let q = 1; q <= 4; q++) {
      const released = q === 1 ? `${y - 1}Q4` : `${y}Q${q - 1}`;
      quarters.push([
        "1",
        String(y),
        String(q),
        released,
        "600",
        "240",
        "42",
        "126",
        "20",
        "18",
        "0.8",
        "1.2",
        "0",
        "0.6",
        "1.5",
        "0",
        "3",
        "2",
        "0.8",
        "1.2",
        "0",
        "0.9",
        "1.1",
        "0",
      ]);
    }
  }
  return [years, quarters];
}

function text(header: string, rows: Rows): string {
  return `${header}\n${rows.map((r) => `${r.join(",")}\n`).join("")}`;
}

/** Each target's verdict for one seed, by id. */
function results(years: Rows, quarters: Rows): [string, string][] {
  const seeds = parse(text(Y_HEADER, years), text(Q_HEADER, quarters));
  const [csv] = evaluate(seeds);
  return csv
    .split("\n")
    .slice(1)
    .filter((l) => l !== "")
    .map((l) => {
      const f = l.split(",");
      return [f[0] as string, f[2] as string];
    });
}

function col(header: string, c: string): number {
  const i = header.split(",").indexOf(c);
  if (i < 0) throw new Error(c);
  return i;
}

describe("headless targets", () => {
  it("good_seed_passes_every_target", () => {
    const [y, q] = good();
    for (const [id, r] of results(y, q)) expect(r, id).toBe("PASS");
  });

  /** Sets column `c` of the rows of `years` to `v`, and checks that only `target` fails. */
  function failsOnly(target: string, table: "y" | "q", c: string, years: number[], v: string): void {
    const [y, q] = good();
    const rows = table === "y" ? y : q;
    const header = table === "y" ? Y_HEADER : Q_HEADER;
    const i = col(header, c);
    const yc = col(header, "year");
    let hit = false;
    for (const r of rows) {
      if (years.includes(Number(r[yc]))) {
        r[i] = v;
        hit = true;
      }
    }
    expect(hit).toBe(true);
    for (const [id, r] of results(y, q)) {
      expect(r, `${id} with ${c} = ${v} in ${years}`).toBe(id === target ? "FAIL" : "PASS");
    }
  }

  const range = (a: number, b: number): number[] => Array.from({ length: b - a }, (_, i) => a + i);

  it("each_target_fails_past_its_bound", () => {
    failsOnly("start_alive_10y", "y", "start_alive_share", [2029], "0.84");
    failsOnly("median_productivity_10y", "y", "median_productivity", [2029], "87.3");
    failsOnly("median_productivity_10y", "y", "median_productivity", [2029], "110.5");
    // The judged revenue target reads the industries not waived (D368).
    failsOnly("industry_revenue_demand", "q", "rev_demand_max_counted", [2027], "1.31");
    failsOnly("industry_revenue_demand", "q", "rev_demand_min_counted", [2021], "0.69");
    failsOnly("industry_revenue_demand", "q", "rev_demand_out_counted", [2024], "1");
    // Cloud out of band fails only its waived row (D368), not industry_revenue_demand.
    failsOnly("industry_revenue_demand_cloud_waived", "q", "rev_demand_min_waived", [2024], "0.696");
    failsOnly("industry_revenue_demand_cloud_waived", "q", "rev_demand_out_waived", [2027], "1");
    failsOnly("industry_demand_trend", "q", "demand_trend_max", [2027], "1.56");
    failsOnly("industry_demand_trend", "q", "demand_trend_min", [2021], "0.44");
    failsOnly("m_clamp_8q", "q", "m_clamp_max_run_counted", [2028], "9");
    // Cloud's own run fails only its waived row (D366), not m_clamp_8q.
    failsOnly("m_clamp_8q_cloud_waived", "q", "m_clamp_max_run_waived", [2028], "9");
    // 240 of 600 is 40%; 170 is 28%, 370 is 62%.
    failsOnly("beat_share", "q", "beats", range(2020, 2031), "170");
    failsOnly("beat_share", "q", "beats", range(2020, 2031), "370");
    // Pooled (D365): 38 of 42 within 3 pp is 90.5%, 37 is 88.1%.
    failsOnly("demand_growth_pooled", "y", "demand_dev_out", [2029], "5");
    // 20 of 126 is 15.9%; 12 is 9.5%, 32 is 25.4%; Bust 18 is 14.3%, 10 is 7.9%, 28 is 22.2%.
    const decade = range(2020, 2030);
    failsOnly("boom_share", "q", "boom_months", decade, "12");
    failsOnly("boom_share", "q", "boom_months", decade, "32");
    failsOnly("bust_share", "q", "bust_months", decade, "10");
    failsOnly("bust_share", "q", "bust_months", decade, "28");
    failsOnly("startups_per_year", "y", "startups_in_year", decade, "5");
    failsOnly("startups_per_year", "y", "startups_in_year", decade, "16");
    const ai = range(2030, 2036);
    failsOnly("ai_lab_startups_2030_2035", "y", "ai_lab_startups_in_year", ai, "2");
    failsOnly("ai_lab_startups_2030_2035", "y", "ai_lab_startups_in_year", ai, "9");
    failsOnly("named_companies", "y", "named_companies", [2044], "599");
    failsOnly("named_companies", "y", "named_companies", [2020], "1101");
    const all = range(2020, 2050);
    failsOnly("listings_30y", "y", "listings_in_year", all, "1");
    failsOnly("listings_30y", "y", "listings_in_year", all, "9");
    failsOnly("listings_per_year", "y", "listings_in_year", [2031], "13");
    failsOnly("start_private_listed_2024", "y", "start_private_listed", [2024], "9");
    failsOnly("start_private_listed_2024", "y", "start_private_listed", [2024], "31");
    // 20 a year, 200 a decade: a 2049 total of 490 leaves 90 made in the 2040s, 710 one of 310;
    // the 2020s and 2030s still pass.
    failsOnly("full_characters_per_decade", "y", "full_characters_made", [2049], "490");
    failsOnly("full_characters_per_decade", "y", "full_characters_made", [2049], "710");
    failsOnly("full_characters_2050", "y", "full_characters", [2049], "1200");
    failsOnly("cast_sizes", "y", "cast_full_max", [2033], "6");
    failsOnly("cast_sizes", "y", "cast_simple_min", [2021], "0");
    failsOnly("no_empty_labor_seat", "y", "born_empty_seats_max", [2040], "1");
  });

  it("short_runs_are_na_and_shares_follow_the_required_share", () => {
    // A 1-year run: only the per-birth cast check is evaluated; the every-year targets need the
    // 30 rows of the run.
    let [y, q] = good();
    y = y.slice(0, 1);
    q = q.slice(0, 4);
    const evaluated = results(y, q)
      .filter(([, v]) => v !== "NA")
      .map(([id]) => id);
    expect(evaluated).toEqual(["cast_sizes"]);
    // 29 of the 30 rows: still NA.
    const [y2, q2] = good();
    y2.pop();
    const na = results(y2, q2)
      .filter(([, v]) => v === "NA")
      .map(([id]) => id);
    for (const id of ["named_companies", "listings_per_year", "no_empty_labor_seat"]) {
      expect(na, id).toContain(id);
    }
    // 9 of 10 seeds meets 90%; 8 of 10 does not; every-seed targets need all.
    const s = (passed: number, required: number, kind: Kind = "Seeds"): Summary => ({
      id: "x",
      spec: "x",
      kind,
      evaluated: 10,
      passed,
      required,
      values: null,
    });
    expect(summaryVerdict(s(9, START_PRIVATE_LISTED_SEED_SHARE))).toBe("MET");
    expect(summaryVerdict(s(8, START_PRIVATE_LISTED_SEED_SHARE))).toBe("NOT MET");
    expect(summaryVerdict(s(8, AI_LABS_SEED_SHARE))).toBe("MET");
    expect(summaryVerdict(s(9, ALL_SEEDS))).toBe("NOT MET");
    expect(summaryVerdict(s(10, ALL_SEEDS))).toBe("MET");
    // A waived target is reported but never MET (D366).
    expect(summaryVerdict(s(10, ALL_SEEDS, "Waived"))).toBe("WAIVED");
  });

  it("a_pooled_target_counts_industry_runs_over_seeds", () => {
    // D365: two seeds, one with 42 of 42 within 3 pp and one with 36 of 42 (85.7%, a seed FAIL);
    // pooled 78 of 84 is 92.9%, MET. With 33 of 42 the pool is 75 of 84, 89.3%.
    const [y, q] = good();
    const run = (out: string): [Summary, string] => {
      const y2 = y.map((r) => [...r]);
      const i = col(Y_HEADER, "demand_dev_out");
      const yc = col(Y_HEADER, "year");
      for (const r of y2) {
        r[0] = "2";
        if (r[yc] === "2029") r[i] = out;
      }
      const q2 = q.map((r) => [...r]);
      for (const r of q2) r[0] = "2";
      const seeds = parse(text(Y_HEADER, [...y, ...y2]), text(Q_HEADER, [...q, ...q2]));
      const [csv, sums] = evaluate(seeds);
      const s = sums.find((x) => x.id === "demand_growth_pooled") as Summary;
      const seed2 = csv.split("\n").find((l) => l.startsWith("demand_growth_pooled,2,")) as string;
      return [s, seed2];
    };
    const [s, seed2] = run("6");
    expect([s.passed, s.evaluated]).toEqual([78, 84]);
    expect(summaryVerdict(s)).toBe("MET");
    expect(seed2).toContain(",FAIL,36 of 42");
    const [s9] = run("9");
    expect([s9.passed, s9.evaluated]).toEqual([75, 84]);
    expect(summaryVerdict(s9)).toBe("NOT MET");
  });

  /** `n` copies of the good seed (seeds 1 to n); `edit(seed, quarter row)` changes each quarter row. */
  function manySeeds(n: number, edit: (seed: number, row: string[]) => void): Summary[] {
    const [y, q] = good();
    const ys: Rows = [];
    const qs: Rows = [];
    for (let seed = 1; seed <= n; seed++) {
      for (const r of y) ys.push([String(seed), ...r.slice(1)]);
      for (const r of q) {
        const row = [String(seed), ...r.slice(1)];
        edit(seed, row);
        qs.push(row);
      }
    }
    return evaluate(parse(text(Y_HEADER, ys), text(Q_HEADER, qs)))[1];
  }

  const summary = (sums: Summary[], id: string): Summary => sums.find((s) => s.id === id) as Summary;

  it("demand_trend_needs_85_percent_of_seeds", () => {
    // D367: 17 of 20 seeds inside ±55% is 85%, MET; 16 of 20 is 80%, NOT MET.
    const i = col(Q_HEADER, "demand_trend_max");
    const run = (bad: number): [number, number, string] => {
      const sums = manySeeds(20, (seed, r) => {
        if (seed <= bad && r[1] === "2025") r[i] = "1.6";
      });
      const s = summary(sums, "industry_demand_trend");
      expect(s.required).toBe(DEMAND_TREND_SEED_SHARE);
      return [s.passed, s.evaluated, summaryVerdict(s)];
    };
    expect(run(3)).toEqual([17, 20, "MET"]);
    expect(run(4)).toEqual([16, 20, "NOT MET"]);
  });

  it("cloud_is_judged_apart_from_revenue_against_demand", () => {
    // D368: Cloud below 0.70 of its demand in every seed leaves the judged target MET and shows
    // on its own WAIVED row, each seed a FAIL there.
    const lo = col(Q_HEADER, "rev_demand_min_waived");
    const out = col(Q_HEADER, "rev_demand_out_waived");
    const sums = manySeeds(4, (_, r) => {
      if (r[1] === "2024") {
        r[lo] = "0.696";
        r[out] = "1";
      }
    });
    const judged = summary(sums, "industry_revenue_demand");
    expect([judged.passed, judged.evaluated]).toEqual([4, 4]);
    expect(summaryVerdict(judged)).toBe("MET");
    const waived = summary(sums, "industry_revenue_demand_cloud_waived");
    expect([waived.passed, waived.evaluated]).toEqual([0, 4]);
    expect(waived.kind).toBe("Waived");
    expect(summaryVerdict(waived)).toBe("WAIVED");
    const worst = (waived.values as [number, number, number])[1];
    expect(Math.abs(worst - 0.304) < 1e-9, String(worst)).toBe(true);
  });

  it("target_texts_hold_no_comma_and_ids_are_unique", () => {
    for (const t of TARGETS) {
      expect(t.spec.includes(",") || t.bound.includes(","), t.id).toBe(false);
      expect(TARGETS.filter((u) => u.id === t.id).length, t.id).toBe(1);
    }
  });

  it("bad_tables_name_the_file_line_and_column", () => {
    const [y, q] = good();
    const bad = y.map((r) => [...r]);
    (bad[3] as string[])[col(Y_HEADER, "named_companies")] = "lots";
    expect(() => parse(text(Y_HEADER, bad), text(Q_HEADER, q))).toThrow(
      /years\.csv:5: column `named_companies`/,
    );
    expect(() => parse("seed,year\n1,2020\n", text(Q_HEADER, q))).toThrow(/no column `start_alive_share`/);
  });
});

// The Rust soak's own tables through the TS `check`: targets.csv and summary.csv must come out
// byte for byte as the Rust wrote them (line endings aside), so the TS fixed-decimal formatting
// (`fixed`, `toFixed`) and the target rules match the Rust on real figures.
describe("check on the Rust reference", () => {
  it("rewrites the Rust targets.csv and summary.csv byte for byte", () => {
    const ref = join(import.meta.dirname, "..", "..", "..", "test", "fixtures", "rust-reference");
    const dir = mkdtempSync(join(tmpdir(), "tc20ff-check-"));
    for (const n of ["years.csv", "quarters.csv"]) copyFileSync(join(ref, n), join(dir, n));
    checkDir(dir);
    const read = (d: string, n: string) => readFileSync(join(d, n), "utf8").replaceAll("\r", "");
    expect(read(dir, "targets.csv")).toBe(read(ref, "targets.csv"));
    expect(read(dir, "summary.csv")).toBe(read(ref, "summary.csv"));
  });
});
