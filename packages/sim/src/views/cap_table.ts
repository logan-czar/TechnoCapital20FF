// v_cap_table: `get_company_cap_table(id)` (spec 9.2; 8 Company Cap table tab, "static holders").
// Rebuilt monthly and at the plan lock (spec 9.4; listings and births re-split and add holders
// there, D153, D159). Ported from crates/sim/src/views/cap_table.rs; the types and labels are in
// types/views/cap_table.ts.
//
// A starting company holds one `Existing` block (D153). The view splits it with companies.csv's
// controller stake (D425): the controller's line is `stake × block` (rounded to the nearest share,
// half away from zero), and an "other holders" line holds the rest (the owner of record and the
// other holders are not split out in the MVP). A widely held company (no controller) shows the
// whole block as other holders. A born company shows its real blocks: founders, lead first, the
// seed investors, then any public float and new investors (D153, D270). Shares are not money, so
// a cap table is never banded (D420).

import type { CompanyId } from "../types/ids.ts";
import { assertCount, roundHalfAway, toU64Sat } from "../types/num.ts";
import {
  type CapHolder,
  type CapLine,
  type CapTable,
  type CapTableView,
  NEW_INVESTORS_LABEL,
  OTHER_HOLDERS_LABEL,
  PUBLIC_FLOAT_LABEL,
  SEED_INVESTORS_LABEL,
} from "../types/views/cap_table.ts";
import type { Company, ControllerRef, World } from "../types/world.ts";
import type { ViewInput } from "./index.ts";

/** `get_company_cap_table(id)`. */
export function capTableViewGet(v: CapTableView, id: CompanyId): CapTable | undefined {
  return v.companies[id];
}

/**
 * A company's controller (spec 3.5): companies.csv's for a starting company (D425), the lead
 * founder for a born one (5.19.3).
 */
export function controllerOf(c: Company): ControllerRef {
  if (c.start_control !== null) return { ...c.start_control.controller };
  return c.controller === null ? { kind: "None" } : { kind: "Character", character: c.controller };
}

/**
 * A controller's name: a character's, a state's (its country) or a company's; null when widely
 * held.
 */
export function controllerName(w: World, r: ControllerRef): string | null {
  switch (r.kind) {
    case "None":
      return null;
    case "Character":
      return w.characters[r.character]!.name;
    case "State":
      return w.countries[r.country]!.name;
    case "Company":
      return w.companies[r.company]!.name;
  }
}

/**
 * The controller's shares of a starting block of `block` shares (D425): `stake × block` rounded
 * half away from zero, at most the block; 0 with no controller or stake.
 */
export function controllerShares(c: Company, block: number): number {
  const sc = c.start_control;
  if (sc === null || sc.controller.kind === "None" || sc.stake === null) return 0;
  // Rust `(block as f64 * stake).round() as u64`, then `.min(block)`.
  return Math.min(toU64Sat(roundHalfAway(block * sc.stake)), block);
}

/** Every line of company `c`'s cap table, in holder order. */
export function capLines(w: World, c: Company): CapLine[] {
  const total = Math.max(c.shares_out, 1);
  const lines: CapLine[] = [];
  const push = (holder: CapHolder, name: string, shares: number): void => {
    if (shares > 0) lines.push({ holder, name, shares: assertCount(shares), share: shares / total });
  };
  for (const h of c.holders) {
    switch (h.holder.kind) {
      case "Existing": {
        const controller = controllerOf(c);
        const held = controllerShares(c, h.shares);
        const name = controllerName(w, controller);
        if (name !== null) push({ kind: "Controller", controller }, name, held);
        push({ kind: "OtherHolders" }, OTHER_HOLDERS_LABEL, h.shares - held);
        break;
      }
      case "Founder":
        push(
          { kind: "Founder", character: h.holder.character },
          w.characters[h.holder.character]!.name,
          h.shares,
        );
        break;
      case "SeedInvestors":
        push({ kind: "SeedInvestors" }, SEED_INVESTORS_LABEL, h.shares);
        break;
      case "PublicFloat":
        push({ kind: "PublicFloat" }, PUBLIC_FLOAT_LABEL, h.shares);
        break;
      case "NewInvestors":
        push({ kind: "NewInvestors" }, NEW_INVESTORS_LABEL, h.shares);
        break;
    }
  }
  return lines;
}

/** Rust `ViewData::build`. */
export function buildCapTable(input: ViewInput): CapTableView {
  const w = input.world;
  return {
    companies: w.companies.map((c, i) => ({
      company: i as CompanyId,
      shares_out: c.shares_out,
      lines: capLines(w, c),
    })),
  };
}
