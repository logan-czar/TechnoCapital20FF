//! Spec 5.12 credit line (10.0.9; C9, C10, C23) and the 5.1.2 home spread: build-plan M4.4, with
//! the Chilean company's 312 bps home spread from the CSV numbers.

mod finance_common;

use finance_common::{
    BASE_RATE, CompanyFacts, FixtureRow, assert_close, data, facts, finance_start,
};
use sim::finance::credit::{
    CreditLine, EXCESS_REPAY_MONTHS, auto_draw, excess_instalment, home_spread, line_limit,
    line_rate, min_cash, monthly_charges, own_cash, plan_repay, review_line,
};
use sim::finance::rating::{Rating, StartRatingInputs, starting_rating};

fn bps(x: f64) -> f64 {
    (x * 10_000.0 * 1e6).round() / 1e6
}

#[track_caller]
fn near(a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-9 * a.abs().max(b.abs()).max(1.0),
        "{a} vs {b}"
    );
}

#[test]
fn a_chilean_company_pays_a_312_bps_home_spread() {
    // 5.1.2 (batch 156): home spread = 0.5 × zone credit_spread + 0.5 × sovereign spread,
    // rounded: a Chilean company pays (591 + 32) ÷ 2 = 312 bps, from financial-zones.csv (AR 591)
    // and country-economy.csv (CHL 32).
    let d = data();
    let f = facts(&d, "CO-0179"); // Andes Cobre, Santiago
    assert_eq!(f.company.hq_country, "CHL");
    assert_eq!(f.zone.zone_id, "AR");
    assert_eq!(f.zone.credit_spread_bps, 591.0);
    assert_eq!(f.economy.sovereign_spread_bps, 32.0);
    assert_eq!(
        bps(home_spread(f.zone_spread(), f.sovereign_spread())),
        312.0
    );
    // "instead of 591 or 32"
    assert_ne!(
        bps(home_spread(f.zone_spread(), f.sovereign_spread())),
        591.0
    );
}

#[test]
fn home_spreads_from_the_spec_and_csv() {
    let d = data();
    let country = |iso: &str| {
        let e = d
            .country_economy
            .rows
            .iter()
            .find(|e| e.iso3 == iso)
            .unwrap();
        let z = d
            .financial_zones
            .rows
            .iter()
            .find(|z| z.zone_id == e.financial_zone)
            .unwrap();
        home_spread(
            z.credit_spread_bps / 10_000.0,
            e.sovereign_spread_bps / 10_000.0,
        )
    };
    // A German one (78 + 0) ÷ 2 = 39.
    assert_eq!(bps(country("DEU")), 39.0);
    // A Greek one half the EU zone's 78 plus half of Greece's own 1,000.
    assert_eq!(bps(country("GRC")), 539.0);
    // Argentina (591 + 1,000) ÷ 2 = 795.5, to 796.
    assert_eq!(bps(country("ARG")), 796.0);
    // The US: (1 + 0) ÷ 2 = 0.5 rounds half away from zero, to 1, as D109 rounds the effective
    // zone spread (D223).
    assert_eq!(bps(country("USA")), 1.0);
    // The effective zone spread is what home spread reads (batch 157): the EU at 112 bps in a
    // mid Contraction gives (112 + 0) ÷ 2 = 56 for Germany.
    assert_eq!(bps(home_spread(0.0112, 0.0)), 56.0);
}

#[test]
fn rate_is_base_plus_home_plus_rating_spread() {
    // 5.12: base_rate + home_spread + corporate spread(rating); no +1.0 (C9).
    near(
        line_rate(BASE_RATE, 0.0312, Rating::A),
        0.03 + 0.0312 + 0.0090,
    );
    near(
        line_rate(BASE_RATE, 0.0039, Rating::Aaa),
        0.03 + 0.0039 + 0.0040,
    );
    near(line_rate(BASE_RATE, 0.0, Rating::Cc), 0.03 + 0.16);
    near(line_rate(BASE_RATE, 0.0, Rating::Bb), 0.03 + 0.028);
}

#[test]
fn limit_counts_half_the_book_and_own_cash() {
    // 5.12: max(0, 0.5 × asset_book + own cash) × rating_factor; own cash = cash − line_drawn,
    // floored at 0 (C10).
    near(
        line_limit(100.0e6, 30.0e6, 10.0e6, Rating::Bbb),
        70.0e6 * 0.65,
    );
    near(line_limit(100.0e6, 5.0e6, 10.0e6, Rating::A), 50.0e6 * 0.8);
    near(line_limit(100.0e6, 30.0e6, 0.0, Rating::Aaa), 80.0e6);
    near(line_limit(100.0e6, 30.0e6, 0.0, Rating::BbPlus), 40.0e6);
    near(line_limit(100.0e6, 30.0e6, 0.0, Rating::BbMinus), 40.0e6);
    assert_eq!(line_limit(100.0e6, 30.0e6, 0.0, Rating::Ccc), 0.0);
    assert_eq!(line_limit(100.0e6, 30.0e6, 0.0, Rating::Cc), 0.0);
    assert_eq!(line_limit(0.0, 0.0, 10.0e6, Rating::Aaa), 0.0);
    // C10: drawing does not raise its own limit.
    let before = line_limit(100.0e6, 30.0e6, 10.0e6, Rating::A);
    let after = line_limit(100.0e6, 30.0e6 + 15.0e6, 10.0e6 + 15.0e6, Rating::A);
    near(before, after);
    assert_eq!(own_cash(5.0, 10.0), 0.0);
    assert_eq!(own_cash(15.0, 10.0), 5.0);
}

#[test]
fn monthly_interest_fee_and_cash_interest() {
    // 5.12 Monthly: interest = drawn × rate ÷ 12; undrawn fee = (limit − drawn) × 0.25% ÷ 12;
    // interest on own cash = own cash × (base_rate − 0.25%) ÷ 12.
    let c = monthly_charges(12.0e6, 24.0e6, 36.0e6, 0.06, BASE_RATE);
    near(c.interest, 12.0e6 * 0.06 / 12.0);
    near(c.undrawn_fee, 12.0e6 * 0.0025 / 12.0);
    near(c.cash_interest, 24.0e6 * 0.0275 / 12.0);
    // Over the limit: no undrawn fee; cash below the line: no cash interest.
    let c = monthly_charges(30.0e6, 24.0e6, 10.0e6, 0.06, BASE_RATE);
    assert_eq!((c.undrawn_fee, c.cash_interest), (0.0, 0.0));
    near(c.interest, 30.0e6 * 0.06 / 12.0);
    // No line: only cash interest, and the fee on the whole limit.
    let c = monthly_charges(0.0, 8.0e6, 80.4e6, 0.034, BASE_RATE);
    assert_eq!(c.interest, 0.0);
    near(c.undrawn_fee, 8.0e6 * 0.0025 / 12.0);
    near(c.cash_interest, 80.4e6 * 0.0275 / 12.0);
}

#[test]
fn auto_draw_covers_the_shortfall_up_to_the_limit() {
    let line = CreditLine {
        drawn: 7.0e6,
        limit: 10.0e6,
        excess_months_left: 0,
    };
    assert_eq!(auto_draw(-2.0e6, &line), 2.0e6);
    assert_eq!(auto_draw(-5.0e6, &line), 3.0e6, "up to the limit");
    assert_eq!(auto_draw(0.0, &line), 0.0);
    assert_eq!(auto_draw(1.0e6, &line), 0.0);
    let full = CreditLine {
        drawn: 10.0e6,
        ..line
    };
    assert_eq!(auto_draw(-1.0e6, &full), 0.0);
}

#[test]
fn auto_repay_follows_the_plan() {
    // 6 min_cash: 5% of trailing annual revenue.
    assert_eq!(min_cash(40.0e6), 2.0e6);
    assert_eq!(min_cash(0.0), 0.0);
    // 6.5: own cash above 2 × min_cash and line drawn: repay min(drawn, own cash − 1.5 × min).
    let m = 1.0e6;
    assert_eq!(plan_repay(10.0e6, 4.0e6, m), 4.0e6, "own 6M: all of the 4M");
    assert_eq!(plan_repay(12.0e6, 9.0e6, m), 1.5e6, "own 3M: 3M − 1.5M");
    assert_eq!(
        plan_repay(11.0e6, 9.0e6, m),
        0.0,
        "own 2M is not above 2 × min"
    );
    assert_eq!(plan_repay(10.0e6, 0.0, m), 0.0, "nothing drawn");
    assert_eq!(plan_repay(5.0e6, 9.0e6, m), 0.0, "no own cash");
    // min_cash 0 (no revenue, D226): any own cash repays.
    assert_eq!(plan_repay(3.0e6, 1.0e6, 0.0), 1.0e6);
}

#[test]
fn review_gives_three_months_to_repay_the_excess() {
    // 5.12 review: limit recomputed; a company over its new limit repays the excess within 3
    // months (10.0.9), in even instalments of what is left (D224).
    let line = CreditLine {
        drawn: 90.0e6,
        limit: 100.0e6,
        excess_months_left: 0,
    };
    let mut l = review_line(line, 60.0e6);
    assert_eq!(l.limit, 60.0e6);
    assert_eq!(l.excess(), 30.0e6);
    assert_eq!(l.excess_months_left, EXCESS_REPAY_MONTHS);
    let mut paid = Vec::new();
    for _ in 0..3 {
        let p = excess_instalment(&l);
        paid.push(p);
        l.drawn -= p;
        l.excess_months_left -= 1;
    }
    assert_eq!(paid, vec![10.0e6, 10.0e6, 10.0e6]);
    assert_eq!(l.excess(), 0.0);
    // Within the limit: no window.
    let ok = review_line(line, 95.0e6);
    assert_eq!((ok.excess(), ok.excess_months_left), (0.0, 0));
    assert_eq!(ok.available(), 5.0e6);
    // A window past its months is overdue: the instalment is all of it.
    let overdue = CreditLine {
        drawn: 70.0e6,
        limit: 60.0e6,
        excess_months_left: 0,
    };
    assert!(overdue.excess_overdue());
    assert_eq!(excess_instalment(&overdue), 10.0e6);
}

#[test]
fn starting_limits_match_the_python_export_for_all_651() {
    // 5.12 limit at load: (0.5 × asset_book + own cash) × rating_factor(starting rating), with
    // the balances from company-start.csv and the starting rating that spec_5_12_rating checks
    // against the same fixture; the expected limit is the independent Python export's.
    let d = data();
    for row in finance_start() {
        let f = facts(&d, row.id());
        let limit = line_limit(
            f.start.asset_book_usd,
            f.start.cash_usd,
            f.start.credit_drawn_usd,
            row.rating("start_rating"),
        );
        assert_close(&format!("{} limit", row.id()), limit, row.num("limit"));
    }
}

#[test]
fn d15_d16_starting_lines_within_their_limit() {
    // Design fix 221, decided at the M3 gate (D15, D16): with the 7.1 starting lines, 231 of the
    // 302 companies that started with a drawn line were over their own 5.12 limit at load
    // ($798B in all), all 63 rated CCC or CC among them. gen.py now sizes every starting line to
    // its limit at the run-rate EBITDA less 10% (D241): 262 companies start with a line (40 of
    // the 237 cut went to 0), none is over its limit at its starting rating, none rated CCC or CC
    // draws one, so the first review (2 January 2020) opens no repayment window.
    let d = data();
    let (mut with_line, mut over, mut ccc_or_cc, mut short_of_cash) = (0, 0, 0, 0);
    let mut excess = 0.0;
    for row in finance_start() {
        let f = facts(&d, row.id());
        let drawn = f.start.credit_drawn_usd;
        if drawn <= 0.0 {
            continue;
        }
        with_line += 1;
        let rating = row.rating("start_rating");
        let limit = line_limit(f.start.asset_book_usd, f.start.cash_usd, drawn, rating);
        if rating >= Rating::Ccc {
            ccc_or_cc += 1;
        }
        if drawn > limit {
            over += 1;
            excess += drawn - limit;
            if f.start.cash_usd < drawn - limit {
                short_of_cash += 1;
            }
        }
    }
    assert_eq!(with_line, 262);
    assert_eq!(over, 0);
    assert_eq!(ccc_or_cc, 0);
    assert_eq!(short_of_cash, 0);
    assert_eq!(excess, 0.0);
}

/// D241 (T): gen.py sizes the starting lines at the run-rate EBITDA less this share
/// (validate.py `LOAD_LINE_SIZING_MARGIN`).
const LOAD_LINE_SIZING_MARGIN: f64 = 0.10;

/// The 5.12 limit of a starting line `x`, floored to the dollar, at the starting rating `x`
/// would have with the run-rate EBITDA scaled by `k` (the engine's `starting_rating`).
fn limit_at(f: &CompanyFacts<'_>, row: &FixtureRow, x: f64, k: f64) -> f64 {
    let s = f.start;
    let rating = starting_rating(&StartRatingInputs {
        cash: s.cash_usd,
        line_drawn: x,
        ebitda: k * (row.num("ebit") + row.num("depreciation")),
        revenue: row.num("revenue"),
        industry_key: &f.industry.id,
        sovereign: f.sovereign(),
        base_rate: BASE_RATE,
        home_spread: home_spread(f.zone_spread(), f.sovereign_spread()),
    })
    .implied;
    line_limit(s.asset_book_usd, s.cash_usd, x, rating).floor()
}

#[test]
fn d241_starting_lines_hold_with_ebitda_5_percent_lower() {
    // D241: inside the 10% sizing margin, a run rate 5% lower than the Python one (the engine's
    // own lines, a weak first quarter) leaves every starting line within its limit.
    let d = data();
    for row in finance_start() {
        let f = facts(&d, row.id());
        let drawn = f.start.credit_drawn_usd;
        if drawn > 0.0 {
            assert!(
                drawn <= limit_at(&f, &row, drawn, 0.95),
                "{} line {drawn} over its limit at EBITDA x 0.95",
                row.id()
            );
        }
    }
}

#[test]
fn d15_cut_lines_settle_where_the_haircut_iteration_does() {
    // D15 with D241: a line cut below the 7.1 line (asset book − book value + min_cash) is where
    // x = min(7.1 line, limit(x)) at the haircut run rate settles: a fixed point, or the lower
    // line of a two-line cycle (one line just past a band edge, the other its worse band's
    // limit). The twin of validate.py's check, with the engine's rating. The cash the smaller line
    // no longer funds is not added back: cash stays min_cash and book equity rises by the cut.
    let d = data();
    let k = 1.0 - LOAD_LINE_SIZING_MARGIN;
    let (mut cut, mut fixed, mut cycle) = (0, 0, 0);
    for row in finance_start() {
        let f = facts(&d, row.id());
        let book_value = f.company.book_value_usd_m * 1e6;
        let s = f.start;
        if book_value >= s.asset_book_usd {
            continue;
        }
        let line_71 = s.asset_book_usd - book_value + min_cash(f.company.revenue_usd_m * 1e6);
        assert!(
            (s.cash_usd - min_cash(f.company.revenue_usd_m * 1e6)).abs() <= 1.0,
            "{}",
            row.id()
        );
        assert!(
            (s.book_equity_usd - (book_value + line_71 - s.credit_drawn_usd)).abs() <= 2.0,
            "{} book equity",
            row.id()
        );
        let x = s.credit_drawn_usd;
        assert!(
            x <= limit_at(&f, &row, x, k),
            "{} line {x} over its limit at the haircut run rate",
            row.id()
        );
        if x >= line_71 - 2.0 {
            continue;
        }
        cut += 1;
        let l0 = line_71.round();
        let next = l0.min(limit_at(&f, &row, x, k));
        if next == x {
            fixed += 1;
        } else {
            assert!(
                next > x && l0.min(limit_at(&f, &row, next, k)) == x,
                "{} line {x} is neither a fixed point nor the lower line of a cycle",
                row.id()
            );
            cycle += 1;
        }
    }
    assert_eq!((cut, fixed, cycle), (237, 114, 123));
}
