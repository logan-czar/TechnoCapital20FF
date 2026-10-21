//! Time: the calendar, the clock, the scheduler and the quarter phases (spec 3.1, 4, 9.1;
//! build-plan M1).

pub mod alerts;
pub mod calendar;
pub mod control;
pub mod quarter;
pub mod scheduler;
pub mod trace;

pub use calendar::{Date, DateTime, Month, Quarter, Weekday};
pub use control::{Control, Controls};
pub use quarter::QuarterPhase;
pub use scheduler::{JobCtx, JobFn, Scheduler, Slot, TickFacts, TickObserver, TickPart};
