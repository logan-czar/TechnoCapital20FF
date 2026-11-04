// The live effect of a company's board-seat events (spec v1.5 5.21, D1024), read by revenue, the
// line rate and the plan lock. A leaf module (types only), so those low-level jobs import no cycle;
// the events themselves are in events/seats.ts.

import type { SeatEffectKind } from "../types/state/events.ts";
import type { Company } from "../types/world.ts";

/** A company's live effect of `kind` (0 with none): each effect's value, faded by the locks left. */
export function seatEffectNow(c: Company, kind: SeatEffectKind): number {
  let sum = 0.0;
  for (const e of c.seat_effects ?? []) {
    if (e.kind === kind) sum += (e.value * e.quarters_left) / e.quarters;
  }
  return sum;
}
