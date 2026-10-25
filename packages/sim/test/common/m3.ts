// Shared helpers of the M2/M3 ports that the Rust tests got from the library or wrote inline:
// the derived unit figures (BusinessUnit::assets_eff and ebit_m, documented on the contract in
// types/world.ts), the skill kinds, and the spec 3.7.1 size rule. Written from the contract docs,
// so no module that is not ported yet is needed.
import type { CompanySize, Skills } from "../../src/types/state/people.ts";
import type { BusinessUnit } from "../../src/types/world.ts";

export type SkillKind = keyof Skills;

/** SkillKind::ALL, in the contract field order. */
export const SKILL_KINDS: readonly SkillKind[] = [
  "finance",
  "operations",
  "persuasion",
  "intrigue",
  "tech",
  "hustle",
];

/** BusinessUnit::assets_eff: gross less 20% of the assets still ramping (spec 5.2, 10.0.4). */
export function unitAssetsEff(u: BusinessUnit): number {
  let ramp = 0;
  for (const t of u.ramping) ramp += t.amount;
  return u.gross_assets - 0.2 * ramp;
}

/** BusinessUnit::ebit_m (spec 5.5). */
export function unitEbitM(u: BusinessUnit): number {
  return u.revenue_m - u.variable_m - u.fixed_m - u.rd_m - u.dep_m - u.shared_m;
}

/** Spec 3.7.1: small under $100M, mid to $10B, large from $10B. */
export function specSize(revenueUsd: number): CompanySize {
  if (revenueUsd >= 10.0e9) return "Large";
  if (revenueUsd >= 100.0e6) return "Mid";
  return "Small";
}

/** CompanySize as Rust's `size as usize` (declaration order). */
export function sizeIndex(s: CompanySize): number {
  return ["Small", "Mid", "Large"].indexOf(s);
}
