//! v_clock: the clock (spec 9.1 `clock()`, the spec 8 top bar and quarter clock). Rebuilt every
//! tick and after every control (spec 9.4).

use super::{Cadence, ViewData, ViewInput};
use crate::time::quarter::{QuarterPhase, next_phase_start, phase_at};
use crate::time::{Date, DateTime, Weekday};
use crate::world::SkipKind;

#[derive(Debug, Clone, PartialEq)]
pub struct ClockView {
    pub now: DateTime,
    pub date: Date,
    pub hour: u8,
    pub weekday: Weekday,
    /// The speed the runner runs at: 0 paused, 5 while skipping (spec 9.1).
    pub speed: u8,
    /// The speed picked (1 to 5), kept while paused.
    pub selected_speed: u8,
    pub paused: bool,
    pub skipping: Option<SkipKind>,
    pub quarter_phase: QuarterPhase,
    pub next_phase: QuarterPhase,
    /// Calendar days to the next phase start (D7).
    pub days_to_next_phase: u32,
    /// The next release: 00:00 on the next 2 January, April, July or October after now (spec 4.4
    /// row 1, 8 Overview "next release").
    pub next_release: DateTime,
}

impl ViewData for ClockView {
    const CADENCE: Cadence = Cadence::EveryTick;
    const ON_CONTROL: bool = true;

    fn build(input: &ViewInput<'_>) -> ClockView {
        let (now, controls) = (input.world.clock, input.controls);
        let phase = phase_at(now);
        ClockView {
            now,
            date: now.date(),
            hour: now.hour(),
            weekday: now.weekday(),
            speed: controls.effective_speed(),
            selected_speed: controls.speed,
            paused: controls.paused,
            skipping: controls.skip.map(|s| s.kind),
            quarter_phase: phase.phase,
            next_phase: phase.next_phase,
            days_to_next_phase: phase.days_to_next_phase(now.date()),
            next_release: next_phase_start(now, QuarterPhase::Release),
        }
    }
}
