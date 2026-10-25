// Where a link opens its page (crates/game/src/links/mod.rs `click_target`, D450): a click opens it
// in the focused pane, Shift+click or a middle click in a new pane, a right click opens nothing.
// A page pane provides a PageNav that opens "focused" pages in itself (the pane clicked is the
// focused one); outside a page pane (the command bar, a table pane, the map) the workspace's
// PageNav picks the focused page pane, or a new one.

import { createContext, useContext } from "react";
import type { PageRef } from "../pages/ref.ts";

export type OpenTarget = "focused" | "new";

export interface PageNav {
  open: (page: PageRef, target: OpenTarget) => void;
}

export const NavContext = createContext<PageNav>({ open: () => {} });

export function useNav(): PageNav {
  return useContext(NavContext);
}

/** Pointer buttons as MouseEvent.button numbers them. */
export const BUTTON_PRIMARY = 0;
export const BUTTON_MIDDLE = 1;

/** Where a click opens a page: Shift or the middle button opens a new pane; others none. */
export function clickTarget(button: number, shift: boolean): OpenTarget | null {
  if (button === BUTTON_PRIMARY) return shift ? "new" : "focused";
  if (button === BUTTON_MIDDLE) return "new";
  return null;
}
