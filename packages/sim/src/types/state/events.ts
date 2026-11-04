// Board-seat events (drift plan lane W, spec v1.5 5.21, D1024). Types only; the rules are in
// events/seats.ts.

/** What a seat event moves while it lasts: one per labor seat's role. */
export type SeatEffectKind = "Growth" | "Spread" | "Productivity" | "Revenue" | "Margin";

/**
 * A temporary multiplier from a seat event: its full `value` when it lands, fading linearly to
 * nothing over `quarters` plan locks. Growth is a fraction a year on the growth plan, Spread a
 * fraction a year on the line rate, Revenue a fraction of revenue, Margin a fraction of revenue off
 * the variable cost share. Signed: a success helps, a failure hurts.
 */
export interface SeatEffect {
  kind: SeatEffectKind;
  value: number;
  /** Plan locks left, counting the one it landed at (u32). */
  quarters_left: number;
  /** Plan locks it lasts (u32). */
  quarters: number;
}

/** Successes and failures so far, per labor seat, for the long-run reports (u64 each). */
export interface SeatTally {
  ok: number[];
  fail: number[];
}
