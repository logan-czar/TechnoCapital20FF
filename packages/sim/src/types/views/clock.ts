// v_clock (crates/sim/src/views/clock.rs): the clock (spec 9.1 `clock()`, the spec 8 top bar and
// quarter clock). Rebuilt every tick and after every control (spec 9.4).
//
// Not ported: the `ViewData` build (logic).

import type { DateTime, SimDate, Weekday } from "../calendar.ts";
import type { QuarterPhase } from "../control.ts";
import type { SkipKind } from "../notice.ts";

export interface ClockView {
  now: DateTime;
  date: SimDate;
  /** 0 to 23 (u8). */
  hour: number;
  weekday: Weekday;
  /** The speed the runner runs at: 0 paused, 5 while skipping (spec 9.1). */
  speed: number;
  /** The speed picked (1 to 5), kept while paused. */
  selected_speed: number;
  paused: boolean;
  skipping: SkipKind | null;
  quarter_phase: QuarterPhase;
  next_phase: QuarterPhase;
  /** Calendar days to the next phase start (D7). */
  days_to_next_phase: number;
  /**
   * The next release: 00:00 on the next 2 January, April, July or October after now (spec 4.4
   * row 1, 8 Overview "next release").
   */
  next_release: DateTime;
}
