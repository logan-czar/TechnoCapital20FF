//! The quarter's fixed dates (spec 4.4, 21.1): release, the 01:00 price move, the plan lock and
//! the pre-quarter-end week, each in January, April, July and October.

use serde::{Deserialize, Serialize};

use super::calendar::{Date, DateTime, Month, Quarter};

/// Release day of the month: statements published at 00:00 (spec 4.4 row 1).
pub const RELEASE_DAY: u8 = 2;
/// Hour of the release-day price move and earnings jump (spec 4.1 step 3, 4.4 "Price move").
pub const PRICE_MOVE_HOUR: u8 = 1;
/// Plan lock day of the month, at 00:00 (spec 4.4 row 3).
pub const PLAN_LOCK_DAY: u8 = 9;
/// The pre-quarter-end week starts this many days before the next release: 26 March, 25 June,
/// 25 September and 26 December (spec 4.4).
pub const RECAP_DAYS_BEFORE_RELEASE: i64 = 7;
/// First and last day of the daily reaction-week reversion, in a release month (spec 4.2 step 3).
pub const REACTION_FIRST_DAY: u8 = 3;
pub const REACTION_LAST_DAY: u8 = 8;

/// 00:00 on the release day of quarter `q`'s first month (spec 4.4 row 1). The release in quarter
/// `q` publishes the statements of `q.prev()`.
pub fn release_tick(q: Quarter) -> DateTime {
    DateTime::midnight(day_of(q.first_month(), RELEASE_DAY))
}

/// 01:00 on the release day: the price move (spec 4.4).
pub fn price_move_tick(q: Quarter) -> DateTime {
    DateTime::at(day_of(q.first_month(), RELEASE_DAY), PRICE_MOVE_HOUR)
}

/// 00:00 on the plan lock day (spec 4.4 row 3).
pub fn lock_tick(q: Quarter) -> DateTime {
    DateTime::midnight(day_of(q.first_month(), PLAN_LOCK_DAY))
}

/// 00:00 on the first day of the pre-quarter-end week that ends quarter `q` (spec 4.4 row 5): the
/// week before the release in `q.next()`.
pub fn recap_tick(q: Quarter) -> DateTime {
    let release = day_of(q.next().first_month(), RELEASE_DAY);
    DateTime::midnight(release.add_days(-RECAP_DAYS_BEFORE_RELEASE))
}

/// True if `date` starts a pre-quarter-end week (spec 4.4 row 5).
pub fn is_recap_day(date: Date) -> bool {
    let release = date.add_days(RECAP_DAYS_BEFORE_RELEASE);
    release.is_quarter_first_month() && release.day == RELEASE_DAY
}

fn day_of(m: Month, day: u8) -> Date {
    Date::ymd(m.year, m.month, day)
}

/// The quarter phases (spec 3.1 `quarter_phase`, 4.4, 21.1). The quarter starts at each release
/// and ends at the next.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum QuarterPhase {
    /// The release tick only: 00:00 on the 2nd (spec 4.4 row 1).
    Release,
    /// 01:00 on the 2nd to the plan lock (spec 4.4 row 2).
    Reaction,
    /// The plan lock to the pre-quarter-end week (spec 4.4 rows 3 and 4).
    Locked,
    /// The 7 days before the next release (spec 4.4 row 5).
    PreQuarterEnd,
}

impl QuarterPhase {
    pub fn name(self) -> &'static str {
        match self {
            QuarterPhase::Release => "Release",
            QuarterPhase::Reaction => "Reaction week",
            QuarterPhase::Locked => "Locked quarter",
            QuarterPhase::PreQuarterEnd => "Pre-quarter-end week",
        }
    }
}

/// When a phase starts: a date and an hour. Kept as (date, hour) rather than [`DateTime`] so the
/// Q4 2019 pre-quarter-end week, which starts before the clock does, can be named.
pub type PhaseStart = (Date, u8);

/// The four phase starts that open in calendar quarter `q`, in order (spec 4.4): Release and
/// Reaction on the 2nd of its first month, Locked on the 9th, PreQuarterEnd 7 days before the
/// next release.
pub fn phase_starts(q: Quarter) -> [(QuarterPhase, PhaseStart); 4] {
    let release = day_of(q.first_month(), RELEASE_DAY);
    let recap = day_of(q.next().first_month(), RELEASE_DAY).add_days(-RECAP_DAYS_BEFORE_RELEASE);
    [
        (QuarterPhase::Release, (release, 0)),
        (QuarterPhase::Reaction, (release, PRICE_MOVE_HOUR)),
        (
            QuarterPhase::Locked,
            (day_of(q.first_month(), PLAN_LOCK_DAY), 0),
        ),
        (QuarterPhase::PreQuarterEnd, (recap, 0)),
    ]
}

/// The phase at a time, when it started and what comes next.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhaseInfo {
    pub phase: QuarterPhase,
    pub started: PhaseStart,
    pub next_phase: QuarterPhase,
    pub next_start: PhaseStart,
}

impl PhaseInfo {
    /// Calendar days from `today` to the day the next phase starts (spec 8 quarter clock; D7).
    /// 0 on the release tick, since the reaction week starts at 01:00 the same day.
    pub fn days_to_next_phase(&self, today: Date) -> u32 {
        u32::try_from(self.next_start.0.days_since_epoch() - today.days_since_epoch())
            .expect("next phase is not in the past")
    }
}

/// The quarter phase at `t` (spec 4.4).
pub fn phase_at(t: DateTime) -> PhaseInfo {
    let now: PhaseStart = (t.date(), t.hour());
    let q = t.date().quarter();
    // Starts from the quarter before (its pre-quarter-end week runs into this one) to the quarter
    // after (its release ends this quarter's last week), in time order.
    let by_quarter = [q.prev(), q, q.next()].map(phase_starts);
    let starts: [(QuarterPhase, PhaseStart); 12] =
        std::array::from_fn(|i| by_quarter[i / 4][i % 4]);
    let i = starts
        .iter()
        .rposition(|(_, s)| *s <= now)
        .expect("a phase started before any time");
    let (phase, started) = starts[i];
    let (next_phase, next_start) = starts[i + 1];
    PhaseInfo {
        phase,
        started,
        next_phase,
        next_start,
    }
}

/// The first tick strictly after `t` at which `phase` starts (spec 9.1 SkipTo).
pub fn next_phase_start(t: DateTime, phase: QuarterPhase) -> DateTime {
    let mut q = t.date().quarter();
    loop {
        for (p, (date, hour)) in phase_starts(q) {
            if p == phase && date.days_since_epoch() >= 0 {
                let at = DateTime::at(date, hour);
                if at > t {
                    return at;
                }
            }
        }
        q = q.next();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_dates() {
        let q2 = Quarter { year: 2020, q: 2 };
        assert_eq!(release_tick(q2).to_string(), "2020-04-02 00:00");
        assert_eq!(price_move_tick(q2).to_string(), "2020-04-02 01:00");
        assert_eq!(lock_tick(q2).to_string(), "2020-04-09 00:00");
        let recaps: Vec<String> = (1..=4)
            .map(|q| recap_tick(Quarter { year: 2020, q }).date().to_string())
            .collect();
        assert_eq!(
            recaps,
            ["2020-03-26", "2020-06-25", "2020-09-25", "2020-12-26"]
        );
        for r in recaps {
            let d = Date::ymd(2020, r[5..7].parse().unwrap(), r[8..].parse().unwrap());
            assert!(is_recap_day(d));
            assert!(!is_recap_day(d.add_days(1)));
        }
    }
}
