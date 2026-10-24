// Lite AI types a Company holds or a headline names (spec 3.5 `archetype`, `plan`; section 6).
// Ported from crates/sim/src/ai/: archetype.rs (Archetype), plan.rs (OperatingPlan, LockedPlan,
// FinancingPlan) and raise.rs (RaiseMethod). Types only.
//
// Not ported (logic and types no World field reaches): archetype.rs ArchetypeRow,
// ARCHETYPE_TABLE, ArchetypeInputs, TRAIT_RD_MULTS and the load constants, Archetype::{at_load,
// row, params, rd_mult, payout_mult, name}, archetype, trait_rd_mult, rd_plan_at_load; plan.rs
// LockStep, PLAN_LOCK_ORDER, PlanStep, COMPANY_PLAN_ORDER, PlanInputs, batch_order,
// plan_operations, plan_financing, lock_plan and `From<Financing> for FinancingPlan`;
// financing.rs Financing and its inputs; growth.rs, inputs.rs, rd.rs, split.rs, raise.rs's
// inputs and rule, jobs.rs.

import type { Stations } from "./ops.ts";

// ---------------------------------------------------------------- archetype.rs

/** A company's archetype (spec 3.5, 6.1). */
export type Archetype = "StateChampion" | "Startup" | "AggressiveGrower" | "CashCow" | "Incumbent";

/** The archetypes in Rust enum order (the spec 6.1 table order). */
export const ARCHETYPE_VALUES = [
  "StateChampion",
  "Startup",
  "AggressiveGrower",
  "CashCow",
  "Incumbent",
] as const;

// ---------------------------------------------------------------- plan.rs

/** The operating half of a locked plan (spec 6.1 to 6.4). */
export interface OperatingPlan {
  archetype: Archetype;
  /** Annual net growth rate g (6.2), for every unit (3.6 `growth_plan`). */
  growth: number;
  /** R&D share of revenue (6.3), for every unit (3.6 `rd_plan`). */
  rd_plan: number;
  /** The 6.4 split, fitted to L each month from now on (5.10, D118). */
  stations: Stations;
  /** The quarter's planned purchases at g, USD (6.2, 5.10). */
  planned_purchases: number;
  /** USD (6.5). */
  min_cash: number;
}

/** A locked plan (spec 3.5 `plan`): the operating plan and the 6.5 moves. */
export interface LockedPlan {
  operating: OperatingPlan;
  financing: FinancingPlan;
}

/** The 6.5 moves, stored with the plan. USD. */
export interface FinancingPlan {
  /** Drawn on the line at the lock (cash and drawn both rise). */
  draw: number;
  /** Repaid at the lock (cash and drawn both fall). */
  repay: number;
  /** Paid at the lock from cash (5.17). */
  dividend: number;
}

// ---------------------------------------------------------------- raise.rs

/** How a raise is made (spec 6.6 Method). */
export type RaiseMethod =
  /** Draw the target on the line now (rated B or better, the undrawn line covers it). */
  | "CreditLine"
  /** A follow-on share issue (listed) or a private placement (private). */
  | "ShareIssue";
