// v_cap_table: `get_company_cap_table(id)` (spec 9.2; 8 Company Cap table tab, "static holders").
// Rebuilt monthly and at the plan lock (spec 9.4; listings and births re-split and add holders
// there, D153, D159). Ported from crates/sim/src/views/cap_table.rs; the types and labels are in
// types/views/cap_table.ts.
//
// A starting company holds one `Existing` block (D153). The view splits it with companies.csv's
// controller stake (D425): the controller's line is `stake × block` (rounded to the nearest share,
// half away from zero), and an "other holders" line holds the rest (the owner of record and the
// other holders are not split out in the MVP). A widely held company (no controller) shows the
// whole block as other holders. A born company shows its real blocks: the seed
// investors (all of it, D989), then any public float and new investors (D153, D270). Shares are not money, so
// a cap table is never banded (D420).

import type { CompanyId } from "../types/ids.ts";
import { assertCount, roundHalfAway, toU64Sat } from "../types/num.ts";
import {
  type CapHolder,
  type CapLine,
  type CapTable,
  type CapTableView,
  type ControllerView,
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
 * A company's controller (spec 3.5): companies.csv's for a starting company (D425), none for a
 * born one (its founders are removed, D989) unless a named character founded it (1995-rework 7.7).
 */
export function controllerOf(c: Company): ControllerRef {
  return c.start_control === null ? { kind: "None" } : { ...c.start_control.controller };
}

/** A controller as the views show it: no character stats (D989). */
export function controllerView(r: ControllerRef): ControllerView {
  return r.kind === "Character" ? { kind: "Character" } : r;
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
      return r.character.name;
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
  // The controller's line out of a block; returns the shares it took.
  const pushController = (block: number): number => {
    const controller = controllerOf(c);
    const held = controllerShares(c, block);
    const name = controllerName(w, controller);
    if (name !== null) push({ kind: "Controller", controller: controllerView(controller) }, name, held);
    return held;
  };
  for (const h of c.holders) {
    switch (h.holder.kind) {
      case "Existing":
        push({ kind: "OtherHolders" }, OTHER_HOLDERS_LABEL, h.shares - pushController(h.shares));
        break;
      case "SeedInvestors":
        // A named founder holds part of the block (1995-rework 7.7); none in the 2020 world.
        push({ kind: "SeedInvestors" }, SEED_INVESTORS_LABEL, h.shares - pushController(h.shares));
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
