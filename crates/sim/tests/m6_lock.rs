//! Build-plan M6.1 to M6.4 on the live engine: the plan at load (D283), the Lite AI batch at the
//! plan lock (spec 4.4 row 3, section 6), the order of the lock's steps and the projection
//! ranges (5.16).
//!
//! The expected plans are written here from the spec, not from lane F's functions: 6.1 (first
//! match in table order, D120), 6.2 (situation row with Logan's oversupply term, 1 point per 1%,
//! D282; trait nudges; the −20% to +30% clamp; the funding cap), 6.3 (archetype and trait mults,
//! productivity adj, loss cut, less free R&D, clamp) and 6.4 (P a power of ten, E for the
//! coverage, research for a Visionary, the 10% idle floor). The inputs are the world one tick
//! before the 9 January 2020 lock.

mod common;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::ai::archetype::Archetype;
use sim::finance::distress::CompanyStatus;
use sim::people::traits::Trait;
use sim::time::{Date, DateTime, Slot};
use sim::world::{Company, World};

/// Spec 6.1 rows (T): hurdle ROA, growth adj, R&D mult, data coverage.
fn row(a: Archetype) -> (f64, f64, f64, f64) {
    match a {
        Archetype::StateChampion => (0.06, 0.02, 1.0, 0.5),
        Archetype::Startup => (0.12, 0.04, 1.2, 1.0),
        Archetype::AggressiveGrower => (0.08, 0.05, 1.3, 1.0),
        Archetype::CashCow => (0.15, -0.03, 0.7, 0.25),
        Archetype::Incumbent => (0.10, 0.0, 1.0, 0.5),
    }
}

/// The traits the AI reads (spec 6, 5.19.5).
fn traits<'a>(w: &'a World, c: &Company) -> &'a [Trait] {
    if c.origin.is_born() {
        return &[];
    }
    c.controller
        .map_or(&[][..], |ch| &w.characters[ch].traits[..])
}

/// Spec 6.1, first match in table order (D120).
fn spec_archetype(state: bool, revenue: f64, tech: bool, t: &[Trait]) -> Archetype {
    let has = |x| t.contains(&x);
    if state {
        Archetype::StateChampion
    } else if revenue < 50.0e6 && tech {
        Archetype::Startup
    } else if has(Trait::Ambitious) || has(Trait::Brave) {
        Archetype::AggressiveGrower
    } else if has(Trait::Greedy) || has(Trait::Cautious) {
        Archetype::CashCow
    } else {
        Archetype::Incumbent
    }
}

/// Spec 6 g_dem: `LT + (φ + φ² + φ³ + φ⁴) × (q_growth − lt_q)`, φ 0.5.
fn spec_g_dem(lt: f64, q: f64) -> f64 {
    lt + 0.9375 * (q - ((1.0 + lt).powf(0.25) - 1.0))
}

/// Spec 6.4 for `l` labor units.
fn spec_split(l: u64, coverage: f64, inflow: f64, visionary: bool) -> [u64; 5] {
    if l == 1 {
        return if coverage >= 1.0 {
            [0, 0, 1, 0, 0]
        } else {
            [1, 0, 0, 0, 0]
        };
    }
    let mut p = 1u64;
    while (p * 10) as f64 <= 0.4 * l as f64 {
        p *= 10;
    }
    let left = l - p;
    let mut e = ((coverage * inflow / 0.9125).ceil().max(0.0) as u64).min(left);
    let mut r = if visionary { (left - e) / 10 } else { 0 };
    if l >= 10 {
        let min_idle = (l * 10).div_ceil(100);
        let mut short = min_idle.saturating_sub(left - e - r);
        let cut = short.min(e);
        e -= cut;
        short -= cut;
        r -= short.min(r);
    }
    [p, e, 0, r, l - p - e - r]
}

#[test]
fn the_plan_at_load_is_g_dem_and_the_6_3_rule() {
    let sim = Sim::new(data(), 2).unwrap();
    let w = sim.world();
    for (_, u) in w.units.iter() {
        let ind = &w.industries[u.industry];
        let want = spec_g_dem(ind.lt, ind.q_growth);
        assert!(
            (u.growth_plan - want).abs() < 1e-12,
            "growth {}",
            u.growth_plan
        );
    }
    for (_, c) in w.companies.iter() {
        assert!(c.plan.is_none(), "no plan is locked before 9 January 2020");
    }
}

#[test]
fn the_lite_ai_batch_at_the_first_lock_follows_section_6() {
    let mut sim = Sim::new(data(), 3).unwrap();
    let before_lock = DateTime::at(Date::ymd(2020, 1, 8), 23);
    while sim.now() < before_lock {
        sim.step();
    }
    let before = sim.world().clone();
    sim.step();
    let after = sim.world();
    let mut checked = 0;
    for (id, c) in before.companies.iter() {
        if c.finance.status().is_frozen() {
            continue;
        }
        let a = &after.companies[id];
        let plan = a.plan.expect("the batch plans every company not frozen");
        let ind = &before.industries[c.industry];
        let u = &before.units[c.units[0]];
        let t = traits(&before, c);
        let q: Vec<_> = c.finance.quarters().iter().rev().take(4).collect();
        let ttm_revenue: f64 = q.iter().map(|s| s.lines.revenue).sum();
        let ttm_ebit: f64 = q.iter().map(|s| s.lines.ebit()).sum();
        let tech = ind.sector == "Tech";

        // 6.1.
        let arch = spec_archetype(c.state_controlled, ttm_revenue, tech, t);
        assert_eq!(a.archetype, arch, "{}", c.key);
        let (hurdle, adj, rd_mult, coverage) = row(arch);

        // 6.3: productivity adj, trait mults, loss cut, less free R&D, clamp.
        let p_adj = if u.productivity < 95.0 {
            0.25
        } else if u.productivity > 110.0 {
            -0.2
        } else {
            0.0
        };
        let mut tm = 1.0;
        for (tr, k) in [
            (Trait::Greedy, 0.8),
            (Trait::Visionary, 1.25),
            (Trait::Conservative, 0.9),
            (Trait::Diligent, 1.1),
        ] {
            if t.contains(&tr) {
                tm *= k;
            }
        }
        let norm = ind.params.rd_norm;
        let mut target = norm * (rd_mult + p_adj) * tm;
        if c.loss_quarters >= 2 {
            target = (target * 0.8).max(target.min(0.5 * norm));
        }
        let free = f64::from(c.data_in(c.industry).unwrap().free_rd_pct) / 100.0;
        let rd = (target - free).clamp(0.0, 3.0 * norm);
        let au = &after.units[c.units[0]];
        assert!(
            (au.rd_plan - rd).abs() < 1e-12,
            "{}: rd {} vs {rd}",
            c.key,
            au.rd_plan
        );

        // 6.2.
        let gross = u.gross_assets;
        let roa = if gross > 0.0 { ttm_ebit / gross } else { 0.0 };
        let demand = spec_g_dem(ind.lt, ind.q_growth) - (ind.supply_ratio - 1.0).max(0.0);
        let mut g = if c.loss_quarters >= 4 {
            -0.15
        } else if c.loss_quarters >= 2 {
            -0.05
        } else if roa >= hurdle {
            demand + adj
        } else if roa >= 0.0 {
            demand.min(0.02)
        } else {
            0.0
        };
        let has = |x| t.contains(&x);
        g += 0.03 * f64::from(u8::from(has(Trait::Ambitious)))
            - 0.01 * f64::from(u8::from(has(Trait::Content)))
            - 0.02 * f64::from(u8::from(has(Trait::Cautious)))
            + 0.01 * f64::from(u8::from(has(Trait::Brave)))
            + 0.01 * f64::from(u8::from(tech && has(Trait::Visionary)));
        g = g.clamp(-0.20, 0.30);
        let p = &ind.params;
        let d = p.asset_decay * (gross - p.asset_decay_threshold_usd).max(0.0) / gross.max(1.0);
        let line = c.finance.line;
        let liquidity = (c.cash_usd - line.drawn).max(0.0) + (line.limit - line.drawn).max(0.0);
        let min_cash = 0.05 * ttm_revenue;
        let budget = 0.5 * (liquidity - min_cash).max(0.0);
        if c.finance.status() != CompanyStatus::Active {
            g = g.min(-d);
        } else if g > -d && gross > 0.0 && gross * (d + g) / 4.0 > budget {
            g = (budget * 4.0 / gross - d).clamp(-d, g);
        }
        assert!(
            (au.growth_plan - g).abs() < 1e-9,
            "{}: growth {} vs {g}",
            c.key,
            au.growth_plan
        );

        // 6.4.
        let inflow = ttm_revenue / 1e6 / 12.0 * ind.params.data_tb_per_musd;
        let s = spec_split(c.labor_units, coverage, inflow, has(Trait::Visionary));
        let st = a.stations;
        assert_eq!(
            [
                st.productivity,
                st.enterprise,
                st.fifty_fifty,
                st.research,
                st.idle
            ],
            s,
            "{}",
            c.key
        );

        // 6.5's moves are booked between closes (D125).
        let moved = plan.financing.draw - plan.financing.repay;
        assert!((a.finance.line.drawn - (line.drawn + moved)).abs() < 1e-6);
        assert!((a.finance.pending.line_drawn_or_repaid - moved).abs() < 1e-6);
        checked += 1;
    }
    assert!(checked >= 640, "{checked} companies checked");
}

#[test]
fn arrowhead_locks_the_cash_cow_plan() {
    let mut sim = Sim::new(data(), 1).unwrap();
    run_to(&mut sim, Date::ymd(2020, 1, 9));
    let w = sim.world();
    let a = &w.companies[company(w, "CO-0001")];
    let u = &w.units[a.units[0]];
    assert_eq!(a.archetype, Archetype::CashCow);
    // 6.4 (spec_6_4.rs): 392 labor units, P 100, E 1 at 25% coverage, idle 291.
    let s = a.stations;
    assert_eq!(
        (s.productivity, s.enterprise, s.research, s.idle),
        (100, 1, 0, 291)
    );
    // 6.3: 0.05 × 0.7 × 0.8 less 1% free R&D (productivity within 95 to 110 after a month).
    assert!((u.rd_plan - 0.018).abs() < 1e-12);
    // 6.2: ROA about 4% is under the Cash cow's 15% hurdle: min(2%, g_dem − oversupply).
    let ind = &w.industries[u.industry];
    let want = (spec_g_dem(ind.lt, ind.q_growth) - (ind.supply_ratio - 1.0).max(0.0)).min(0.02);
    assert!((u.growth_plan - want).abs() < 1e-12, "{}", u.growth_plan);
}

#[test]
fn the_lock_runs_its_steps_in_the_spec_order() {
    // Spec 4.4 row 3: fixed events, random events, IPO votes and listings, the Lite AI batch,
    // consensus.
    let order = [
        Slot::LockFixedStartupEvents,
        Slot::LockRandomStartupEvents,
        Slot::LockIpoVotes,
        Slot::LockAiPlans,
        Slot::LockConsensus,
    ];
    let pos: Vec<usize> = order
        .iter()
        .map(|s| Slot::ALL.iter().position(|x| x == s).unwrap())
        .collect();
    assert!(pos.windows(2).all(|w| w[0] < w[1]));
    let scheduler = sim::scheduler();
    let jobs = |s: Slot| -> Vec<&str> { scheduler.jobs(s).iter().map(|(n, _)| *n).collect() };
    assert_eq!(jobs(Slot::LockFixedStartupEvents), ["births.fixed_events"]);
    assert_eq!(
        jobs(Slot::LockRandomStartupEvents),
        ["births.random_events"]
    );
    assert_eq!(jobs(Slot::LockIpoVotes), ["births.ipo_votes_and_listings"]);
    assert_eq!(jobs(Slot::LockAiPlans), ["ai.plan_lock"]);
    assert_eq!(jobs(Slot::LockConsensus), ["market.consensus"]);
}

#[test]
fn projection_ranges_shrink_with_the_quarter_and_stop_at_three_percent() {
    let mut sim = Sim::new(data(), 5).unwrap();
    // Spec 5.16: `max(3%, 30% × (1 − 0.6 × elapsed) × (1 − 24 ÷ 50) × 0.7 × 2)`.
    let spec = |e: f64| (0.30 * (1.0 - 0.6 * e) * (1.0 - 24.0 / 50.0) * 0.7 * 2.0).max(0.03);
    let mut last = f64::INFINITY;
    for day in [10, 40, 70, 90] {
        run_to(&mut sim, Date::ymd(2020, 1, 1).add_days(day));
        let v = sim.views().projection.get();
        let e = v.elapsed_share;
        let row = &v.companies[0];
        assert!((row.width - spec(e)).abs() < 1e-12);
        assert!(row.width < last && row.width >= 0.03);
        let half = row.consensus_ni.abs() * row.width;
        assert!((row.range.0 - (row.consensus_ni - half)).abs() < 1e-6);
        assert!((row.range.1 - (row.consensus_ni + half)).abs() < 1e-6);
        assert!(row.plan.is_none(), "the observer never sees a plan");
        last = row.width;
    }
}
