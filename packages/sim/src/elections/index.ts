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

//
// Lane E's build (D1040): calendar.ts (dates), geography.ts (where a race is voted), count.ts (the
// vote), races.ts (fields, primaries, specials, seating), jobs.ts (the daily and weekly jobs) and
// mirror.ts (the POC's table kept as a mirror for its readers). Elections act only in a world with
// counties; a world without keeps the POC's vote.

import { type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import type { ElectionsState } from "../types/state/elections.ts";
import type { World } from "../types/world.ts";
import { electionsDailyJob, electionsWeeklyJob, startElections } from "./jobs.ts";

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
 * `DailyElections` slot, the weekly ones in `WeeklyJobs` (first there).
 */
export function registerElectionJobs(s: Scheduler): void {
  schedulerRegister(s, "DailyElections", "elections.calendar", electionsDailyJob);
  schedulerRegister(s, "WeeklyJobs", "elections.coarse_campaigns", electionsWeeklyJob, {
    fidelity: "Coarse",
  });
}

/**
 * The elections at a world's start (pivot 6.1): the governor cycles, the start year's races, and
 * (while lane C seats nobody at the start) persons from the POC's seats. Runs after `geoStart` and
 * `personsStart`. Campaign stream (and lane C's Politics stream inside `challengerFor`).
 */
export function electionsStart(world: World, draws: DrawSource): void {
  startElections(world, draws);
}
