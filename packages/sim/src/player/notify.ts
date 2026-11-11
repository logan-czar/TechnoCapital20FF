// Notifications to the player (pivot 12, 2.4, 14.4; D1037, D1042): a row in
// `World.player.notifications` (world state, the same whatever the settings), and for a row that
// asks to pause, `jobCtxNotify`, which pauses the runner unless that fixed pause is switched off.
//
// The account's own notices (D1042, D1052): a tax bill paid in full is a `Tax` that does not pause;
// a forced sale to pay it is a `Tax` and the bankruptcy a `Bankruptcy`, both on the `MarginCall`
// fixed pause (pivot 2.4 item 2, which cannot be switched off); a delisting of a held stock is a
// `Holding` (item 4: a resolution naming a company the player holds).

import { type JobCtx, jobCtxNotify } from "../time/scheduler.ts";
import type { AlertRuleId } from "../types/action.ts";
import type { DateTime } from "../types/calendar.ts";
import type { FixedPause } from "../types/notice.ts";
import type { PlayerNotification, PlayerState } from "../types/state/player.ts";
import type { EntityRef } from "../types/views/entity.ts";
import type { NotificationKind } from "../types/views/notifications.ts";

/** What a notification says; its id and time are given by `notify`. */
export interface NotifyFields {
  kind: NotificationKind;
  text: string;
  refs: EntityRef[];
  rule?: AlertRuleId | null;
  paused: boolean;
  fixed: FixedPause | null;
}

/**
 * Raises a notification at `time` and, if it asks to pause and a tick is running (`ctx`), asks the
 * runner to pause after this tick (pivot 2.4; scheduler.ts `jobCtxNotify`).
 */
export function notify(
  p: PlayerState,
  ctx: JobCtx | null,
  time: DateTime,
  f: NotifyFields,
): PlayerNotification {
  const n: PlayerNotification = {
    id: p.notifications.length,
    time,
    kind: f.kind,
    text: f.text,
    refs: f.refs,
    rule: f.rule ?? null,
    paused: f.paused,
    fixed: f.fixed,
  };
  p.notifications.push(n);
  if (n.paused && ctx !== null) jobCtxNotify(ctx, n.id, n.fixed);
  return n;
}

/** USD as text, to the cent: "$1,234.50", "-$12.00". Deterministic (toFixed is exact per ECMAScript). */
export function usd(x: number): string {
  const neg = x < 0;
  const s = (neg ? -x : x).toFixed(2);
  const dot = s.indexOf(".");
  let whole = s.slice(0, dot);
  let grouped = "";
  while (whole.length > 3) {
    grouped = `,${whole.slice(-3)}${grouped}`;
    whole = whole.slice(0, -3);
  }
  return `${neg ? "-" : ""}$${whole}${grouped}${s.slice(dot)}`;
}
