//! Build-plan M6.6 to M6.8 on the live engine: random startup events at each plan lock
//! (5.19.1), the fixed event F1 at its lock (5.19.2), and each startup carved from the fringe
//! with its cap table, seed cash and seated cast (5.19.3, 5.19.4), registered in every table.
//!
//! Done lines: supply unchanged by a birth before PC bonuses; no empty labor seat. Expected
//! values come from the spec: the type table's ranges, the 2% fringe cap and $1M floor, Glut and
//! Bust industries weighing 0, `gross = revenue × capital_per_dollar` out of the fringe, cash
//! 0.5 × gross, founders 60% (the lead half of it, D270) and seed investors 40%, the lead
//! founder as CEO and controller, the 6.1 archetype without the trait rows.

mod common;

use std::sync::Mutex;

use common::data;
use common::ops::run_to;
use sim::Sim;
use sim::ai::archetype::Archetype;
use sim::births::random::{EventKind, EventType};
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{
    CompanyId, Holder, IndustryId, Notice, Ordinal, Origin, PhaseLabel, SeatHolder, World,
};

/// Spec 5.2 supply before PC bonuses: the fringe at productivity 100 plus each unit not frozen at
/// `assets_eff × turnover × (productivity + location bonus) ÷ 100`.
fn supply_before_bonus(w: &World, i: IndustryId) -> f64 {
    let ind = &w.industries[i];
    let t = ind.params.asset_turnover;
    let units: f64 = w
        .units
        .iter()
        .filter(|(_, u)| u.industry == i && !w.companies[u.company].finance.status().is_frozen())
        .map(|(_, u)| u.assets_eff() * t * (u.productivity + u.location_bonus) / 100.0)
        .sum();
    ind.fringe_assets * t + units
}

/// Per lock: each industry's supply before bonuses and fringe assets before the startup events,
/// and its label and fringe revenue once the fixed events have run (what the random events read).
#[derive(Clone, Default)]
struct Snap {
    date: Option<Date>,
    supply_before: Vec<f64>,
    fringe_before: Vec<f64>,
    companies_before: usize,
    labels: Vec<PhaseLabel>,
    fringe_revenue_after_fixed: Vec<f64>,
    supply_after: Vec<f64>,
    fringe_after: Vec<f64>,
}

static SNAPS: Mutex<Vec<Snap>> = Mutex::new(Vec::new());

fn is_lock(ctx: &JobCtx<'_>) -> bool {
    ctx.facts.is_lock_tick()
}

/// Hourly alerts slot (before the plan lock in the same tick).
fn before_lock(w: &mut World, ctx: &mut JobCtx<'_>) {
    if !is_lock(ctx) {
        return;
    }
    let ids: Vec<IndustryId> = w.industries.ids().collect();
    SNAPS.lock().unwrap().push(Snap {
        date: Some(ctx.facts.date),
        supply_before: ids.iter().map(|&i| supply_before_bonus(w, i)).collect(),
        fringe_before: ids.iter().map(|&i| w.industries[i].fringe_assets).collect(),
        companies_before: w.companies.len(),
        ..Snap::default()
    });
}

/// After the fixed events (registered after the built-in job in the same slot).
fn after_fixed(w: &mut World, _: &mut JobCtx<'_>) {
    let mut s = SNAPS.lock().unwrap();
    let snap = s.last_mut().unwrap();
    snap.labels = w.industries.rows().iter().map(|i| i.phase_label).collect();
    snap.fringe_revenue_after_fixed = w
        .industries
        .rows()
        .iter()
        .map(|i| i.fringe_assets * i.params.asset_turnover)
        .collect();
}

/// After the births and listings, before the Lite AI batch.
fn after_births(w: &mut World, _: &mut JobCtx<'_>) {
    let mut s = SNAPS.lock().unwrap();
    let snap = s.last_mut().unwrap();
    snap.supply_after = w
        .industries
        .ids()
        .map(|i| supply_before_bonus(w, i))
        .collect();
    snap.fringe_after = w
        .industries
        .rows()
        .iter()
        .map(|i| i.fringe_assets)
        .collect();
}

/// Spec 5.19.1 type table ranges: (revenue $M, full, partial).
fn type_ranges(t: EventType) -> ((f64, f64), (u8, u8), (u8, u8)) {
    match t {
        EventType::GarageFounder => ((5.0, 20.0), (1, 1), (1, 3)),
        EventType::SpinOutTeam => ((10.0, 50.0), (2, 3), (2, 4)),
        EventType::HotCluster => ((5.0, 30.0), (1, 2), (1, 3)),
        EventType::BackedVenture => ((30.0, 50.0), (3, 5), (3, 5)),
    }
}

/// Spec 5.19.2 F1 to F3, the fixed events due by January 2022: (revenue $M, full, partial).
fn fixed_ranges(id: &str) -> ((f64, f64), (u8, u8), (u8, u8)) {
    match id {
        "F1" => ((5.0, 15.0), (2, 3), (1, 2)),
        "F2" => ((10.0, 40.0), (1, 2), (2, 4)),
        "F3" => ((5.0, 30.0), (1, 3), (1, 3)),
        other => panic!("{other} is not due before 2030"),
    }
}

/// Spec 5.19.2: the plan lock each of F1 to F3 fires at.
fn fixed_date(id: &str) -> Date {
    match id {
        "F1" => Date::ymd(2020, 4, 9),
        "F2" => Date::ymd(2021, 4, 9),
        _ => Date::ymd(2022, 1, 9),
    }
}

/// A born company's full characters (5.19.4).
fn founders(w: &World, id: CompanyId) -> usize {
    w.companies[id].founders.len()
}

#[test]
fn births_follow_5_19_on_the_live_engine() {
    let mut sim = Sim::new(data(), 21).unwrap();
    sim.register_test_job(Slot::Alerts, "test.before_lock", before_lock);
    sim.register_test_job(
        Slot::LockFixedStartupEvents,
        "test.after_fixed",
        after_fixed,
    );
    sim.register_test_job(Slot::LockIpoVotes, "test.after_births", after_births);
    let end = DateTime::midnight(Date::ymd(2022, 1, 10));
    let (mut born_notices, mut event_notices) = (Vec::new(), Vec::new());
    while sim.now() < end {
        for n in sim.step() {
            match n {
                Notice::CompanyBorn(c) => born_notices.push(c),
                Notice::StartupEvent(e) => event_notices.push(e),
                _ => {}
            }
        }
    }
    let w = sim.world();
    let snaps = SNAPS.lock().unwrap().clone();
    assert_eq!(
        snaps.len(),
        9,
        "the nine plan locks of 2020, 2021 and January 2022"
    );

    // M6.8 done line: at every lock each industry's supply before PC bonuses is the same after
    // its births, and the fringe lost exactly the newborns' gross assets.
    let mut carves = 0;
    for s in &snaps {
        for (i, (&a, &b)) in s.supply_before.iter().zip(&s.supply_after).enumerate() {
            assert!(
                (a - b).abs() <= 1e-9 * a.max(1.0),
                "{:?} industry {i}: supply {a} before, {b} after",
                s.date
            );
            // The fringe lost exactly the gross assets of the companies born there at this
            // lock: `revenue × capital_per_dollar` each (5.19.3).
            let industry = IndustryId::from_index(i);
            let carved: f64 = w
                .companies
                .iter()
                .skip(s.companies_before)
                .filter(|(_, c)| {
                    c.industry == industry
                        && matches!(c.origin, Origin::Born { date, .. } if Some(date) == s.date)
                })
                .map(|(_, c)| c.revenue_usd * w.industries[industry].params.capital_per_dollar)
                .sum();
            let lost = s.fringe_before[i] - s.fringe_after[i];
            assert!(
                (lost - carved).abs() <= 1e-6 * carved.max(1.0),
                "{:?} industry {i}: fringe lost {lost}, births carved {carved}",
                s.date
            );
            carves += usize::from(carved > 0.0);
        }
    }
    assert!(carves > 0);

    // Every born company, against 5.19.3 and 5.19.4.
    let born: Vec<CompanyId> = w
        .companies
        .iter()
        .filter(|(_, c)| c.origin.is_born())
        .map(|(id, _)| id)
        .collect();
    assert!(born.len() >= 8, "{} births in two years", born.len());
    assert_eq!(born_notices, born, "one company_born notice each, in order");
    let mut names: Vec<&str> = w.companies.iter().map(|(_, c)| c.name.as_str()).collect();
    names.sort_unstable();
    let before = names.len();
    names.dedup();
    assert_eq!(names.len(), before, "company names are unique");
    let mut random_events = 0;
    for e in &w.births.events {
        assert!(event_notices.contains(&e.id));
        let snap = snaps.iter().find(|s| s.date == Some(e.date)).unwrap();
        let (range, full, partial) = match &e.kind {
            EventKind::Random(t) => {
                random_events += 1;
                // Glut and Bust industries weigh 0 (5.19.1).
                for &i in &e.industries {
                    assert!(!matches!(
                        snap.labels[i.index()],
                        PhaseLabel::Glut | PhaseLabel::Bust
                    ));
                }
                if *t == EventType::HotCluster {
                    let hq = w.companies[e.companies[0]].hq_province;
                    assert!(
                        e.companies
                            .iter()
                            .all(|&c| w.companies[c].hq_province == hq)
                    );
                    assert!((1..=3).contains(&e.companies.len()));
                } else {
                    assert_eq!(e.companies.len(), 1);
                }
                assert!(e.industries.iter().all(|&i| i == e.industries[0]));
                type_ranges(*t)
            }
            EventKind::Fixed(id) => {
                assert_eq!(e.date, fixed_date(id), "{id} fires at its plan lock");
                fixed_ranges(id)
            }
        };
        for &id in &e.companies {
            let c = &w.companies[id];
            let i = c.industry.index();
            // 5.19.3 size: the target log-uniform in the range, capped at 2% of the fringe's
            // revenue, skipped under $1M.
            let r = c.revenue_usd;
            assert!(
                r >= 1.0e6 && r <= range.1 * 1e6 * (1.0 + 1e-12),
                "{}: {r}",
                c.key
            );
            let cap = 0.02 * snap.fringe_revenue_after_fixed[i];
            assert!(
                r >= range.0 * 1e6 * (1.0 - 1e-12) || r <= cap * (1.0 + 1e-9),
                "{}",
                c.key
            );
            // The cast (5.19.4): founders within the event's range; the lead founder is CEO
            // and the controller; every open labor seat held.
            let f = founders(w, id) as u8;
            assert!((full.0..=full.1).contains(&f), "{}: {f} founders", c.key);
            let lead = c.founders[0];
            assert_eq!(c.controller, Some(lead));
            assert_eq!(c.board[0], Some(SeatHolder::Full(lead)));
            let open = c.labor_units.min(5) as usize;
            assert!(c.board[..open].iter().all(Option::is_some), "{}", c.key);
            let partials = c
                .board
                .iter()
                .filter(|h| matches!(h, Some(SeatHolder::Simple(_))))
                .count()
                + c.directors
                    .iter()
                    .filter(|d| matches!(d, sim::world::Director::Simple(_)))
                    .count();
            assert!(
                partials >= usize::from(partial.0).min(open - 1),
                "{}",
                c.key
            );
            for &ch in &c.founders {
                let fc = &w.characters[ch];
                assert_eq!(fc.tier, "generated");
                assert_eq!(fc.key, format!("CH-{:04}", ch.index() + 1));
                assert_eq!(fc.traits.len(), 3);
            }
            // The cap table (5.19.3, D270): founders 60%, the lead half of it when there are
            // several; seed investors the rest; it sums to shares_out.
            let total: u64 = c.holders.iter().map(|h| h.shares).sum();
            if c.public {
                continue;
            }
            assert_eq!(total, c.shares_out, "{}", c.key);
            let s = c.shares_out as f64;
            let lead_shares = c.holders[0].shares as f64;
            assert_eq!(c.holders[0].holder, Holder::Founder(lead));
            let lead_share = if f == 1 { 0.6 } else { 0.3 };
            // Each founder's shares round down (D270): off by under a share each.
            let rounding = (f64::from(f) + 1.0) / s;
            assert!(
                (lead_shares / s - lead_share).abs() <= rounding,
                "{}",
                c.key
            );
            let seed = c.holders.last().unwrap();
            assert_eq!(seed.holder, Holder::SeedInvestors);
            assert!(
                (seed.shares as f64 / s - 0.4).abs() <= rounding,
                "{}",
                c.key
            );
            // The unit (5.19.3): gross = revenue × capital_per_dollar, book = gross, newly
            // bought; its company got a plan at the same lock (6, "new companies included").
            let u = &w.units[c.units[0]];
            assert_eq!(u.company, id);
            assert!(c.plan.is_some(), "{}: planned at its birth lock", c.key);
            assert!(w.market.stocks.get(id).is_some(), "a stock row");
        }
    }
    assert!(
        random_events >= 8,
        "{random_events} random events at 9 locks (mean 2 each)"
    );

    // The views list the births (9.2 list_births) and the companies (list_companies).
    let v = sim.views();
    assert_eq!(
        v.births.get().list_births(Date::ymd(2020, 1, 1)).count(),
        born.len()
    );
    let rows = &v.company_rows.get().rows;
    for &id in &born {
        assert!(
            rows.iter().any(|r| r.id == id),
            "v_company_row lists a newborn"
        );
    }
}

/// The seed money and the books at birth (5.19.3): cash = 0.5 × gross, no line, assets =
/// liabilities + equity from the first month on (M4.9 counts no failure).
#[test]
fn a_newborn_opens_with_its_seed_round_and_balanced_books() {
    let mut sim = Sim::new(data(), 22).unwrap();
    // F1 makes two AI labs at the 9 April 2020 lock (5.19.2).
    run_to(&mut sim, Date::ymd(2020, 4, 9));
    let w = sim.world().clone();
    let f1 = w
        .births
        .events
        .iter()
        .find(|e| e.kind == EventKind::Fixed("F1".into()))
        .expect("F1 fires at 9 April 2020");
    assert_eq!(f1.date, Date::ymd(2020, 4, 9));
    assert_eq!(f1.companies.len(), 2);
    for &id in &f1.companies {
        let c = &w.companies[id];
        let ind = &w.industries[c.industry];
        assert_eq!(ind.name, "AI labs");
        // HQ in North America (startup-events.csv `@north-america`).
        assert!(w.births.in_regions(
            c.hq_province,
            &w.countries[c.hq_country].key,
            &[sim::births::fixed::Region::Superregion(
                "north-america".into()
            )]
        ));
        let u = &w.units[c.units[0]];
        let gross = c.revenue_usd * ind.params.capital_per_dollar;
        assert!((u.gross_assets - gross).abs() < 1e-6 * gross);
        assert_eq!(u.asset_book, u.gross_assets);
        assert!(u.ramping.is_empty());
        assert_eq!(c.finance.line.drawn, 0.0);
        // The Lite AI planned it in the same lock: Startup R&D and 6.5 moves only.
        let plan = c.plan.unwrap();
        let cash0 = 0.5 * gross;
        let moved = plan.financing.draw - plan.financing.repay - plan.financing.dividend;
        assert!((c.cash_usd - (cash0 + moved)).abs() < 1e-6, "{}", c.key);
        assert!(matches!(
            c.archetype,
            Archetype::Startup | Archetype::Incumbent
        ));
    }
    run_to(&mut sim, Date::ymd(2020, 7, 2));
    let w = sim.world();
    assert_eq!(
        w.books_check.failures, 0,
        "{:?}",
        w.books_check.first_failure
    );
    for &id in &f1.companies {
        let c = &w.companies[id];
        assert_eq!(c.finance.quarters().len(), 1, "Q2 2020 archived");
    }
}

/// The tipped lab (5.1.1, D281): drawn at load among the five largest AI labs by starting
/// revenue.
#[test]
fn the_tipped_lab_is_one_of_the_five_largest_labs() {
    for seed in 1..=6 {
        let sim = Sim::new(data(), seed).unwrap();
        let w = sim.world();
        let mut labs: Vec<(CompanyId, f64)> = w
            .companies
            .iter()
            .filter(|(_, c)| w.industries[c.industry].name == "AI labs")
            .map(|(id, c)| (id, c.revenue_usd))
            .collect();
        labs.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
        let top: Vec<CompanyId> = labs.iter().take(5).map(|(id, _)| *id).collect();
        let tipped = w.births.tipped_lab.unwrap();
        assert!(top.contains(&tipped), "seed {seed}");
    }
}
