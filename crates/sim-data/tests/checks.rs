//! Each ported validate.py check catches a broken value and names its file, line and field
//! (build-plan M0.4).

use sim_data::{DataError, WorldData, check, default_data_dir, load_world};

fn world() -> WorldData {
    load_world(&default_data_dir()).unwrap_or_else(|e| panic!("{e}"))
}

/// The checks' errors after `edit`, which must include one at `file`, `line`, `field`.
fn expect_error(edit: impl FnOnce(&mut WorldData), file: &str, line: u64, field: &str) {
    let mut w = world();
    edit(&mut w);
    let errors = check(&w);
    let hit =
        |e: &DataError| e.file == file && e.line == Some(line) && e.field.as_deref() == Some(field);
    assert!(
        errors.iter().any(hit),
        "no error at {file}:{line} {field}; got {errors:#?}"
    );
}

#[test]
fn unknown_key_city_province() {
    expect_error(
        |w| w.key_cities.rows[0].province_ids.push("XX-9999".into()),
        "key-cities.csv",
        2,
        "province_ids",
    );
}

#[test]
fn unknown_specialty() {
    expect_error(
        |w| w.key_cities.rows[3].specialties.push("Alchemy".into()),
        "key-cities.csv",
        5,
        "specialties",
    );
}

#[test]
fn hub_province_outside_zone() {
    // Move zone 1's hub to zone 2's hub province: wrong key city and wrong zone.
    expect_error(
        |w| w.financial_zones.rows[0].hub_province = w.financial_zones.rows[1].hub_province.clone(),
        "financial-zones.csv",
        2,
        "hub_province",
    );
}

#[test]
fn unknown_zone_of_country() {
    expect_error(
        |w| w.country_economy.rows[2].financial_zone = "ZZ".into(),
        "country-economy.csv",
        4,
        "financial_zone",
    );
}

#[test]
fn industry_ranges() {
    expect_error(
        |w| w.industries.rows[1].asset_decay = 0.2,
        "industries.csv",
        3,
        "asset_decay",
    );
    expect_error(
        |w| w.industries.rows[1].crash_drop = 1.0,
        "industries.csv",
        3,
        "crash_drop",
    );
}

#[test]
fn wealth_index_range() {
    expect_error(
        |w| w.countries.rows[0].wealth_index = 100,
        "countries.csv",
        2,
        "wealth_index",
    );
}

#[test]
fn company_start_balance_identity() {
    expect_error(
        |w| w.company_start.rows[0].cash_usd += 10.0,
        "company-start.csv",
        2,
        "book_equity_usd",
    );
    expect_error(
        |w| w.company_start.rows[1].open_price = 250.0,
        "company-start.csv",
        3,
        "open_price",
    );
}

#[test]
fn company_start_lines_within_their_limit() {
    // D15: CO-0002 starts at A- with its line at the 5.12 limit (0.5 × asset book × 0.8); at BBB
    // (0.65) the same line is over it.
    expect_error(
        |w| w.company_start.rows[1].start_rating = "BBB".into(),
        "company-start.csv",
        3,
        "credit_drawn_usd",
    );
    // D15: a line above the 7.1 line (asset book − book value + min_cash).
    expect_error(
        |w| {
            let r = &mut w.company_start.rows[1];
            r.credit_drawn_usd += 20.0e6;
            r.book_equity_usd -= 20.0e6;
        },
        "company-start.csv",
        3,
        "credit_drawn_usd",
    );
    // D16: CO-0006 draws its line; rated CCC it may not.
    expect_error(
        |w| w.company_start.rows[5].start_rating = "CCC".into(),
        "company-start.csv",
        7,
        "start_rating",
    );
    expect_error(
        |w| w.company_start.rows[0].start_rating = "AAA+".into(),
        "company-start.csv",
        2,
        "start_rating",
    );
}

#[test]
fn rating_factors_by_label() {
    // Spec 5.12 rating factors; a notch reads its band's (D220).
    let f = sim_data::rating_factor_of_label;
    assert_eq!(sim_data::RATING_LABELS.len(), 18);
    assert_eq!(f("AAA"), Some(1.0));
    assert_eq!(f("AA-"), Some(0.9));
    assert_eq!(f("BBB+"), Some(0.65));
    assert_eq!(f("BB-"), Some(0.5));
    assert_eq!(f("B+"), Some(0.3));
    assert_eq!(f("CCC"), Some(0.0));
    assert_eq!(f("CC"), Some(0.0));
    assert_eq!(f("C"), None);
    assert_eq!(f("CCC+"), None);
}

#[test]
fn duplicate_province_id() {
    let line = world().provinces[1].lines[1];
    expect_error(
        |w| w.provinces[1].rows[1].id = w.provinces[1].rows[0].id.clone(),
        "provinces-europe.csv",
        line,
        "id",
    );
}

#[test]
fn startup_event_references() {
    expect_error(
        |w| w.startup_events.rows[0].startups[0].industry = "Alchemy".into(),
        "startup-events.csv",
        2,
        "startups",
    );
    expect_error(
        |w| w.startup_events.rows[1].startups[0].regions[0] = "atlantis".into(),
        "startup-events.csv",
        3,
        "startups",
    );
    expect_error(
        |w| w.startup_events.rows[2].date = "2022-13-09".into(),
        "startup-events.csv",
        4,
        "date",
    );
}

#[test]
fn country_culture_must_be_in_its_superregion_file() {
    // USA (line 2) moved to a culture the North America file does not have.
    expect_error(
        |w| w.country_cultures.rows[0].culture = "japanese".into(),
        "names/country-cultures.csv",
        2,
        "culture",
    );
}
