// Port of the `#[cfg(test)] mod tests` of crates/headless/src/metrics.rs, plus a run of
// `runSeed` against a stub sim (the Sim is not ported yet), checking the two tables' shape.
import type { Notice, SimViews } from "@tc20ff/sim/internal";
import { describe, expect, it } from "vitest";
import {
  atClamp,
  bandCounts,
  bandStats,
  bandStatsWhere,
  type ClampRuns,
  cagr,
  castSizes,
  clampRunsAddQuarter,
  clampRunsCurrentMax,
  clampRunsNew,
  M_CLAMP_QUARTERS,
  M_MAX,
  M_MIN,
  type MonthFigures,
  QUARTERS_HEADER,
  quarterAccAddMonth,
  quarterAccNew,
  quarterLabel,
  ratingBand,
  revenueRatio,
  runSeed,
  type SoakSimApi,
  type SoakStats,
  sharesOutCsv,
  YEARS_HEADER,
} from "../src/metrics.ts";

describe("headless metrics", () => {
  it("cagr_and_revenue_ratio", () => {
    expect(Math.abs(cagr(100.0, 121.0, 2.0) - 0.1) < 1e-12).toBe(true);
    expect(cagr(0.0, 1.0, 1.0)).toBe(Number.POSITIVE_INFINITY);
    expect(revenueRatio(3.0, 2.0)).toBe(1.5);
    expect(revenueRatio(0.0, 0.0)).toBe(1.0);
    expect(revenueRatio(1.0, 0.0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("clamp_runs_count_consecutive_quarters_at_either_edge", () => {
    const c = clampRunsNew();
    // Industry 0 sits at the floor, industry 1 at the cap then leaves it, industry 2 never.
    for (let q = 0; q < 10; q++) {
      const one = q < 3 ? M_MAX : 1.0;
      clampRunsAddQuarter(c, [M_MIN, one, 1.05]);
    }
    expect(c.run).toEqual([10, 0, 0]);
    expect(c.over).toEqual([true, false, false]);
    expect(c.max_run).toBe(10);
    // A quarter off the clamp resets the run but not `over` or the longest run.
    clampRunsAddQuarter(c, [0.9, M_MAX, 1.0]);
    expect(c.run).toEqual([0, 1, 0]);
    expect(c.over).toEqual([true, false, false]);
    expect(c.max_run).toBe(10);
    // Exactly 8 quarters is not over; 9 is.
    const d = clampRunsNew();
    for (let i = 0; i < M_CLAMP_QUARTERS; i++) clampRunsAddQuarter(d, [M_MAX]);
    expect(d.over).toEqual([false]);
    clampRunsAddQuarter(d, [M_MAX]);
    expect(d.over).toEqual([true]);
    expect(atClamp(M_MIN) && atClamp(M_MAX) && !atClamp(M_MIN + 1e-6)).toBe(true);
  });

  it("waived_industries_are_reported_apart", () => {
    // Industry 1 is waived (D366): its 12-quarter run is its own; the others' longest is 4.
    const waived = [false, true, false];
    const c: ClampRuns = clampRunsNew();
    for (let q = 0; q < 12; q++) {
      const zero = q >= 8 ? M_MIN : 1.0;
      clampRunsAddQuarter(c, [zero, M_MAX, 1.0]);
    }
    expect(clampRunsCurrentMax(c, waived, true)).toBe(12);
    expect(clampRunsCurrentMax(c, waived, false)).toBe(4);
    expect(c.max_run).toBe(12);
    // With no waiver list nothing is waived.
    const d = clampRunsNew();
    clampRunsAddQuarter(d, [M_MAX]);
    expect([clampRunsCurrentMax(d, [], false), clampRunsCurrentMax(d, [], true)]).toEqual([1, 0]);
    expect(bandStats([0.6, 1.0, 1.4], 0.3)).toEqual([0.6, 1.4, 2]);
    // D368: the waived industry's revenue ratio (0.6) leaves the judged figures and is reported
    // on its own; all of them still count in the plain columns.
    const ratios = [0.9, 0.6, 1.2];
    expect(bandStats(ratios, 0.3)).toEqual([0.6, 1.2, 1]);
    expect(bandStatsWhere(ratios, 0.3, waived, false)).toEqual([0.9, 1.2, 0]);
    expect(bandStatsWhere(ratios, 0.3, waived, true)).toEqual([0.6, 0.6, 1]);
    expect(bandStatsWhere(ratios, 0.3, [], true)).toEqual([1.0, 1.0, 0]);
    expect(bandStatsWhere(ratios, 0.3, [], false)).toEqual([0.6, 1.2, 1]);
  });

  it("a_month_counts_the_labels_in_force_before_its_close", () => {
    const fig = (label: MonthFigures["label"]): MonthFigures => ({
      label,
      revenue: 10.0,
      trend_demand: 120.0,
      demand: 96.0,
    });
    // Load labels Boom and Normal; the January close sets Bust and Boom for February.
    const labels: MonthFigures["label"][] = ["Boom", "Normal"];
    const q = quarterAccNew();
    quarterAccAddMonth(q, labels, [fig("Bust"), fig("Boom")]);
    expect([q.industry_months, q.boom_months, q.bust_months]).toEqual([2, 1, 0]);
    expect(labels).toEqual(["Bust", "Boom"]);
    // February ran under Bust and Boom, whatever its close sets.
    quarterAccAddMonth(q, labels, [fig("Normal"), fig("Normal")]);
    expect([q.industry_months, q.boom_months, q.bust_months]).toEqual([4, 2, 1]);
    // Revenue against a twelfth of trend demand: 20 over 2 x 10.
    expect(q.revenue).toEqual([20.0, 20.0]);
    expect(q.trend).toEqual([20.0, 20.0]);
    // And against a twelfth of effective demand (D363): 2 x 8.
    expect(q.demand).toEqual([16.0, 16.0]);
  });

  it("cast_sizes_give_max_of_partials_and_open_seats", () => {
    // 5.19.4 placement with five open seats: the lead founder is CEO and the others take seats;
    // partials fill the seats left in order, then sit as directors; fillers take the rest. A
    // sixth founder (outside the spec's 1 to 5) would be an unseated director.
    const SEATS = 5;
    for (let founders = 1; founders <= 6; founders++) {
      for (let partials = 0; partials <= 7; partials++) {
        const seated = Math.min(founders, SEATS);
        const partialSeats = Math.min(partials, SEATS - seated);
        const simpleSeats = SEATS - seated;
        const directors = founders - seated + (partials - partialSeats);
        const [full, simple] = castSizes(founders, seated, simpleSeats, directors);
        expect(full).toBe(founders);
        expect(simple, `${founders} ${partials}`).toBe(Math.max(partials, SEATS - seated));
      }
    }
  });

  it("headers_have_no_spaces_or_duplicates", () => {
    for (const h of [YEARS_HEADER, QUARTERS_HEADER]) {
      const cols = h.split(",");
      expect(
        cols.every((c) => c !== "" && !c.includes(" ")),
        h,
      ).toBe(true);
      expect(new Set(cols).size, h).toBe(cols.length);
    }
  });

  it("headers_match_the_rust_reference_files", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const ref = join(import.meta.dirname, "..", "..", "..", "test", "fixtures", "rust-reference");
    const first = (f: string): string => readFileSync(join(ref, f), "utf8").split(/\r?\n/)[0] as string;
    expect(YEARS_HEADER).toBe(first("years.csv"));
    expect(QUARTERS_HEADER).toBe(first("quarters.csv"));
  });

  it("ratings_read_the_band_of_their_notch_and_band_counts_skip_frozen", () => {
    expect(ratingBand("AaMinus")).toBe("Aa");
    expect(ratingBand("BMinus")).toBe("B");
    expect(ratingBand("Cc")).toBe("Cc");
    const counts = bandCounts([
      { rating: "Aaa", status: "Active" },
      { rating: "AaPlus", status: "Distressed" },
      { rating: "Aa", status: "Bankrupt" },
      { rating: "Cc", status: "Removed" },
    ]);
    expect(counts.map(([, n]) => n)).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);
    expect(quarterLabel({ year: 2019, q: 4 })).toBe("2019Q4");
  });

  it("run_seed_writes_one_row_per_year_and_quarter_with_the_header_width", () => {
    const widthY = YEARS_HEADER.split(",").length;
    const widthQ = QUARTERS_HEADER.split(",").length;
    const stub = new StubSim();
    const res = runSeed(() => ({ ok: true, value: stub as unknown as SoakSimApi }), {} as never, 7, 1);
    if (!res.ok) throw new Error(res.error);
    const out = res.value;
    expect(out.ticks).toBe(366 * 24);
    const years = out.years.split("\n").filter((l) => l !== "");
    const quarters = out.quarters.split("\n").filter((l) => l !== "");
    expect(years.length).toBe(1);
    expect(quarters.length).toBe(4);
    expect((years[0] as string).split(",").length).toBe(widthY);
    for (const q of quarters) expect(q.split(",").length).toBe(widthQ);
    expect((years[0] as string).startsWith("7,2020,8784,")).toBe(true);
    expect(out.max_shares_out).toBe(5_000);
    expect(sharesOutCsv([out])).toBe("seed,max_shares_out\n7,5000\n");
    expect(out.end).toBe("2021-01-01 00:00");
  });

  it("run_seed_reports_a_load_error_as_text", () => {
    const res = runSeed(
      () => ({ ok: false, error: { kind: "Duplicate", table: "companies", key: "x" } }),
      {} as never,
      1,
      1,
    );
    expect(res).toEqual({ ok: false, error: "companies: id `x` appears twice" });
  });
});

/**
 * A minimal sim: one industry, two companies, one tick per hour from 2020-01-01 00:00, with the
 * notices the recorder reads (DayDone, MonthDone, EarningsReleased).
 */
class StubSim {
  private hours = 0;
  private readonly daysIn = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  step(): Notice[] {
    this.hours += 1;
    const out: Notice[] = [];
    if (this.hours % 24 === 0) {
      const day = this.hours / 24; // days elapsed
      out.push({ kind: "DayDone", date: { year: 2020, month: 1, day: 1 } });
      let acc = 0;
      this.daysIn.forEach((d, m) => {
        acc += d;
        if (day === acc) out.push({ kind: "MonthDone", month: { year: 2020, month: m + 1 } });
      });
    }
    out.push({ kind: "TickDone", time: this.hours });
    return out;
  }
  now(): number {
    return this.hours;
  }
  stateHash(): string {
    return "00";
  }
  soakStats(): SoakStats {
    return {
      line_drawn_usd: 0,
      profitable_companies: 1,
      mean_productivity: 100,
      median_productivity: 100,
      data_tb: 1,
      industries: [{ named_revenue_m: 1, fringe_revenue_m: 1, supply_ratio: 1, market_factor: 1 }],
    };
  }
  views(): SimViews {
    const v = (data: unknown) => ({ data, version: 0, dirty: false });
    return {
      industry_rows: v({
        rows: [{ key: "cloud", phase_label: "Normal", demand: 120, trend_demand: 120 }],
      }),
      company_detail: v({
        companies: [
          {
            id: 0,
            status: "Active",
            origin: { kind: "Start" },
            board: [],
            management_score: 50,
            shares_out: 5_000,
          },
          {
            id: 1,
            status: "Distressed",
            origin: { kind: "Start" },
            board: [],
            management_score: 50,
            shares_out: 10,
          },
        ],
      }),
      market_stats: v({
        quoted: 1,
        within_band: 1,
        median_gap: 0.1,
        mean_confidence: 5,
        reports: 0,
        beats: 0,
        misses: 0,
      }),
      quotes: v({ rows: [], indices: [] }),
      exchanges: v({ exchanges: [] }),
      births: v({ events: [], births: [], listings: [], full_characters_made: 0, full_characters: 296 }),
      ratings: v({ companies: [{ rating: "A", status: "Active", bankrupt_on: null, removed_on: null }] }),
      cycle: v({ phase: "Expansion", g_t: 0.01 }),
    } as unknown as SimViews;
  }
}
