// Row types' methods for the world's entities (spec 3.5, 3.6, 3.7). Ported from
// crates/sim/src/world/entities.rs; the types are in types/world.ts.

import { RAMP_SHORTFALL } from "../economy/assets.ts";
import type { IndustryId } from "../types/ids.ts";
import type { DataBook } from "../types/state/ops.ts";
import type { Seat } from "../types/state/people.ts";
import { LABOR_SEAT_COUNT, SEAT_LABOR } from "../types/state/people.ts";
import type { BusinessUnit, Company, Origin, PhaseLabel, SeatHolder } from "../types/world.ts";

export { PHASE_LABEL_VALUES } from "../types/world.ts";

/** Rust `PhaseLabel::name`: equals the variant. */
export function phaseLabelName(label: PhaseLabel): string {
  return label;
}

/** Rust `Origin::is_born`. */
export function originIsBorn(origin: Origin): boolean {
  return origin.kind === "Born";
}

/** `assets_eff = gross_assets − 0.2 × ramping`: new assets work at 80% (spec 5.2, 10.0.4). */
export function businessUnitAssetsEff(unit: BusinessUnit): number {
  let ramping = 0;
  for (const t of unit.ramping) ramping += t.amount;
  return unit.gross_assets - RAMP_SHORTFALL * ramping;
}

/** Operating costs: variable plus fixed cash (spec 3.6 `opex_m`). */
export function businessUnitOpexM(unit: BusinessUnit): number {
  return unit.variable_m + unit.fixed_m;
}

/** Last month's EBIT: revenue less every 5.5 line. */
export function businessUnitEbitM(unit: BusinessUnit): number {
  return unit.revenue_m - unit.variable_m - unit.fixed_m - unit.rd_m - unit.dep_m - unit.shared_m;
}

/** The holder of a labor seat, if the seat is open and filled (null for a non-labor seat). */
export function companySeat(company: Company, seat: Seat): SeatHolder | null {
  const i = (SEAT_LABOR as readonly Seat[]).indexOf(seat);
  if (i < 0 || i >= LABOR_SEAT_COUNT) return null;
  return company.board[i] ?? null;
}

/** The data of one industry, if the company has units in it. */
export function companyDataIn(company: Company, industry: IndustryId): DataBook | null {
  const d = company.data.find((x) => x.industry === industry);
  return d === undefined ? null : d.book;
}
