//! Quarter phases on the exact spec 4.4 dates, and days_to_next_phase on every day and hour of
//! 2020 to 2023 (build-plan M1.4), checked against the spec table written out by hand.

use sim::time::quarter::{QuarterPhase, next_phase_start, phase_at};
use sim::time::{Date, DateTime};

/// Spec 4.4, as written: (month, day, hour, phase) of every phase start in a year.
const SPEC_TABLE: [(u8, u8, u8, QuarterPhase); 16] = [
    (1, 2, 0, QuarterPhase::Release),
    (1, 2, 1, QuarterPhase::Reaction),
    (1, 9, 0, QuarterPhase::Locked),
    (3, 26, 0, QuarterPhase::PreQuarterEnd),
    (4, 2, 0, QuarterPhase::Release),
    (4, 2, 1, QuarterPhase::Reaction),
    (4, 9, 0, QuarterPhase::Locked),
    (6, 25, 0, QuarterPhase::PreQuarterEnd),
    (7, 2, 0, QuarterPhase::Release),
    (7, 2, 1, QuarterPhase::Reaction),
    (7, 9, 0, QuarterPhase::Locked),
    (9, 25, 0, QuarterPhase::PreQuarterEnd),
    (10, 2, 0, QuarterPhase::Release),
    (10, 2, 1, QuarterPhase::Reaction),
    (10, 9, 0, QuarterPhase::Locked),
    (12, 26, 0, QuarterPhase::PreQuarterEnd),
];

/// Every phase start from 2019 to 2024 as (hours since epoch, may be negative; phase).
fn spec_starts() -> Vec<(i64, QuarterPhase)> {
    (2019..=2024)
        .flat_map(|y| {
            SPEC_TABLE.iter().map(move |&(m, d, h, p)| {
                (Date::ymd(y, m, d).days_since_epoch() * 24 + i64::from(h), p)
            })
        })
        .collect()
}

#[test]
fn phases_and_days_to_next_on_every_hour_2020_to_2023() {
    let starts = spec_starts();
    let end = DateTime::midnight(Date::ymd(2024, 1, 1)).hours();
    for h in 0..end {
        let t = DateTime::from_hours(h);
        let i = starts
            .iter()
            .rposition(|&(s, _)| s <= i64::from(h))
            .unwrap();
        let (want_phase, (next_hour, next_phase)) = (starts[i].1, starts[i + 1]);
        let info = phase_at(t);
        assert_eq!(info.phase, want_phase, "{t}");
        assert_eq!(info.next_phase, next_phase, "{t}");
        let want_days = next_hour.div_euclid(24) - i64::from(h / 24);
        assert_eq!(
            i64::from(info.days_to_next_phase(t.date())),
            want_days,
            "{t}"
        );
    }
}

#[test]
fn spot_checks() {
    let at = |y, m, d, h| DateTime::at(Date::ymd(y, m, d), h);
    // Game start: the Q4 2019 pre-quarter-end week, one day to the 2 Jan release.
    let start = phase_at(DateTime::START);
    assert_eq!(start.phase, QuarterPhase::PreQuarterEnd);
    assert_eq!(start.days_to_next_phase(Date::ymd(2020, 1, 1)), 1);
    // Release tick: the reaction week starts at 01:00 the same day.
    let rel = phase_at(at(2020, 4, 2, 0));
    assert_eq!(rel.phase, QuarterPhase::Release);
    assert_eq!(rel.days_to_next_phase(Date::ymd(2020, 4, 2)), 0);
    // Plan lock to recap: 9 Apr to 25 Jun is 77 days.
    assert_eq!(
        phase_at(at(2020, 4, 9, 0)).days_to_next_phase(Date::ymd(2020, 4, 9)),
        77
    );
    // Q4 locked quarter ends 26 Dec, the Q1 one 26 Mar.
    assert_eq!(
        next_phase_start(at(2020, 10, 9, 0), QuarterPhase::PreQuarterEnd),
        at(2020, 12, 26, 0)
    );
    assert_eq!(
        next_phase_start(at(2020, 12, 26, 0), QuarterPhase::Release),
        at(2021, 1, 2, 0)
    );
}
