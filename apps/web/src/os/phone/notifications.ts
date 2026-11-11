// What the phone and the taskbar read of v_notifications (pivot 12, 2.4): the unread count, whether a
// notification paused the game, and which one paused it now. The rows come from the view's append
// list; a notification the player has read is one at or before the view's `read_through`.

import type { ClockView, FixedPauses, NotificationRow, NotificationsView, PauseReason } from "@tc20ff/sim";
import { useNotices, useViewData } from "../../sim/hooks.ts";

/** The most notifications the phone lists, newest first. */
export const PHONE_MAX_NOTIFICATIONS = 60;

/** How many of `view`'s notifications the player has not read. */
export function unreadCount(view: NotificationsView | undefined): number {
  if (view === undefined) return 0;
  let count = 0;
  for (const n of view.items) if (n.id > view.read_through) count++;
  return count;
}

/**
 * True when the game paused on `row`: it asks to pause, and the fixed pause it is has not been
 * switched off (v_notifications `paused`, v_clock `fixed_pauses`; pivot 2.4).
 */
export function pausedTheGame(row: NotificationRow, fixed: FixedPauses | undefined): boolean {
  if (!row.paused) return false;
  return row.fixed === null || fixed?.[row.fixed] !== false;
}

/** The number of unread notifications, re-read when the view moves. */
export function useUnread(): number {
  return unreadCount(useViewData("notifications"));
}

/**
 * The notification that paused the game now, or null: the clock is paused and the newest pause the
 * game made was for a notification (`PauseReason` `Notification`). A later pause for another reason
 * (the player's own, a step that ran out) or a resume clears it.
 */
export function usePausingNotification(clock: ClockView | undefined): NotificationRow | null {
  const notices = useNotices();
  const view = useViewData("notifications");
  if (clock === undefined || !clock.paused || view === undefined) return null;
  let reason: PauseReason | null = null;
  for (let i = notices.length - 1; i >= 0; i--) {
    const n = notices[i]?.notice;
    if (n?.kind === "Paused") {
      reason = n.reason;
      break;
    }
  }
  if (reason?.kind !== "Notification") return null;
  const id = reason.id;
  return view.items.find((n) => n.id === id) ?? null;
}
