// v_notifications (pivot 12, 2.4, 14.4): what the phone shows. One row per notice to the player,
// from the player's alerts and the fixed list. Lane P builds it (views/notifications.ts; D1037); the
// alert rules on published events arrive with M5. The rows only grow, oldest first. A notification
// that paused the game is also the `PauseReason` `{ kind: "Notification", id }`.

import type { AlertRuleId } from "../action.ts";
import type { DateTime } from "../calendar.ts";
import type { FixedPause } from "../notice.ts";
import type { EntityRef } from "./entity.ts";

/** Why the player was told: the fixed list of pivot 2.4, or one of their own alerts (pivot 14.4). */
export type NotificationKind =
  /** A fill of the player's order (pivot 2.4 item 1). */
  | "Fill"
  /** A contract the player holds resolved (pivot 2.4 item 1). */
  | "Resolution"
  | "MarginCall"
  | "ElectionDay"
  /** A scandal, roll call or resolution naming something the player holds a position on (pivot 2.4 item 4). */
  | "Holding"
  /** One of the player's alert rules fired. */
  | "Alert";

export interface NotificationRow {
  /** Its place in the order they were raised, from 0. */
  id: number;
  time: DateTime;
  kind: NotificationKind;
  text: string;
  refs: EntityRef[];
  /** The alert rule that fired, for an `Alert`. */
  rule: AlertRuleId | null;
  /**
   * It asks to pause (pivot 2.4): a fixed pause, or a rule set to pause. The game paused on it unless
   * that fixed pause is switched off in v_clock's `fixed_pauses` (a setting, outside the world).
   */
  paused: boolean;
  /** The fixed pause it is (D1037); null for an alert rule's. */
  fixed: FixedPause | null;
}

export interface NotificationsView {
  /** Every notification, oldest first. An append list (protocol.ts `APPEND_LISTS`). */
  items: NotificationRow[];
  /** The last notification the player has read (`PlayerAction` NotificationsRead; D1037); -1 for none. */
  read_through: number;
}
