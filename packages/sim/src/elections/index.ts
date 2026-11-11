// Lane E's module (pivot 6.1, 6.2, 6.6, 6.7, 9.4; D1037): the vote count kernel county to district
// to state to the Electoral College, built on politics/vote.ts `shares` and `utility`; the calendar
// with governors on each state's cycle and special elections; Coarse campaigns as one strength
// number; races, candidacies and primaries; certified results stored compactly. Vote noise and
// swings come from the Count stream and Coarse campaign strength and primaries from the Campaign
// stream (pivot-lanes.md "RNG streams").
//
// The contracts change wrote the seams only: `registerElectionJobs` (jobs.ts calls it, in the
// `DailyElections` and `WeeklyJobs` slots), `electionsStart` (lib.ts `START_DEPS` calls it after
// the POC's and lane C's starts) and `electionsStateEmpty` (the load). Their signatures are
// contracts. Lane E also owns the politics POC's removal (politics/jobs.ts and its views).

import type { Scheduler } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import type { ElectionsState } from "../types/state/elections.ts";
import type { World } from "../types/world.ts";

/** No races, no calendar (D1037): every world's at load until lane E opens a cycle. */
export function electionsStateEmpty(): ElectionsState {
  return {
    calendar: { next_general: null, primaries: [], governor_cycle: [] },
    races: [],
    races_made: 0,
    latest_general: null,
    county_results: [],
    colleges: [],
  };
}

/**
 * Lane E's jobs. Pivot 3.3: the vote count runs at both fidelities (at once at Coarse; election
 * night's batches are M5's, tagged Full), Coarse campaigns are tagged `{ fidelity: "Coarse" }`
 * and Full campaigns (M3) `{ fidelity: "Full" }`. Registered by jobs.ts: the daily jobs in the
 * `DailyElections` slot, the weekly ones in `WeeklyJobs` (first there). Empty until lane E adds them.
 */
export function registerElectionJobs(_s: Scheduler): void {}

/**
 * The elections at a world's start (pivot 6.1): nothing until lane E sets the calendar and opens the
 * cycle. Runs after `geoStart` and `personsStart`. Count and Campaign streams only.
 */
export function electionsStart(_world: World, _draws: DrawSource): void {}
