// World-level economy state's methods (spec 3.1): the global business cycle and the AI boom.
// Ported from crates/sim/src/world/economy.rs; the types are in types/world.ts. The formulas
// that move the state live in the economy/ port.

import type { AiStage, CyclePhase, GlobalCycle } from "../types/world.ts";

export { AI_STAGE_VALUES, CYCLE_PHASE_VALUES } from "../types/world.ts";

/** Rust `CyclePhase::name`: equals the variant. */
export function cyclePhaseName(phase: CyclePhase): string {
  return phase;
}

/** Rust `AiStage::name`: equals the variant. */
export function aiStageName(stage: AiStage): string {
  return stage;
}

/**
 * g lag quarters ago (spec 5.1): `g_history[min(lag, len − 1)]`, or `g_t` when the history is
 * empty. `lag` is a whole number (u32).
 */
export function globalCycleGLagged(cycle: GlobalCycle, lag: number): number {
  const i = Math.min(lag, Math.max(0, cycle.g_history.length - 1));
  const g = cycle.g_history[i];
  return g === undefined ? cycle.g_t : g;
}
