// The clock fixture (v_clock), moved as it was from mockViews.ts, with Omniscient as a parameter.

import {
  type ClockView,
  type CompanyId,
  type DateTime,
  dateTimeDate,
  dateTimeHour,
  dateTimeWeekday,
  type FixedPauses,
  fixedPausesDefault,
  nextPhaseStart,
  phaseAt,
  phaseInfoDaysToNextPhase,
  type SkipKind,
} from "@tc20ff/sim";

export function clockView(
  now: DateTime,
  speed: number,
  selected: number,
  paused: boolean,
  skipping: SkipKind | null,
  watchlist: CompanyId[] = [],
  omniscient = false,
  fixed_pauses: FixedPauses = fixedPausesDefault(),
): ClockView {
  const p = phaseAt(now);
  return {
    now,
    date: dateTimeDate(now),
    hour: dateTimeHour(now),
    weekday: dateTimeWeekday(now),
    speed,
    selected_speed: selected,
    paused,
    skipping,
    quarter_phase: p.phase,
    next_phase: p.next_phase,
    days_to_next_phase: phaseInfoDaysToNextPhase(p, dateTimeDate(now)),
    next_release: nextPhaseStart(now, "Release"),
    watchlist,
    // The mock is a release build: Omniscient is never on (design fix 8).
    omniscient,
    fixed_pauses,
  };
}
