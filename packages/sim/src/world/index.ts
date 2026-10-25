// The world state's helpers: ids, Vec-backed tables in id order, and the methods every module
// shares (spec 3; build-plan 2.3 `world/`). Ported from crates/sim/src/world/mod.rs. The types
// are in types/world.ts; the pure step contract is documented there. `World::from_data` is
// `worldFromData` in world/load.ts (lane W2).

import { dateTimeDate, quarterNext, simDateQuarter } from "../time/calendar.ts";
import { releaseTick } from "../time/quarter.ts";
import { cmpDate, type DateTime } from "../types/calendar.ts";
import type { CompanyId, IndustryId } from "../types/ids.ts";
import type { World } from "../types/world.ts";
import { INDUSTRY_UNPUBLISHED_BELOW } from "../types/world.ts";

export { INDUSTRY_UNPUBLISHED_BELOW } from "../types/world.ts";
export * from "./economy.ts";
export * from "./entities.ts";
export * from "./log.ts";
export * from "./notice.ts";
export * from "./table.ts";

/**
 * Whether company `id` publishes its figures at `t` (spec 1, 5.20.1 Listing step 4; D420, D439):
 * a company listed at load always; a company listed in play from the first release after its
 * listing; a private one never (also before a later listing). The engine (the wire) and the views
 * both read it.
 */
export function worldPublishesAt(world: World, id: CompanyId, t: DateTime): boolean {
  const s = world.market.stocks[id]!;
  if (s.exchange === null) return false;
  if (s.listed_on === null) return true;
  return t >= releaseTick(quarterNext(simDateQuarter(s.listed_on)));
}

/** `worldPublishesAt` now. */
export function worldPublishes(world: World, id: CompanyId): boolean {
  return worldPublishesAt(world, id, world.clock);
}

/**
 * Whether industry `id` is in the estimated class at `t` (Logan's ruling, D432, D437): at least
 * one and fewer than INDUSTRY_UNPUBLISHED_BELOW of its companies that exist at `t` (born by then),
 * not bankrupt by then, do not publish at `t`. Read for a past quarter with `t` its close, so a
 * quarter's bands follow the class it was in.
 */
export function worldIndustryEstimatedAt(world: World, id: IndustryId, t: DateTime): boolean {
  const today = dateTimeDate(t);
  const seen: CompanyId[] = [];
  for (const u of world.units) {
    if (u.industry !== id) continue;
    const c = world.companies[u.company]!;
    const born = c.origin.kind === "Start" ? true : cmpDate(c.origin.date, today) <= 0;
    const frozen = c.finance.bankrupt_on !== null && cmpDate(c.finance.bankrupt_on, today) <= 0;
    if (born && !frozen && !worldPublishesAt(world, u.company, t) && !seen.includes(u.company)) {
      seen.push(u.company);
    }
  }
  return seen.length >= 1 && seen.length < INDUSTRY_UNPUBLISHED_BELOW;
}
