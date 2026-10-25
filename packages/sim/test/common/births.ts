// Shared helpers of the M6 integration tests (m6_births, m6_full_year, m6_ipo, m6_lock, m6_news):
// small pure functions the Rust files each wrote out themselves, kept here once. Reads the World
// types only, so it needs no module that is not ported yet except businessUnitAssetsEff
// (world/entities.ts, ported) and the Figure tagged unions (types/views/estimate.ts).
import type { SimDate } from "../../src/types/calendar.ts";
import type { IndustryId } from "../../src/types/ids.ts";
import type { Figure } from "../../src/types/views/estimate.ts";
import type { Company, World } from "../../src/types/world.ts";
import { businessUnitAssetsEff } from "../../src/world/entities.ts";

/** CompanyStatus::is_frozen: Bankrupt or Removed (spec 5.12). */
export function isFrozen(c: Company): boolean {
  const s = c.finance.distress.status;
  return s === "Bankrupt" || s === "Removed";
}

/** Rust Date == Date. */
export function sameDate(a: SimDate | null | undefined, b: SimDate | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Spec 5.2 supply before PC bonuses: the fringe at productivity 100 plus each unit not frozen at
 * `assets_eff × turnover × (productivity + location bonus) ÷ 100`.
 */
export function supplyBeforeBonus(w: World, i: IndustryId): number {
  const ind = w.industries[i];
  if (ind === undefined) throw new RangeError(`no industry ${i}`);
  const t = ind.params.asset_turnover;
  let units = 0;
  for (const u of w.units) {
    const owner = w.companies[u.company];
    if (u.industry === i && owner !== undefined && !isFrozen(owner)) {
      units += (businessUnitAssetsEff(u) * t * (u.productivity + u.location_bonus)) / 100.0;
    }
  }
  return ind.fringe_assets * t + units;
}

/** Figure::exact(): the value of an Exact figure, null for a band. */
export function figureExact(f: Figure): number | null {
  return f.kind === "Exact" ? f.value : null;
}

/** Figure::band(): the band of a banded figure, null for an exact one. */
export function figureBand(f: Figure): { estimate: number; low: number; high: number } | null {
  return f.kind === "Band" ? f.band : null;
}

/** Sum of a list of numbers (Rust `.iter().sum::<f64>()`, left to right). */
export function sum(xs: Iterable<number>): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}
