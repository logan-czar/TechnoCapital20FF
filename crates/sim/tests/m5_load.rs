//! Build-plan M5.1 and M5.2 on the live engine (spec 7.1 Shares row, 5.13, 5.14): the market
//! the load builds. Every company's fair value at load is its engine value and matches
//! company-start.csv `engine_value_usd`; P is the 7.1 open price ($5 to $200), worked out here
//! from the engine value with gen.py's id-seeded jitter; V = engine value ÷ shares sits at P up to
//! the share rounding; the stored basis is the load basis (E_norm = run-rate NI, G at g 0); every
//! exchange with a listed company starts at 1,000 and the others show no level; private companies
//! have a value and no quote.

mod common;

use common::data;
use sim::Sim;
use sim::world::{Ordinal, ZoneId};

/// Spec 7.1 (batch 161; gen.py `PRICE_*`): `open_price = clamp(round($25 × (value ÷ $1B)^0.35
/// × jitter), $5, $200)`, jitter up to ±10% seeded by the company id.
const PRICE_BASE: f64 = 25.0;
const PRICE_REF_USD: f64 = 1e9;
const PRICE_EXP: f64 = 0.35;
const PRICE_MIN: f64 = 5.0;
const PRICE_MAX: f64 = 200.0;
const PRICE_JITTER: f64 = 0.10;
/// Spec 5.14: every headline index starts at 1,000.
const INDEX_BASE: f64 = 1000.0;
/// Spec 5.13 step 6: private companies show 0.7 × fair value.
const PRIVATE_DISCOUNT: f64 = 0.7;

/// CRC-32 (IEEE, reflected), as Python's `zlib.crc32`.
fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &b in bytes {
        crc ^= u32::from(b);
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

/// gen.py `price_jitter`: `1 + 0.10 × (2 × (crc32("price:" + id) mod 10001) ÷ 10000 − 1)`.
fn jitter(id: &str) -> f64 {
    let h = crc32(format!("price:{id}").as_bytes()) % 10001;
    1.0 + PRICE_JITTER * (2.0 * f64::from(h) / 10000.0 - 1.0)
}

/// The 7.1 open price of a value (Python's `round` rounds halves to even).
fn open_price(value: f64, id: &str) -> f64 {
    let p = PRICE_BASE * (value / PRICE_REF_USD).powf(PRICE_EXP) * jitter(id);
    p.round_ties_even().clamp(PRICE_MIN, PRICE_MAX)
}

#[test]
fn crc32_matches_python() {
    // zlib.crc32(b"price:CO-0001") and the classic check value.
    assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
}

#[test]
fn load_values_match_company_start_and_open_at_v() {
    let d = data();
    let sim = Sim::new(d.clone(), 1).unwrap();
    let w = sim.world();
    let csv: std::collections::BTreeMap<&str, &sim_data::CompanyStart> = d
        .company_start
        .rows
        .iter()
        .map(|r| (r.id.as_str(), r))
        .collect();
    let mut worst_usd: f64 = 0.0;
    let mut worst_gap: f64 = 0.0;
    let mut listed = 0;
    for (id, c) in w.companies.iter() {
        let s = &w.market.stocks[id];
        let row = csv[c.key.as_str()];
        // M5.2: the engine value at load is company-start.csv's, to the dollar it was rounded to.
        let diff = (s.fair_value - row.engine_value_usd).abs();
        worst_usd = worst_usd.max(diff);
        assert!(
            diff <= 1.0 + 1e-9 * row.engine_value_usd,
            "{}: engine value {} vs company-start.csv {}",
            c.key,
            s.fair_value,
            row.engine_value_usd
        );
        assert_eq!(c.shares_out as f64, row.shares, "{}", c.key);
        // V = fair value ÷ shares_out (5.13 step 6).
        assert!((s.value - s.fair_value / c.shares_out as f64).abs() < 1e-12 * s.value.max(1.0));
        // The load basis (D244): g 0, so E_norm = 0.6 NI + 0.4 NI = NI, and G = clamp(1 − 2.5 ×
        // lt, 0.5, 2.5) with lt the industry's trend_growth at load.
        let lt = w.industries[c.industry].params.trend_growth;
        let g = (1.0 - 2.5 * lt).clamp(0.5, 2.5);
        assert!((s.basis.growth_factor - g).abs() < 1e-12, "{}", c.key);
        assert!(s.basis.e_norm.is_some(), "{}", c.key);
        assert_eq!(s.buzz, 0.0);
        if c.public {
            listed += 1;
            assert!(s.quoted && s.exchange.is_some(), "{}", c.key);
            assert_eq!(s.exchange, Some(w.countries[c.hq_country].zone));
            // The 7.1 open price, from the engine value, is P; $5 to $200.
            assert_eq!(s.price, row.open_price, "{}", c.key);
            assert_eq!(open_price(s.fair_value, &c.key), s.price, "{}", c.key);
            assert!((PRICE_MIN..=PRICE_MAX).contains(&s.price), "{}", c.key);
            // P = V up to shares = round(value ÷ open_price): |V ÷ P − 1| ≤ 0.5 ÷ shares, plus
            // the dollar the CSV value was rounded to.
            let gap = (s.value / s.price - 1.0).abs();
            worst_gap = worst_gap.max(gap);
            let bound = 0.5 / c.shares_out as f64 + 1.0 / row.engine_value_usd + 1e-12;
            assert!(gap <= bound, "{}: |V/P − 1| = {gap} > {bound}", c.key);
            // The first bar opens at P on 1 January; the day's change starts at 0.
            assert_eq!(s.bar.open, s.price);
            assert_eq!(s.prev_close, s.price);
        } else {
            assert!(!s.quoted && s.exchange.is_none(), "{}", c.key);
            assert_eq!(s.price, 0.0);
        }
    }
    assert_eq!(listed, 467);
    println!("engine value vs company-start.csv: worst ${worst_usd:.4}; worst |V/P − 1| {worst_gap:.2e}");

    // Arrowhead (ARDR): $9 × about 6.67M shares = $60M, its 0.6 × book floor (7.1).
    let ardr = w.companies.iter().find(|(_, c)| c.key == "CO-0001").unwrap().0;
    let s = &w.market.stocks[ardr];
    assert_eq!(s.price, 9.0);
    assert_eq!(w.companies[ardr].shares_out, 6_666_667);
    assert!((s.fair_value - 60_000_000.0).abs() < 1.0);
}

#[test]
fn every_exchange_with_a_listing_opens_at_1000() {
    let sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    let quotes = sim.views().quotes.get();
    let exchanges = sim.views().exchanges.get();
    assert_eq!(w.zones.len(), 26);
    assert_eq!(exchanges.exchanges.len(), 26);
    let mut with_listing = 0;
    for z in w.zones.ids() {
        let listed: Vec<_> = w
            .market
            .stocks
            .iter()
            .filter(|(_, s)| s.exchange == Some(z))
            .collect();
        let level = quotes.index(z).unwrap().level;
        let row = &exchanges.exchanges[z.index()];
        assert_eq!(row.listed_count, listed.len());
        assert_eq!(row.code, w.zones[z].exchange_code);
        if listed.is_empty() {
            assert_eq!(level, None, "{}: no listing shows no level", row.code);
        } else {
            with_listing += 1;
            let l = level.unwrap();
            assert!((l - INDEX_BASE).abs() < 1e-9, "{}: {l}", row.code);
        }
    }
    println!("{with_listing} of 26 exchanges have a listed company at load");
    assert!(with_listing > 0);
    let _ = ZoneId::from_index(0);
}

#[test]
fn private_companies_show_seventy_percent_of_fair_value() {
    let sim = Sim::new(data(), 1).unwrap();
    let w = sim.world();
    let detail = &sim.views().company_detail.get().companies;
    for (id, c) in w.companies.iter() {
        if c.public {
            continue;
        }
        let s = &w.market.stocks[id];
        let shown = detail[id.index()].shown_value_per_share;
        assert!((shown - PRIVATE_DISCOUNT * s.value).abs() < 1e-9 * s.value.max(1.0));
        assert!(sim.views().quotes.get().get(id).is_none(), "no quote");
    }
}
