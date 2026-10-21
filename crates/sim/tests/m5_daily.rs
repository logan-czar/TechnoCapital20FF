//! Build-plan M5.4 and M5.5 on the live engine, over the Q1 2020 release (spec 4.2, 4.4, 5.13,
//! 5.15, 21.3.1, 3.10; D248): run from load to the end of the Q2 2020 reaction week, tick by tick.
//!
//! - **M5.4** Each quoted stock's daily bar closes at 00:00: dated the day before, opening at the
//!   price the previous 00:00 daily jobs left, closing at the price of the 00:00 hourly step,
//!   spanning every hourly price between; none for 1 January (closed, 3.1.0). Buzz decays 25%
//!   at each 00:00. The daily fair value refresh is spec 5.13 written out here on the stored
//!   basis with the day's book equity, label, confidence factor, home spread and exchange
//!   confidence (D243).
//! - **M5.5** At 01:00 on the 2 April release: the full recalculation's basis is the TTM of the
//!   archive (E_norm from TTM net income and the 4-quarter revenue growth, G against lt); each
//!   quoted price jumps `× (1 + 1.5 × clamp(0.5 × s, ±25%))` from the price the 01:00 hourly step
//!   left, s from the archived quarter and the consensus set at the 9 January lock; buzz moves by
//!   `clamp(20 × s, ±30)`; the result tags follow 5.15's edges. On the 3rd to the 8th each price
//!   closes 20% of its gap to V after the 00:00 step (21.3.1).

mod common;

use std::sync::Mutex;

use common::data;
use sim::Sim;
use sim::finance::jobs::{company_home_spread, sheet};
use sim::finance::statements::trailing_four;
use sim::market::earnings::SurpriseTag;
use sim::time::{Date, DateTime, JobCtx, Slot};
use sim::world::{CompanyId, Ordinal, PhaseLabel, World};

/// Spec 4.2 step 1 (3.3.5): buzz decays 25% a day.
const BUZZ_KEEP: f64 = 0.75;
/// Spec 4.2 step 3 (21.3.1): 20% of the gap a day.
const REVERSION: f64 = 0.20;

/// Spec 5.13 written out: E_norm and G from the basis; R, cycle, confidence, X and floors from
/// today's inputs.
fn spec_fair_value(
    w: &World,
    id: CompanyId,
    e_norm: Option<f64>,
    g: f64,
    zone_confidence: &[f64],
) -> f64 {
    let c = &w.companies[id];
    let ind = &w.industries[c.industry];
    let book = sheet(w, c).equity;
    let home = company_home_spread(w, c, false);
    let r = (0.09 / (0.035 + home + 0.05)).clamp(0.4, 1.6);
    let cycle = match ind.phase_label {
        PhaseLabel::Boom => 1.2,
        PhaseLabel::Normal => 1.0,
        PhaseLabel::Glut => 0.85,
        PhaseLabel::Bust => 0.7,
    };
    let confidence = 0.8 + c.management_score / 250.0;
    let x = w.market.stocks[id]
        .exchange
        .map_or(1.0, |z| 1.0 + 0.10 * zone_confidence[z.index()] / 100.0);
    let value = match e_norm {
        Some(e) if e > 0.0 => {
            (0.3 * book + 0.7 * e * ind.params.earnings_multiple * g * r * cycle * confidence) * x
        }
        _ => book * cycle * x,
    };
    let floor = if ind.key == "real_estate" { 0.9 } else { 0.6 };
    value
        .max(floor * book.max(0.0))
        .max(0.01 * c.shares_out as f64)
}

/// Prices and buzz after the 01:00 hourly step, before the jump (a test job in the full fair
/// value slot, which runs after the engine's recalculation there).
static BEFORE_JUMP: Mutex<Vec<(f64, f64)>> = Mutex::new(Vec::new());

fn record_before_jump(w: &mut World, _: &mut JobCtx<'_>) {
    *BEFORE_JUMP.lock().unwrap() = w
        .market
        .stocks
        .rows()
        .iter()
        .map(|s| (s.price, s.buzz))
        .collect();
}

fn near(a: f64, b: f64, what: &str) {
    assert!(
        (a - b).abs() <= 1e-9 * a.abs().max(b.abs()).max(1e-6),
        "{what}: {a} vs {b}"
    );
}

#[test]
fn bars_buzz_fair_value_jump_and_reaction_week() {
    let mut sim = Sim::new(data(), 3).unwrap();
    sim.register_test_job(
        Slot::PriceMoveFairValue,
        "test.before_jump",
        record_before_jump,
    );
    let end = DateTime::midnight(Date::ymd(2020, 4, 10));
    let n = sim.world().companies.len();
    // Hourly prices since the day's bar opened, per company.
    let mut day_prices: Vec<Vec<f64>> = vec![Vec::new(); n];
    let mut open: Vec<f64> = sim
        .world()
        .market
        .stocks
        .rows()
        .iter()
        .map(|s| s.price)
        .collect();
    let mut buzz: Vec<f64> = vec![0.0; n];
    let mut confidence: Vec<f64> = sim
        .world()
        .zones
        .iter()
        .map(|(_, z)| z.confidence)
        .collect();
    let (mut bars_checked, mut refreshes, mut jumps, mut reversions) = (0, 0, 0, 0);
    let mut tags = [0usize; 4];
    while sim.now() < end {
        sim.step();
        let t = sim.now();
        let w = sim.world();
        let d = t.date();
        for (id, s) in w.market.stocks.iter() {
            let i = id.index();
            if !s.quoted {
                continue;
            }
            if t.hour() != 0 {
                day_prices[i].push(s.price);
                continue;
            }
            // 00:00: the bar of yesterday closed (none for 1 January).
            let yesterday = d.add_days(-1);
            let last = s.bars.last();
            if yesterday == Date::ymd(2020, 1, 1) {
                assert!(
                    last.is_none_or(|b| b.date != yesterday),
                    "a bar on 1 January"
                );
            } else {
                let bar = last.expect("a bar each trading day");
                assert_eq!(bar.date, yesterday);
                near(bar.open, open[i], "bar open");
                let release_tick = d.day == 2 && [1, 4, 7, 10].contains(&d.month);
                let reaction = (3..=8).contains(&d.day) && [1, 4, 7, 10].contains(&d.month);
                if !release_tick && !reaction {
                    // The 00:00 step moved the price; nothing after it did.
                    near(bar.close, s.price, "bar close");
                }
                // The release day's bar also holds the 01:00 step before the jump, which this
                // loop does not see; elsewhere the bar spans the open and every hourly price.
                if yesterday.day != 2 || ![1, 4, 7, 10].contains(&yesterday.month) {
                    let mut prices = day_prices[i].clone();
                    prices.push(bar.close);
                    let hi = prices.iter().copied().fold(bar.open, f64::max);
                    let lo = prices.iter().copied().fold(bar.open, f64::min);
                    near(bar.high, hi, "bar high");
                    near(bar.low, lo, "bar low");
                }
                bars_checked += 1;
                if reaction {
                    // 21.3.1: 20% of the gap to V after the 00:00 step.
                    near(
                        s.price,
                        bar.close + REVERSION * (s.value - bar.close),
                        "reversion",
                    );
                    reversions += 1;
                }
            }
            // Buzz decays 25% at 00:00.
            near(s.buzz, BUZZ_KEEP * buzz[i], "buzz decay");
            day_prices[i].clear();
            open[i] = s.price;
        }
        // The daily refresh (4.2 step 2), every company not frozen (private ones too). It reads
        // the zone confidence before step 6 moves it, so yesterday's; on the 1st the monthly
        // job moves its other inputs after it, so those days are left out here.
        if t.hour() == 0 && d.day != 1 {
            for (id, c) in w.companies.iter() {
                if c.finance.status().is_frozen() {
                    continue;
                }
                let s = &w.market.stocks[id];
                let want =
                    spec_fair_value(w, id, s.basis.e_norm, s.basis.growth_factor, &confidence);
                near(s.fair_value, want, &format!("{} daily fair value", c.key));
                near(s.value, s.fair_value / c.shares_out as f64, "V");
                refreshes += 1;
            }
        }
        if t == DateTime::at(Date::ymd(2020, 4, 2), 1) {
            let before = BEFORE_JUMP.lock().unwrap().clone();
            for (id, c) in w.companies.iter() {
                if c.finance.status().is_frozen() {
                    continue;
                }
                let s = &w.market.stocks[id];
                // The full recalculation: E_norm and G from the archive (5.13 steps 1, 2).
                let quarters = c.finance.quarters();
                let ttm = trailing_four(quarters).unwrap().net_income();
                let rev: Vec<f64> = quarters.iter().map(|q| q.lines.revenue).collect();
                let k = rev.len();
                let g_raw = if k >= 8 {
                    rev[k - 4..].iter().sum::<f64>() / rev[k - 8..k - 4].iter().sum::<f64>() - 1.0
                } else if k > 4 {
                    let m = k - 4;
                    rev[k - m..].iter().sum::<f64>() / rev[k - m - 4..k - 4].iter().sum::<f64>()
                        - 1.0
                } else {
                    0.0
                };
                let g = g_raw.clamp(-0.30, 0.60);
                let e = 0.6 * ttm + 0.4 * ttm * (1.0 + g);
                let lt = w.industries[c.industry].lt;
                let big_g = (1.0 + 2.5 * (g - lt)).clamp(0.5, 2.5);
                near(s.basis.e_norm.unwrap(), e, "E_norm");
                near(s.basis.growth_factor, big_g, "G");
                // The surprise against the 9 January consensus (5.15), and the tags.
                let last = quarters.last().unwrap();
                let ni = last.lines.net_income();
                let cons = if s.consensus_ni == 0.0 {
                    1.0
                } else {
                    s.consensus_ni
                };
                let sp = (ni - cons) / cons.abs();
                near(s.last_surprise, sp, "surprise");
                let tag = s.tags.surprise;
                let want_tag = if sp > 0.20 {
                    Some(SurpriseTag::BigBeat)
                } else if sp > 0.05 {
                    Some(SurpriseTag::Beat)
                } else if sp < -0.20 {
                    Some(SurpriseTag::BigMiss)
                } else if sp < -0.05 {
                    Some(SurpriseTag::Miss)
                } else {
                    None
                };
                assert_eq!(tag, want_tag, "{}", c.key);
                assert_eq!(s.tags.loss, ni < 0.0);
                if let Some(t) = tag {
                    tags[t as usize] += 1;
                }
                if !s.quoted {
                    continue;
                }
                let (p0, b0) = before[id.index()];
                let jump = 1.0 + 1.5 * (0.5 * sp).clamp(-0.25, 0.25);
                near(s.price, (p0 * jump).max(0.01), &format!("{} jump", c.key));
                let b = (b0 + (20.0 * sp).clamp(-30.0, 30.0)).clamp(-100.0, 100.0);
                near(s.buzz, b, "buzz jump");
                // The jumped price is in the day's bar.
                assert_eq!(s.bar.last, s.price);
                jumps += 1;
            }
        }
        for (id, s) in w.market.stocks.iter() {
            buzz[id.index()] = s.buzz;
        }
        confidence = w.zones.iter().map(|(_, z)| z.confidence).collect();
    }
    println!(
        "{bars_checked} bars, {refreshes} daily refreshes, {jumps} jumps, {reversions} reversions; \
         Q1 2020 tags (big beat, beat, miss, big miss): {tags:?}"
    );
    assert!(bars_checked > 467 * 90);
    assert!(jumps > 400);
    assert_eq!(reversions, 467 * 6 * 2, "6 days in January and in April");
}
