//! Load-time checks on the starting world: the id, range and balance checks of
//! `tools/mvp-data/validate.py`, ported one for one (build-plan M0.4), plus row counts (M0.2).
//!
//! Python's economy runs (growth and boom runs, profit tables) are not ported here: they become
//! engine tests in M2 (build-plan M2.4, M2.10). Missing or removed columns (validate.py's
//! batch 155 and 157 column checks) are rejected at load, since every row struct denies unknown
//! columns and requires all of its own.
//!
//! Not ported: validate.py's zone spread seed check (credit_spread_bps equals the GDP-weighted
//! member spread unless gen.py's ZONE_ECON_SET sets it by hand) is a generator identity that needs
//! gen.py's hand-set table, so it stays in Python.

use std::collections::{BTreeMap, BTreeSet};

use crate::{DataError, SUPERREGIONS, Table, WorldData};

/// Expected row counts (spec 10 M0, build-plan M0.2).
pub const EXPECTED_COUNTS: [(&str, usize); 11] = [
    ("countries", 211),
    ("provinces", 3255),
    ("companies", 651),
    ("characters", 296),
    ("industries", 42),
    ("country-economy", 211),
    ("financial-zones", 26),
    ("ai-boom", 15),
    ("key-cities", 88),
    ("company-start", 651),
    ("startup-events", 9),
];

/// Asset decay is 0% to 10% a year (validate.py; spec 5.10).
const ASSET_DECAY_MAX: f64 = 0.10;
/// Quarterly growth volatility is 0% to 10% (validate.py; spec 5.1).
const VOLATILITY_MAX: f64 = 0.10;
/// Equality index range (batch 158).
const WEALTH_INDEX_RANGE: (u32, u32) = (10, 95);
/// Zone base credit spread range in bps (batch 155; spec 5.1.2).
const CREDIT_SPREAD_MAX_BPS: f64 = 2500.0;
/// Zone confidence_start range (batch 155; spec 5.13).
const CONFIDENCE_RANGE: (f64, f64) = (-100.0, 100.0);
/// Opening share price range in whole dollars (batch 161; spec 7.1).
const OPEN_PRICE_RANGE: (f64, f64) = (5.0, 200.0);
/// Starting asset book is half of gross assets (spec 7.1).
const ASSET_BOOK_SHARE: f64 = 0.5;
/// min_cash is 5% of revenue; a company drawing its line holds no more (spec 7.1, 5.12).
const MIN_CASH_SHARE: f64 = 0.05;
/// Dollar tolerances of validate.py for rounded balances.
const BALANCE_TOL_USD: f64 = 2.0;
const ASSET_BOOK_TOL_USD: f64 = 1.0;
const MIN_CASH_TOL_USD: f64 = 1.0;
/// Cost shares sum to 1 (validate.py).
const SHARE_SUM_TOL: f64 = 1e-9;
/// The fixed events F1 to F9 bring 32 startups (spec 5.19.2).
const FIXED_EVENT_STARTUPS: u32 = 32;
/// Every startup brings 1 to 5 full and 1 to 5 partial characters (spec 5.19, batch 165).
const CAST_RANGE: (u8, u8) = (1, 5);

/// Runs every check and returns all problems found (empty when the data is good).
pub fn check(w: &WorldData) -> Vec<DataError> {
    let mut errors = Vec::new();
    let ids = Ids::new(w, &mut errors);
    counts(w, &mut errors);
    industries(w, &ids, &mut errors);
    countries(w, &mut errors);
    country_economy(w, &ids, &mut errors);
    zones(w, &ids, &mut errors);
    key_cities(w, &ids, &mut errors);
    companies(w, &ids, &mut errors);
    company_start(w, &mut errors);
    startup_events(w, &ids, &mut errors);
    errors
}

/// Id sets and lookups shared by the checks (BTree types: fixed order, CLAUDE.md).
struct Ids<'a> {
    countries: BTreeSet<&'a str>,
    /// Province id to its country.
    provinces: BTreeMap<&'a str, &'a str>,
    industries: BTreeSet<&'a str>,
    zones: BTreeSet<&'a str>,
}

impl<'a> Ids<'a> {
    fn new(w: &'a WorldData, errors: &mut Vec<DataError>) -> Self {
        let mut provinces = BTreeMap::new();
        for (t, line, p) in w.all_provinces() {
            if provinces
                .insert(p.id.as_str(), p.country.as_str())
                .is_some()
            {
                errors.push(t.err(line, "id", format!("duplicate province id {}", p.id)));
            }
        }
        Self {
            countries: unique(&w.countries, "iso3", |r| &r.iso3, errors),
            provinces,
            industries: unique(&w.industries, "name", |r| &r.name, errors),
            zones: unique(&w.financial_zones, "zone_id", |r| &r.zone_id, errors),
        }
    }
}

/// The set of `key(row)`, reporting duplicates.
fn unique<'a, T>(
    t: &'a Table<T>,
    field: &str,
    key: impl Fn(&'a T) -> &'a str,
    errors: &mut Vec<DataError>,
) -> BTreeSet<&'a str> {
    let mut set = BTreeSet::new();
    for (line, r) in t.iter() {
        if !set.insert(key(r)) {
            errors.push(t.err(line, field, format!("duplicate {field} {}", key(r))));
        }
    }
    set
}

fn counts(w: &WorldData, errors: &mut Vec<DataError>) {
    let have = w.counts();
    for (name, expected) in EXPECTED_COUNTS {
        let n = have.iter().find(|(k, _)| *k == name).map_or(0, |(_, n)| *n);
        if n != expected {
            errors.push(DataError::file(
                format!("{name}.csv"),
                format!("{n} rows, expected {expected}"),
            ));
        }
    }
}

fn industries(w: &WorldData, ids: &Ids, errors: &mut Vec<DataError>) {
    let t = &w.industries;
    unique(t, "id", |r| &r.id, errors);
    // Industry names match companies.csv exactly (validate.py; spec 10.3's 42 industries).
    let used: BTreeSet<&str> = w
        .companies
        .rows
        .iter()
        .map(|c| c.industry.as_str())
        .collect();
    let diff: Vec<_> = ids.industries.symmetric_difference(&used).collect();
    if !diff.is_empty() {
        errors.push(t.file_err(format!(
            "industry names differ from companies.csv: {diff:?}"
        )));
    }
    for (line, r) in t.iter() {
        let mut range = |field: &str, ok: bool, what: &str| {
            if !ok {
                errors.push(t.err(line, field, format!("{}: {what}", r.name)));
            }
        };
        range(
            "asset_decay",
            (0.0..=ASSET_DECAY_MAX).contains(&r.asset_decay),
            "out of 0 to 10%",
        );
        range(
            "asset_decay_threshold_usd",
            r.asset_decay_threshold_usd >= 0.0,
            "negative",
        );
        range(
            "variable_cost_share",
            (r.margin_full_use + r.fixed_cost_share + r.variable_cost_share - 1.0).abs()
                <= SHARE_SUM_TOL,
            "margin_full_use + fixed_cost_share + variable_cost_share is not 1",
        );
        range(
            "volatility",
            (0.0..=VOLATILITY_MAX).contains(&r.volatility),
            "out of 0 to 10% a quarter",
        );
        // spec 5.1.1: boom uplift 0 to 1, crash drop 0 to under 1
        range(
            "boom_uplift",
            (0.0..=1.0).contains(&r.boom_uplift),
            "out of 0 to 1",
        );
        range(
            "crash_drop",
            (0.0..1.0).contains(&r.crash_drop),
            "out of 0 to under 1",
        );
    }
}

fn countries(w: &WorldData, errors: &mut Vec<DataError>) {
    let t = &w.countries;
    let (lo, hi) = WEALTH_INDEX_RANGE;
    for (line, r) in t.iter() {
        if !(lo..=hi).contains(&r.wealth_index) {
            errors.push(t.err(
                line,
                "wealth_index",
                format!(
                    "{} is not an equality index of {lo} to {hi}",
                    r.wealth_index
                ),
            ));
        }
        if !SUPERREGIONS.iter().any(|(_, name)| *name == r.superregion) {
            errors.push(t.err(line, "superregion", format!("unknown {}", r.superregion)));
        }
    }
}

fn country_economy(w: &WorldData, ids: &Ids, errors: &mut Vec<DataError>) {
    let t = &w.country_economy;
    // Every country in exactly one row, so in exactly one financial zone (batch 152).
    let seen = unique(t, "iso3", |r| &r.iso3, errors);
    for (line, r) in t.iter() {
        if !ids.countries.contains(r.iso3.as_str()) {
            errors.push(t.err(line, "iso3", format!("unknown country {}", r.iso3)));
        }
        if !ids.zones.contains(r.financial_zone.as_str()) {
            errors.push(t.err(
                line,
                "financial_zone",
                format!("unknown financial zone {}", r.financial_zone),
            ));
        }
    }
    for iso in ids.countries.difference(&seen) {
        errors.push(t.file_err(format!("{iso} has no row (no financial zone)")));
    }
}

fn zones(w: &WorldData, ids: &Ids, errors: &mut Vec<DataError>) {
    let t = &w.financial_zones;
    unique(t, "exchange_code", |r| &r.exchange_code, errors);
    let members: u32 = t.rows.iter().map(|z| z.countries).sum();
    if members as usize != ids.countries.len() {
        errors.push(t.file_err(format!(
            "member counts sum to {members}, not the {} countries",
            ids.countries.len()
        )));
    }
    let zone_of: BTreeMap<&str, &str> = w
        .country_economy
        .rows
        .iter()
        .map(|r| (r.iso3.as_str(), r.financial_zone.as_str()))
        .collect();
    let cities: BTreeMap<&str, &crate::KeyCity> = w
        .key_cities
        .rows
        .iter()
        .map(|k| (k.city.as_str(), k))
        .collect();
    for (line, z) in t.iter() {
        let id = &z.zone_id;
        if z.intensity <= 0.0 {
            errors.push(t.err(line, "intensity", format!("{id}: must be above 0")));
        }
        if !(0.0..=CREDIT_SPREAD_MAX_BPS).contains(&z.credit_spread_bps) {
            errors.push(t.err(line, "credit_spread_bps", format!("{id}: out of 0 to 2500")));
        }
        let (lo, hi) = CONFIDENCE_RANGE;
        if !(lo..=hi).contains(&z.confidence_start) {
            errors.push(t.err(
                line,
                "confidence_start",
                format!("{id}: out of -100 to +100"),
            ));
        }
        for p in &z.extra_provinces {
            if !ids.provinces.contains_key(p.as_str()) {
                errors.push(t.err(
                    line,
                    "extra_provinces",
                    format!("{id}: unknown province {p}"),
                ));
            }
        }
        // Batch 152: the hub province exists, belongs to the hub key city and lies in the zone.
        let hp = z.hub_province.as_str();
        let Some(country) = ids.provinces.get(hp) else {
            errors.push(t.err(line, "hub_province", format!("{id}: unknown province {hp}")));
            continue;
        };
        match cities.get(z.hub_city.as_str()) {
            None => errors.push(t.err(
                line,
                "hub_city",
                format!("{id}: {} is not in key-cities.csv", z.hub_city),
            )),
            Some(k) if !k.province_ids.iter().any(|p| p == hp) => errors.push(t.err(
                line,
                "hub_province",
                format!("{id}: {hp} is not among {} key city provinces", z.hub_city),
            )),
            Some(_) => {}
        }
        if !z.extra_provinces.iter().any(|p| p == hp) && zone_of.get(country) != Some(&id.as_str())
        {
            errors.push(t.err(
                line,
                "hub_province",
                format!("{id}: {hp} lies in {country}, outside the zone"),
            ));
        }
    }
}

fn key_cities(w: &WorldData, ids: &Ids, errors: &mut Vec<DataError>) {
    let t = &w.key_cities;
    unique(t, "id", |r| &r.id, errors);
    for (line, k) in t.iter() {
        if !ids.countries.contains(k.country.as_str()) {
            errors.push(t.err(
                line,
                "country",
                format!("{}: unknown country {}", k.city, k.country),
            ));
        }
        if k.province_ids.is_empty() {
            errors.push(t.err(line, "province_ids", format!("{}: no provinces", k.city)));
        }
        for p in &k.province_ids {
            if !ids.provinces.contains_key(p.as_str()) {
                errors.push(t.err(
                    line,
                    "province_ids",
                    format!("{}: unknown province {p}", k.city),
                ));
            }
        }
        for s in &k.specialties {
            if !ids.industries.contains(s.as_str()) {
                errors.push(t.err(
                    line,
                    "specialties",
                    format!("{}: unknown industry {s}", k.city),
                ));
            }
        }
    }
}

fn companies(w: &WorldData, ids: &Ids, errors: &mut Vec<DataError>) {
    let t = &w.companies;
    unique(t, "id", |r| &r.id, errors);
    for (line, c) in t.iter() {
        if !ids.countries.contains(c.hq_country.as_str()) {
            errors.push(t.err(
                line,
                "hq_country",
                format!("{}: unknown country {}", c.id, c.hq_country),
            ));
        }
        if !ids.provinces.contains_key(c.hq_province.as_str()) {
            errors.push(t.err(
                line,
                "hq_province",
                format!("{}: unknown province {}", c.id, c.hq_province),
            ));
        }
    }
}

/// Batch 161 (G6): the starting balance sheet, share count and opening price (spec 7.1).
fn company_start(w: &WorldData, errors: &mut Vec<DataError>) {
    let t = &w.company_start;
    let cos = &w.companies.rows;
    if t.rows.iter().map(|r| &r.id).ne(cos.iter().map(|c| &c.id)) {
        errors.push(t.file_err("ids differ from companies.csv (same ids in the same order)"));
        return;
    }
    let (p_lo, p_hi) = OPEN_PRICE_RANGE;
    for ((line, r), c) in t.iter().zip(cos) {
        let id = &r.id;
        let p = r.open_price;
        if p.fract() != 0.0 || !(p_lo..=p_hi).contains(&p) {
            errors.push(t.err(
                line,
                "open_price",
                format!("{id}: {p} is not a whole dollar in 5 to 200"),
            ));
        }
        let assets = r.cash_usd + r.asset_book_usd;
        let claims = r.credit_drawn_usd + r.book_equity_usd;
        if (assets - claims).abs() > BALANCE_TOL_USD {
            errors.push(t.err(
                line,
                "book_equity_usd",
                format!(
                    "{id}: assets {assets:.0} != liabilities {:.0} + equity {:.0}",
                    r.credit_drawn_usd, r.book_equity_usd
                ),
            ));
        }
        if (r.book_equity_usd - c.book_value_usd_m * 1e6).abs() > BALANCE_TOL_USD {
            errors.push(t.err(
                line,
                "book_equity_usd",
                format!("{id}: differs from companies.csv book value"),
            ));
        }
        if (r.asset_book_usd - ASSET_BOOK_SHARE * r.gross_assets_usd).abs() > ASSET_BOOK_TOL_USD
            || r.asset_book_usd.min(r.cash_usd).min(r.credit_drawn_usd) < 0.0
        {
            errors.push(t.err(
                line,
                "asset_book_usd",
                format!("{id}: not 50% of gross, or a negative balance"),
            ));
        }
        if r.credit_drawn_usd > 0.0
            && r.cash_usd > MIN_CASH_SHARE * 1e6 * c.revenue_usd_m + MIN_CASH_TOL_USD
        {
            errors.push(t.err(
                line,
                "cash_usd",
                format!("{id}: draws the line while holding cash above min_cash"),
            ));
        }
        if r.shares < 1.0 || (r.shares * p - r.engine_value_usd).abs() > p {
            errors.push(t.err(
                line,
                "shares",
                format!("{id}: shares x open_price is not the engine value"),
            ));
        }
    }
}

/// The fixed startup events F1 to F9 (spec 5.19.2, build-plan M0.5); the twin of validate.py's.
fn startup_events(w: &WorldData, ids: &Ids, errors: &mut Vec<DataError>) {
    use crate::EventTrigger;
    let t = &w.startup_events;
    let expected = (1..=9).map(|i| format!("F{i}"));
    if t.rows.iter().map(|e| e.id.clone()).ne(expected) {
        errors.push(t.file_err("expected the 9 rows F1 to F9 in order"));
    }
    let region_ok = |r: &str| {
        r == "any" || SUPERREGIONS.iter().any(|(slug, _)| *slug == r) || ids.countries.contains(r)
    };
    let mut startups = 0;
    for (line, e) in t.iter() {
        let id = &e.id;
        let date_ok = match e.trigger {
            EventTrigger::Date => is_iso_date(&e.date),
            EventTrigger::AfterBust => e.date.is_empty(),
        };
        if !date_ok {
            errors.push(t.err(
                line,
                "date",
                format!("{id}: `{}` does not fit the trigger", e.date),
            ));
        }
        if e.startups.is_empty() {
            errors.push(t.err(line, "startups", format!("{id}: no startups")));
        }
        for g in &e.startups {
            startups += g.count;
            if !ids.industries.contains(g.industry.as_str()) {
                errors.push(t.err(
                    line,
                    "startups",
                    format!("{id}: unknown industry {}", g.industry),
                ));
            }
            for r in g.regions.iter().filter(|r| !region_ok(r)) {
                errors.push(t.err(line, "startups", format!("{id}: unknown region {r}")));
            }
        }
        if !(e.revenue_min_usd_m > 0.0 && e.revenue_min_usd_m <= e.revenue_max_usd_m) {
            errors.push(t.err(
                line,
                "revenue_max_usd_m",
                format!("{id}: bad revenue range"),
            ));
        }
        let (lo, hi) = CAST_RANGE;
        for (field, min, max) in [
            ("full_max", e.full_min, e.full_max),
            ("partial_max", e.partial_min, e.partial_max),
        ] {
            if !(lo <= min && min <= max && max <= hi) {
                errors.push(t.err(
                    line,
                    field,
                    format!("{id}: cast {min} to {max} not within 1 to 5"),
                ));
            }
        }
    }
    if !t.is_empty() && startups != FIXED_EVENT_STARTUPS {
        errors.push(t.file_err(format!("{startups} startups, expected 32")));
    }
}

/// `YYYY-MM-DD` with a month of 1 to 12 and a day of 1 to 31.
fn is_iso_date(s: &str) -> bool {
    let parts: Vec<_> = s.split('-').collect();
    let num = |p: &str, len: usize| p.len() == len && p.bytes().all(|b| b.is_ascii_digit());
    match parts[..] {
        [y, m, d] if num(y, 4) && num(m, 2) && num(d, 2) => {
            (1..=12).contains(&m.parse::<u8>().unwrap_or(0))
                && (1..=31).contains(&d.parse::<u8>().unwrap_or(0))
        }
        _ => false,
    }
}
