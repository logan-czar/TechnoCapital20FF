// v_notifications's builder slot (D1037), owned by lane P (player). Its `build` is to give
// the player's notifications from `World.player`.
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { NotificationsView } from "../types/views/notifications.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyNotifications(): NotificationsView {
  return { items: [], read_through: -1 };
}

/** v_notifications's slot in `VIEW_BUILDERS`. */
export const notificationsBuilder: ViewBuilder<NotificationsView> = {
  rust: "(none: pivot 12)",
  empty: emptyNotifications,
  build: null,
};
