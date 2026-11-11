// The levers at load (pivot 4.3): a neutral set for every world. Nothing reads or moves them yet:
// lane S3 moves the economy onto them, and laws and executive actions move them from M3 (pivot 7.7).

import type { Levers } from "../types/state/governing.ts";

/** Every lever but the tax rate at its neutral value, 0 (pivot 4.3). */
export const LEVER_NEUTRAL = 0.0;

/**
 * The neutral levers (pivot 4.3) of a world with `industries` industries and `states` US states:
 * `corpTax` is the USA's corporate tax rate at load, and every other lever is `LEVER_NEUTRAL`.
 */
export function leversNeutral(industries: number, states: number, corpTax: number): Levers {
  const perIndustry = (): number[] => new Array<number>(industries).fill(LEVER_NEUTRAL);
  return {
    corp_tax: corpTax,
    fiscal: LEVER_NEUTRAL,
    rate_bias: LEVER_NEUTRAL,
    regulation: perIndustry(),
    subsidy: perIndustry(),
    antitrust: perIndustry(),
    tariff: perIndustry(),
    state_growth: new Array<number>(states).fill(LEVER_NEUTRAL),
    gains_tax: LEVER_NEUTRAL,
    income_tax: LEVER_NEUTRAL,
  };
}
