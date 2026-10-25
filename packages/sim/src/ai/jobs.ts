// The Lite AI on the World (build-plan M6.1 to M6.4): the plan at load (D283), the plan lock's
// batch (spec 4.4 row 3, section 6: every company not frozen, newborns included, in id order),
// and loss_q at each close (spec 6, 3.6). Ported from crates/sim/src/ai/jobs.rs.
//
// This chunk holds `planAtLoad` and `lossQuartersJob`; the plan lock batch (it needs the market's
// `setSharesOut`, news, people's `confidenceFactor` and raise.ts) follows.

import { companyStatusIsFrozen } from "../finance/distress.ts";
import { companyFinanceQuarters, companyFinanceStatus } from "../finance/state.ts";
import { ledgerEbit } from "../finance/statements.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { World } from "../types/world.ts";
import { gDem, nextLossQuarters } from "./inputs.ts";

/**
 * The plan at load (spec 6.5 last line, 7.1 Plan row; D283): each unit's growth is g_dem of the Q1
 * 2020 draw (no situation row, nudge or funding cap); R&D is the 6.3 rule at productivity 100 and
 * loss_q 0, set by the load with the units (`world/load`); stations stay the 7.1 loadout; no
 * financing move and no dividend. Call after the economy's load draws.
 */
export function planAtLoad(world: World): void {
  const { units, industries } = world;
  for (const u of units) {
    const ind = industries[u.industry] as World["industries"][number];
    u.growth_plan = gDem(ind.lt, ind.q_growth);
  }
}

/**
 * The 4.4 close, after finance has archived the quarter (spec 6 loss_q, 3.6 `loss_quarters`):
 * each company not frozen counts one more loss quarter when the quarter's EBIT is below 0, else
 * starts again at 0.
 */
export function lossQuartersJob(world: World, _ctx: JobCtx): void {
  for (const c of world.companies) {
    if (companyStatusIsFrozen(companyFinanceStatus(c.finance))) continue;
    const quarters = companyFinanceQuarters(c.finance);
    const q = quarters[quarters.length - 1];
    if (q !== undefined) c.loss_quarters = nextLossQuarters(c.loss_quarters, ledgerEbit(q.lines));
  }
}
