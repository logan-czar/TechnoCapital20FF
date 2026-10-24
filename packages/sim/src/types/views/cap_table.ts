// v_cap_table (crates/sim/src/views/cap_table.rs): `get_company_cap_table(id)` (spec 9.2; 8
// Company Cap table tab, "static holders"). Rebuilt monthly and at the plan lock (spec 9.4;
// listings and births re-split and add holders there, D153, D159).
//
// A starting company holds one `Existing` block (D153). The view splits it with companies.csv's
// controller stake (D425): the controller's line is `stake × block` (rounded to the nearest
// share, half away from zero), and an "other holders" line holds the rest (the owner of record
// and the other holders are not split out in the MVP). A widely held company (no controller)
// shows the whole block as other holders. A born company shows its real blocks: founders, lead
// first, the seed investors, then any public float and new investors (D153, D270). Shares are
// not money, so a cap table is never banded (D420).
//
// Not ported: CapTableView::get, controller_of, controller_name, controller_shares, cap_lines
// and the `ViewData` build (logic).

import type { CharacterId, CompanyId } from "../ids.ts";
import type { ControllerRef } from "../world.ts";

/** Who a cap table line belongs to. */
export type CapHolder =
  /** A starting company's controller with its companies.csv stake of the starting block. */
  | { kind: "Controller"; controller: ControllerRef }
  /** The rest of a starting company's starting block (D425). */
  | { kind: "OtherHolders" }
  | { kind: "Founder"; character: CharacterId }
  | { kind: "SeedInvestors" }
  | { kind: "PublicFloat" }
  | { kind: "NewInvestors" };

/** One cap table line. */
export interface CapLine {
  holder: CapHolder;
  /**
   * The holder's name as a page shows it (a character's, a state's, a company's) or the
   * block's label.
   */
  name: string;
  /** Whole number (u64). */
  shares: number;
  /** Share of shares outstanding. */
  share: number;
}

/** One company's cap table. */
export interface CapTable {
  company: CompanyId;
  /** Whole number (u64). */
  shares_out: number;
  /** Lines in cap table order (D153); their shares sum to `shares_out`. */
  lines: CapLine[];
}

export interface CapTableView {
  /** Every company in company id order. */
  companies: CapTable[];
}

/** The label of the rest of a starting company's block. */
export const OTHER_HOLDERS_LABEL = "Other holders";
export const SEED_INVESTORS_LABEL = "Seed investors";
export const PUBLIC_FLOAT_LABEL = "Public float";
export const NEW_INVESTORS_LABEL = "New investors";
