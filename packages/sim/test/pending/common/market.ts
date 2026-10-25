// Helpers shared by the M5 market tests (crates/sim/tests/m5_*.rs): the headline index level
// written out from the spec, a quantile and a time stepper. No ported module is needed beyond
// the World types.
import { type Sim, simNow, simStep } from "../../../src/lib.ts";
import type { DateTime } from "../../../src/types/calendar.ts";
import type { ZoneId } from "../../../src/types/ids.ts";
import { roundHalfAway } from "../../../src/types/num.ts";
import type { World } from "../../../src/types/world.ts";

/**
 * Sum of P x shares_out of the quoted companies on z, divided by the divisor (spec 5.14), written
 * out; null while the exchange shows no level.
 */
export function specLevel(w: World, z: ZoneId): number | null {
  let cap = 0;
  w.market.stocks.forEach((s, id) => {
    if (s.quoted && s.exchange === z) cap += s.price * (w.companies[id]?.shares_out ?? 0);
  });
  const d = w.market.indices[z]?.divisor ?? null;
  return d === null ? null : cap / d;
}

/** Steps until the clock reaches t. */
export function stepTo(sim: Sim, t: DateTime): void {
  while (simNow(sim) < t) simStep(sim);
}

/** m5_tracking quantile: sorted[round((len - 1) x q)], NaN when empty (Rust f64::round). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  return sorted[roundHalfAway((sorted.length - 1) * q)] as number;
}

/** The 1e-9 relative compare of the daily and index tests; throws with what on a miss. */
export function nearRel(a: number, b: number, what: string, floor = 1e-6): void {
  const tol = 1e-9 * Math.max(Math.abs(a), Math.abs(b), floor);
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${what}: ${a} vs ${b}`);
}
