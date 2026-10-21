//! Spec 5.19.2 (fixed startup events), build-plan M6.7: F1 to F9 from startup-events.csv, each
//! firing once at its plan lock (F9 at the first lock after the bust), and their drafts.

mod common;

use common::data;
use sim::births::fixed::{FixedEvent, Region, draw_fixed_event, due_events};
use sim::births::random::EventKind;
use sim::economy::ai_boom::{boom_date, stage_at};
use sim::rng::RngStreams;
use sim::time::{Date, Quarter};
use sim::world::{IndustryId, ProvinceId};

fn events() -> Vec<FixedEvent> {
    data()
        .startup_events
        .rows
        .iter()
        .map(|r| FixedEvent::from_row(r).unwrap())
        .collect()
}

#[test]
fn nine_events_and_32_startups() {
    let ev = events();
    let ids: Vec<&str> = ev.iter().map(|e| e.id.as_str()).collect();
    assert_eq!(ids, ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"]);
    // Spec 5.19.2: 32 startups, 8 before the boom, 21 in 2030 to 2035 and 3 after the bust.
    let n: Vec<u32> = ev.iter().map(|e| e.startup_count()).collect();
    assert_eq!(n.iter().sum::<u32>(), 32);
    assert_eq!(n[..3].iter().sum::<u32>(), 8);
    assert_eq!(n[3..8].iter().sum::<u32>(), 21);
    assert_eq!(n[8], 3);
    // F6's labs are in China; F5's groups may sit in either of two superregions.
    assert_eq!(ev[5].groups[0].regions, vec![Region::Country("CHN".into())]);
    assert_eq!(
        ev[4].groups[0].regions,
        vec![
            Region::Superregion("east-asia-oceania".into()),
            Region::Superregion("north-america".into())
        ]
    );
    assert!(Region::Any.contains("europe", "DEU"));
    assert!(!Region::Country("CHN".into()).contains("east-asia-oceania", "JPN"));
    // F1: 2 AI labs in North America, $5M to $15M, cast 2 to 3 full and 1 to 2 partial.
    let f1 = &ev[0];
    assert_eq!(f1.groups[0].industry_name, "AI labs");
    assert_eq!(f1.revenue_usd, (5.0e6, 15.0e6));
    assert_eq!(
        (f1.full.lo, f1.full.hi, f1.partial.lo, f1.partial.hi),
        (2, 3, 1, 2)
    );
}

#[test]
fn each_fires_once_at_its_plan_lock() {
    // The 5.19.2 table's dates, with the pop on 1 January 2040: the bust runs 8 quarters, so
    // F9 fires at the first lock of 2042.
    let ev = events();
    let pop = Date::ymd(2040, 1, 1);
    let mut fired = vec![false; ev.len()];
    let mut when: Vec<(String, Date)> = Vec::new();
    let mut q = Quarter { year: 2020, q: 1 };
    while q.year <= 2050 {
        let lock = Date::ymd(q.year, q.first_day().month, 9);
        let (stage, _) = stage_at(lock, boom_date(), pop);
        for i in due_events(&ev, &fired, lock, stage) {
            fired[i] = true;
            when.push((ev[i].id.clone(), lock));
        }
        q = q.next();
    }
    let want = [
        ("F1", Date::ymd(2020, 4, 9)),
        ("F2", Date::ymd(2021, 4, 9)),
        ("F3", Date::ymd(2022, 1, 9)),
        ("F4", Date::ymd(2030, 1, 9)),
        ("F5", Date::ymd(2031, 1, 9)),
        ("F6", Date::ymd(2032, 1, 9)),
        ("F7", Date::ymd(2033, 1, 9)),
        ("F8", Date::ymd(2035, 1, 9)),
        ("F9", Date::ymd(2042, 1, 9)),
    ];
    let got: Vec<(&str, Date)> = when.iter().map(|(i, d)| (i.as_str(), *d)).collect();
    assert_eq!(got, want);
    // A pop later moves F9 with it: pop Q3 2041 + 8 quarters is Q3 2043.
    let pop = Date::ymd(2041, 7, 1);
    let lock = Date::ymd(2043, 7, 9);
    let (stage, _) = stage_at(lock, boom_date(), pop);
    assert!(ev[8].is_due(lock, stage, false));
    let before = Date::ymd(2043, 4, 9);
    assert!(!ev[8].is_due(before, stage_at(before, boom_date(), pop).0, false));
}

#[test]
fn drafts_follow_the_groups_and_ranges() {
    let ev = events();
    // A resolver that knows every industry name, and a candidate list that remembers the
    // regions it was asked for.
    let names: Vec<String> = ev
        .iter()
        .flat_map(|e| e.groups.iter().map(|g| g.industry_name.clone()))
        .collect();
    let resolve = |n: &str| {
        names
            .iter()
            .position(|x| x == n)
            .map(|i| IndustryId(i as u32))
    };
    let hq = |_: IndustryId, regions: &[Region]| {
        let base = if regions.contains(&Region::Country("CHN".into())) {
            100
        } else {
            0
        };
        (base..base + 5)
            .map(|p| (ProvinceId(p), 1.0))
            .collect::<Vec<_>>()
    };
    let mut rng = RngStreams::new(3);
    for e in &ev {
        let d = draw_fixed_event(e, &resolve, &hq, &mut rng);
        assert_eq!(d.kind, EventKind::Fixed(e.id.clone()));
        assert_eq!(d.startups.len() as u32, e.startup_count());
        for s in &d.startups {
            assert!(s.target_revenue_usd >= e.revenue_usd.0 - 1e-6);
            assert!(s.target_revenue_usd <= e.revenue_usd.1 + 1e-6);
            assert!((e.full.lo..=e.full.hi).contains(&s.full));
            assert!((e.partial.lo..=e.partial.hi).contains(&s.partial));
        }
    }
    // F6: the two Chinese labs draw from the CHN candidates, the rest from anywhere.
    let d = draw_fixed_event(&ev[5], &resolve, &hq, &mut rng);
    assert!(d.startups[..2].iter().all(|s| s.hq.0 >= 100));
    assert!(d.startups[2..].iter().all(|s| s.hq.0 < 100));
    // An unknown industry makes no startup.
    let none = |_: &str| None;
    assert!(
        draw_fixed_event(&ev[0], &none, &hq, &mut rng)
            .startups
            .is_empty()
    );
}
