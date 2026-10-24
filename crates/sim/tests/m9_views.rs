//! The M9 views (docs/build/m9-plan.md section 2; spec 9.2, 9.4): cap table, characters,
//! countries, places, zones, rates, the clock's next release, the company row additions, the
//! births column and event names, the Omniscient toggle, the EFV history, and the rule that
//! building views never moves an RNG stream. Expected values come from the data tables and the
//! spec.

mod common;

use common::data;
use common::ops::{company, company_row, run_to};
use sim::finance::rating::Rating;
use sim::people::traits::Trait;
use sim::time::{Control, Controls, Date, DateTime};
use sim::views::cap_table::CapHolder;
use sim::views::characters::{CharacterRef, Role};
use sim::views::company_rows::Listing;
use sim::views::price_bars::Resolution;
use sim::world::{ControllerRef, Ordinal, Origin};
use sim::{RngStreams, Sim};

fn character<'a>(data: &'a sim_data::WorldData, key: &str) -> &'a sim_data::Character {
    data.characters.rows.iter().find(|c| c.id == key).unwrap()
}

#[test]
fn cap_tables_split_the_starting_block_by_the_controller_stake() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let v = sim.views().cap_table.get();
    for (id, c) in w.companies.iter() {
        let t = v.get(id).unwrap();
        assert_eq!(t.lines.iter().map(|l| l.shares).sum::<u64>(), c.shares_out);
    }
    // Arrowhead (CO-0001): Terry Tippacanoe (CH-0002) holds 60% of 6,666,667 shares
    // (companies.csv, company-start.csv): 4,000,000 rounded; the other holders the rest.
    let a = v.get(company(w, "CO-0001")).unwrap();
    let row = company_row(&d, "CO-0001");
    let shares: u64 = d
        .company_start
        .rows
        .iter()
        .find(|s| s.id == "CO-0001")
        .unwrap()
        .shares as u64;
    assert_eq!(shares, 6_666_667);
    assert_eq!(row.controller_stake_pct, Some(60.0));
    assert_eq!(a.lines.len(), 2);
    assert_eq!(a.lines[0].name, character(&d, "CH-0002").name);
    assert!(matches!(
        a.lines[0].holder,
        CapHolder::Controller(ControllerRef::Character(_))
    ));
    assert_eq!(a.lines[0].shares, 4_000_000);
    assert_eq!(a.lines[1].holder, CapHolder::OtherHolders);
    assert_eq!(a.lines[1].shares, 2_666_667);
    assert!((a.lines[0].share - 0.6).abs() < 1e-6);
    // A state champion (CO-0138, Saudi Arabia 98%) and a widely held company (CO-0123).
    let ghawar = v.get(company(w, "CO-0138")).unwrap();
    assert_eq!(ghawar.lines[0].name, "Saudi Arabia");
    assert!((ghawar.lines[0].share - 0.98).abs() < 1e-6);
    let lacoste = v.get(company(w, "CO-0123")).unwrap();
    assert_eq!(lacoste.lines.len(), 1);
    assert_eq!(lacoste.lines[0].holder, CapHolder::OtherHolders);
    // A subsidiary (CO-0134, 100% CO-0132) names its parent company and has no other holders.
    let halcyon = v.get(company(w, "CO-0134")).unwrap();
    assert_eq!(halcyon.lines.len(), 1);
    assert_eq!(halcyon.lines[0].name, company_row(&d, "CO-0132").name);
}

#[test]
fn characters_list_terry_with_his_roles_and_holdings() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let v = sim.views().characters.get();
    assert_eq!(v.full.len(), d.characters.rows.len());
    let terry_id = w
        .characters
        .iter()
        .find(|(_, c)| c.key == "CH-0002")
        .unwrap()
        .0;
    let t = v.get(terry_id).unwrap();
    let csv = character(&d, "CH-0002");
    assert_eq!((t.name.as_str(), t.age), (csv.name.as_str(), csv.age));
    assert_eq!(
        (t.skills.finance, t.skills.operations, t.skills.persuasion),
        (csv.finance, csv.operations, csv.persuasion)
    );
    assert_eq!(
        (t.skills.intrigue, t.skills.tech, t.skills.hustle),
        (csv.intrigue, csv.tech, csv.hustle)
    );
    let traits: Vec<Trait> = csv
        .traits
        .iter()
        .filter_map(|n| Trait::from_name(n.trim()))
        .collect();
    assert_eq!(t.traits, traits);
    assert!(t.full && t.id == CharacterRef::Full(terry_id));
    let home = t.home.as_ref().unwrap();
    assert_eq!(
        (home.province_name.as_str(), home.country_name.as_str()),
        ("Edmonton", "Canada")
    );
    // companies.csv: Terry controls CO-0001 to CO-0003 (60%, 100%, 100%).
    let controls: Vec<String> = t
        .roles
        .iter()
        .filter_map(|r| match r {
            Role::Controller { company } => Some(w.companies[*company].key.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(controls, ["CO-0001", "CO-0002", "CO-0003"]);
    assert_eq!(t.holdings.len(), 3);
    assert!((t.holdings[0].share - 0.6).abs() < 1e-6);
    assert!((t.holdings[1].share - 1.0).abs() < 1e-12);
    // A proxy: CH-0107 is the owner of record of CO-0031 and CO-0032 (companies.csv).
    let proxy_id = w
        .characters
        .iter()
        .find(|(_, c)| c.key == "CH-0107")
        .unwrap()
        .0;
    let owned: Vec<String> = v
        .get(proxy_id)
        .unwrap()
        .roles
        .iter()
        .filter_map(|r| match r {
            Role::OwnerOfRecord { company } => Some(w.companies[*company].key.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(owned, ["CO-0031", "CO-0032"]);
    // Every seated simple character is listed once, as partial, with its seat.
    let seated = w
        .companies
        .rows()
        .iter()
        .flat_map(|c| c.board.iter().flatten())
        .filter(|h| matches!(h, sim::world::SeatHolder::Simple(_)))
        .count();
    assert_eq!(v.partial.len(), seated);
    assert!(
        v.partial
            .iter()
            .all(|p| !p.full && p.home.is_none() && p.roles.len() == 1)
    );
    assert!(v.partial.windows(2).all(|p| p[0].id < p[1].id));
}

#[test]
fn countries_places_zones_and_rates_read_the_data() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let v = sim.views();
    let countries = v.countries.get();
    assert_eq!(countries.countries.len(), d.countries.rows.len());
    // countries.csv and country-economy.csv: the United States.
    let usa = countries.by_iso3("USA").unwrap();
    assert_eq!(
        (usa.name.as_str(), usa.superregion.as_str()),
        ("United States", "North America")
    );
    assert_eq!(usa.sovereign_rating, Rating::Aaa);
    assert_eq!((usa.sovereign_spread, usa.corp_tax_rate), (0.0, 0.258));
    let hq_usa = d
        .companies
        .rows
        .iter()
        .filter(|c| c.hq_country == "USA")
        .count();
    assert_eq!(usa.hq_companies.len(), hq_usa);
    assert_eq!(hq_usa, 109);
    let total: usize = countries
        .countries
        .iter()
        .map(|c| c.hq_companies.len())
        .sum();
    assert_eq!(total, 651);

    let places = v.places.get();
    assert_eq!(places.provinces.len(), d.all_provinces().count());
    assert_eq!(places.provinces.len(), 3968);
    let edmonton = places
        .provinces
        .iter()
        .find(|p| p.key == "CA-0033")
        .unwrap();
    assert_eq!(
        places.place_name(edmonton.id).as_deref(),
        Some("Edmonton, Canada")
    );

    // 26 zones (spec 5.1.2, batch 154); every country in exactly one; spreads as v_cycle.
    let zones = v.zones.get();
    assert_eq!(zones.zones.len(), 26);
    let members: usize = zones.zones.iter().map(|z| z.members.len()).sum();
    assert_eq!(members, countries.countries.len());
    for (z, c) in zones.zones.iter().zip(&v.cycle.get().zones) {
        assert_eq!(
            (z.id, z.credit_spread, z.confidence),
            (c.id, c.credit_spread, c.confidence)
        );
        for m in &z.members {
            assert_eq!(countries.get(*m).unwrap().zone, z.id);
        }
    }

    // F7 Bonds (spec 5.12 table, batch 155): base 3%, AAA 40 bps to CC 1,600 bps.
    let rates = v.rates.get();
    assert_eq!(rates.base_rate, 0.03);
    assert_eq!(rates.rating_spreads.len(), 18);
    assert_eq!(rates.rating_spreads[0].rating, Rating::Aaa);
    assert_eq!(rates.rating_spreads[0].spread, 0.0040);
    assert_eq!(rates.rating_spreads[17].rating, Rating::Cc);
    assert_eq!(rates.rating_spreads[17].spread, 0.1600);
    assert_eq!(rates.zones.len(), 26);
    let usa_rate = &rates.sovereigns[usa.id.index()];
    assert_eq!((usa_rate.rating, usa_rate.spread), (Rating::Aaa, 0.0));
}

#[test]
fn the_clock_shows_the_next_release() {
    let mut sim = Sim::new(data(), 1).unwrap();
    // Spec 4.4 row 1: releases at 00:00 on 2 January, April, July and October.
    assert_eq!(
        sim.clock().next_release,
        DateTime::midnight(Date::ymd(2020, 1, 2))
    );
    run_to(&mut sim, Date::ymd(2020, 1, 2));
    assert_eq!(
        sim.clock().next_release,
        DateTime::midnight(Date::ymd(2020, 4, 2))
    );
}

#[test]
fn company_rows_carry_archetype_origin_listing_and_control() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let rows = &sim.views().company_rows.get().rows;
    let row = |key: &str| rows.iter().find(|r| r.key == key).unwrap();
    let a = row("CO-0001");
    assert_eq!(a.origin, Origin::Start);
    assert_eq!(a.archetype, w.companies[a.id].archetype);
    assert!(
        matches!(a.listing, Listing::BeforeStart { .. }),
        "listed before 2020"
    );
    assert_eq!(a.listing.date(), None);
    assert_eq!(a.listing.exchange(), a.exchange);
    assert_eq!(a.controller_name.as_deref(), Some("Terry Tippacanoe"));
    assert_eq!(a.owner_of_record, None);
    assert!(!a.estimated && a.revenue_ttm.exact().is_some());
    // CO-0031 is private, held for CH-0011 by its owner of record CH-0107 (companies.csv).
    let b = row("CO-0031");
    assert_eq!(b.listing, Listing::Private);
    assert_eq!(
        b.controller_name.as_deref(),
        Some(character(&d, "CH-0011").name.as_str())
    );
    assert_eq!(
        b.owner_of_record_name.as_deref(),
        Some(character(&d, "CH-0107").name.as_str())
    );
    assert!(b.estimated && b.revenue_ttm.band().is_some() && b.value.band().is_some());
    // A widely held company has no controller.
    assert_eq!(row("CO-0123").controller, ControllerRef::None);
    assert_eq!(row("CO-0123").controller_name, None);
}

#[test]
fn births_count_the_last_four_quarters_and_name_their_events() {
    let mut sim = Sim::new(data(), 1).unwrap();
    // F1 fires at the 9 April 2020 plan lock (startup-events.csv) with 2 AI labs.
    run_to(&mut sim, Date::ymd(2020, 4, 9));
    let v = sim.views().births.get().clone();
    let f1 = v
        .events
        .iter()
        .find(|e| matches!(&e.kind, sim::births::random::EventKind::Fixed(id) if id == "F1"))
        .expect("F1 fired");
    assert_eq!(
        f1.name,
        "The transformer paper: researchers leave to build on it"
    );
    for b in &v.births {
        assert!(v.event(b.event).is_some());
    }
    assert_eq!(v.births_column_quarters.len(), 4);
    let counted: usize = v.births_by_industry.iter().sum();
    assert_eq!(
        counted,
        v.births.len(),
        "every 2020 birth is in the last 4 quarters"
    );
    assert!(counted >= 2);
    // A year and a half on, the Q2 2020 births have left the column.
    run_to(&mut sim, Date::ymd(2021, 10, 9));
    let v = sim.views().births.get();
    let first = v.births_column_quarters[0];
    let want = v
        .births
        .iter()
        .filter(|b| b.date.quarter() >= first)
        .count();
    assert_eq!(v.births_by_industry.iter().sum::<usize>(), want);
    assert!(want < v.births.len());
}

#[test]
fn omniscient_toggles_rebuild_the_banded_views_at_once() {
    let mut sim = Sim::new(data(), 1).unwrap();
    run_to(&mut sim, Date::ymd(2020, 2, 10));
    let private = company(sim.world(), "CO-0002");
    let before = sim.views().statements.version();
    assert!(sim.views().statements.get().get(private).unwrap().estimated);
    // A speed change rebuilds none of them (D423).
    sim.apply(Control::SetSpeed(3)).unwrap();
    assert_eq!(sim.views().statements.version(), before);
    sim.apply(Control::SetOmniscient(true)).unwrap();
    let v = sim.views();
    assert!(v.statements.version() > before && v.statements.is_dirty());
    let s = v.statements.get().get(private).unwrap();
    assert!(!s.estimated && s.estimated_quarters.is_empty() && !s.quarters().is_empty());
    let truth = sim.world().companies[private].cash_usd;
    assert_eq!(
        v.company_detail
            .get()
            .get(private)
            .unwrap()
            .cash_usd
            .exact(),
        Some(truth)
    );
    sim.apply(Control::SetOmniscient(false)).unwrap();
    let s = sim.views().statements.get().get(private).unwrap();
    assert!(s.estimated && s.quarters().is_empty() && !s.estimated_quarters.is_empty());

    // The quarterly rebuild reuses archived quarters' estimates (D435): after a year of
    // rebuilds, a fresh build (the toggle) gives the same view.
    run_to(&mut sim, Date::ymd(2021, 4, 2));
    let rebuilt = sim.views().statements.get().clone();
    let banded = rebuilt.companies.iter().filter(|c| c.estimated).count();
    assert!(banded > 100);
    sim.apply(Control::SetOmniscient(true)).unwrap();
    sim.apply(Control::SetOmniscient(false)).unwrap();
    assert_eq!(sim.views().statements.get(), &rebuilt);
}

#[test]
fn daily_bars_keep_the_day_s_efv() {
    let mut sim = Sim::new(data(), 4).unwrap();
    let a = company(sim.world(), "CO-0001");
    run_to(&mut sim, Date::ymd(2020, 3, 3));
    // At 23:00 the quote shows the EFV in force; the 00:00 close stores it with the bar
    // (D424), before the day's fair value refresh.
    while sim.now() < DateTime::at(Date::ymd(2020, 3, 3), 23) {
        sim.step();
    }
    let efv = sim.views().quotes.get().get(a).unwrap().efv;
    sim.step();
    let bar = *sim.world().market.stocks[a].bars.last().unwrap();
    assert_eq!(bar.date, Date::ymd(2020, 3, 3));
    assert_eq!(bar.efv, efv);
    assert!(bar.efv_low() < bar.efv && bar.efv < bar.efv_high());
    // The view serves it; a weekly bar takes its last day's EFV.
    let bars = sim.views().price_bars.get();
    let daily = bars.get_price_history(a, Resolution::Daily, Date::ymd(2020, 1, 1), bar.date);
    assert_eq!(daily.last().unwrap().efv, efv);
    assert!(daily.iter().all(|b| b.efv > 0.0));
    let weekly = bars.get_price_history(a, Resolution::Weekly, Date::ymd(2020, 1, 1), bar.date);
    assert_eq!(weekly.last().unwrap().efv, efv);
}

#[test]
fn building_views_moves_no_rng_stream() {
    // The same seed run through a bare scheduler (no views at all) and through `Sim` (views
    // after every tick, and Omniscient and watchlist controls rebuilding views between ticks)
    // ends in the same world and the same RNG positions (D421).
    let d = data();
    let seed = 9;
    let mut sim = Sim::new(d.clone(), seed).unwrap();
    let mut rng = RngStreams::new(seed);
    let mut world = sim::start_world(&d, &mut rng).unwrap();
    let scheduler = sim::scheduler();
    let controls = Controls::default();
    let end = DateTime::midnight(Date::ymd(2020, 7, 10));
    let mut tick = 0u32;
    while sim.now() < end {
        sim.step();
        let mut notices = Vec::new();
        scheduler.run_tick(&mut world, &mut rng, &mut notices, &controls, None);
        tick += 1;
        if tick.is_multiple_of(500) {
            let on = !sim.controls().omniscient;
            sim.apply(Control::SetOmniscient(on)).unwrap();
            sim.apply(Control::WatchlistAdd(sim::world::CompanyId::from_index(
                tick as usize % 651,
            )))
            .unwrap();
        }
    }
    assert_eq!(&world, sim.world());
    assert_eq!(sim.state_hash(), sim::hash::state_hash(&world, &rng));
}

#[test]
fn past_recaps_open_by_quarter() {
    // m9-plan section 1: past recaps are reachable by quarter; the World keeps the last 20
    // (D433) and v_recap serves each with the same banding.
    let mut sim = Sim::new(data(), 2).unwrap();
    run_to(&mut sim, Date::ymd(2021, 1, 2));
    let v = sim.views().recap.get();
    let quarters: Vec<String> = v
        .recaps
        .iter()
        .map(|r| r.world.quarter.to_string())
        .collect();
    assert_eq!(v.recaps.len(), 4, "{quarters:?}");
    assert_eq!(sim.world().recaps.len(), 4);
    let q3 = sim::time::Quarter { year: 2020, q: 3 };
    let page = v.quarter(q3).unwrap();
    assert_eq!(page.world.quarter, q3);
    let private = company(sim.world(), "CO-0002");
    assert!(page.company(private).unwrap().estimated);
    assert_eq!(
        v.latest().unwrap().world.quarter,
        sim::time::Quarter { year: 2020, q: 4 }
    );
    assert_eq!(sim::recap::jobs::RECAPS_KEPT, 20);
}
