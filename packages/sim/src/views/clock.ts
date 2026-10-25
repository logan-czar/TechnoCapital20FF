// v_clock: the clock (spec 9.1 `clock()`, the spec 8 top bar and quarter clock). Rebuilt every
// tick and after every control (spec 9.4). Ported from crates/sim/src/views/clock.rs; the type is
// in types/views/clock.ts. Ported with the views framework (lane W1) because `Sim::clock` and the
// controls tests read it; it reads only the clock and the controls.

import { dateTimeDate, dateTimeHour, dateTimeWeekday } from "../time/calendar.ts";
import { controlsEffectiveSpeed } from "../time/control.ts";
import { nextPhaseStart, phaseAt, phaseInfoDaysToNextPhase } from "../time/quarter.ts";
import type { ClockView } from "../types/views/clock.ts";
import type { ViewInput } from "./index.ts";

/** Rust `impl ViewData for ClockView`: `build`. */
export function buildClock(input: ViewInput): ClockView {
  const now = input.world.clock;
  const controls = input.controls;
  const phase = phaseAt(now);
  return {
    now,
    date: dateTimeDate(now),
    hour: dateTimeHour(now),
    weekday: dateTimeWeekday(now),
    speed: controlsEffectiveSpeed(controls),
    selected_speed: controls.speed,
    paused: controls.paused,
    skipping: controls.skip === null ? null : controls.skip.kind,
    quarter_phase: phase.phase,
    next_phase: phase.next_phase,
    days_to_next_phase: phaseInfoDaysToNextPhase(phase, dateTimeDate(now)),
    next_release: nextPhaseStart(now, "Release"),
  };
}

/**
 * The clock before any build: the start of the game (2020-01-01 00:00, spec 7.3), paused. Only a
 * placeholder for the framework's `empty`; a real build always replaces it.
 */
export function emptyClock(): ClockView {
  return {
    now: 0,
    date: { year: 2020, month: 1, day: 1 },
    hour: 0,
    weekday: "Wed",
    speed: 0,
    selected_speed: 1,
    paused: true,
    skipping: null,
    // The Q4 2019 pre-quarter-end week, with the Q1 release on 2 January 00:00 (hour 24).
    quarter_phase: "PreQuarterEnd",
    next_phase: "Release",
    days_to_next_phase: 1,
    next_release: 24,
  };
}
