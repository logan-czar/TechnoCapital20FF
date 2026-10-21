//! The M2 views, read through the `Sim` API only (spec 9.2 `list_industries`, `get_industry`,
//! `get_cycle`; 9.4 cadences).

mod common;

use common::data;
use sim::Sim;
use sim::time::{Control, Date, DateTime};

#[test]
fn industry_views_at_load_and_after_six_years() {
    let mut sim = Sim::new(data(), 3).unwrap();
    // The top 5 and the detail list rank by the revenue shown; a private company's is a band
    // (D420), so the exact shares and order are checked with Omniscient on.
    let banded_first = sim.views().industry_rows.get().rows[0]
        .top_companies
        .clone();
    assert!(!banded_first.is_empty());
    sim.apply(Control::SetOmniscient(true)).unwrap();
    let v = sim.views();
    let rows = &v.industry_rows.get().rows;
    assert_eq!(rows.len(), 42);
    for r in rows {
        assert_eq!(
            format!(
                "{:.2} {:.2}",
                r.supply_ratio.exact().unwrap(),
                r.market_factor.exact().unwrap()
            ),
            "1.00 1.00"
        );
        assert!(r.top_companies.len() <= 5 && !r.top_companies.is_empty());
        assert!((0.0..1.0).contains(&r.fringe_share.exact().unwrap()));
        let detail = v.industry_detail.get().get(r.id).unwrap();
        assert_eq!(
            detail.companies.first().map(|c| c.company),
            r.top_companies.first().copied()
        );
        let shares: f64 = detail
            .companies
            .iter()
            .map(|c| c.share.exact().unwrap())
            .sum::<f64>()
            + detail.fringe_share.exact().unwrap();
        assert!((shares - 1.0).abs() < 1e-9);
        let revenue =
            |c: &sim::views::industry_detail::IndustryCompany| c.revenue_m.exact().unwrap();
        assert!(
            detail
                .companies
                .windows(2)
                .all(|p| revenue(&p[0]) > revenue(&p[1])
                    || (revenue(&p[0]) == revenue(&p[1]) && p[0].company < p[1].company))
        );
    }
    let end = DateTime::midnight(Date::ymd(2026, 1, 2));
    while sim.now() < end {
        sim.step();
    }
    let detail = &sim.views().industry_detail.get().industries[0];
    assert_eq!(detail.history.len(), 20, "20 closed quarters kept");
    assert_eq!(detail.history.last().unwrap().quarter.year, 2025);
}

#[test]
fn cycle_view_hides_the_pop_date_outside_omniscient() {
    let mut sim = Sim::new(data(), 3).unwrap();
    let c = sim.views().cycle.get().clone();
    assert_eq!(c.zones.len(), 26);
    assert_eq!(c.phase.name(), "Expansion");
    assert!((0.0..0.02).contains(&c.g_t));
    assert!((c.z_avg - 1.07).abs() < 0.005);
    assert_eq!(c.pop_date, None);
    assert_eq!(c.boom_year, None);
    sim.apply(Control::SetOmniscient(true)).unwrap();
    let pop = sim
        .views()
        .cycle
        .get()
        .pop_date
        .expect("shown in Omniscient");
    assert!((2038..=2042).contains(&pop.year));
}
