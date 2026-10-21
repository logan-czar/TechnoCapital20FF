//! Build-plan M4.1 against the live engine: the monthly ledger in the 4.3 step order (steps 9
//! to 14). Done line: every line posts once a month.
//!
//! Each line of a posted month is checked against the spec formula written out here, on the
//! World one tick before the monthly job (the month's opening balances) and the unit lines the
//! job computed: step 9 the 5.5 lines, step 11 the 5.10 purchases and depreciation, step 12 the
//! 5.12 charges on the opening balances, step 13 the line movement and step 14 the 5.11 accrual
//! on the month's pre-tax income. Between monthly closes nothing posts.

mod common;

use common::data;
use common::ops::run_to;
use sim::Sim;
use sim::finance::rating::{Band, Rating};
use sim::time::{Date, DateTime};

/// Spec 5.12 corporate spreads by band (3.6.2), with the D220 notch thirds.
fn spec_spread(r: Rating) -> f64 {
    let band = |b: Band| match b {
        Band::Aaa => 0.0040,
        Band::Aa => 0.0060,
        Band::A => 0.0090,
        Band::Bbb => 0.0150,
        Band::Bb => 0.0280,
        Band::B => 0.0450,
        Band::Ccc => 0.0900,
        Band::Cc => 0.1600,
    };
    let order = [
        Band::Aaa,
        Band::Aa,
        Band::A,
        Band::Bbb,
        Band::Bb,
        Band::B,
        Band::Ccc,
        Band::Cc,
    ];
    let b = r.band();
    let i = order.iter().position(|&x| x == b).unwrap();
    let s = band(b);
    let label = r.label();
    if label.ends_with('+') && i > 0 {
        s - (s - band(order[i - 1])) / 3.0
    } else if label.ends_with('-') && i + 1 < order.len() {
        s + (band(order[i + 1]) - s) / 3.0
    } else {
        s
    }
}

#[track_caller]
fn near(what: &str, a: f64, b: f64) {
    assert!(
        (a - b).abs() <= 1e-9 * a.abs().max(b.abs()).max(1.0),
        "{what}: {a} vs {b}"
    );
}

#[test]
fn every_line_posts_once_a_month_in_step_order() {
    let mut sim = Sim::new(data(), 5).unwrap();
    // The tick on the 1st closes the month before: 1 March closes February and 1 May closes
    // April (ordinary months, tax only accrues); 1 April closes March and 1 July 2021 closes
    // June, quarter ends, where the 4.4 close then pays the quarter's tax.
    let mut quarter_ends = 0;
    for (y, m) in [(2020, 3), (2020, 4), (2020, 5), (2021, 2), (2021, 7)] {
        let close = DateTime::midnight(Date::ymd(y, m, 1));
        while sim.now().next() < close {
            sim.step();
        }
        let before = sim.world().clone();
        sim.step();
        let w = sim.world();
        let base = w.base_rate;
        let mut checked = 0;
        for (id, c) in w.companies.iter() {
            let b = &before.companies[id];
            if b.finance.status().is_frozen() {
                continue;
            }
            let posted = c.finance.last_month.unwrap();
            assert_eq!(posted.month, Date::ymd(y, m, 1).month_of().prev());
            let l = &posted.lines;
            let u = &w.units[c.units[0]];
            // Step 9: the 5.5 lines of the unit, as the economy computed them this month.
            near("revenue", l.revenue, u.revenue_m);
            near("variable", l.variable, u.variable_m);
            near("fixed cash", l.fixed_cash, u.fixed_m);
            near("R&D", l.rd, u.rd_m);
            near("shared", l.shared, u.shared_m);
            // Step 11: depreciation is the month's decay off the book, capped at the book
            // (5.5, 5.10), and the purchases buy back the decay at g = 0.
            let bu = &before.units[c.units[0]];
            let p = &w.industries[u.industry].params;
            let decay =
                p.asset_decay * (bu.gross_assets - p.asset_decay_threshold_usd).max(0.0) / 12.0;
            near("depreciation", l.depreciation, decay.min(bu.asset_book));
            let distressed = b.finance.status() != sim::finance::distress::CompanyStatus::Active;
            near(
                "purchases",
                l.asset_purchases,
                if distressed { 0.0 } else { decay },
            );
            // Step 12: interest, fee and cash interest on the opening balances (5.12), at base
            // + home spread (half the zone's effective spread, half the sovereign spread,
            // rounded to whole bps) + the corporate spread of the rating.
            let country = &w.countries[c.hq_country];
            let zone = &w.zones[country.zone];
            let zone_bps = (zone.credit_spread * 1e4).round();
            let sov_bps = (country.sovereign_spread * 1e4).round();
            let home = ((zone_bps + sov_bps) / 2.0).round() / 1e4;
            let rate = base + home + spec_spread(b.finance.rating);
            let drawn = b.finance.line.drawn;
            let own = (b.cash_usd - drawn).max(0.0);
            near("line interest", l.line_interest, drawn * rate / 12.0);
            near(
                "undrawn fee",
                l.line_fee,
                (b.finance.line.limit - drawn).max(0.0) * 0.0025 / 12.0,
            );
            near(
                "interest on cash",
                l.interest_income,
                own * (base - 0.0025) / 12.0,
            );
            // Step 13: the line moved by what the ledger says (5.12 auto-draw and repay).
            near(
                "line drawn or repaid",
                l.line_drawn_or_repaid,
                c.finance.line.drawn - drawn,
            );
            // Step 14: the accrual is the quarter-to-date tax less earlier accruals (5.11, D227),
            // with the HQ country's rate.
            let qtd = b.finance.tax.quarter_pre_tax + l.pre_tax_income();
            let cf = b.finance.tax.carryforward;
            let to_date = (qtd - cf.min(qtd.max(0.0))).max(0.0) * country.corp_tax_rate;
            near("tax accrued", l.tax, to_date - b.finance.tax.accrued);
            // The close pays the quarter's tax on its first day (4.4), else nothing is paid.
            if m == 4 || m == 1 || m == 7 || m == 10 {
                near("tax paid", l.tax_paid, to_date);
                assert_eq!(c.finance.tax.accrued, 0.0);
                quarter_ends += 1;
            } else {
                assert_eq!(l.tax_paid, 0.0);
                near("tax payable", c.finance.tax.accrued, to_date);
            }
            checked += 1;
        }
        assert!(
            checked > 600,
            "{checked} companies checked on {y}-{m:02}-01"
        );
    }
    // Both quarter-end closes ran the tax-paid branch for every company checked.
    assert!(
        quarter_ends > 1200,
        "{quarter_ends} quarter-end company-months checked"
    );
}

#[test]
fn nothing_posts_between_monthly_closes() {
    let mut sim = Sim::new(data(), 6).unwrap();
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let posted: Vec<_> = sim
        .world()
        .companies
        .iter()
        .map(|(_, c)| (c.finance.months.len(), c.finance.last_month, c.cash_usd))
        .collect();
    // Every hour of February (the daily jobs, no release or lock in February): no finance line
    // moves and no month is posted.
    while sim.now() < DateTime::midnight(Date::ymd(2020, 2, 29)) {
        sim.step();
        for ((_, c), p) in sim.world().companies.iter().zip(&posted) {
            assert_eq!(
                (c.finance.months.len(), c.finance.last_month, c.cash_usd),
                *p
            );
        }
    }
    // One month posted at each close, then compiled at a quarter close: Jan, Feb, Mar posted on
    // 1 Feb, 1 Mar and 1 Apr, the quarter built on 1 Apr and the months cleared.
    run_to(&mut sim, Date::ymd(2020, 3, 1));
    assert!(
        sim.world()
            .companies
            .iter()
            .all(|(_, c)| !c.finance.in_game() || c.finance.months.len() == 2)
    );
    run_to(&mut sim, Date::ymd(2020, 4, 1));
    let w = sim.world();
    for (_, c) in w.companies.iter() {
        if c.finance.in_game() {
            assert!(c.finance.months.is_empty(), "{}", c.key);
            assert_eq!(c.finance.quarters().len(), 5, "{}", c.key);
        }
    }
}
