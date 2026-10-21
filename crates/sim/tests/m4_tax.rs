//! Build-plan M4.3 against the live engine: tax with unlimited loss carryforward, accrued monthly
//! and paid at the quarter close (spec 5.11; D227). The formula cases (a loss year, ten years of
//! carryforward, a loss month reversing an accrual) are lane F's `spec_5_11.rs`; here a live
//! company runs a loss quarter and the test follows 5.11 quarter by quarter.
//!
//! A test job gives Arrowhead (Canada, 26.5% in country-economy.csv) an extra cost in January
//! 2020 only, so Q1 2020 is a loss and the carryforward shields the next quarters. For each close
//! the expected tax is `max(0, pre-tax − carryforward used) × rate`, with the carryforward kept
//! here from the quarters' pre-tax income.

mod common;

use std::sync::atomic::{AtomicU64, Ordering};

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::finance::statements::Period;
use sim::time::{Date, JobCtx, Quarter, Slot};
use sim::world::World;

/// January 2020's extra cost, USD: several quarters of Arrowhead's pre-tax income.
const LOSS_USD: f64 = 3.0e6;
static BASE_RATE_BITS: AtomicU64 = AtomicU64::new(0);

fn january_loss(w: &mut World, ctx: &mut JobCtx<'_>) {
    let id = company(w, "CO-0001");
    let u = w.companies[id].units[0];
    let base = f64::from_bits(BASE_RATE_BITS.load(Ordering::SeqCst));
    let gross = w.units[u].gross_assets;
    let d = ctx.facts.date;
    w.units[u].fixed_cost_rate = if (d.year, d.month) == (2020, 2) {
        base + 12.0 * LOSS_USD / gross
    } else {
        base
    };
}

#[test]
fn a_loss_quarter_carries_forward_and_tax_is_paid_at_each_close() {
    let d = data();
    let rate = d
        .country_economy
        .rows
        .iter()
        .find(|e| e.iso3 == "CAN")
        .unwrap()
        .corp_tax_rate;
    let mut sim = Sim::new(d, 7).unwrap();
    let id = company(sim.world(), "CO-0001");
    let u = sim.world().companies[id].units[0];
    BASE_RATE_BITS.store(
        sim.world().units[u].fixed_cost_rate.to_bits(),
        Ordering::SeqCst,
    );
    sim.register_test_job(Slot::MonthlyDemand, "test.january_loss", january_loss);

    let mut cf = 0.0_f64;
    let (mut shielded, mut taxed) = (0, 0);
    let mut q = Quarter { year: 2020, q: 1 };
    while q.year < 2023 {
        // Each month's accrual is the quarter-to-date tax less earlier months' (D227): watch
        // the payable over the quarter's three closes.
        let mut accrued = Vec::new();
        for m in 0..3u8 {
            let month = q.first_month().month + m;
            let (y, mo) = if month == 12 {
                (q.year + 1, 1)
            } else {
                (q.year, month + 1)
            };
            run_to(&mut sim, Date::ymd(y, mo, 1));
            let c = &sim.world().companies[id];
            accrued.push(c.finance.last_month.unwrap().lines.tax);
            if m < 2 {
                // Unpaid until the close: the tax payable is the accrual so far.
                let so_far: f64 = accrued.iter().sum();
                assert!((c.finance.tax.accrued - so_far).abs() < 1e-6);
            }
        }
        let c = &sim.world().companies[id];
        let s = c.finance.quarters().last().unwrap();
        assert_eq!(s.period, Period::Quarter(q));
        let pti = s.lines.pre_tax_income();
        let used = cf.min(pti.max(0.0));
        let tax = (pti - used).max(0.0) * rate;
        cf = cf - used + (-pti).max(0.0);
        // The quarter's tax is the sum of its accruals, all paid at the close (5.11).
        assert!(
            (s.lines.tax - tax).abs() < 1e-6,
            "{q}: {} vs {tax}",
            s.lines.tax
        );
        assert!((accrued.iter().sum::<f64>() - tax).abs() < 1e-6, "{q}");
        assert!((s.lines.tax_paid - tax).abs() < 1e-6, "{q}");
        assert_eq!(c.finance.tax.accrued, 0.0, "{q}: nothing left payable");
        assert!(
            (c.finance.tax.carryforward - cf).abs() < 1e-6,
            "{q} carryforward"
        );
        if q == (Quarter { year: 2020, q: 1 }) {
            assert!(pti < 0.0, "Q1 2020 is a loss: {pti}");
            assert_eq!(tax, 0.0);
        } else if used > 0.0 {
            shielded += 1;
        } else if tax > 0.0 {
            taxed += 1;
        }
        q = q.next();
    }
    println!(
        "Arrowhead: Q1 2020 loss carried forward; {shielded} later quarters used it, then \
         {taxed} quarters taxed in full at {rate}"
    );
    assert!(
        shielded >= 2,
        "the carryforward shields more than one quarter"
    );
    assert!(taxed > 0, "and runs out");
    assert_eq!(cf, 0.0);
}
