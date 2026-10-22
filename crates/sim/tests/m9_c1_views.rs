//! M9 Phase C lane C1's sim requests (docs/build/m9-plan.md; the requests lanes B1 and B2
//! logged): the index history in v_exchanges (D540). Expected values come from the spec: every
//! headline index is 1,000 at load (5.14) and closes once a day at 00:00 (4.2 step 6).

mod common;

use common::data;
use sim::Sim;
use sim::market::index::INDEX_BASE;
use sim::time::Date;

#[test]
fn exchanges_serve_each_index_s_daily_closes_from_2020() {
    let mut sim = Sim::new(data(), 1).unwrap();
    let start = Date::ymd(2020, 1, 1);
    {
        let v = sim.views();
        for (e, z) in v.exchanges.get().exchanges.iter().zip(&v.zones.get().zones) {
            match z.index_close {
                Some(_) => {
                    let c: Vec<_> = e.closes.iter().copied().collect();
                    assert_eq!(c.len(), 1, "{}: the load level", e.code);
                    assert_eq!(c[0].date, start);
                    assert!(
                        (c[0].level - INDEX_BASE).abs() < 1e-9,
                        "1,000 at load (5.14)"
                    );
                }
                None => assert!(e.closes.is_empty(), "{}: no level, no close", e.code),
            }
        }
    }
    // Each day's 00:00 close joins the history, dated that day, at v_zones' last close.
    let mut seen: Vec<Vec<(Date, f64)>> = Vec::new();
    let end = Date::ymd(2020, 2, 3);
    loop {
        sim.step();
        let v = sim.views();
        let today = v.clock().date;
        if seen.is_empty() {
            seen = vec![Vec::new(); v.zones.get().zones.len()];
        }
        for (i, z) in v.zones.get().zones.iter().enumerate() {
            if let Some(close) = z.index_close
                && seen[i].last().is_none_or(|l| l.0 != today)
                && v.clock().hour == 0
            {
                seen[i].push((today, close));
            }
        }
        if today >= end && v.clock().hour == 0 {
            break;
        }
    }
    let v = sim.views();
    let mut checked = 0;
    for (i, e) in v.exchanges.get().exchanges.iter().enumerate() {
        let c: Vec<(Date, f64)> = e.closes.iter().map(|c| (c.date, c.level)).collect();
        if c.is_empty() {
            continue;
        }
        checked += 1;
        assert_eq!(c[0].0, start);
        assert_eq!(&c[1..], seen[i].as_slice(), "{}", e.code);
        assert!(c.windows(2).all(|w| w[0].0 < w[1].0), "one close a day");
        assert_eq!(
            c.len(),
            1 + 33,
            "{}: 1 January, then 2 January to 3 February",
            e.code
        );
        assert_eq!(v.exchanges.get().of_zone(e.zone).unwrap().code, e.code);
    }
    assert!(checked > 0);
    // The view shares the World's chunks (D148).
    let w = sim.world();
    let z = v.exchanges.get().exchanges[0].zone;
    assert!(
        v.exchanges.get().exchanges[0]
            .closes
            .shares_with(&w.market.index_history[z])
    );
}
