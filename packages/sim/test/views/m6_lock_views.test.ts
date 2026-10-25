// The view half of crates/sim/tests/m6_lock.rs (the rest is test/m6_lock.test.ts): the projection
// ranges (5.16) as the projection view shows them. Pending until the projection view is ported
// (Step 3).
//
// Changed from the Rust: seed 5 seeds the new generator (D951); the widths are the spec formula,
// which holds for any draws.
import { describe, expect, it } from "vitest";
import { simNew, simViews } from "../../src/lib.ts";
import { simDateAddDays, simDateYmd } from "../../src/time/calendar.ts";
import { figureExact } from "../common/births.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";

describe("m6 lock views", () => {
  it("projection_ranges_shrink_with_the_quarter_and_stop_at_three_percent", () => {
    const sim = unwrap(simNew(data(), 5), "Sim::new");
    // Spec 5.16: `max(3%, 30% x (1 - 0.6 x elapsed) x (1 - 24 / 50) x 0.7 x 2)`.
    const spec = (e: number): number =>
      Math.max(0.3 * (1.0 - 0.6 * e) * (1.0 - 24.0 / 50.0) * 0.7 * 2.0, 0.03);
    let last = Number.POSITIVE_INFINITY;
    for (const day of [10, 40, 70, 90]) {
      runTo(sim, simDateAddDays(simDateYmd(2020, 1, 1), day));
      const v = simViews(sim).projection.data;
      const e = v.elapsed_share;
      const r = v.companies[0];
      if (r === undefined) throw new Error("no projection rows");
      expect(Math.abs(r.width - spec(e)) < 1e-12).toBe(true);
      expect(r.width < last && r.width >= 0.03).toBe(true);
      // Company 0 (Arrowhead) is listed, so its figures are exact (D420).
      const consensus = figureExact(r.consensus_ni);
      if (consensus === null) throw new Error("Arrowhead's consensus is exact");
      const half = Math.abs(consensus) * r.width;
      expect(Math.abs((figureExact(r.range[0]) as number) - (consensus - half)) < 1e-6).toBe(true);
      expect(Math.abs((figureExact(r.range[1]) as number) - (consensus + half)) < 1e-6).toBe(true);
      expect(r.plan, "the observer never sees a plan").toBeNull();
      last = r.width;
    }
  });
});
