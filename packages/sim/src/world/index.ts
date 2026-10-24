// The world state's helpers: ids, Vec-backed tables in id order, and the methods every module
// shares (spec 3; build-plan 2.3 `world/`). Ported from crates/sim/src/world/mod.rs. The types
// are in types/world.ts; the pure step contract is documented there. `World::from_data` is
// `worldFromData` in world/load.ts (lane W2).

import type { DateTime, SimDate } from "../types/calendar.ts";
import type { CompanyId, IndustryId } from "../types/ids.ts";
import type { World } from "../types/world.ts";
import { INDUSTRY_UNPUBLISHED_BELOW } from "../types/world.ts";

export { INDUSTRY_UNPUBLISHED_BELOW } from "../types/world.ts";
export * from "./economy.ts";
export * from "./entities.ts";
export * from "./log.ts";
export * from "./notice.ts";
export * from "./table.ts";

// CONTRACT: Rust reads `Date::quarter`, `Quarter::next`, `quarter::release_tick` and
// `DateTime::date` from time/ (lane W1). Until that port is merged, the two needs below are met
// with a private day count: a SimDate's day number counts days since 2020-01-01, and an hour
// count is a DateTime (types/calendar.ts). Replace with the time/ functions when they land.

/** Days from 1970-01-01 to a civil date (Howard Hinnant's algorithm), proleptic Gregorian. */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Days since the game epoch, 2020-01-01. */
function dayNumber(d: SimDate): number {
  return daysFromCivil(d.year, d.month, d.day) - daysFromCivil(2020, 1, 1);
}

/** Release day of the month (spec 4.4 row 1; time/quarter.ts RELEASE_DAY). */
const RELEASE_DAY = 2;

/** `release_tick(date.quarter().next())`: 00:00 on the release day of the next quarter's first month. */
function releaseTickAfter(date: SimDate): DateTime {
  const q = Math.floor((date.month - 1) / 3) + 1;
  const [year, nextQ] = q === 4 ? [date.year + 1, 1] : [date.year, q + 1];
  return dayNumber({ year, month: 3 * (nextQ - 1) + 1, day: RELEASE_DAY }) * 24;
}

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
  return t >= releaseTickAfter(s.listed_on);
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
  const today = Math.floor(t / 24); // `t.date()` as a day number
  const seen: CompanyId[] = [];
  for (const u of world.units) {
    if (u.industry !== id) continue;
    const c = world.companies[u.company]!;
    const born = c.origin.kind === "Start" ? true : dayNumber(c.origin.date) <= today;
    const frozen = c.finance.bankrupt_on !== null && dayNumber(c.finance.bankrupt_on) <= today;
    if (born && !frozen && !worldPublishesAt(world, u.company, t) && !seen.includes(u.company)) {
      seen.push(u.company);
    }
  }
  return seen.length >= 1 && seen.length < INDUSTRY_UNPUBLISHED_BELOW;
}
