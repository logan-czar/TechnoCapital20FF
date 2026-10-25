// Births jobs (spec 5.19, 5.20): the plan-lock glue of the births module. Ported from
// crates/sim/src/births/jobs.rs. This first chunk holds the constants and `tippedLabName`
// (news needs them); the load draws, the plan-lock jobs and `register` follow with the births
// state and startup files.

import type { World } from "../types/world.ts";

/**
 * companies.csv id prefix: a born company takes the next CO- id (spec 5.19.3; D4 ordinals
 * append).
 */
export const COMPANY_KEY_PREFIX = "CO-";
/** industries.csv id of AI labs: the tipped lab's candidates and F4's headline (5.1.1, 5.18). */
export const AI_LABS_KEY = "ai_labs";
/** startup-events.csv id of the boom event, whose headline names the tipped lab (5.18 F4). */
export const CHATBOT_EVENT_ID = "F4";

/** The key of the `n`th company, 1-based (CO-0001 to CO-0651 load; born companies append). */
export function companyKey(n: number): string {
  return `${COMPANY_KEY_PREFIX}${String(n).padStart(4, "0")}`;
}

/** The tipped lab's name (5.1.1), or a generic name with no candidate. */
export function tippedLabName(world: World): string {
  const c = world.births.tipped_lab;
  return c === null ? "An AI lab" : (world.companies[c] as World["companies"][number]).name;
}
