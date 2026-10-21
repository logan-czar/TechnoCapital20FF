//! Build-plan M4.7, removal with a drawn line (spec 5.12 step 3; D233): everything left sells at
//! the Bust factor (0.60), the cash repays the line, then the tax payable; the unpaid line is
//! written off by the bank and any cash left leaves the game.
//!
//! The test company is the lowest-id company that starts with a drawn line. A test job raises
//! its fixed cost rate before step 9 each month (an input the books post like any cost): while
//! Active a month's extra cost is its cash, its undrawn limit and 4% of its book; then 4% of
//! its book. It draws its line full, goes Distressed, Bankrupt and is removed at a release. On
//! today's data (CO-0002, seed 12) the 0.60 sale covers the line, so nothing is written off;
//! the assertions follow D233's order whatever the amounts.

mod common;

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

use common::data;
use sim::Sim;
use sim::finance::distress::CompanyStatus;
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{CompanyId, Ordinal, World};

static TARGET: AtomicUsize = AtomicUsize::new(usize::MAX);
static BASE_RATE_BITS: AtomicU64 = AtomicU64::new(0);
const LOSS_SHARE_OF_BOOK: f64 = 0.04;
/// Spec 5.12 step 3: the Bust factor.
const BUST_FACTOR: f64 = 0.60;

fn squeeze(w: &mut World, _: &mut JobCtx<'_>) {
    let id = CompanyId::from_index(TARGET.load(Ordering::SeqCst));
    let c = &w.companies[id];
    if c.finance.status().is_frozen() {
        return;
    }
    let u = c.units[0];
    let gross = w.units[u].gross_assets;
    if gross <= 0.0 {
        return;
    }
    let book = w.units[u].asset_book;
    let mut extra = LOSS_SHARE_OF_BOOK * book;
    if c.finance.status() == CompanyStatus::Active {
        extra += c.cash_usd.max(0.0) + c.finance.line.available();
    }
    let base = f64::from_bits(BASE_RATE_BITS.load(Ordering::SeqCst));
    w.units[u].fixed_cost_rate = base + 12.0 * extra / gross;
}

#[test]
fn removal_repays_the_line_then_the_tax() {
    let mut sim = Sim::new(data(), 12).unwrap();
    let pick = sim
        .world()
        .companies
        .iter()
        .find(|(_, c)| c.finance.line.drawn > 0.0)
        .map(|(id, _)| id)
        .expect("a company with a drawn line");
    TARGET.store(pick.index(), Ordering::SeqCst);
    let unit = sim.world().companies[pick].units[0];
    BASE_RATE_BITS.store(
        sim.world().units[unit].fixed_cost_rate.to_bits(),
        Ordering::SeqCst,
    );
    let key = sim.world().companies[pick].key.clone();
    sim.register_test_job(Slot::MonthlyDemand, "test.squeeze", squeeze);
    // Step until the release tick that removes it, keeping the state just before each release.
    let mut before = sim.world().clone();
    let mut walk = Vec::new();
    let end = DateTime::midnight(Date::ymd(2023, 1, 1));
    while sim.now() < end {
        let next = sim.now().next();
        if next.hour() == 0 && next.date().day == 2 && next.date().is_quarter_first_month() {
            before = sim.world().clone();
        }
        sim.step();
        let s = sim.world().companies[pick].finance.status();
        if walk.last() != Some(&s) {
            walk.push(s);
        }
        if s == CompanyStatus::Removed {
            break;
        }
    }
    assert_eq!(
        walk,
        vec![
            CompanyStatus::Active,
            CompanyStatus::Distressed,
            CompanyStatus::Bankrupt,
            CompanyStatus::Removed
        ],
        "{key}"
    );
    let w = sim.world();
    let c = &w.companies[pick];
    let b = &before.companies[pick];
    let r = c.finance.removal.unwrap();
    let drawn = b.finance.line.drawn;
    assert!(drawn > 0.0, "{key} holds a drawn line into removal");
    // Everything sells at 0.60 of book (5.12 step 3).
    let book = before.units[unit].asset_book;
    assert!((r.sale.proceeds - BUST_FACTOR * book).abs() < 1e-6 * book.max(1.0));
    // The cash repays the line first, the bank writes off the rest (A), then tax (D233).
    let cash = b.cash_usd + r.sale.proceeds;
    let repaid = drawn.min(cash.max(0.0));
    assert!((r.line_repaid - repaid).abs() < 1e-6);
    assert!((r.line_written_off - (drawn - repaid)).abs() < 1e-6);
    let left = cash - repaid;
    let payable = b.finance.tax.accrued.max(0.0);
    let tax = payable.min(left.max(0.0));
    assert!((r.tax_paid - tax).abs() < 1e-6);
    assert!((r.residual_cash - (left - tax).max(0.0)).abs() < 1e-6);
    assert!((r.other_written_off - ((payable - tax) + (-(left - tax)).max(0.0))).abs() < 1e-6);
    // The removed company's books are cleared; its capacity went to the fringe (C30).
    assert_eq!(c.finance.line.drawn, 0.0);
    assert_eq!(c.cash_usd, 0.0);
    assert_eq!(r.capacity_to_fringe, before.units[unit].gross_assets);
    println!(
        "{key}: removed {} with ${:.2}M drawn; sale ${:.2}M, line repaid ${:.2}M, written off \
         ${:.2}M",
        c.finance.removed_on.unwrap(),
        drawn / 1e6,
        r.sale.proceeds / 1e6,
        r.line_repaid / 1e6,
        r.line_written_off / 1e6
    );
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
}
