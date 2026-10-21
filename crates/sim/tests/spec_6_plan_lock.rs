//! Spec 4.4 row 3 and 6 (the plan lock), build-plan M6.4 (formula side): the lock's step
//! order, the batch order, and one company's composed plan (6.1 to 6.5).

use sim::ai::archetype::Archetype;
use sim::ai::plan::{
    COMPANY_PLAN_ORDER, LockStep, PLAN_LOCK_ORDER, PlanInputs, PlanStep, batch_order, lock_plan,
};
use sim::finance::credit::CreditLine;
use sim::finance::distress::CompanyStatus;
use sim::ops::stations::Stations;
use sim::people::traits::Trait;
use sim::world::CompanyId;

#[test]
fn lock_order_follows_4_4() {
    // 4.4 row 3: startup events (fixed due, then random), then IPO board votes and listings,
    // then the Lite AI batch, new companies included; consensus set.
    assert_eq!(
        PLAN_LOCK_ORDER,
        [
            LockStep::FixedStartupEvents,
            LockStep::RandomStartupEvents,
            LockStep::IpoVotes,
            LockStep::Listings,
            LockStep::LiteAiBatch,
            LockStep::Consensus,
        ]
    );
    // 6.6: the raise is checked after 6.2 to 6.4 and before 6.5.
    let pos = |s| COMPANY_PLAN_ORDER.iter().position(|&x| x == s).unwrap();
    assert!(pos(PlanStep::StationSplit) < pos(PlanStep::Raise));
    assert!(pos(PlanStep::Raise) < pos(PlanStep::FinancingAndDividend));
}

#[test]
fn batch_is_every_unfrozen_company_in_id_order() {
    let list = [
        (CompanyId(5), CompanyStatus::Active),
        (CompanyId(1), CompanyStatus::Distressed),
        (CompanyId(3), CompanyStatus::Bankrupt),
        (CompanyId(652), CompanyStatus::Active), // born at this lock
        (CompanyId(2), CompanyStatus::Removed),
    ];
    assert_eq!(
        batch_order(&list),
        vec![CompanyId(1), CompanyId(5), CompanyId(652)]
    );
}

fn arrowhead<'a>(traits: &'a [Trait]) -> PlanInputs<'a> {
    // Spec 7.1 Arrowhead at load: $40M Oil, $39.2M gross (d_eff 1% of the $29.2M above $10M),
    // $80.4M cash, no line, 392 labor, productivity 100, 1% free R&D.
    let gross = 39.2e6;
    PlanInputs {
        state_controlled: false,
        controller_traits: Some(traits),
        born_in_play: false,
        tech: false,
        ttm_revenue: 40.0e6,
        ttm_ebit: 1.63e6,
        lt: 0.0,
        q_growth: 0.0,
        supply_ratio: 1.0,
        loss_q: 0,
        gross_assets: gross,
        d_eff: 0.01 * (gross - 10.0e6) / gross,
        cash: 80.4e6,
        line: CreditLine::default(),
        status: CompanyStatus::Active,
        raise_pending: false,
        rd_norm: 0.05,
        data_tb_per_musd: 1.0,
        productivity: 100.0,
        free_rd_pct: 1,
        labor: 392,
        last_quarter_net_income: 0.0,
    }
}

#[test]
fn arrowhead_locked_plan() {
    let traits = [Trait::Deceitful, Trait::Greedy, Trait::Gregarious];
    let p = lock_plan(&arrowhead(&traits));
    let op = p.operating;
    assert_eq!(op.archetype, Archetype::CashCow);
    // ROA 1.63 ÷ 39.2 = 4.2% is under the 15% hurdle: min(2%, g_dem 0) = 0.
    assert_eq!(op.growth, 0.0);
    assert!((op.rd_plan - 0.018).abs() < 1e-12);
    assert_eq!(
        op.stations,
        Stations {
            productivity: 100,
            enterprise: 1,
            fifty_fifty: 0,
            research: 0,
            idle: 291,
        }
    );
    // g = 0 buys back the decay: 39.2 × 0.745% ÷ 4 = $73,000 a quarter.
    assert!((op.planned_purchases - 0.01 * 29.2e6 / 4.0).abs() < 1e-6);
    assert_eq!(op.min_cash, 2.0e6);
    assert_eq!((p.financing.draw, p.financing.repay), (0.0, 0.0));
}

#[test]
fn born_company_ignores_founder_traits() {
    // 5.19.5: a Tech startup under $50M plans as a Startup with no nudges, whatever its
    // founders' traits; a Greedy controller would have made it no different here, but an
    // Ambitious one would add 3 pp were it read.
    let traits = [Trait::Ambitious, Trait::Visionary];
    let mut i = arrowhead(&traits);
    i.tech = true;
    i.ttm_revenue = 20.0e6;
    i.born_in_play = true;
    i.ttm_ebit = 10.0e6; // ROA above the 12% hurdle
    i.lt = 0.05;
    i.q_growth = 1.05f64.powf(0.25) - 1.0;
    let p = lock_plan(&i);
    assert_eq!(p.operating.archetype, Archetype::Startup);
    // g_dem 5% + Startup adj 4 pp, no Ambitious or Visionary nudge.
    assert!((p.operating.growth - 0.09).abs() < 1e-12);
    // No Visionary research row either.
    assert_eq!(p.operating.stations.research, 0);
}
