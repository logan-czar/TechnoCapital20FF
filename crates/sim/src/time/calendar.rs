//! The calendar (spec 3.1, 4; build-plan M1.1). Time is a count of hours since the game epoch,
//! 2020-01-01 00:00 UTC (spec 3.1 `clock`); dates, weekdays, months and quarters are views of it.
//! The proleptic Gregorian calendar with the 400-year leap rule; there are no time zones or
//! daylight saving.

use std::fmt;

use serde::{Deserialize, Serialize};

/// The year the game starts in (spec 3.1: the clock starts 2020-01-01 00:00).
pub const EPOCH_YEAR: i32 = 2020;
/// Hours in a day (one tick is one hour, spec 4).
pub const HOURS_PER_DAY: u32 = 24;
/// Days in a week.
const DAYS_PER_WEEK: i64 = 7;
/// 2020-01-01 was a Wednesday.
const EPOCH_WEEKDAY: Weekday = Weekday::Wed;
/// The first month of each calendar quarter: January, April, July and October (spec 4.4).
pub const QUARTER_FIRST_MONTHS: [u8; 4] = [1, 4, 7, 10];

/// True for leap years: every 4th year, except centuries not divisible by 400.
pub fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Days in `month` (1 to 12) of `year`.
pub fn days_in_month(year: i32, month: u8) -> u8 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => panic!("month {month} out of range"),
    }
}

/// Days in `year`.
pub fn days_in_year(year: i32) -> u32 {
    if is_leap_year(year) { 366 } else { 365 }
}

/// Days from 1970-01-01 to a civil date (H. Hinnant's `days_from_civil`).
fn days_from_civil(year: i32, month: u8, day: u8) -> i64 {
    let (m, d) = (i64::from(month), i64::from(day));
    let y = i64::from(year) - i64::from(m <= 2);
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// The civil date of a day count from 1970-01-01 (H. Hinnant's `civil_from_days`).
fn civil_from_days(days: i64) -> (i32, u8, u8) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    // Ranges are guaranteed by the algorithm: day 1..=31, month 1..=12.
    (year as i32, month as u8, day as u8)
}

/// Days from 1970-01-01 to the game epoch.
fn epoch_days() -> i64 {
    days_from_civil(EPOCH_YEAR, 1, 1)
}

/// Day of the week.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl Weekday {
    pub const ALL: [Weekday; 7] = [
        Weekday::Mon,
        Weekday::Tue,
        Weekday::Wed,
        Weekday::Thu,
        Weekday::Fri,
        Weekday::Sat,
        Weekday::Sun,
    ];

    /// Monday is 0.
    pub fn index(self) -> usize {
        self as usize
    }

    /// Three-letter name for the top bar (spec 8).
    pub fn short_name(self) -> &'static str {
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][self.index()]
    }
}

/// A calendar date.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Date {
    pub year: i32,
    pub month: u8,
    pub day: u8,
}

impl Date {
    /// The date, if it exists.
    pub fn new(year: i32, month: u8, day: u8) -> Option<Date> {
        ((1..=12).contains(&month) && day >= 1 && day <= days_in_month(year, month))
            .then_some(Date { year, month, day })
    }

    /// The date; panics if it does not exist. For constants and tests.
    pub fn ymd(year: i32, month: u8, day: u8) -> Date {
        Date::new(year, month, day)
            .unwrap_or_else(|| panic!("{year:04}-{month:02}-{day:02} is not a date"))
    }

    /// Days since 2020-01-01 (negative before it).
    pub fn days_since_epoch(self) -> i64 {
        days_from_civil(self.year, self.month, self.day) - epoch_days()
    }

    /// The date `days` after 2020-01-01.
    pub fn from_days_since_epoch(days: i64) -> Date {
        let (year, month, day) = civil_from_days(days + epoch_days());
        Date { year, month, day }
    }

    /// The date `n` days later (or earlier, if negative).
    pub fn add_days(self, n: i64) -> Date {
        Date::from_days_since_epoch(self.days_since_epoch() + n)
    }

    pub fn weekday(self) -> Weekday {
        let i = (self.days_since_epoch() + EPOCH_WEEKDAY.index() as i64).rem_euclid(DAYS_PER_WEEK);
        Weekday::ALL[i as usize]
    }

    /// The month this date is in.
    pub fn month_of(self) -> Month {
        Month {
            year: self.year,
            month: self.month,
        }
    }

    /// The calendar quarter this date is in (accounting quarters are calendar quarters, spec 4.4).
    pub fn quarter(self) -> Quarter {
        Quarter {
            year: self.year,
            q: (self.month - 1) / 3 + 1,
        }
    }

    /// The last day of this date's month.
    pub fn is_month_end(self) -> bool {
        self.day == days_in_month(self.year, self.month)
    }

    /// True in January, April, July and October: the months with a quarterly draw, close, release
    /// and plan lock (spec 4.3 step 1, 4.4).
    pub fn is_quarter_first_month(self) -> bool {
        QUARTER_FIRST_MONTHS.contains(&self.month)
    }
}

impl fmt::Display for Date {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

/// A calendar month.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Month {
    pub year: i32,
    /// 1 to 12.
    pub month: u8,
}

impl Month {
    pub fn first_day(self) -> Date {
        Date::ymd(self.year, self.month, 1)
    }

    pub fn last_day(self) -> Date {
        Date::ymd(self.year, self.month, days_in_month(self.year, self.month))
    }

    pub fn next(self) -> Month {
        if self.month == 12 {
            Month {
                year: self.year + 1,
                month: 1,
            }
        } else {
            Month {
                year: self.year,
                month: self.month + 1,
            }
        }
    }

    pub fn prev(self) -> Month {
        if self.month == 1 {
            Month {
                year: self.year - 1,
                month: 12,
            }
        } else {
            Month {
                year: self.year,
                month: self.month - 1,
            }
        }
    }
}

impl fmt::Display for Month {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}", self.year, self.month)
    }
}

/// A calendar quarter, Q1 to Q4 (accounting quarters are calendar quarters, spec 4.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Quarter {
    pub year: i32,
    /// 1 to 4.
    pub q: u8,
}

impl Quarter {
    pub fn first_month(self) -> Month {
        Month {
            year: self.year,
            month: QUARTER_FIRST_MONTHS[usize::from(self.q - 1)],
        }
    }

    pub fn first_day(self) -> Date {
        self.first_month().first_day()
    }

    pub fn next(self) -> Quarter {
        if self.q == 4 {
            Quarter {
                year: self.year + 1,
                q: 1,
            }
        } else {
            Quarter {
                year: self.year,
                q: self.q + 1,
            }
        }
    }

    pub fn prev(self) -> Quarter {
        if self.q == 1 {
            Quarter {
                year: self.year - 1,
                q: 4,
            }
        } else {
            Quarter {
                year: self.year,
                q: self.q - 1,
            }
        }
    }
}

impl fmt::Display for Quarter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Q{} {}", self.q, self.year)
    }
}

/// A point on the clock: whole hours since 2020-01-01 00:00 UTC (spec 3.1). One tick is one hour
/// (spec 4), so this is also the tick number. A `u32` covers about 490,000 years.
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
pub struct DateTime(u32);

impl DateTime {
    /// The game start, 2020-01-01 00:00 (spec 3.1, 7.3).
    pub const START: DateTime = DateTime(0);

    pub const fn from_hours(hours: u32) -> DateTime {
        DateTime(hours)
    }

    /// Hours since 2020-01-01 00:00.
    pub const fn hours(self) -> u32 {
        self.0
    }

    /// `hour` (0 to 23) on `date`; panics before the epoch.
    pub fn at(date: Date, hour: u8) -> DateTime {
        assert!(u32::from(hour) < HOURS_PER_DAY, "hour {hour} out of range");
        let days = u32::try_from(date.days_since_epoch()).expect("date before the game epoch");
        DateTime(days * HOURS_PER_DAY + u32::from(hour))
    }

    /// 00:00 on `date`.
    pub fn midnight(date: Date) -> DateTime {
        DateTime::at(date, 0)
    }

    pub fn date(self) -> Date {
        Date::from_days_since_epoch(i64::from(self.0 / HOURS_PER_DAY))
    }

    /// 0 to 23.
    pub fn hour(self) -> u8 {
        (self.0 % HOURS_PER_DAY) as u8
    }

    pub fn weekday(self) -> Weekday {
        self.date().weekday()
    }

    pub fn add_hours(self, n: u32) -> DateTime {
        DateTime(self.0 + n)
    }

    /// The next tick.
    pub fn next(self) -> DateTime {
        self.add_hours(1)
    }
}

impl fmt::Display for DateTime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} {:02}:00", self.date(), self.hour())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_is_wednesday_first_of_january_2020() {
        let t = DateTime::START;
        assert_eq!(t.date(), Date::ymd(2020, 1, 1));
        assert_eq!(t.hour(), 0);
        assert_eq!(t.weekday(), Weekday::Wed);
        assert_eq!(t.to_string(), "2020-01-01 00:00");
    }

    #[test]
    fn leap_days_2024_2028_2048() {
        // Each leap day exists, has the right weekday and hour index, and the next day is 1 March.
        for (year, weekday) in [
            (2024, Weekday::Thu),
            (2028, Weekday::Tue),
            (2048, Weekday::Sat),
        ] {
            let leap = Date::new(year, 2, 29).expect("leap day exists");
            assert!(is_leap_year(year));
            assert_eq!(days_in_month(year, 2), 29);
            assert_eq!(days_in_year(year), 366);
            assert_eq!(leap.weekday(), weekday, "{leap}");
            assert!(leap.is_month_end());
            assert_eq!(leap.add_days(1), Date::ymd(year, 3, 1));
            assert_eq!(Date::ymd(year, 3, 1).add_days(-1), leap);
            let t = DateTime::at(leap, 13);
            assert_eq!(t.date(), leap);
            assert_eq!(t.hour(), 13);
            assert!(Date::new(year + 1, 2, 29).is_none());
        }
        // 2024-02-29 00:00: 1,461 days for 2020 to 2023, plus 31 + 28 days.
        assert_eq!(
            DateTime::midnight(Date::ymd(2024, 2, 29)).hours(),
            1520 * 24
        );
    }

    #[test]
    fn century_rule() {
        assert!(!is_leap_year(2100));
        assert!(is_leap_year(2000));
        assert!(Date::new(2100, 2, 29).is_none());
        assert_eq!(days_in_year(2100), 365);
    }

    #[test]
    fn month_ends() {
        let ends = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        for (i, &n) in ends.iter().enumerate() {
            let m = Month {
                year: 2020,
                month: i as u8 + 1,
            };
            assert_eq!(m.last_day().day, n);
            assert!(m.last_day().is_month_end());
            assert_eq!(m.last_day().add_days(1), m.next().first_day());
        }
        assert_eq!(days_in_month(2021, 2), 28);
        assert_eq!(
            Month {
                year: 2020,
                month: 12
            }
            .next(),
            Month {
                year: 2021,
                month: 1
            }
        );
    }

    #[test]
    fn every_day_round_trips_through_2080() {
        let mut date = Date::ymd(2020, 1, 1);
        let mut weekday = Weekday::Wed.index();
        for days in 0..(61 * 366) {
            assert_eq!(date.days_since_epoch(), days);
            assert_eq!(Date::from_days_since_epoch(days), date);
            assert_eq!(date.weekday().index(), weekday);
            let t = DateTime::at(date, 23);
            assert_eq!((t.date(), t.hour()), (date, 23));
            assert_eq!(t.next().date(), date.add_days(1));
            // Step to the next date by hand.
            date = if date.is_month_end() {
                date.month_of().next().first_day()
            } else {
                Date::ymd(date.year, date.month, date.day + 1)
            };
            weekday = (weekday + 1) % 7;
        }
    }

    #[test]
    fn quarters() {
        assert_eq!(
            Date::ymd(2020, 3, 31).quarter(),
            Quarter { year: 2020, q: 1 }
        );
        assert_eq!(
            Date::ymd(2020, 4, 1).quarter(),
            Quarter { year: 2020, q: 2 }
        );
        assert_eq!(
            Date::ymd(2020, 12, 31).quarter(),
            Quarter { year: 2020, q: 4 }
        );
        let q = Quarter { year: 2020, q: 1 };
        assert_eq!(q.prev(), Quarter { year: 2019, q: 4 });
        assert_eq!(q.prev().next(), q);
        assert_eq!(
            Quarter { year: 2020, q: 3 }.first_day(),
            Date::ymd(2020, 7, 1)
        );
        assert_eq!(q.to_string(), "Q1 2020");
    }
}
