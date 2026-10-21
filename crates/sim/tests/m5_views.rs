//! The M5 views (spec 9.2, 9.4): v_quotes (every tick), v_price_bars (daily), v_exchanges
//! (daily), v_market_stats (daily), the zone confidence in v_cycle (daily) and the prices in
//! v_company_row and v_company_detail, each read against the World after a 100-day run. True V
//! shows only in Omniscient (spec 8), and a private company has a value but no quote.

mod common;

use common::data;
use sim::Sim;
use sim::market::state::BarHistory;
use sim::time::{Control, Date, DateTime};
use sim::views::price_bars::Resolution;
use sim::world::Ordinal;

fn run_to(sim: &mut Sim, t: DateTime) {
    while sim.now() < t {
        sim.step();
    }
}

#[test]
fn market_views_show_the_world() {
    let mut sim = Sim::new(data(), 8).unwrap();
    // A plain hour mid-April, after the Q1 release (EFV errors drawn).
    run_to(&mut sim, DateTime::at(Date::ymd(2020, 4, 20), 13));
    let w = sim.world();
    let v = sim.views();

    // v_quotes: every quoted stock, live this tick.
    let quotes = v.quotes.get();
    let quoted: Vec<_> = w.market.stocks.iter().filter(|(_, s)| s.quoted).collect();
    assert_eq!(quotes.rows.len(), quoted.len());
    for (id, s) in &quoted {
        let q = quotes.get(*id).unwrap();
        assert_eq!(q.last, s.price);
        assert_eq!(q.change, s.price - s.prev_close);
        assert_eq!(q.volume, 0);
        // 3.14.2: EFV = V × (1 + e), e within ±15%, the band ±15% around it.
        assert!(s.efv_error.abs() <= 0.15);
        assert!((q.efv - s.value * (1.0 + s.efv_error)).abs() < 1e-9 * q.efv);
        assert!((q.efv_high / q.efv - 1.15).abs() < 1e-12);
        assert!((q.efv_low / q.efv - 0.85).abs() < 1e-12);
        assert_eq!(q.value, None, "true V is never shown outside Omniscient");
    }
    assert!(
        quoted.iter().any(|(_, s)| s.efv_error != 0.0),
        "errors drawn at the release"
    );
    assert_eq!(quotes.indices.len(), 26);

    // v_company_row and v_company_detail: the price at the last monthly rebuild (1 April).
    let rows = &v.company_rows.get().rows;
    let detail = &v.company_detail.get().companies;
    for r in rows {
        let s = &w.market.stocks[r.id];
        assert_eq!(r.exchange, s.exchange);
        let d = &detail[r.id.index()];
        assert_eq!(d.exchange, s.exchange);
        assert_eq!(d.shares_out, w.companies[r.id].shares_out);
        if s.exchange.is_none() {
            assert_eq!(r.price, 0.0);
        }
    }

    // v_price_bars: every listed company's bars (none on 1 January); weekly and monthly bars
    // aggregate the daily ones.
    let bars = v.price_bars.get();
    assert_eq!(bars.companies.len(), 467);
    let (id, _) = quoted[0];
    let from = Date::ymd(2020, 1, 1);
    let to = Date::ymd(2020, 4, 19);
    let daily = bars.get_price_history(id, Resolution::Daily, from, to);
    let history: &BarHistory = &w.market.stocks[id].bars;
    assert_eq!(daily.len(), history.range(from, to).count());
    assert_eq!(daily.first().unwrap().date, Date::ymd(2020, 1, 2));
    assert_eq!(daily.last().unwrap().date, to);
    let monthly = bars.get_price_history(id, Resolution::Monthly, from, to);
    assert_eq!(monthly.len(), 4);
    let march: Vec<_> = daily.iter().filter(|b| b.date.month == 3).collect();
    let m = monthly[2];
    assert_eq!(m.open, march[0].open);
    assert_eq!(m.close, march[march.len() - 1].close);
    assert_eq!(
        m.high,
        march.iter().map(|b| b.high).fold(f64::MIN, f64::max)
    );
    assert_eq!(m.low, march.iter().map(|b| b.low).fold(f64::MAX, f64::min));
    let weekly = bars.get_price_history(id, Resolution::Weekly, from, to);
    assert!(weekly.iter().skip(1).all(|b| b.date.weekday().index() == 0));

    // v_exchanges and v_cycle: confidence and the index at the last daily close.
    let ex = v.exchanges.get();
    let cycle = v.cycle.get();
    for (z, zone) in w.zones.iter() {
        let row = &ex.exchanges[z.index()];
        assert_eq!(row.confidence, zone.confidence);
        assert_eq!(row.name, zone.exchange_name);
        assert_eq!(cycle.zones[z.index()].confidence, zone.confidence);
        assert_eq!(
            cycle.zones[z.index()].index_close,
            w.market.indices[z].prev_close
        );
    }
    assert_eq!(ex.get("ATX").unwrap().index_name, "Atlantic 500");

    // v_market_stats: the quoted count and the tracking count.
    let stats = v.market_stats.get();
    assert_eq!(stats.quoted, quoted.len());
    assert_eq!(stats.listed, 467);
    assert!(stats.within_band <= stats.quoted);

    // Omniscient (debug builds) shows the true V.
    if cfg!(debug_assertions) {
        sim.apply(Control::SetOmniscient(true)).unwrap();
        let q = sim.views().quotes.get().rows[0];
        assert_eq!(q.value, Some(sim.world().market.stocks[q.id].value));
    }
}
