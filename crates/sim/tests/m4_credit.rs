//! Build-plan M4.4 against the live engine: the credit line's limit, home spread rate, interest,
//! fees, interest on cash, auto-draw and repay, and the release-day review (spec 5.12, 5.1.2,
//! C10, C23, 6.5).
//!
//! Done line: a Chilean company pays a 312 bps home spread. Andes Cobre (CO-0179, Santiago) sits
//! in the Argentina zone (base 591 bps) with Chile's sovereign spread of 32 bps
//! (financial-zones.csv, country-economy.csv): round((591 + 32) ÷ 2) = 312 at load, where the
//! base spread applies (D235); from the first step 12 the zone's effective spread does.

mod common;
mod finance_common;

use std::sync::atomic::{AtomicU64, Ordering};

use common::data;
use common::ops::{company, run_to};
use finance_common::finance_start;
use sim::Sim;
use sim::finance::jobs::{asset_book, company_home_spread};
use sim::finance::rating::{Band, Rating};
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::World;

/// Spec 5.12 rating factor by band (T).
fn spec_factor(b: Band) -> f64 {
    match b {
        Band::Aaa => 1.0,
        Band::Aa => 0.9,
        Band::A => 0.8,
        Band::Bbb => 0.65,
        Band::Bb => 0.5,
        Band::B => 0.3,
        Band::Ccc | Band::Cc => 0.0,
    }
}

/// Spec 5.12 limit: `max(0, 0.5 × asset_book + own cash) × rating factor`, own cash = cash −
/// drawn floored at 0 (C10).
fn spec_limit(book: f64, cash: f64, drawn: f64, b: Band) -> f64 {
    (0.5 * book + (cash - drawn).max(0.0)).max(0.0) * spec_factor(b)
}

/// Spec 5.12 corporate spreads by band (3.6.2), with the D220 notch thirds, written out.
fn spec_spread(r: Rating) -> f64 {
    let order = [
        (Band::Aaa, 0.0040),
        (Band::Aa, 0.0060),
        (Band::A, 0.0090),
        (Band::Bbb, 0.0150),
        (Band::Bb, 0.0280),
        (Band::B, 0.0450),
        (Band::Ccc, 0.0900),
        (Band::Cc, 0.1600),
    ];
    let i = order.iter().position(|&(b, _)| b == r.band()).unwrap();
    let s = order[i].1;
    let label = r.label();
    if label.ends_with('+') && i > 0 {
        s - (s - order[i - 1].1) / 3.0
    } else if label.ends_with('-') && i + 1 < order.len() {
        s + (order[i + 1].1 - s) / 3.0
    } else {
        s
    }
}

/// Andes Cobre's fixed cost rate at load (f64 bits).
static CHILE_RATE_BITS: AtomicU64 = AtomicU64::new(0);

/// Before step 9 each month: the Argentina zone's spread is held at its base (a quarter with no
/// zone effect, 5.1.2), so the home spread in play is 312 bps; in January Andes Cobre gets an
/// extra cost of its cash plus half its undrawn limit, so it draws on its line.
fn chile_draws(w: &mut World, ctx: &mut JobCtx<'_>) {
    let id = company(w, "CO-0179");
    let zone = w.countries[w.companies[id].hq_country].zone;
    w.zones[zone].credit_spread = w.zones[zone].credit_spread_base;
    let c = &w.companies[id];
    let u = c.units[0];
    let base = f64::from_bits(CHILE_RATE_BITS.load(Ordering::SeqCst));
    let d = ctx.facts.date;
    let extra = if (d.year, d.month) == (2020, 2) {
        c.cash_usd + 0.5 * c.finance.line.available()
    } else {
        0.0
    };
    let gross = w.units[u].gross_assets;
    w.units[u].fixed_cost_rate = base + 12.0 * extra / gross;
}

#[test]
fn a_chilean_company_pays_312_bps() {
    let mut sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    let id = company(w, "CO-0179");
    let c = &w.companies[id];
    assert_eq!(w.countries[c.hq_country].key, "CHL");
    // Load reads the zone's base spread (D235): round((591 + 32) ÷ 2) = 312 bps.
    assert_eq!(
        w.zones[w.countries[c.hq_country].zone].credit_spread_base,
        0.0591
    );
    assert_eq!(w.countries[c.hq_country].sovereign_spread, 0.0032);
    assert_eq!(company_home_spread(w, c, true), 0.0312);
    // The fixture's rate is base 3% + 312 bps + the starting rating's spread (5.12).
    let row = finance_start()
        .into_iter()
        .find(|r| r.id() == "CO-0179")
        .unwrap();
    assert_eq!(row.num("home_spread_bps"), 312.0);
    let start = row.rating("start_rating");
    assert_eq!(c.finance.rating, start);
    assert!((row.num("line_rate") - (0.03 + 0.0312 + spec_spread(start))).abs() < 1e-12);

    // In play: with the zone at its base spread and a drawn line, February's interest is the
    // drawn line at 3% + 312 bps + the rating's spread, a twelfth of it (5.12 "Monthly").
    let u = c.units[0];
    CHILE_RATE_BITS.store(w.units[u].fixed_cost_rate.to_bits(), Ordering::SeqCst);
    sim.register_test_job(Slot::MonthlyDemand, "test.chile_draws", chile_draws);
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let c = &w.companies[id];
    let drawn = c.finance.line.drawn;
    assert!(drawn > 0.0, "Andes Cobre drew on its line in January");
    let rating = c.finance.rating;
    run_to(&mut sim, Date::ymd(2020, 3, 1));
    let w = sim.world();
    let c = &w.companies[id];
    assert_eq!(company_home_spread(w, c, false), 0.0312);
    let l = c.finance.last_month.unwrap().lines;
    let rate = 0.03 + 0.0312 + spec_spread(rating);
    assert!(
        (l.line_interest - drawn * rate / 12.0).abs() < 1e-6,
        "{} vs {}",
        l.line_interest,
        drawn * rate / 12.0
    );
    println!(
        "Andes Cobre: 312 bps home spread; drew ${:.1}M in January, February interest ${:.0} at \
         {:.2}% ({rating})",
        drawn / 1e6,
        l.line_interest,
        100.0 * rate
    );
}

#[test]
fn starting_limits_for_all_651() {
    let sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    for row in finance_start() {
        let c = &w.companies[company(w, row.id())];
        let want = spec_limit(
            asset_book(w, c),
            c.cash_usd,
            c.finance.line.drawn,
            c.finance.rating.band(),
        );
        assert!((c.finance.line.limit - want).abs() < 1e-6, "{}", row.id());
        assert!(
            (c.finance.line.limit - row.num("limit")).abs() < 1e-6 * want.max(1.0),
            "{} limit {} vs fixture {}",
            row.id(),
            c.finance.line.limit,
            row.num("limit")
        );
    }
}

#[test]
fn the_review_recomputes_every_limit() {
    let mut sim = Sim::new(data(), 2).unwrap();
    for (y, m) in [(2020, 1), (2020, 4), (2021, 7)] {
        let review = DateTime::at(Date::ymd(y, m, 2), 1);
        while sim.now() < review {
            sim.step();
        }
        let w = sim.world();
        let mut windows = 0;
        for (_, c) in w.companies.iter() {
            if c.finance.status().is_frozen() {
                continue;
            }
            let f = &c.finance;
            let want = spec_limit(asset_book(w, c), c.cash_usd, f.line.drawn, f.rating.band());
            assert!((f.line.limit - want).abs() < 1e-6, "{} {y}-{m}", c.key);
            // Over the new limit: 3 months to repay the excess (5.12 review, 10.0.9).
            let over = f.line.drawn > f.line.limit;
            assert_eq!(
                f.line.excess_months_left,
                if over { 3 } else { 0 },
                "{}",
                c.key
            );
            windows += usize::from(over);
        }
        println!("review {y}-{m:02}-02: {windows} companies over their new limit");
    }
}

/// The test company's fixed cost rate at load (f64 bits).
static BASE_RATE_BITS: AtomicU64 = AtomicU64::new(0);
/// Arrowhead's January extra cost: its cash plus $10M, so it draws about $10M; March's credit
/// (a negative cost) puts it far above twice min_cash, so the plan repays (6.5).
const JANUARY_COST: f64 = 80.4e6 + 10.0e6;
const MARCH_CREDIT: f64 = 30.0e6;

fn draw_then_repay(w: &mut World, ctx: &mut JobCtx<'_>) {
    let id = company(w, "CO-0001");
    let u = w.companies[id].units[0];
    let gross = w.units[u].gross_assets;
    let base = f64::from_bits(BASE_RATE_BITS.load(Ordering::SeqCst));
    let d = ctx.facts.date;
    let extra = match (d.year, d.month) {
        (2020, 2) => JANUARY_COST,
        (2020, 4) => -MARCH_CREDIT,
        _ => 0.0,
    };
    w.units[u].fixed_cost_rate = base + 12.0 * extra / gross;
}

#[test]
fn auto_draw_then_the_plan_repays() {
    let mut sim = Sim::new(data(), 3).unwrap();
    let id = company(sim.world(), "CO-0001");
    let u = sim.world().companies[id].units[0];
    BASE_RATE_BITS.store(
        sim.world().units[u].fixed_cost_rate.to_bits(),
        Ordering::SeqCst,
    );
    sim.register_test_job(Slot::MonthlyDemand, "test.draw_then_repay", draw_then_repay);
    // January: cash below 0 after the month draws the shortfall, up to the limit (5.12).
    run_to(&mut sim, Date::ymd(2020, 1, 31));
    let before = sim.world().clone();
    run_to(&mut sim, Date::ymd(2020, 2, 1));
    let w = sim.world();
    let c = &w.companies[id];
    let l = c.finance.last_month.unwrap().lines;
    let b = &before.companies[id];
    let cash_after_month =
        b.cash_usd + l.operating_cash() - l.asset_purchases + l.asset_sale_proceeds;
    assert!(cash_after_month < 0.0);
    assert!(-cash_after_month < b.finance.line.limit, "within the limit");
    assert!(
        (l.line_drawn_or_repaid + cash_after_month).abs() < 1e-6,
        "draws the shortfall"
    );
    assert!((c.finance.line.drawn + cash_after_month).abs() < 1e-6);
    assert!(c.cash_usd.abs() < 1e-6);
    // February: own cash is 0 (cash − drawn, C10), so the plan repays nothing; a month that
    // ends short draws again.
    run_to(&mut sim, Date::ymd(2020, 3, 1));
    let c = &sim.world().companies[id];
    assert!(c.finance.last_month.unwrap().lines.line_drawn_or_repaid >= 0.0);
    assert!(c.cash_usd >= 0.0);
    // March: the credit lifts own cash above 2 × min_cash; the plan repays min(drawn, own cash −
    // 1.5 × min_cash) (6.5), min_cash 5% of trailing revenue (6).
    let before = sim.world().clone();
    run_to(&mut sim, Date::ymd(2020, 4, 1));
    let w = sim.world();
    let c = &w.companies[id];
    let b = &before.companies[id];
    // March closes on 1 April, a quarter end: the posted month carries the quarter's tax paid
    // at the close, after the settle, so it is added back for the cash the settle saw.
    let l = c.finance.last_month.unwrap().lines;
    let ttm: f64 = b.finance.quarters()[b.finance.quarters().len() - 4..]
        .iter()
        .map(|s| s.lines.revenue)
        .sum();
    let min_cash = 0.05 * ttm;
    let drawn = b.finance.line.drawn;
    let cash =
        b.cash_usd + l.operating_cash() + l.tax_paid - l.asset_purchases + l.asset_sale_proceeds;
    let own = (cash - drawn).max(0.0);
    assert!(own > 2.0 * min_cash);
    let repay = drawn.min(own - 1.5 * min_cash);
    assert!(
        (l.line_drawn_or_repaid + repay).abs() < 1e-6,
        "{} vs {repay}",
        l.line_drawn_or_repaid
    );
    assert!((c.finance.line.drawn - (drawn - repay)).abs() < 1e-6);
    println!(
        "Arrowhead: drew ${:.2}M in January, repaid ${:.2}M in March",
        -cash_after_month / 1e6,
        repay / 1e6
    );
}
