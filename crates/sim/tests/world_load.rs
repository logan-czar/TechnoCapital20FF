//! The world tables build from today's data in id order, with units converted (build-plan 2.3,
//! decisions D3 and D4).

use sim::world::{CompanyId, Ordinal, World};

fn world() -> World {
    let data = sim_data::load_world(&sim_data::default_data_dir()).expect("data loads");
    World::from_data(&data).expect("world builds")
}

#[test]
fn counts_match_the_data() {
    let w = world();
    assert_eq!(w.countries.len(), 211);
    assert_eq!(w.provinces.len(), 3969);
    assert_eq!(w.companies.len(), 651);
    assert_eq!(w.characters.len(), 296);
    assert_eq!(w.industries.len(), 42);
    assert_eq!(w.zones.len(), 26);
}

#[test]
fn ordinals_follow_ids() {
    let w = world();
    let sorted = |keys: Vec<&str>| keys.windows(2).all(|p| p[0] < p[1]);
    assert!(sorted(
        w.provinces.rows().iter().map(|p| p.key.as_str()).collect()
    ));
    assert!(sorted(
        w.companies.rows().iter().map(|c| c.key.as_str()).collect()
    ));
    assert!(sorted(
        w.countries.rows().iter().map(|c| c.key.as_str()).collect()
    ));
    assert!(sorted(
        w.industries.rows().iter().map(|c| c.key.as_str()).collect()
    ));
    assert!(sorted(
        w.zones.rows().iter().map(|c| c.key.as_str()).collect()
    ));
    assert!(sorted(
        w.characters.rows().iter().map(|c| c.key.as_str()).collect()
    ));
    for (id, c) in w.companies.iter() {
        assert_eq!(CompanyId::from_index(id.index()), id);
        assert!(w.provinces.get(c.hq_province).is_some());
    }
}

#[test]
fn units_convert_once_at_load() {
    let w = world();
    // CO-0001 Arrowhead Drilling: $40M revenue, 6,666,667 shares (companies.csv, company-start.csv).
    let arrowhead = &w.companies[CompanyId(0)];
    assert_eq!(arrowhead.key, "CO-0001");
    assert_eq!(arrowhead.revenue_usd, 40_000_000.0);
    assert_eq!(arrowhead.shares_out, 6_666_667);
    assert_eq!(w.industries[arrowhead.industry].name, "Oil");
    assert_eq!(w.provinces[arrowhead.hq_province].key, "CA-0033");
    let usa = w.countries.iter().find(|(_, c)| c.key == "USA").unwrap().1;
    assert_eq!(usa.gdp_usd, 23_500.0e9);
    assert_eq!(w.zones[usa.zone].key, "NA");
    assert_eq!(w.zones[usa.zone].credit_spread_base, 0.0001);
}
