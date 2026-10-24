// The public face of the sim package: what the UI and the headless runner may use (spec 9). Raw
// world tables are not exported here; tests reach them through "@tc20ff/sim/internal". The
// value exports are UI-safe constants and helpers (alert tables, speeds, calendar ordering, view
// enums and names).

// UI-safe clock helpers (time/): the date formats, the runner's speed, and the SkipTo target.
export {
  formatDateTime,
  formatMonth,
  formatQuarter,
  formatSimDate,
  weekdayShortName,
} from "./time/calendar.ts";
export { controlsEffectiveSpeed, controlsSecondsPerTick, skipTarget } from "./time/control.ts";
export * from "./types/calendar.ts";
export * from "./types/control.ts";
export * from "./types/ids.ts";
export * from "./types/notice.ts";
export * from "./types/protocol.ts";
export type * from "./types/sim-api.ts";
export * from "./types/views/index.ts";
