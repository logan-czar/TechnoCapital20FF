// v_account's builder slot (D1037), owned by lane P (player). Its `build` is to give
// the player's money from `World.player` (`open` false while it is null).
//
// The contracts change left it unported: the sim holds the empty value below and never posts it
// (views/patch.ts). The lane sets `build` (and `rebuildFrom` or `slice` where the view needs them)
// on this one object; views/index.ts `VIEW_BUILDERS` names it and is not edited.

import type { AccountView } from "../types/views/account.ts";
import type { ViewBuilder } from "./index.ts";

/** The empty value: the view before a world has anything to show. */
export function emptyAccount(): AccountView {
  return {
    open: false,
    cash: [],
    net_worth: 0,
    positions: [],
    orders: [],
    fills: [],
    settlements: [],
    realised_gains: 0,
    tax_due: 0,
    follows: [],
    alert_rules: [],
    bankrupt: false,
  };
}

/** v_account's slot in `VIEW_BUILDERS`. */
export const accountBuilder: ViewBuilder<AccountView> = {
  rust: "(none: pivot 14)",
  empty: emptyAccount,
  build: null,
};
