// v_notifications (pivot 12, 2.4, 14.4): what the phone shows. One row per notice to the player,
// from the player's alerts and the fixed list. Type only: the builder arrives with the player
// (M2) and the alerts (M5). The rows only grow, oldest first.

import type { AlertRuleId } from "../action.ts";
import type { DateTime } from "../calendar.ts";
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
  /** It paused the game (pivot 2.4). */
  paused: boolean;
}

export interface NotificationsView {
  /** Every notification, oldest first. */
  items: NotificationRow[];
}
