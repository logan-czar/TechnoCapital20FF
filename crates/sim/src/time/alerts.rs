//! The calendar alerts of 4.1 step 4 (spec 8 time controls row, 4.4): Quarter start on the
//! quarter's first tick (D800), Earnings day on the release tick, Plan lock on the lock tick and
//! Quarterly recap at the start of the pre-quarter-end week.
//! Alerts raised by later jobs in a tick (a watchlist bankruptcy in 4.3 step 13, the AI boom in
//! 4.3 step 1) fire where they are raised; any pause takes effect after the tick (D6).

use super::scheduler::{JobCtx, Scheduler, Slot};
use crate::world::{AlertKind, AlertPayload, World};

/// Registers the built-in alert job in [`Slot::Alerts`].
pub fn register(s: &mut Scheduler) {
    s.register(Slot::Alerts, "time.calendar_alerts", calendar_alerts);
}

/// Fires the alerts the calendar makes due this hour.
fn calendar_alerts(_: &mut World, ctx: &mut JobCtx<'_>) {
    let f = ctx.facts;
    if f.is_quarter_start() {
        ctx.raise_alert(
            AlertKind::QuarterStart,
            AlertPayload::Quarter(f.date.quarter()),
        );
    }
    if f.is_release_tick() {
        // The release in quarter q publishes q - 1 (spec 4.4, D10).
        let released = f.date.quarter().prev();
        ctx.raise_alert(AlertKind::EarningsDay, AlertPayload::Quarter(released));
    }
    if f.is_lock_tick() {
        ctx.raise_alert(AlertKind::PlanLock, AlertPayload::Quarter(f.date.quarter()));
    }
    if f.is_recap_tick() {
        ctx.raise_alert(
            AlertKind::QuarterlyRecap,
            AlertPayload::Quarter(f.date.quarter()),
        );
    }
}
