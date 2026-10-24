// v_projection (crates/sim/src/views/projection.rs): `get_company_projection(id)` (spec 9.2:
// locked plan, projection range, consensus; 8 Financials Quarter view). Rebuilt daily (spec 9.4,
// 4.2 step 4 "projection ranges refreshed").
//
// The observer never sees a plan, so the range is the 5.16 range at today's share of the quarter
// elapsed, ×2 for a secret plan and centred on the consensus (D252); it narrows as the quarter
// passes and never goes under ±3%. The plan itself shows only in Omniscient. A private company's
// or new listing's consensus and range ends are estimate bands (D420).
//
// Not ported: ProjectionView::get, consensus_figure, range_of (D430) and the `ViewData` build
// (logic).

import type { CompanyId } from "../ids.ts";
import type { Figure } from "./estimate.ts";
import type { LockedPlan } from "./shared.ts";

/** One company's projection (spec 9.2). */
export interface ProjectionRow {
  id: CompanyId;
  /** The quarter's net income consensus set at the plan lock (5.16). */
  consensus_ni: Figure;
  /** The shown range, low then high (5.16). */
  range: [Figure, Figure];
  /** The range's half-width as a share of the consensus. */
  width: number;
  /** The locked plan, in Omniscient only (spec 1: published data only). */
  plan: LockedPlan | null;
}

export interface ProjectionView {
  /** Share of the calendar quarter elapsed at the rebuild (D252). */
  elapsed_share: number;
  /** Every company not frozen, in id order. */
  companies: ProjectionRow[];
}
