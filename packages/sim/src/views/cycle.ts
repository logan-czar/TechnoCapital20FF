// v_cycle: `get_cycle()` (spec 9.2): the global phase, g_t, quarters left, Z, every zone's cycle
// settings, effect and spreads, and the AI stage, boom year and boom date; the rolled pop date
// only in Omniscient. Rebuilt daily (zone confidence moves each day at 00:00, 5.1.2; D146), on
// load and after a control (the Omniscient toggle shows or hides the pop date). Ported from
// crates/sim/src/views/cycle.rs.

import { boomYear, stageAt } from "../economy/ai_boom.ts";
import { dateTimeDate } from "../time/calendar.ts";
import { ordinal, type ZoneId } from "../types/ids.ts";
import type { CycleView } from "../types/views/cycle.ts";
import type { ViewInput } from "./index.ts";

/** Rust `impl ViewData for CycleView`: `build`. */
export function buildCycle(input: ViewInput): CycleView {
  const w = input.world;
  const c = w.cycle;
  const [stage, quartersIn] = stageAt(dateTimeDate(w.clock), w.ai.boom_date, w.ai.pop_date);
  return {
    phase: c.phase,
    g_t: c.g_t,
    quarters_left: c.quarters_left,
    z_avg: c.z_avg,
    base_rate: w.base_rate,
    zones: w.zones.map((z, i) => ({
      id: ordinal<ZoneId>(i),
      number: z.number,
      key: z.key,
      name: z.name,
      exchange_code: z.exchange_code,
      intensity: z.intensity,
      lag_quarters: z.lag_quarters,
      contagion: z.contagion,
      effect: z.effect,
      gdp_share: z.gdp_share,
      credit_spread_base: z.credit_spread_base,
      credit_spread: z.credit_spread,
      confidence: z.confidence,
      index_close: (w.market.indices[i] as (typeof w.market.indices)[number]).prev_close,
    })),
    ai_stage: w.ai.stage,
    boom_year: stage === "Boom" ? boomYear(quartersIn) : null,
    boom_date: w.ai.boom_date,
    ai_labs_lt: w.ai.ai_labs_lt,
    pop_date: input.controls.omniscient ? w.ai.pop_date : null,
  };
}
