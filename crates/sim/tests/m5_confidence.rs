//! Build-plan M5.7 on the live engine (spec 5.1.2; batch 157, 2a; D251): each zone exchange's
//! investor confidence moves once a day at 00:00 by `clamp(0.9 × c + 3 × r + news, −100, +100)`,
//! with r the headline index's return that day in %, written out here from the index levels at
//! each daily close. The day's headlines are lane F's M6.5 news wire: until it lands the hook
//! returns none (D137), so news is 0. An exchange with no listed company has r 0 and no news and
//! decays to 0: a test job puts one at +100 on the first tick, and it falls by 10% a day to exactly
//! 0 after 94 quiet days (under 0.005 reads 0, D251).

mod common;

use std::sync::atomic::{AtomicUsize, Ordering};

use common::data;
use sim::Sim;
use sim::market::jobs::{confidence_headlines, confidence_news};
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{Ordinal, World, ZoneId};

/// Spec 5.1.2: 0.9 kept a day, 3 points per 1% of index return.
const RETAIN: f64 = 0.9;
const POINTS_PER_PERCENT: f64 = 3.0;
/// D251: days from ±100 to exactly 0.
const QUIET_DAYS_TO_ZERO: usize = 94;

static EMPTY_ZONE: AtomicUsize = AtomicUsize::new(usize::MAX);

fn shock_empty_zone(w: &mut World, ctx: &mut JobCtx<'_>) {
    if ctx.facts.now == DateTime::at(Date::ymd(2020, 1, 1), 1) {
        let z = ZoneId::from_index(EMPTY_ZONE.load(Ordering::SeqCst));
        w.zones[z].confidence = 100.0;
    }
}

/// Σ P × shares ÷ divisor of the quoted companies on `z` (spec 5.14), written out.
fn level(w: &World, z: ZoneId) -> Option<f64> {
    let cap: f64 = w
        .market
        .stocks
        .iter()
        .filter(|(_, s)| s.quoted && s.exchange == Some(z))
        .map(|(id, s)| s.price * w.companies[id].shares_out as f64)
        .sum();
    w.market.indices[z].divisor.map(|d| cap / d)
}

#[test]
fn confidence_follows_the_index_and_decays_to_zero_with_no_news() {
    let mut sim = Sim::new(data(), 6).unwrap();
    let w = sim.world();
    let empty = w
        .zones
        .ids()
        .find(|&z| !w.market.stocks.rows().iter().any(|s| s.exchange == Some(z)))
        .expect("an exchange with no listed company");
    EMPTY_ZONE.store(empty.index(), Ordering::SeqCst);
    let zones: Vec<ZoneId> = w.zones.ids().collect();
    // Every zone starts at confidence_start, 0 for all (5.1.2).
    assert!(w.zones.iter().all(|(_, z)| z.confidence == 0.0));
    sim.register_test_job(Slot::Alerts, "test.shock", shock_empty_zone);
    let mut prev_conf: Vec<f64> = zones
        .iter()
        .map(|&z| sim.world().zones[z].confidence)
        .collect();
    let mut prev_level: Vec<Option<f64>> = zones.iter().map(|&z| level(sim.world(), z)).collect();
    let mut days = 0;
    let mut news_days = 0;
    let mut empty_path = Vec::new();
    let end = DateTime::midnight(Date::ymd(2020, 5, 1));
    while sim.now() < end {
        sim.step();
        let w = sim.world();
        if sim.now() == DateTime::at(Date::ymd(2020, 1, 1), 1) {
            prev_conf[empty.index()] = 100.0;
        }
        if sim.now().hour() != 0 {
            continue;
        }
        days += 1;
        for &z in &zones {
            // Since M6.5 the day's Pdoomberg Wire headlines on the exchange's companies carry
            // their 5.1.2 points (D137, D158); the empty exchange has none.
            let headlines = confidence_headlines(w, z);
            for h in &headlines {
                let c = h.company.expect("a confidence headline names its company");
                assert_eq!(w.market.stocks[c].exchange, Some(z));
            }
            let news = confidence_news(&headlines);
            if news != 0.0 {
                news_days += 1;
            }
            if z == empty {
                assert!(headlines.is_empty());
            }
            let now = level(w, z);
            let r = match (prev_level[z.index()], now) {
                (Some(a), Some(b)) => (b / a - 1.0) * 100.0,
                _ => 0.0,
            };
            let mut want = (RETAIN * prev_conf[z.index()] + POINTS_PER_PERCENT * r + news)
                .clamp(-100.0, 100.0);
            if want.abs() < 0.005 {
                want = 0.0;
            }
            let got = w.zones[z].confidence;
            assert!(
                (got - want).abs() < 1e-9,
                "{} {}: confidence {got} vs {want}",
                sim.now(),
                w.zones[z].exchange_code
            );
            prev_conf[z.index()] = got;
            prev_level[z.index()] = now;
        }
        empty_path.push(w.zones[empty].confidence);
    }
    println!(
        "{days} days; empty exchange {}: {:?}; {news_days} exchange-days with headline points",
        sim.world().zones[empty].exchange_code,
        &empty_path[..5]
    );
    assert!(
        news_days > 0,
        "the April release's beats and misses move their exchanges"
    );
    // From +100: 90 after the first close, 0.9^n × 100 after n, exactly 0 from day 94 on.
    for (n, &c) in empty_path.iter().enumerate() {
        let k = n + 1;
        if k < QUIET_DAYS_TO_ZERO {
            assert!(
                (c - 100.0 * RETAIN.powi(k as i32)).abs() < 1e-9,
                "day {k}: {c}"
            );
            assert!(c > 0.0);
        } else {
            assert_eq!(c, 0.0, "day {k}");
        }
    }
    assert!(empty_path.len() > QUIET_DAYS_TO_ZERO);
    // Listed exchanges did move (index returns).
    assert!(
        sim.world()
            .zones
            .iter()
            .any(|(z, c)| z != empty && c.confidence != 0.0)
    );
}
