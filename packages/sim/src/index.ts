// The public face of the sim package: what the UI and the headless runner may use (spec 9). Raw
// world tables are not exported here; tests reach them through "@tc20ff/sim/internal". The
// value exports are UI-safe constants and helpers (alert tables, speeds, calendar ordering, view
// enums and names).

// The Sim (lib.ts): built with `simNew`, driven through its SimApi methods. Test and soak hooks
// (`simWorld`, `simRegisterTestJob`, `simSoakStats` ...) are in internal.ts only.
export { Sim, type SimOptions, simErrorMessage, simNew } from "./lib.ts";
// UI-safe clock helpers (time/): the date formats and calendar math, the quarter phase and its
// tick helpers (pure functions of a DateTime), the runner's speed and the SkipTo target.
export {
  dateTimeAddHours,
  dateTimeAt,
  dateTimeDate,
  dateTimeFromHours,
  dateTimeHour,
  dateTimeHours,
  dateTimeMidnight,
  dateTimeNext,
  dateTimeWeekday,
  daysInMonth,
  formatDateTime,
  formatMonth,
  formatQuarter,
  formatSimDate,
  simDateAddDays,
  simDateDaysSinceEpoch,
  simDateFromDaysSinceEpoch,
  simDateIsQuarterFirstMonth,
  simDateQuarter,
  simDateWeekday,
  simDateYmd,
  weekdayShortName,
} from "./time/calendar.ts";
export { controlsEffectiveSpeed, controlsSecondsPerTick, skipTarget } from "./time/control.ts";
export {
  lockTick,
  nextPhaseStart,
  phaseAt,
  phaseInfoDaysToNextPhase,
  priceMoveTick,
  recapTick,
  releaseTick,
} from "./time/quarter.ts";
export * from "./types/calendar.ts";
export * from "./types/control.ts";
export * from "./types/ids.ts";
export * from "./types/notice.ts";
// String order for ids (D4): the UI sorts CSV ids the same way the sim does.
// Number helpers the UI shares with the sim (D952): Rust's rounding and float order, and the
// flattening of a bar history's chunks.
export { cmpStr, roundHalfAway, roundTiesEven, totalCmp } from "./types/num.ts";
export * from "./types/protocol.ts";
export type * from "./types/sim-api.ts";
export * from "./types/views/index.ts";
export { barRows } from "./views/bars.ts";
// What the worker posts: view copies and patches by version (views/).
export { simViewsCopyChangedFrom, simViewsMapLayerVersions } from "./views/index.ts";
export { type PostedViews, postedViewsNone, postedViewsResetNews, viewsPatchSince } from "./views/patch.ts";
