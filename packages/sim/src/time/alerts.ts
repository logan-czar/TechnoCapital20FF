// The calendar alerts of 4.1 step 4 (spec 8 time controls row, 4.4): Quarter start on the
// quarter's first tick (D800), Earnings day on the release tick, Plan lock on the lock tick and
// Quarterly recap at the start of the pre-quarter-end week. Ported from
// crates/sim/src/time/alerts.rs.
// Alerts raised by later jobs in a tick (a watchlist bankruptcy in 4.3 step 13, the AI boom in
// 4.3 step 1) fire where they are raised; any pause takes effect after the tick (D6).

import type { World } from "../types/world.ts";
import { quarterPrev, simDateQuarter } from "./calendar.ts";
import {
  type JobCtx,
  jobCtxRaiseAlert,
  type Scheduler,
  schedulerRegister,
  tickFactsIsLockTick,
  tickFactsIsQuarterStart,
  tickFactsIsRecapTick,
  tickFactsIsReleaseTick,
} from "./scheduler.ts";

/** Registers the built-in alert job in the `Alerts` slot. */
export function register(s: Scheduler): void {
  schedulerRegister(s, "Alerts", "time.calendar_alerts", calendarAlerts);
}

/** Fires the alerts the calendar makes due this hour. */
function calendarAlerts(_world: World, ctx: JobCtx): void {
  const f = ctx.facts;
  if (tickFactsIsQuarterStart(f)) {
    jobCtxRaiseAlert(ctx, "QuarterStart", { kind: "Quarter", quarter: simDateQuarter(f.date) });
  }
  if (tickFactsIsReleaseTick(f)) {
    // The release in quarter q publishes q - 1 (spec 4.4, D10).
    const released = quarterPrev(simDateQuarter(f.date));
    jobCtxRaiseAlert(ctx, "EarningsDay", { kind: "Quarter", quarter: released });
  }
  if (tickFactsIsLockTick(f)) {
    jobCtxRaiseAlert(ctx, "PlanLock", { kind: "Quarter", quarter: simDateQuarter(f.date) });
  }
  if (tickFactsIsRecapTick(f)) {
    jobCtxRaiseAlert(ctx, "QuarterlyRecap", { kind: "Quarter", quarter: simDateQuarter(f.date) });
  }
}
