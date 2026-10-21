//! The quarter's fixed dates (spec 4.4, 21.1): release, the 01:00 price move, the plan lock and
//! the pre-quarter-end week, each in January, April, July and October.

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
