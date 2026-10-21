//! Build-plan M4.6 and M4.7 against the live engine: forced asset sales at the sale factor with
//! their gain or loss (5.10), and a forced-failure test company that walks Distressed (6 months
//! of forced sales) → Bankrupt (frozen 2 quarters, equity 0, out of supply, the watchlist alert)
//! → Removed (sold at the Bust factor, capacity back to its industry's fringe pool, which the
//! next supply step counts; spec 5.12, C30).
//!
//! The test company is the lowest-id company that starts rated CCC or CC with no drawn line (a
//! limit of 0, so it never draws and no review excess muddies the walk). A test job raises its
//! fixed cost rate before step 9 each month, an input the books post through the ledger like any
//! cost: while Active, a month's extra cost is its cash plus 4% of its asset book; while
//! Distressed, 4% of its book. So it goes Distressed in the January close and Bankrupt in the
//! July close, the D232 example: frozen quarters counted on 1 October and 1 January, removed at
//! the 2 January 2021 release.

mod common;

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

use common::data;
use sim::Sim;
use sim::economy::assets::sale_factor;
use sim::finance::distress::CompanyStatus;
use sim::finance::jobs::sheet;
use sim::finance::rating::Band;
use sim::time::{Control, Date, DateTime, JobCtx, Slot};
use sim::world::{AlertKind, AlertPayload, CompanyId, Notice, Ordinal, World};

/// The test company's index, and its fixed cost rate at load (f64 bits).
static TARGET: AtomicUsize = AtomicUsize::new(usize::MAX);
static BASE_RATE_BITS: AtomicU64 = AtomicU64::new(0);
/// A distress month's extra cost, as a share of the asset book.
const LOSS_SHARE_OF_BOOK: f64 = 0.04;

fn target() -> CompanyId {
    CompanyId::from_index(TARGET.load(Ordering::SeqCst))
}

/// Runs before step 9 (registered in step 2): the squeeze.
fn squeeze(w: &mut World, _: &mut JobCtx<'_>) {
    let id = target();
    let c = &w.companies[id];
    if c.finance.status().is_frozen() {
        return;
    }
    let u = c.units[0];
    let gross = w.units[u].gross_assets;
    let book = w.units[u].asset_book;
    let mut extra = LOSS_SHARE_OF_BOOK * book;
    if c.finance.status() == CompanyStatus::Active {
        extra += c.cash_usd.max(0.0) + c.finance.line.available();
    }
    let base = f64::from_bits(BASE_RATE_BITS.load(Ordering::SeqCst));
    w.units[u].fixed_cost_rate = base + 12.0 * extra / gross;
}

/// Spec 5.2 supply of one industry, written out: fringe × turnover + Σ units not frozen
/// (assets_eff × turnover × p_pre ÷ 100).
fn spec_supply(w: &World, ind: sim::world::IndustryId) -> f64 {
    let i = &w.industries[ind];
    let t = i.params.asset_turnover;
    let mut s = i.fringe_assets * t;
    for (_, u) in w.units.iter() {
        let c = &w.companies[u.company];
        if u.industry != ind || c.finance.status().is_frozen() {
            continue;
        }
        let ramping: f64 = u.ramping.iter().map(|r| r.amount).sum();
        s +=
            (u.gross_assets - 0.2 * ramping) * t * (u.productivity + c.pc_bonus + u.location_bonus)
                / 100.0;
    }
    s
}

/// Worst relative gap between the engine's supply of the test company's industry and
/// [`spec_supply`], measured right after step 6 each month (f64 bits), and the checks made.
static SUPPLY_GAP_BITS: AtomicU64 = AtomicU64::new(0);
static SUPPLY_CHECKS: AtomicUsize = AtomicUsize::new(0);

/// Runs right after the step 6 supply job.
fn check_supply(w: &mut World, _: &mut JobCtx<'_>) {
    let ind = w.units[w.companies[target()].units[0]].industry;
    let s = w.industries[ind].supply;
    let gap = (s - spec_supply(w, ind)).abs() / s;
    let worst = f64::from_bits(SUPPLY_GAP_BITS.load(Ordering::SeqCst)).max(gap);
    SUPPLY_GAP_BITS.store(worst.to_bits(), Ordering::SeqCst);
    SUPPLY_CHECKS.fetch_add(1, Ordering::SeqCst);
}

fn supply_gap() -> f64 {
    f64::from_bits(SUPPLY_GAP_BITS.load(Ordering::SeqCst))
}

fn step_to(sim: &mut Sim, t: DateTime, notices: &mut Vec<Notice>) {
    while sim.now() < t {
        notices.extend(sim.step());
    }
}

#[test]
fn a_forced_failure_walks_distressed_bankrupt_removed() {
    let mut sim = Sim::new(data(), 11).unwrap();
    let pick = sim
        .world()
        .companies
        .iter()
        .find(|(_, c)| {
            matches!(c.finance.rating.band(), Band::Ccc | Band::Cc)
                && c.finance.line.drawn == 0.0
                && c.finance.line.limit == 0.0
        })
        .map(|(id, _)| id)
        .expect("a company rated CCC or CC with no line");
    TARGET.store(pick.index(), Ordering::SeqCst);
    let unit = sim.world().companies[pick].units[0];
    let industry = sim.world().units[unit].industry;
    BASE_RATE_BITS.store(
        sim.world().units[unit].fixed_cost_rate.to_bits(),
        Ordering::SeqCst,
    );
    let key = sim.world().companies[pick].key.clone();
    sim.register_test_job(Slot::MonthlyDemand, "test.squeeze", squeeze);
    sim.register_test_job(Slot::MonthlySupply, "test.supply", check_supply);
    sim.apply(Control::WatchlistAdd(pick)).unwrap();

    // 1. Distressed: the January to June closes each count a distress month and force a sale
    //    at the industry's sale factor, just enough to bring cash back to 0 (5.12 step 1).
    let mut notices = Vec::new();
    let mut prev = sim.world().clone();
    for (n, m) in (2u8..=7).enumerate() {
        notices.clear();
        step_to(
            &mut sim,
            DateTime::midnight(Date::ymd(2020, m, 1)),
            &mut notices,
        );
        let w = sim.world();
        let c = &w.companies[pick];
        let l = c.finance.last_month.unwrap().lines;
        let (u0, u1) = (&prev.units[unit], &w.units[unit]);
        // M4.6: the book sold is what left the book (no decay below $10M of assets), the cash
        // is book sold × the sale factor of this month's label, the gain the difference.
        let book_sold = u0.asset_book - l.depreciation - u1.asset_book;
        assert!(book_sold > 0.0, "{key} month {m}: a forced sale");
        let factor = sale_factor(w.industries[industry].phase_label);
        let proceeds = book_sold * factor;
        assert!((l.asset_sale_proceeds - proceeds).abs() < 1e-6 * proceeds.max(1.0));
        assert!((l.asset_sale_gain - (proceeds - book_sold)).abs() < 1e-6 * book_sold);
        assert!(
            l.asset_sale_gain < 0.0 || factor == 1.0,
            "a loss below Boom"
        );
        // The same share of gross and book is sold (5.10).
        let share_g = 1.0 - u1.gross_assets / (u0.gross_assets - l.depreciation);
        let share_b = book_sold / (u0.asset_book - l.depreciation);
        assert!((share_g - share_b).abs() < 1e-9);
        let months = n as u32 + 1;
        assert_eq!(c.finance.distress.distress_months, months, "{key} {m}");
        if months < 6 {
            assert_eq!(c.finance.status(), CompanyStatus::Distressed);
            // Just enough: cash back to 0 (5.12 step 1; D225).
            assert!(c.cash_usd.abs() < 1e-3, "{key} cash {}", c.cash_usd);
            // No purchases while Distressed (5.12 step 1).
            if months > 1 {
                assert_eq!(l.asset_purchases, 0.0);
            }
        }
        prev = w.clone();
    }

    // 2. Bankrupt at the July close (the 6th distress month): frozen, wiped, alert raised.
    let w = sim.world();
    let c = &w.companies[pick];
    assert_eq!(c.finance.status(), CompanyStatus::Bankrupt);
    assert_eq!(c.finance.bankrupt_on, Some(Date::ymd(2020, 7, 1)));
    let bs = sheet(w, c);
    assert_eq!(bs.equity, 0.0, "shareholders wiped");
    assert_eq!(bs.estate, bs.total_assets - bs.total_liabilities);
    assert!(
        notices.iter().any(|n| matches!(
            n,
            Notice::Alert {
                kind: AlertKind::BankruptcyInWatchlist,
                payload: AlertPayload::Company(id),
                ..
            } if *id == pick
        )),
        "the watchlist alert fires"
    );
    let gross_at_bankruptcy = w.units[unit].gross_assets;
    assert!(gross_at_bankruptcy > 0.0, "assets left to return");
    let cash_at_bankruptcy = c.cash_usd;

    // Frozen for 2 quarters: nothing posts, nothing decays, it leaves supply (5.12 step 2).
    for m in [8u8, 9, 10, 11, 12] {
        step_to(
            &mut sim,
            DateTime::midnight(Date::ymd(2020, m, 1)),
            &mut notices,
        );
        let w = sim.world();
        let c = &w.companies[pick];
        assert_eq!(c.finance.status(), CompanyStatus::Bankrupt);
        assert_eq!(
            c.finance.last_month.unwrap().lines,
            Default::default(),
            "{m}"
        );
        assert_eq!(w.units[unit].gross_assets, gross_at_bankruptcy);
        assert_eq!(w.units[unit].revenue_m, 0.0);
        assert_eq!(c.cash_usd, cash_at_bankruptcy);
        // Step 6 counted every unit but the frozen one (checked right after it).
        assert!(supply_gap() < 1e-12, "out of supply: {}", supply_gap());
        // The quarter of the bankruptcy does not count (D232): 1 at the October close.
        let want = if m >= 10 { 1 } else { 0 };
        assert_eq!(c.finance.distress.frozen_quarters, want, "{m}");
    }
    step_to(
        &mut sim,
        DateTime::midnight(Date::ymd(2021, 1, 1)),
        &mut notices,
    );
    assert_eq!(
        sim.world().companies[pick].finance.distress.frozen_quarters,
        2
    );
    assert_eq!(
        sim.world().companies[pick].finance.status(),
        CompanyStatus::Bankrupt
    );

    // 3. Removed at the 2 January 2021 release: sold at the Bust factor, the capacity back to
    //    the fringe (5.12 step 3, C30), the board discarded, the filings kept.
    let before = sim.world().clone();
    step_to(
        &mut sim,
        DateTime::midnight(Date::ymd(2021, 1, 2)),
        &mut notices,
    );
    let w = sim.world();
    let c = &w.companies[pick];
    assert_eq!(c.finance.status(), CompanyStatus::Removed);
    assert_eq!(c.finance.removed_on, Some(Date::ymd(2021, 1, 2)));
    let r = c.finance.removal.unwrap();
    let book = before.units[unit].asset_book;
    assert!((r.sale.proceeds - 0.60 * book).abs() < 1e-6 * book);
    assert_eq!(r.capacity_to_fringe, gross_at_bankruptcy);
    let fringe_gain =
        w.industries[industry].fringe_assets - before.industries[industry].fringe_assets;
    assert!((fringe_gain - gross_at_bankruptcy).abs() < 1e-6 * gross_at_bankruptcy);
    assert_eq!(w.units[unit].gross_assets, 0.0);
    assert!(c.board.iter().all(Option::is_none));
    assert!(!c.finance.quarters().is_empty(), "filings stay");
    // Nothing owed: no line, and the tax payable came out of the sale (D233).
    assert_eq!(
        r.line_repaid + r.line_written_off,
        before.companies[pick].finance.line.drawn
    );
    // The next supply step counts the returned capacity in the fringe (M2 supply, 5.2).
    step_to(
        &mut sim,
        DateTime::midnight(Date::ymd(2021, 2, 1)),
        &mut notices,
    );
    let w = sim.world();
    assert!(supply_gap() < 1e-12, "{}", supply_gap());
    assert_eq!(
        SUPPLY_CHECKS.load(Ordering::SeqCst),
        13,
        "a check each month"
    );
    // The books balanced every month of the walk (M4.9), in the engine's own check.
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
    println!(
        "{key}: Distressed from the January 2020 close, Bankrupt 2020-07-01 with ${:.0} of \
         gross assets, removed 2021-01-02: ${:.0} back to the fringe, removal sale ${:.0}",
        gross_at_bankruptcy, r.capacity_to_fringe, r.sale.proceeds
    );
}
