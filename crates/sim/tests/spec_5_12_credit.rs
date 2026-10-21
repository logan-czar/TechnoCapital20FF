//! Spec 5.12 credit line (10.0.9; C9, C10, C23) and the 5.1.2 home spread: build-plan M4.4, with
//! the Chilean company's 312 bps home spread from the CSV numbers.

mod finance_common;

use finance_common::{BASE_RATE, assert_close, data, facts, finance_start};
use sim::finance::credit::{
    CreditLine, EXCESS_REPAY_MONTHS, auto_draw, excess_instalment, home_spread, line_limit,
    line_rate, min_cash, monthly_charges, own_cash, plan_repay, review_line,
};
use sim::finance::rating::Rating;

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
fn design_fix_221_starting_lines_over_their_limit() {
    // Pinned until Logan decides design fix 221: with the 7.1 starting lines and the 5.12
    // limit, 231 of the 302 companies that start with a drawn line are over their own limit at
    // load, among them all 63 rated CCC or CC (rating factor 0, so a limit of 0); $798B over in
    // all, and 215 cannot repay the excess from cash. If a fix lands, update these numbers.
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
            assert_eq!(limit, 0.0, "{}", row.id());
        }
        if drawn > limit {
            over += 1;
            excess += drawn - limit;
            if f.start.cash_usd < drawn - limit {
                short_of_cash += 1;
            }
        }
    }
    assert_eq!(with_line, 302);
    assert_eq!(over, 231);
    assert_eq!(ccc_or_cc, 63);
    assert_eq!(short_of_cash, 215);
    assert!(
        (excess / 1.0e9 - 798.25).abs() < 0.01,
        "excess ${}B",
        excess / 1.0e9
    );
}
