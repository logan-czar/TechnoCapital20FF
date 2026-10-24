// v_cycle (crates/sim/src/views/cycle.rs): `get_cycle()` (spec 9.2): the global phase, g_t,
// quarters left, Z, every zone's cycle settings, effect and spreads, and the AI stage, boom year
// and boom date; the rolled pop date only in Omniscient. Rebuilt daily (zone confidence moves
// each day at 00:00, 5.1.2; D146), on load and after a control (the Omniscient toggle shows or
// hides the pop date).
//
// Not ported: the `ViewData` build (logic).

import type { SimDate } from "../calendar.ts";
import type { ZoneId } from "../ids.ts";
import type { AiStage, CyclePhase } from "../world.ts";

/** One zone of the cycle view (spec 8 Financial zones map mode hover, 9.2). */
export interface ZoneCycleRow {
  id: ZoneId;
  number: number;
  key: string;
  name: string;
  exchange_code: string;
  intensity: number;
  lag_quarters: number;
  contagion: number;
  /** `intensity × g(t − lag)` plus any own shock, a yearly rate (spec 5.1). */
  effect: number;
  gdp_share: number;
  /** Base and effective credit spread, fractions (spec 5.1.2). */
  credit_spread_base: number;
  credit_spread: number;
  /** Investor confidence of the zone exchange, −100 to +100, moved daily (spec 5.1.2). */
  confidence: number;
  /**
   * The exchange's headline index level at its last daily close; null with no listing
   * (spec 5.14).
   */
  index_close: number | null;
}

export interface CycleView {
  phase: CyclePhase;
  g_t: number;
  quarters_left: number;
  z_avg: number;
  base_rate: number;
  zones: ZoneCycleRow[];
  ai_stage: AiStage;
  /** Whole years into the boom, while it runs (spec 5.1.1). */
  boom_year: number | null;
  boom_date: SimDate;
  /** AI labs' long-term rate this quarter. */
  ai_labs_lt: number;
  /** The rolled pop date: only in Omniscient (spec 9.2). */
  pop_date: SimDate | null;
}
