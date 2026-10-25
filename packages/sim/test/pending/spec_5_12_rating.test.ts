// Port of crates/sim/tests/spec_5_12_rating.rs: spec 5.12 implied rating (3.6.3), adjustments,
// sovereign ceiling and review moves (3.6.4); build-plan M4.5: starting ratings match the run
// rate for all 651 companies. The expected ratings are the independent Python export
// (finance-start.csv).
//
// Expects:
//   ../../src/finance/rating.ts  type RatingInputs { net_debt, ebitda, interest, revenue,
//                                industry_key, sovereign }, coverNotches(ebitda, interest),
//                                corporateSpread(r), impliedRating(inputs) -> ImpliedRating,
//                                leverageRating(net_debt, ebitda), notchesBetween(a, b),
//                                ratingFactor(r), ratingLabel(r) [Rating::label],
//                                ratingParse(label) -> Rating | null, reviewMove(from, implied),
//                                sectorNotches(industry_key), sizeNotches(revenue),
//                                sovereignCeiling(r), startingRating(StartRatingInputs)
//   ../../src/finance/credit.ts  homeSpread
//   "@tc20ff/sim-data"           RATING_LABELS, ratingFactorOfLabel
//   Rating is the string union of types/state/finance.ts; Rust order is RATING_VALUES index.
import { RATING_LABELS, ratingFactorOfLabel } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { homeSpread } from "../../src/finance/credit.ts";
import {
  corporateSpread,
  coverNotches,
  impliedRating,
  leverageRating,
  notchesBetween,
  ratingFactor,
  ratingLabel,
  ratingParse,
  reviewMove,
  sectorNotches,
  sizeNotches,
  sovereignCeiling,
  startingRating,
} from "../../src/finance/rating.ts";
import { roundHalfAway } from "../../src/types/num.ts";
import { type ImpliedRating, RATING_VALUES, type Rating } from "../../src/types/state/finance.ts";
import {
  BASE_RATE,
  data,
  facts,
  financeStart,
  sovereign,
  sovereignSpread,
  zoneSpread,
} from "./finance_common/index.ts";

/** Rust derived Ord on Rating: better is smaller. */
function ord(r: Rating): number {
  return RATING_VALUES.indexOf(r);
}

/** Net debt for a ratio x on EBITDA of 100M. */
function lev(x: number): Rating {
  return leverageRating(x * 100.0e6, 100.0e6);
}

describe("spec 5.12 rating", () => {
  it("leverage_table", () => {
    // 5.12: below 0.5 AAA, 0.5 to 1 AA, 1 to 2 A, 2 to 3 BBB, 3 to 4 BB+, 4 to 5 BB-, 5 to 6.5 B,
    // 6.5 to 8 CCC, above 8 CC. Lower edges inclusive, 8 itself CCC (D221).
    const cases: [number, Rating][] = [
      [0.0, "Aaa"],
      [0.49, "Aaa"],
      [0.5, "Aa"],
      [0.99, "Aa"],
      [1.0, "A"],
      [1.99, "A"],
      [2.0, "Bbb"],
      [2.99, "Bbb"],
      [3.0, "BbPlus"],
      [3.99, "BbPlus"],
      [4.0, "BbMinus"],
      [4.99, "BbMinus"],
      [5.0, "B"],
      [6.49, "B"],
      [6.5, "Ccc"],
      [8.0, "Ccc"],
      [8.01, "Cc"],
      [40.0, "Cc"],
    ];
    for (const [x, r] of cases) {
      expect(lev(x), `ratio ${x}`).toBe(r);
    }
  });

  it("leverage_edge_cases", () => {
    // EBITDA negative is CC (5.12); 0 counts as negative (D221).
    expect(leverageRating(50.0e6, -1.0e6)).toBe("Cc");
    expect(leverageRating(50.0e6, 0.0)).toBe("Cc");
    // Net cash with positive EBITDA is AAA, on purpose (D221).
    expect(leverageRating(-50.0e6, 10.0e6)).toBe("Aaa");
    expect(leverageRating(0.0, 10.0e6)).toBe("Aaa");
    // Net cash with negative EBITDA divides to a positive ratio below 0.5 (-50 / -1,000 = 0.05),
    // but must not read as AAA by accident: it is CC.
    expect(leverageRating(-50.0e6, -1000.0e6)).toBe("Cc");
    expect(leverageRating(-50.0e6, 0.0)).toBe("Cc");
  });

  it("adjustment_notches", () => {
    // Interest cover (EBITDA / interest, 3.6.3): above 10 +1, below 3 -1, below 1.5 -2.
    expect(coverNotches(110.0, 10.0)).toBe(1);
    expect(coverNotches(100.0, 10.0), "10 is not above 10").toBe(0);
    expect(coverNotches(30.0, 10.0)).toBe(0);
    expect(coverNotches(29.0, 10.0)).toBe(-1);
    expect(coverNotches(15.0, 10.0), "1.5 is not below 1.5").toBe(-1);
    expect(coverNotches(14.9, 10.0)).toBe(-2);
    expect(coverNotches(-5.0, 10.0)).toBe(-2);
    // No interest (D222): unbounded cover with positive EBITDA, nothing to cover otherwise.
    expect(coverNotches(1.0, 0.0)).toBe(1);
    expect(coverNotches(0.0, 0.0)).toBe(0);
    expect(coverNotches(-1.0, 0.0)).toBe(0);
    // Revenue: above 20B +1, below 500M -1.
    expect(sizeNotches(20.1e9)).toBe(1);
    expect(sizeNotches(20.0e9)).toBe(0);
    expect(sizeNotches(500.0e6)).toBe(0);
    expect(sizeNotches(499.9e6)).toBe(-1);
    // Sector: utilities +1; mining and shipping -1; the ids exist in industries.csv.
    expect(sectorNotches("power_utilities")).toBe(1);
    expect(sectorNotches("mining")).toBe(-1);
    expect(sectorNotches("shipping")).toBe(-1);
    expect(sectorNotches("oil")).toBe(0);
    expect(sectorNotches("renewables")).toBe(0);
    const d = data();
    for (const key of ["power_utilities", "mining", "shipping"]) {
      expect(
        d.industries.rows.some((i) => i.id === key),
        key,
      ).toBe(true);
    }
  });

  it("ceiling_is_sovereign_plus_one_notch", () => {
    expect(sovereignCeiling("Aaa")).toBe("Aaa");
    expect(sovereignCeiling("APlus"), "Chile A+").toBe("AaMinus");
    expect(sovereignCeiling("BbbMinus"), "India BBB-").toBe("Bbb");
    expect(sovereignCeiling("Ccc"), "Greece CCC").toBe("BMinus");
    expect(sovereignCeiling("Cc"), "North Korea CC").toBe("Ccc");
    // Every sovereign rating in country-economy.csv is on the AAA to CC scale.
    for (const e of data().country_economy.rows) {
      expect(ratingParse(e.sovereign_rating) !== null, e.iso3).toBe(true);
    }
  });

  it("implied_rating_sums_adjustments_then_caps", () => {
    // A utility with leverage 1.5 (A), cover 20 (+1), revenue 25B (+1), utility (+1): A + 3
    // notches (A+, AA-, AA) = AA, then capped at a BBB sovereign + 1 = BBB+.
    const i = {
      net_debt: 1.5e9,
      ebitda: 1.0e9,
      interest: 50.0e6,
      revenue: 25.0e9,
      industry_key: "power_utilities",
      sovereign: "Bbb" as Rating,
    };
    const want: ImpliedRating = {
      leverage: "A",
      cover_notches: 1,
      size_notches: 1,
      sector_notches: 1,
      adjusted: "Aa",
      ceiling: "BbbPlus",
      implied: "BbbPlus",
    };
    expect(impliedRating(i)).toEqual(want);
    // Under an AAA sovereign it keeps AA.
    expect(impliedRating({ ...i, sovereign: "Aaa" }).implied).toBe("Aa");
    // A small miner at leverage 7 (CCC), cover 1 (-2), revenue 100M (-1), mining (-1): the sum of
    // -4 clamps at CC, the bottom of the scale.
    const miner = impliedRating({
      net_debt: 7.0e6,
      ebitda: 1.0e6,
      interest: 1.0e6,
      revenue: 100.0e6,
      industry_key: "mining",
      sovereign: "Aaa",
    });
    expect([miner.leverage, miner.implied]).toEqual(["Ccc", "Cc"]);
    // Notches add before clamping: AAA leverage with +1 and -1 stays AAA.
    const r = impliedRating({
      net_debt: 0.0,
      ebitda: 1.0e9,
      interest: 0.0,
      revenue: 100.0e6,
      industry_key: "oil",
      sovereign: "Aaa",
    });
    expect([r.cover_notches, r.size_notches, r.implied]).toEqual([1, -1, "Aaa"]);
  });

  it("review_moves_one_or_two_notches", () => {
    // 5.12 (3.6.4): 1 notch per review toward implied, 2 if 3 or more away.
    expect(reviewMove("Bbb", "Bbb")).toBe("Bbb");
    expect(reviewMove("Bbb", "BbbMinus"), "1 away").toBe("BbbMinus");
    expect(reviewMove("Bbb", "BbPlus"), "2 away: 1 notch").toBe("BbbMinus");
    expect(reviewMove("Bbb", "Bb"), "3 away: 2 notches").toBe("BbPlus");
    expect(reviewMove("Bbb", "APlus"), "3 up: 2 notches").toBe("AMinus");
    expect(reviewMove("Aaa", "Cc")).toBe("Aa");
    expect(reviewMove("Cc", "Aaa")).toBe("BMinus");
    expect(reviewMove("A", "AMinus")).toBe("AMinus");
    expect(notchesBetween("Bbb", "BbPlus")).toBe(-2);
    expect(notchesBetween("Bbb", "A")).toBe(3);
    // Walks to the implied rating and stops there.
    let r: Rating = "Aaa";
    let steps = 0;
    while (r !== "BMinus") {
      r = reviewMove(r, "BMinus");
      steps += 1;
    }
    // AAA to B- is 15 notches: seven moves of 2 (gaps 15 to 3) and one of 1.
    expect(steps).toBe(8);
  });

  it("rating_factor_and_spread_by_band", () => {
    // 5.12 rating factors (T).
    const factors: [Rating, number][] = [
      ["Aaa", 1.0],
      ["Aa", 0.9],
      ["AaPlus", 0.9],
      ["AaMinus", 0.9],
      ["A", 0.8],
      ["Bbb", 0.65],
      ["Bb", 0.5],
      ["BbPlus", 0.5],
      ["BbMinus", 0.5],
      ["B", 0.3],
      ["Ccc", 0.0],
      ["Cc", 0.0],
    ];
    for (const [r, f] of factors) {
      expect(ratingFactor(r), r).toBe(f);
    }
    // 5.12 (3.6.2 5-year spreads) at the flat notches.
    const spreads: [Rating, number][] = [
      ["Aaa", 0.004],
      ["Aa", 0.006],
      ["A", 0.009],
      ["Bbb", 0.015],
      ["Bb", 0.028],
      ["B", 0.045],
      ["Ccc", 0.09],
      ["Cc", 0.16],
    ];
    for (const [r, s] of spreads) {
      expect(corporateSpread(r), r).toBe(s);
    }
    // 3.6.2: a plus notch a third of the way to the better band, a minus a third to the worse
    // (D220).
    const third = (a: number, b: number): number => a + (b - a) / 3.0;
    const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-15;
    expect(near(corporateSpread("BbPlus"), third(0.028, 0.015))).toBe(true);
    expect(near(corporateSpread("BbMinus"), third(0.028, 0.045))).toBe(true);
    expect(near(corporateSpread("AaPlus"), third(0.006, 0.004))).toBe(true);
    expect(near(corporateSpread("BMinus"), third(0.045, 0.09))).toBe(true);
    // Spreads never get better going down the scale.
    for (let i = 0; i + 1 < RATING_VALUES.length; i++) {
      const a = RATING_VALUES[i] as Rating;
      const b = RATING_VALUES[i + 1] as Rating;
      expect(corporateSpread(a) < corporateSpread(b), `${a} ${b}`).toBe(true);
    }
  });

  it("starting_ratings_match_the_run_rate_for_all_651", () => {
    // 7.1: implied rating from the starting run rate, no smoothing. Cash, line, revenue, industry
    // and sovereign come from the CSVs; run-rate EBIT and depreciation from the independent Python
    // export (export_finance_fixtures.py), which also computed the expected rating.
    const d = data();
    const rows = financeStart();
    expect(rows.length).toBe(651);
    expect(d.companies.rows.length).toBe(651);
    // BTreeMap<Rating, u32>: a count per rating.
    const byRating = new Map<Rating, number>();
    for (const row of rows) {
      const f = facts(d, row.id());
      const ebitda = row.num("ebit") + row.num("depreciation");
      const home = homeSpread(zoneSpread(f), sovereignSpread(f));
      expect(roundHalfAway(home * 10_000.0), `${row.id()} home spread`).toBe(row.num("home_spread_bps"));
      const r = startingRating({
        cash: f.start.cash_usd,
        line_drawn: f.start.credit_drawn_usd,
        ebitda,
        revenue: row.num("revenue"),
        industry_key: f.industry.id,
        sovereign: sovereign(f),
        base_rate: BASE_RATE,
        home_spread: home,
      });
      expect(r.leverage, `${row.id()} leverage`).toBe(row.rating("leverage_rating"));
      expect(r.implied, `${row.id()} start`).toBe(row.rating("start_rating"));
      // company-start.csv carries the same rating, which its D15 and D16 load checks read.
      expect(ratingParse(f.start.start_rating), `${row.id()} company-start.csv start_rating`).toBe(r.implied);
      expect(ord(r.implied) >= ord(sovereignCeiling(sovereign(f))), row.id()).toBe(true);
      byRating.set(r.implied, (byRating.get(r.implied) ?? 0) + 1);
    }
    let total = 0;
    for (const n of byRating.values()) total += n;
    expect(total).toBe(651);
  });

  it("sim_data_reads_the_same_rating_factors", () => {
    // sim-data load checks (D15, D16) carry their own copy of the 5.12 rating factor table.
    expect(RATING_LABELS.length).toBe(RATING_VALUES.length);
    RATING_LABELS.forEach((label, i) => {
      const r = RATING_VALUES[i] as Rating;
      expect(label).toBe(ratingLabel(r));
      expect(ratingFactorOfLabel(label)).toBe(ratingFactor(r));
    });
  });

  it("a_chilean_miner_is_capped_at_aa_minus", () => {
    // Andes Cobre (CO-0179, Mining, Chile A+): net cash, so AAA leverage; the ceiling is A+ + 1
    // = AA-.
    const d = data();
    const f = facts(d, "CO-0179");
    expect(f.company.hq_country).toBe("CHL");
    expect(sovereign(f)).toBe("APlus");
    expect(f.start.cash_usd > f.start.credit_drawn_usd).toBe(true);
    const r = startingRating({
      cash: f.start.cash_usd,
      line_drawn: f.start.credit_drawn_usd,
      ebitda: 0.07 * 4390.0e6,
      revenue: 4390.0e6,
      industry_key: f.industry.id,
      sovereign: sovereign(f),
      base_rate: BASE_RATE,
      home_spread: 0.0312,
    });
    expect([r.leverage, r.sector_notches, r.implied]).toEqual(["Aaa", -1, "AaMinus"]);
  });
});
