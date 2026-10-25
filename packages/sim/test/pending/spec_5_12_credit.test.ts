// Port of crates/sim/tests/spec_5_12_credit.rs: spec 5.12 credit line (10.0.9; C9, C10, C23) and
// the 5.1.2 home spread: build-plan M4.4, with the Chilean company 312 bps home spread from the
// CSV numbers. The expected limits are the independent Python export (finance-start.csv).
//
// Expects:
//   ../../src/finance/credit.ts  EXCESS_REPAY_MONTHS, autoDraw(shortfall_cash, line),
//                                excessInstalment(line), homeSpread(zone, sovereign),
//                                lineLimit(book, cash, line_drawn, rating), lineRate(base, home,
//                                rating), minCash(revenue), monthlyCharges(drawn, limit, cash,
//                                rate, base) -> { interest, undrawn_fee, cash_interest },
//                                ownCash(cash, drawn), planRepay(cash, drawn, min_cash),
//                                reviewLine(line, new_limit), creditLineExcess(line),
//                                creditLineAvailable(line), creditLineExcessOverdue(line)
//   ../../src/finance/rating.ts  startingRating(StartRatingInputs) -> { implied, ... }
//   ./finance_common/index.ts    the fixture helpers
import { describe, expect, it } from "vitest";
import {
  autoDraw,
  creditLineAvailable,
  creditLineExcess,
  creditLineExcessOverdue,
  EXCESS_REPAY_MONTHS,
  excessInstalment,
  homeSpread,
  lineLimit,
  lineRate,
  minCash,
  monthlyCharges,
  ownCash,
  planRepay,
  reviewLine,
} from "../../src/finance/credit.ts";
import { startingRating } from "../../src/finance/rating.ts";
import { maxF, minF, roundHalfAway } from "../../src/types/num.ts";
import { type CreditLine, RATING_VALUES } from "../../src/types/state/finance.ts";
import {
  assertClose,
  BASE_RATE,
  type CompanyFacts,
  data,
  type FixtureRow,
  facts,
  financeStart,
  sovereign,
  sovereignSpread,
  zoneSpread,
} from "./finance_common/index.ts";

function bps(x: number): number {
  return roundHalfAway(x * 10_000.0 * 1e6) / 1e6;
}

function near(a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-9 * maxF(maxF(Math.abs(a), Math.abs(b)), 1.0), `${a} vs ${b}`).toBe(true);
}

describe("spec 5.12 credit line", () => {
  it("a_chilean_company_pays_a_312_bps_home_spread", () => {
    // 5.1.2 (batch 156): home spread = 0.5 x zone credit_spread + 0.5 x sovereign spread,
    // rounded: a Chilean company pays (591 + 32) / 2 = 312 bps, from financial-zones.csv (AR 591)
    // and country-economy.csv (CHL 32).
    const d = data();
    const f = facts(d, "CO-0179"); // Andes Cobre, Santiago
    expect(f.company.hq_country).toBe("CHL");
    expect(f.zone.zone_id).toBe("AR");
    expect(f.zone.credit_spread_bps).toBe(591.0);
    expect(f.economy.sovereign_spread_bps).toBe(32.0);
    expect(bps(homeSpread(zoneSpread(f), sovereignSpread(f)))).toBe(312.0);
    // "instead of 591 or 32"
    expect(bps(homeSpread(zoneSpread(f), sovereignSpread(f)))).not.toBe(591.0);
  });

  it("home_spreads_from_the_spec_and_csv", () => {
    const d = data();
    const country = (iso: string): number => {
      const e = d.country_economy.rows.find((x) => x.iso3 === iso);
      if (e === undefined) throw new Error(`no economy row ${iso}`);
      const z = d.financial_zones.rows.find((x) => x.zone_id === e.financial_zone);
      if (z === undefined) throw new Error(`no zone ${e.financial_zone}`);
      return homeSpread(z.credit_spread_bps / 10_000.0, e.sovereign_spread_bps / 10_000.0);
    };
    // A German one (78 + 0) / 2 = 39.
    expect(bps(country("DEU"))).toBe(39.0);
    // A Greek one half the EU zone 78 plus half of Greece own 1,000.
    expect(bps(country("GRC"))).toBe(539.0);
    // Argentina (591 + 1,000) / 2 = 795.5, to 796.
    expect(bps(country("ARG"))).toBe(796.0);
    // The US: (1 + 0) / 2 = 0.5 rounds half away from zero, to 1, as D109 rounds the effective
    // zone spread (D223).
    expect(bps(country("USA"))).toBe(1.0);
    // The effective zone spread is what home spread reads (batch 157): the EU at 112 bps in a
    // mid Contraction gives (112 + 0) / 2 = 56 for Germany.
    expect(bps(homeSpread(0.0112, 0.0))).toBe(56.0);
  });

  it("rate_is_base_plus_home_plus_rating_spread", () => {
    // 5.12: base_rate + home_spread + corporate spread(rating); no +1.0 (C9).
    near(lineRate(BASE_RATE, 0.0312, "A"), 0.03 + 0.0312 + 0.009);
    near(lineRate(BASE_RATE, 0.0039, "Aaa"), 0.03 + 0.0039 + 0.004);
    near(lineRate(BASE_RATE, 0.0, "Cc"), 0.03 + 0.16);
    near(lineRate(BASE_RATE, 0.0, "Bb"), 0.03 + 0.028);
  });

  it("limit_counts_half_the_book_and_own_cash", () => {
    // 5.12: max(0, 0.5 x asset_book + own cash) x rating_factor; own cash = cash - line_drawn,
    // floored at 0 (C10).
    near(lineLimit(100.0e6, 30.0e6, 10.0e6, "Bbb"), 70.0e6 * 0.65);
    near(lineLimit(100.0e6, 5.0e6, 10.0e6, "A"), 50.0e6 * 0.8);
    near(lineLimit(100.0e6, 30.0e6, 0.0, "Aaa"), 80.0e6);
    near(lineLimit(100.0e6, 30.0e6, 0.0, "BbPlus"), 40.0e6);
    near(lineLimit(100.0e6, 30.0e6, 0.0, "BbMinus"), 40.0e6);
    expect(lineLimit(100.0e6, 30.0e6, 0.0, "Ccc")).toBe(0.0);
    expect(lineLimit(100.0e6, 30.0e6, 0.0, "Cc")).toBe(0.0);
    expect(lineLimit(0.0, 0.0, 10.0e6, "Aaa")).toBe(0.0);
    // C10: drawing does not raise its own limit.
    const before = lineLimit(100.0e6, 30.0e6, 10.0e6, "A");
    const after = lineLimit(100.0e6, 30.0e6 + 15.0e6, 10.0e6 + 15.0e6, "A");
    near(before, after);
    expect(ownCash(5.0, 10.0)).toBe(0.0);
    expect(ownCash(15.0, 10.0)).toBe(5.0);
  });

  it("monthly_interest_fee_and_cash_interest", () => {
    // 5.12 Monthly: interest = drawn x rate / 12; undrawn fee = (limit - drawn) x 0.25% / 12;
    // interest on own cash = own cash x (base_rate - 0.25%) / 12.
    let c = monthlyCharges(12.0e6, 24.0e6, 36.0e6, 0.06, BASE_RATE);
    near(c.interest, (12.0e6 * 0.06) / 12.0);
    near(c.undrawn_fee, (12.0e6 * 0.0025) / 12.0);
    near(c.cash_interest, (24.0e6 * 0.0275) / 12.0);
    // Over the limit: no undrawn fee; cash below the line: no cash interest.
    c = monthlyCharges(30.0e6, 24.0e6, 10.0e6, 0.06, BASE_RATE);
    expect([c.undrawn_fee, c.cash_interest]).toEqual([0.0, 0.0]);
    near(c.interest, (30.0e6 * 0.06) / 12.0);
    // No line: only cash interest, and the fee on the whole limit.
    c = monthlyCharges(0.0, 8.0e6, 80.4e6, 0.034, BASE_RATE);
    expect(c.interest).toBe(0.0);
    near(c.undrawn_fee, (8.0e6 * 0.0025) / 12.0);
    near(c.cash_interest, (80.4e6 * 0.0275) / 12.0);
  });

  it("auto_draw_covers_the_shortfall_up_to_the_limit", () => {
    const line: CreditLine = { drawn: 7.0e6, limit: 10.0e6, excess_months_left: 0 };
    expect(autoDraw(-2.0e6, line)).toBe(2.0e6);
    expect(autoDraw(-5.0e6, line), "up to the limit").toBe(3.0e6);
    expect(autoDraw(0.0, line)).toBe(0.0);
    expect(autoDraw(1.0e6, line)).toBe(0.0);
    const full: CreditLine = { ...line, drawn: 10.0e6 };
    expect(autoDraw(-1.0e6, full)).toBe(0.0);
  });

  it("auto_repay_follows_the_plan", () => {
    // 6 min_cash: 5% of trailing annual revenue.
    expect(minCash(40.0e6)).toBe(2.0e6);
    expect(minCash(0.0)).toBe(0.0);
    // 6.5: own cash above 2 x min_cash and line drawn: repay min(drawn, own cash - 1.5 x min).
    const m = 1.0e6;
    expect(planRepay(10.0e6, 4.0e6, m), "own 6M: all of the 4M").toBe(4.0e6);
    expect(planRepay(12.0e6, 9.0e6, m), "own 3M: 3M - 1.5M").toBe(1.5e6);
    expect(planRepay(11.0e6, 9.0e6, m), "own 2M is not above 2 x min").toBe(0.0);
    expect(planRepay(10.0e6, 0.0, m), "nothing drawn").toBe(0.0);
    expect(planRepay(5.0e6, 9.0e6, m), "no own cash").toBe(0.0);
    // min_cash 0 (no revenue, D226): any own cash repays.
    expect(planRepay(3.0e6, 1.0e6, 0.0)).toBe(1.0e6);
  });

  it("review_gives_three_months_to_repay_the_excess", () => {
    // 5.12 review: limit recomputed; a company over its new limit repays the excess within 3
    // months (10.0.9), in even instalments of what is left (D224).
    const line: CreditLine = { drawn: 90.0e6, limit: 100.0e6, excess_months_left: 0 };
    const l = reviewLine(line, 60.0e6);
    expect(l.limit).toBe(60.0e6);
    expect(creditLineExcess(l)).toBe(30.0e6);
    expect(l.excess_months_left).toBe(EXCESS_REPAY_MONTHS);
    const paid: number[] = [];
    for (let i = 0; i < 3; i++) {
      const p = excessInstalment(l);
      paid.push(p);
      l.drawn -= p;
      l.excess_months_left -= 1;
    }
    expect(paid).toEqual([10.0e6, 10.0e6, 10.0e6]);
    expect(creditLineExcess(l)).toBe(0.0);
    // Within the limit: no window.
    const ok = reviewLine(line, 95.0e6);
    expect([creditLineExcess(ok), ok.excess_months_left]).toEqual([0.0, 0]);
    expect(creditLineAvailable(ok)).toBe(5.0e6);
    // A window past its months is overdue: the instalment is all of it.
    const overdue: CreditLine = { drawn: 70.0e6, limit: 60.0e6, excess_months_left: 0 };
    expect(creditLineExcessOverdue(overdue)).toBe(true);
    expect(excessInstalment(overdue)).toBe(10.0e6);
  });

  it("starting_limits_match_the_python_export_for_all_651", () => {
    // 5.12 limit at load: (0.5 x asset_book + own cash) x rating_factor(starting rating), with the
    // balances from company-start.csv and the starting rating that spec_5_12_rating checks against
    // the same fixture; the expected limit is the independent Python export.
    const d = data();
    for (const row of financeStart()) {
      const f = facts(d, row.id());
      const limit = lineLimit(
        f.start.asset_book_usd,
        f.start.cash_usd,
        f.start.credit_drawn_usd,
        row.rating("start_rating"),
      );
      assertClose(`${row.id()} limit`, limit, row.num("limit"));
    }
  });

  it("d15_d16_starting_lines_within_their_limit", () => {
    // Design fix 221, decided at the M3 gate (D15, D16): with the 7.1 starting lines, 231 of the
    // 302 companies that started with a drawn line were over their own 5.12 limit at load
    // (798 billion dollars in all), all 63 rated CCC or CC among them. gen.py now sizes every
    // starting line to its limit at the run-rate EBITDA less 10% (D241): 262 companies start with
    // a line (40 of the 237 cut went to 0), none is over its limit at its starting rating, none
    // rated CCC or CC draws one, so the first review (2 January 2020) opens no repayment window.
    const d = data();
    let withLine = 0;
    let over = 0;
    let cccOrCc = 0;
    let shortOfCash = 0;
    let excess = 0.0;
    const ccc = RATING_VALUES.indexOf("Ccc");
    for (const row of financeStart()) {
      const f = facts(d, row.id());
      const drawn = f.start.credit_drawn_usd;
      if (drawn <= 0.0) continue;
      withLine += 1;
      const rating = row.rating("start_rating");
      const limit = lineLimit(f.start.asset_book_usd, f.start.cash_usd, drawn, rating);
      if (RATING_VALUES.indexOf(rating) >= ccc) cccOrCc += 1;
      if (drawn > limit) {
        over += 1;
        excess += drawn - limit;
        if (f.start.cash_usd < drawn - limit) shortOfCash += 1;
      }
    }
    expect(withLine).toBe(262);
    expect(over).toBe(0);
    expect(cccOrCc).toBe(0);
    expect(shortOfCash).toBe(0);
    expect(excess).toBe(0.0);
  });
});

/**
 * D241 (T): gen.py sizes the starting lines at the run-rate EBITDA less this share (validate.py
 * LOAD_LINE_SIZING_MARGIN).
 */
const LOAD_LINE_SIZING_MARGIN = 0.1;

/**
 * The 5.12 limit of a starting line x, floored to the dollar, at the starting rating x would have
 * with the run-rate EBITDA scaled by k (the engine starting_rating).
 */
function limitAt(f: CompanyFacts, row: FixtureRow, x: number, k: number): number {
  const s = f.start;
  const rating = startingRating({
    cash: s.cash_usd,
    line_drawn: x,
    ebitda: k * (row.num("ebit") + row.num("depreciation")),
    revenue: row.num("revenue"),
    industry_key: f.industry.id,
    sovereign: sovereign(f),
    base_rate: BASE_RATE,
    home_spread: homeSpread(zoneSpread(f), sovereignSpread(f)),
  }).implied;
  return Math.floor(lineLimit(s.asset_book_usd, s.cash_usd, x, rating));
}

describe("spec 5.12 starting lines (D241)", () => {
  it("d241_starting_lines_hold_with_ebitda_5_percent_lower", () => {
    // D241: inside the 10% sizing margin, a run rate 5% lower than the Python one (the engine
    // own lines, a weak first quarter) leaves every starting line within its limit.
    const d = data();
    for (const row of financeStart()) {
      const f = facts(d, row.id());
      const drawn = f.start.credit_drawn_usd;
      if (drawn > 0.0) {
        expect(
          drawn <= limitAt(f, row, drawn, 0.95),
          `${row.id()} line ${drawn} over its limit at EBITDA x 0.95`,
        ).toBe(true);
      }
    }
  });

  it("d15_cut_lines_settle_where_the_haircut_iteration_does", () => {
    // D15 with D241: a line cut below the 7.1 line (asset book - book value + min_cash) is where
    // x = min(7.1 line, limit(x)) at the haircut run rate settles: a fixed point, or the lower
    // line of a two-line cycle (one line just past a band edge, the other its worse band limit).
    // The twin of the validate.py check, with the engine rating. The cash the smaller line no
    // longer funds is not added back: cash stays min_cash and book equity rises by the cut.
    const d = data();
    const k = 1.0 - LOAD_LINE_SIZING_MARGIN;
    let cut = 0;
    let fixed = 0;
    let cycle = 0;
    for (const row of financeStart()) {
      const f = facts(d, row.id());
      const bookValue = f.company.book_value_usd_m * 1e6;
      const s = f.start;
      if (bookValue >= s.asset_book_usd) continue;
      const line71 = s.asset_book_usd - bookValue + minCash(f.company.revenue_usd_m * 1e6);
      expect(Math.abs(s.cash_usd - minCash(f.company.revenue_usd_m * 1e6)) <= 1.0, row.id()).toBe(true);
      expect(
        Math.abs(s.book_equity_usd - (bookValue + line71 - s.credit_drawn_usd)) <= 2.0,
        `${row.id()} book equity`,
      ).toBe(true);
      const x = s.credit_drawn_usd;
      expect(x <= limitAt(f, row, x, k), `${row.id()} line ${x} over its limit at the haircut run rate`).toBe(
        true,
      );
      if (x >= line71 - 2.0) continue;
      cut += 1;
      const l0 = roundHalfAway(line71);
      const next = minF(l0, limitAt(f, row, x, k));
      if (next === x) {
        fixed += 1;
      } else {
        expect(
          next > x && minF(l0, limitAt(f, row, next, k)) === x,
          `${row.id()} line ${x} is neither a fixed point nor the lower line of a cycle`,
        ).toBe(true);
        cycle += 1;
      }
    }
    expect([cut, fixed, cycle]).toEqual([237, 114, 123]);
  });
});
