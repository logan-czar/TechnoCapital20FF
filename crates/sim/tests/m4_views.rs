//! The M4 views (spec 9.2, 9.4; one file each): v_statements (`get_company_statements`, the
//! Financials tab), v_filings (`get_filings`, Pdoomberg F5), v_ratings (Pdoomberg F6) and the
//! finance figures of v_company_detail (the Overview tab). Statements are published at the
//! release after their close (spec 4.4; D130).

mod common;

use common::data;
use common::ops::{company, run_to};
use sim::Sim;
use sim::finance::statements::Period;
use sim::time::{Control, Date, DateTime, Quarter};
use sim::views::statements::StatementPeriod;

fn q(year: i32, q: u8) -> Period {
    Period::Quarter(Quarter { year, q })
}

#[test]
fn statements_are_published_at_the_release() {
    let mut sim = Sim::new(data(), 1).unwrap();
    let a = company(sim.world(), "CO-0001");
    // At load Q1 to Q3 2019 are history; Q4 2019 waits for the 2 January 2020 release (4.4).
    let quarters = |sim: &Sim| -> Vec<Period> {
        sim.views()
            .statements
            .get()
            .statements(a, StatementPeriod::Quarter, 20)
            .iter()
            .map(|s| s.period)
            .collect()
    };
    assert_eq!(quarters(&sim), vec![q(2019, 1), q(2019, 2), q(2019, 3)]);
    assert!(
        sim.views()
            .statements
            .get()
            .statements(a, StatementPeriod::Year, 5)
            .is_empty()
    );
    assert_eq!(
        sim.views().filings.get().quarter,
        Some(Quarter { year: 2019, q: 3 })
    );
    run_to(&mut sim, Date::ymd(2020, 1, 2));
    assert_eq!(quarters(&sim).last(), Some(&q(2019, 4)));
    let v = sim.views().statements.get();
    let y = v.statements(a, StatementPeriod::Year, 5);
    assert_eq!(y.len(), 1);
    assert_eq!(y[0].period, Period::Year(2019));
    let f = sim.views().filings.get();
    assert_eq!(f.quarter, Some(Quarter { year: 2019, q: 4 }));
    assert_eq!(f.filings.len(), 651);
    let af = f.of_company(a).unwrap();
    assert_eq!(
        af.revenue,
        sim.world().companies[a].finance.quarters()[3].lines.revenue
    );
    assert!(af.synthetic);
    // Q1 2020 is compiled at the 1 April close, unpublished until the 2 April release.
    run_to(&mut sim, Date::ymd(2020, 4, 1));
    assert_eq!(
        sim.world().companies[a]
            .finance
            .quarters()
            .last()
            .unwrap()
            .period,
        q(2020, 1)
    );
    assert_eq!(quarters(&sim).last(), Some(&q(2019, 4)));
    run_to(&mut sim, Date::ymd(2020, 4, 2));
    assert_eq!(quarters(&sim).last(), Some(&q(2020, 1)));
    assert_eq!(
        sim.views().filings.get().quarter,
        Some(Quarter { year: 2020, q: 1 })
    );
    assert!(!sim.views().filings.get().of_company(a).unwrap().synthetic);
    // Monthly ledgers are not published; Omniscient (debug builds) shows the open quarter's.
    assert!(sim.views().statements.get().months(a, 3).is_empty());
    if cfg!(debug_assertions) {
        run_to(&mut sim, Date::ymd(2020, 6, 1));
        sim.apply(Control::SetOmniscient(true)).unwrap();
        // The view follows at its next quarterly rebuild (the recap, 25 June).
        run_to(&mut sim, Date::ymd(2020, 6, 25));
        let months = sim.views().statements.get().months(a, 3).to_vec();
        assert_eq!(months.len(), 2, "April and May");
        assert_eq!(months[0].month.month, 4);
    }
}

#[test]
fn ratings_and_company_detail_show_the_books() {
    let mut sim = Sim::new(data(), 2).unwrap();
    run_to(&mut sim, Date::ymd(2020, 1, 2));
    sim.step(); // the 01:00 review
    assert_eq!(sim.now(), DateTime::at(Date::ymd(2020, 1, 2), 1));
    let w = sim.world();
    let r = sim.views().ratings.get();
    let d = sim.views().company_detail.get();
    assert_eq!(r.companies.len(), 651);
    let total: usize = r.band_counts().iter().map(|(_, n)| n).sum();
    assert_eq!(total, 651);
    for (id, c) in w.companies.iter() {
        let row = r.get(id).unwrap();
        assert_eq!(row.rating, c.finance.rating);
        assert_eq!(row.implied, c.finance.implied);
        assert_eq!(row.line_limit, c.finance.line.limit);
        assert_eq!(row.line_drawn, c.finance.line.drawn);
        assert_eq!(
            row.line_rate,
            w.base_rate
                + row.home_spread
                + sim::finance::rating::corporate_spread(c.finance.rating)
        );
        // The Overview (monthly) carries what load set: the January figures.
        let o = d.get(id).unwrap();
        assert_eq!(o.cash_usd, c.cash_usd);
        assert_eq!(o.status, c.finance.status());
        assert_eq!(o.archetype, c.archetype);
    }
    // list_companies (monthly): at load, revenue and NI over the trailing published quarters,
    // the synthetic Q1 to Q3 2019 annualized (D228): the run rate.
    let fresh = Sim::new(data(), 2).unwrap();
    let w0 = fresh.world();
    let rows = &fresh.views().company_rows.get().rows;
    assert_eq!(rows.len(), 651);
    for row in rows {
        let c = &w0.companies[row.id];
        let year: f64 = c.finance.quarters()[..4]
            .iter()
            .map(|s| s.lines.revenue)
            .sum();
        assert!(
            (row.revenue_ttm - year).abs() < 1e-6 * year.max(1.0),
            "{}",
            c.key
        );
        assert_eq!(row.rating, c.finance.rating);
    }
    let chile = r.get(company(w, "CO-0179")).unwrap();
    println!(
        "Andes Cobre on 2 January 2020: {} (implied {}), line rate {:.2}% (home spread {:.0} bps)",
        chile.rating,
        chile.implied.implied,
        100.0 * chile.line_rate,
        1e4 * chile.home_spread
    );
}
