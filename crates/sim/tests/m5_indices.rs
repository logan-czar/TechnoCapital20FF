//! Build-plan M5.6 on the live engine (spec 5.14; batches 152, 154; D250): 26 zone exchanges, each
//! headline index the market-cap weighted level of its quoted companies, kept by a divisor so it
//! does not jump when the constituents change.
//!
//! - A listing (5.20, as M6's IPOs will call it): at the 9 January 2020 plan lock a test job lists
//!   two private companies, one on an exchange with listings and one on an exchange with none;
//!   the first exchange's level is the same just before and just after, the empty one opens at
//!   1,000. A share issue (6.6) keeps the level too.
//! - A delisting at bankruptcy (5.12 step 2, D126): Arrowhead (CO-0001, ATX) is squeezed into
//!   bankruptcy as in `m4_distress.rs`. Its exchange's level read at 4.3 step 12 and again at
//!   step 14 of the bankruptcy month (prices do not move between them) is the same; its price is
//!   then $0.00, it leaves the quotes and the index and never steps again.
//! - The level is `Σ P × shares ÷ divisor`, written out here, every day.

mod common;

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

use common::data;
use sim::Sim;
use sim::finance::distress::CompanyStatus;
use sim::market::jobs::{index_level, list_company, set_shares_out};
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{CompanyId, Ordinal, World, ZoneId};

/// Spec 5.14: the base level.
const INDEX_BASE: f64 = 1000.0;

fn near(a: f64, b: f64, what: &str) {
    assert!(
        (a - b).abs() <= 1e-9 * b.abs().max(1.0),
        "{what}: {a} vs {b}"
    );
}

/// What the listing job saw: (level before, level after) on the exchange with listings, the
/// empty exchange's level after, and the level around a share issue.
static LISTING: Mutex<Option<ListingSeen>> = Mutex::new(None);

#[derive(Debug, Clone, Copy)]
struct ListingSeen {
    listed: CompanyId,
    zone: ZoneId,
    before: f64,
    after: f64,
    empty_listed: Option<(CompanyId, ZoneId, Option<f64>, Option<f64>)>,
    issue_before: f64,
    issue_after: f64,
}

fn list_two(w: &mut World, ctx: &mut JobCtx<'_>) {
    if LISTING.lock().unwrap().is_some() {
        return;
    }
    let has_listing = |w: &World, z: ZoneId| {
        w.market
            .stocks
            .rows()
            .iter()
            .any(|s| s.quoted && s.exchange == Some(z))
    };
    let private: Vec<CompanyId> = w
        .companies
        .iter()
        .filter(|(id, c)| {
            !c.public && !c.finance.status().is_frozen() && w.market.stocks[*id].exchange.is_none()
        })
        .map(|(id, _)| id)
        .collect();
    let zone_of = |w: &World, id: CompanyId| w.countries[w.companies[id].hq_country].zone;
    let first = *private
        .iter()
        .find(|&&id| has_listing(w, zone_of(w, id)))
        .expect("a private company on an exchange with listings");
    let zone = zone_of(w, first);
    let before = index_level(w, zone).unwrap();
    let price = w.market.stocks[first].value.max(5.0).round();
    assert!(list_company(w, first, price, ctx.facts.date));
    let after = index_level(w, zone).unwrap();
    let empty = private
        .iter()
        .copied()
        .find(|&id| !has_listing(w, zone_of(w, id)))
        .map(|id| {
            let z = zone_of(w, id);
            let b = index_level(w, z);
            let p = w.market.stocks[id].value.max(5.0).round();
            assert!(list_company(w, id, p, ctx.facts.date));
            (id, z, b, index_level(w, z))
        });
    // A share issue of 10% on the first listing's exchange (6.6).
    let issue_before = index_level(w, zone).unwrap();
    let shares = w.companies[first].shares_out;
    set_shares_out(w, first, shares + shares / 10);
    let issue_after = index_level(w, zone).unwrap();
    *LISTING.lock().unwrap() = Some(ListingSeen {
        listed: first,
        zone,
        before,
        after,
        empty_listed: empty,
        issue_before,
        issue_after,
    });
}

/// Σ P × shares of the quoted companies on `z` ÷ the divisor (spec 5.14), written out.
fn spec_level(w: &World, z: ZoneId) -> Option<f64> {
    let cap: f64 = w
        .market
        .stocks
        .iter()
        .filter(|(_, s)| s.quoted && s.exchange == Some(z))
        .map(|(id, s)| s.price * w.companies[id].shares_out as f64)
        .sum();
    w.market.indices[z].divisor.map(|d| cap / d)
}

#[test]
fn an_index_does_not_jump_when_a_company_lists_or_issues_shares() {
    let mut sim = Sim::new(data(), 2).unwrap();
    sim.register_test_job(Slot::LockIpoVotes, "test.list_two", list_two);
    let end = DateTime::midnight(Date::ymd(2020, 2, 1));
    while sim.now() < end {
        sim.step();
        let w = sim.world();
        if sim.now().hour() == 0 {
            for z in w.zones.ids() {
                let q = sim.views().quotes.get().index(z).unwrap().level;
                match (q, spec_level(w, z)) {
                    (Some(a), Some(b)) => near(a, b, "level"),
                    (None, None) => {}
                    other => panic!("{z:?}: {other:?}"),
                }
            }
        }
    }
    let seen = LISTING.lock().unwrap().expect("the lock ran");
    println!("{seen:?}");
    assert!(sim.world().market.stocks[seen.listed].exchange == Some(seen.zone));
    near(seen.after, seen.before, "level through a listing");
    near(
        seen.issue_after,
        seen.issue_before,
        "level through a share issue",
    );
    let (id, z, before, after) = seen
        .empty_listed
        .expect("a private company on an empty exchange");
    assert_eq!(before, None, "an exchange with no listing shows no level");
    near(after.unwrap(), INDEX_BASE, "a first listing opens at 1,000");
    let w = sim.world();
    for listed in [seen.listed, id] {
        let s = &w.market.stocks[listed];
        assert!(s.quoted && s.listed_on == Some(Date::ymd(2020, 1, 9)));
        assert!(!s.bars.is_empty(), "it trades and gets bars");
        assert!(sim.views().quotes.get().get(listed).is_some());
    }
    assert!(
        sim.views().exchanges.get().exchanges[z.index()]
            .constituents
            .contains(&id)
    );
    assert_eq!(
        w.market.stocks[seen.listed].shares,
        w.companies[seen.listed].shares_out
    );
}

// --- Delisting at bankruptcy ------------------------------------------------------------------

static TARGET: AtomicUsize = AtomicUsize::new(usize::MAX);
static BASE_RATE_BITS: AtomicU64 = AtomicU64::new(0);
/// A distress month's extra cost, as a share of the asset book (as in m4_distress.rs).
const LOSS_SHARE_OF_BOOK: f64 = 0.04;
/// Levels of the target's exchange at steps 12 and 14 of the bankruptcy month.
static LEVELS: Mutex<Vec<MonthLevels>> = Mutex::new(Vec::new());

/// The level at step 12, the level at step 14 and whether the target was Bankrupt by then.
type MonthLevels = (Option<f64>, Option<f64>, bool);

fn target() -> CompanyId {
    CompanyId::from_index(TARGET.load(Ordering::SeqCst))
}

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

fn zone_of_target(w: &World) -> ZoneId {
    w.countries[w.companies[target()].hq_country].zone
}

fn level_at_step_12(w: &mut World, _: &mut JobCtx<'_>) {
    let l = index_level(w, zone_of_target(w));
    LEVELS.lock().unwrap().push((l, None, false));
}

fn level_at_step_14(w: &mut World, _: &mut JobCtx<'_>) {
    let l = index_level(w, zone_of_target(w));
    let bankrupt = w.companies[target()].finance.status() == CompanyStatus::Bankrupt;
    let mut v = LEVELS.lock().unwrap();
    let last = v.last_mut().unwrap();
    last.1 = l;
    last.2 = bankrupt;
}

#[test]
fn a_bankruptcy_delists_without_moving_the_index() {
    let mut sim = Sim::new(data(), 4).unwrap();
    let id = sim
        .world()
        .companies
        .iter()
        .find(|(_, c)| c.key == "CO-0001")
        .unwrap()
        .0;
    TARGET.store(id.index(), Ordering::SeqCst);
    let u = sim.world().companies[id].units[0];
    BASE_RATE_BITS.store(
        sim.world().units[u].fixed_cost_rate.to_bits(),
        Ordering::SeqCst,
    );
    assert!(
        sim.world().market.stocks[id].quoted,
        "Arrowhead lists on ATX"
    );
    sim.register_test_job(Slot::MonthlyDemand, "test.squeeze", squeeze);
    sim.register_test_job(Slot::MonthlyInterest, "test.level_12", level_at_step_12);
    sim.register_test_job(Slot::MonthlyLedger, "test.level_14", level_at_step_14);
    let end = DateTime::midnight(Date::ymd(2021, 1, 10));
    let mut delisted_on = None;
    while sim.now() < end {
        sim.step();
        let w = sim.world();
        let s = &w.market.stocks[id];
        if w.companies[id].finance.status().is_frozen() {
            // 5.12 step 2: $0.00, no quote, no bar, out of the index from the bankruptcy on.
            assert_eq!(s.price, 0.0);
            assert!(!s.quoted);
            assert_eq!(s.fair_value, 0.0);
            assert!(sim.views().quotes.get().get(id).is_none());
            delisted_on.get_or_insert(sim.now());
        }
    }
    let levels = LEVELS.lock().unwrap().clone();
    let month = levels
        .iter()
        .find(|(_, _, bankrupt)| *bankrupt)
        .expect("Arrowhead went bankrupt");
    println!(
        "delisted {delisted_on:?}: level at step 12 {:?}, at step 14 {:?}",
        month.0, month.1
    );
    near(
        month.1.unwrap(),
        month.0.unwrap(),
        "level through the delisting",
    );
    let w = sim.world();
    assert_eq!(w.companies[id].finance.status(), CompanyStatus::Removed);
    assert_eq!(w.market.stocks[id].price, 0.0);
}
