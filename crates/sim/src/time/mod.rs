//! Time: the calendar, the clock, the scheduler and the quarter phases (spec 3.1, 4, 9.1;
//! build-plan M1).

pub mod calendar;

pub use calendar::{Date, DateTime, Month, Quarter, Weekday};
