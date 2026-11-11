// v_notifications's builder slot (D1037), owned by lane P (player): the player's notifications from
// `World.player` (pivot 12, 2.4, 14.4), rebuilt every tick and after an action.
//
// The items are an append list (protocol.ts `APPEND_LISTS`): a row is made once per state
// notification and kept (`ROWS`, keyed by the state's own object, which never changes once
// raised), so the frame patch sends only the new ones.

import type { PlayerNotification } from "../types/state/player.ts";
import type { NotificationRow, NotificationsView } from "../types/views/notifications.ts";
import type { ViewBuilder, ViewInput } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyNotifications(): NotificationsView {
  return { items: [], read_through: -1 };
}

const ROWS = new WeakMap<PlayerNotification, NotificationRow>();

function row(n: PlayerNotification): NotificationRow {
  let r = ROWS.get(n);
  if (r === undefined) {
    r = {
      id: n.id,
      time: n.time,
      kind: n.kind,
      text: n.text,
      refs: n.refs.map((x) => ({ ...x })),
      rule: n.rule,
      paused: n.paused,
      fixed: n.fixed,
    };
    ROWS.set(n, r);
  }
  return r;
}

/** v_notifications from the state. */
export function buildNotifications(input: ViewInput): NotificationsView {
  const p = input.world.player;
  if (p === null) return emptyNotifications();
  return { items: p.notifications.map(row), read_through: p.read_through };
}

/** v_notifications's slot in `VIEW_BUILDERS`. */
export const notificationsBuilder: ViewBuilder<NotificationsView> = {
  rust: "(none: pivot 12)",
  empty: emptyNotifications,
  build: buildNotifications,
};
