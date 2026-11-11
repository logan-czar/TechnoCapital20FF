// The policy drift (1995-rework 7.5): each quarter the president and the chambers move the US
// corporate tax rate, a fiscal push and a bias on the policy rate toward the president's party's
// targets. No bills or laws as objects. Does nothing in the 2020 world.
//
// The three values are levers (pivot 4.3): the drift reads `World.levers` and writes it only through
// `leversApply`, the function M3's laws and executive actions will call. Pivot 4.3 removes the drift
// when bills exist; what stays then is the quarterly reading of the USA's share of world GDP, which
// turns the `fiscal` lever into the push on world demand.

import { leversApply, usGdpShare } from "../governing/levers.ts";
import { HOUSE_MAJORITY, SENATE_MAJORITY } from "../politics/jobs.ts";
import { officeHolders } from "../politics/state.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { Party } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";

/** How much of the gap to a target one quarter closes (1995-rework 7.5, T). */
export const LEVER_STEP_UNIFIED = 0.15;
export const LEVER_STEP_SPLIT = 0.04;

/** Where a party takes the levers (1995-rework 7.5, T). */
export interface LeverTargets {
  corp_tax_rate: number;
  /** A push on US demand, as a share of it. */
  fiscal: number;
  /** Added to the policy rate's target (1995-rework 6.2). */
  rate_bias: number;
}

export const PARTY_LEVERS: Readonly<Record<Party, LeverTargets>> = {
  Democrats: { corp_tax_rate: 0.35, fiscal: 0.02, rate_bias: -0.0025 },
  Republicans: { corp_tax_rate: 0.21, fiscal: 0.0, rate_bias: 0.0025 },
};

/**
 * The step this quarter (1995-rework 7.5): the president's party holding both chambers moves at full
 * step, one chamber at the slow step, and neither freezes the levers.
 */
export function leverStep(holdsHouse: boolean, holdsSenate: boolean): number {
  if (holdsHouse && holdsSenate) return LEVER_STEP_UNIFIED;
  return holdsHouse || holdsSenate ? LEVER_STEP_SPLIT : 0.0;
}

/**
 * Quarter start, before the policy rate (1995-rework 6.3, 7.5): the party drift moves the three
 * national levers through `leversApply` (pivot 4.3), and the USA's share of world GDP is read for the
 * fiscal push, `1 + fiscal × US share` (governing/levers.ts `fiscalDemandMult`).
 */
export function eraPolicyJob(world: World, _ctx: JobCtx): void {
  const era = world.era;
  if (era === undefined) return;
  const p = world.politics;
  const president = officeHolders(p, "President")[0];
  if (president === undefined) return;
  const seats = (kind: "House" | "Senate"): number =>
    officeHolders(p, kind).filter((c) => c.party === president.party).length;
  const step = leverStep(seats("House") >= HOUSE_MAJORITY, seats("Senate") >= SENATE_MAJORITY);
  const want = PARTY_LEVERS[president.party];
  const l = world.levers;
  leversApply(world, {
    corp_tax: l.corp_tax + step * (want.corp_tax_rate - l.corp_tax),
    fiscal: l.fiscal + step * (want.fiscal - l.fiscal),
    rate_bias: l.rate_bias + step * (want.rate_bias - l.rate_bias),
  });
  era.politics.us_share = usGdpShare(world);
}
