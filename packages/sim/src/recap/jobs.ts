// The quarterly recap on the World (build-plan M6.5; spec 4.4 row 5, 8, 21.6.2): built at 00:00 on
// the first day of the pre-quarter-end week, from the lock's projection and consensus. Ported from
// crates/sim/src/recap/jobs.rs.
//
// Recap and RECAPS_KEPT are in types/state/recap.ts.

import { companyIsFrozen } from "../economy/index.ts";
import { elapsedShare } from "../market/projection.ts";
import { confidenceFactor } from "../people/management.ts";
import { companyRecap, expectedResultNew, ratingWatch, worldRecap } from "../recap.ts";
import { simDateQuarter } from "../time/calendar.ts";
import { type JobCtx, type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import type { CompanyId, IndustryId } from "../types/ids.ts";
import { ordinal } from "../types/ids.ts";
import type { CompanyRecap, ExpectedResult } from "../types/state/recap.ts";
import { RECAPS_KEPT, type Recap } from "../types/state/recap.ts";
import type { PhaseLabel, World } from "../types/world.ts";

export type { Recap };
export { RECAPS_KEPT };

/**
 * 4.4 row 5 (spec 8, 21.6.2; D280): the world page (phase, g_t, industries by label, the five
 * largest expected beats and misses of the quoted companies by the lock's projection against its
 * consensus) and every company page (the observer's 5.16 range at today's elapsed share, the
 * expected reaction, confidence, the outlook with the rating watch).
 */
export function recapJob(world: World, ctx: JobCtx): void {
  const quarter = simDateQuarter(ctx.facts.date);
  const elapsed = elapsedShare(ctx.facts.now);
  const listed: ExpectedResult[] = [];
  const pages: CompanyRecap[] = [];
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as World["companies"][number];
    if (companyIsFrozen(c)) continue;
    const id = ordinal<CompanyId>(i);
    const s = world.market.stocks[i] as World["market"]["stocks"][number];
    const expected = expectedResultNew(id, s.projection_ni, s.consensus_ni);
    if (s.quoted) listed.push(expected);
    const label = (world.industries[c.industry] as World["industries"][number]).phase_label;
    pages.push(
      companyRecap(
        quarter,
        expected,
        elapsed,
        confidenceFactor(c.management_score),
        s.exchange !== null && s.quoted
          ? (world.zones[s.exchange] as World["zones"][number]).confidence
          : null,
        {
          label,
          loss_quarters: c.loss_quarters,
          rating: c.finance.rating,
          rating_watch: ratingWatch(c.finance.rating, c.finance.implied.implied),
        },
      ),
    );
  }
  const industries: [IndustryId, PhaseLabel][] = world.industries.map((ind, i) => [
    ordinal<IndustryId>(i),
    ind.phase_label,
  ]);
  const page = worldRecap(quarter, world.cycle.phase, world.cycle.g_t, industries, listed);
  world.recaps.push({ world: page, companies: pages });
  const extra = Math.max(world.recaps.length - RECAPS_KEPT, 0);
  world.recaps.splice(0, extra);
}

/** Registers the recap job (spec 4.4 row 5). */
export function register(s: Scheduler): void {
  schedulerRegister(s, "RecapBuild", "recap.build", recapJob);
}
