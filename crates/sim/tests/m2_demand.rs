//! M2.5: monthly demand, trend demand and the rate term (spec 5.1). Done when demand follows the
//! draws to 1e-9.

mod common;

use common::data;
use common::economy::{economy_scheduler, month_starts, rel, run_month, world_at_load};
use sim::economy::demand::{month_factor, trend_month_factor};
use sim::rng::RngStreams;
use sim::time::Date;

#[test]
fn demand_follows_the_draws_month_by_month() {
    let d = data();
    let mut rng = RngStreams::new(2024);
    let mut w = world_at_load(&d, &mut rng);
    let s = economy_scheduler();
    let n = w.industries.len();
    // Demand starts at the 2020 world size (7.3).
    for (_, ind) in w.industries.iter() {
        assert_eq!(ind.demand_core, ind.world_size_2020_usd);
        assert_eq!(ind.trend_demand, ind.world_size_2020_usd);
        assert_eq!(ind.demand, ind.world_size_2020_usd);
    }
    // The quarter's growth and lt in force for each month as it is closed (D100).
    let mut quarter: Vec<(f64, f64)> = w
        .industries
        .iter()
        .map(|(_, i)| (i.q_growth, i.lt))
        .collect();
    let mut want_core: Vec<f64> = w.industries.iter().map(|(_, i)| i.demand_core).collect();
    let mut want_trend = want_core.clone();
    for date in month_starts(Date::ymd(2020, 2, 1), Date::ymd(2030, 1, 1)) {
        // The job closes the month before `date`, whose quarter's rates are `quarter`.
        for i in 0..n {
            want_core[i] *= month_factor(quarter[i].0);
            want_trend[i] *= trend_month_factor(quarter[i].1);
        }
        if date == Date::ymd(2025, 6, 1) {
            // The rate term (5.1): s × (base − neutral) comes off; none at neutral.
            w.base_rate = 0.05;
        }
        run_month(&s, &mut w, &mut rng, date);
        for (id, ind) in w.industries.iter() {
            let i = id.0 as usize;
            assert!(
                rel(ind.demand_core, want_core[i]) < 1e-9,
                "{} {date}",
                ind.key
            );
            assert!(
                rel(ind.trend_demand, want_trend[i]) < 1e-9,
                "{} {date}",
                ind.key
            );
            let term = 1.0 - ind.params.rate_sensitivity * (w.base_rate - w.neutral_rate);
            assert!(rel(ind.demand, ind.demand_core * term) < 1e-12);
            if date.month % 3 == 1 {
                // A new quarter was drawn: the old one is now prev, and the new one's months
                // close from the next job on.
                assert_eq!((ind.prev_q_growth, ind.prev_lt), quarter[i]);
                quarter[i] = (ind.q_growth, ind.lt);
            }
        }
    }
    // Demand moves only with the draws: the trend line is smooth, the core is not.
    let ind = w.industries.iter().next().unwrap().1;
    assert_ne!(ind.demand_core, ind.trend_demand);
}
