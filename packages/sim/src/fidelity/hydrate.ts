// Hydration (pivot 3.4): the switch from the Coarse pre-simulation to Full fidelity on the first
// day of play. In M1 it is a skeleton: it sets the fidelity, ends the 25-year run where the world
// has not ended it itself, and trims the per-stock daily bars. Outlets, pollsters, accounts, the
// 2020 cycle, the back-filled polls, the contracts and the player account are M3's.
//
// It is a pure function of the Coarse state (pivot 3.4): it draws nothing and reads no wall clock.
//
// What a world keeps doing past its 25th year (D1030): every job that is not tagged Coarse still
// runs, so the economy, the companies, the politics POC and the news go on as they did. The era's
// tracks hold their last values where they have one (the neutral rate stays at the scenario's
// `neutral_end`, the ideologies stay fully ramped, the House keeps the 2011 census's seats) and
// keep their rules where they are rules (zone tracks, state lean and population drift, mortality,
// the five-yearly top-10 snapshot, the yearly history rows).

import { barHistoryDropBefore, barHistoryLen } from "../market/state.ts";
import { eraHeadline, newsWireQueue } from "../news.ts";
import { dateTimeDate, simDateYmd } from "../time/calendar.ts";
import type { SimDate } from "../types/calendar.ts";
import type { World } from "../types/world.ts";

/**
 * Years of each stock's daily bars a hydrated world keeps (pivot 3.4 "era-only state is trimmed";
 * T, D1030). The pre-simulation keeps 10 (market/jobs.ts `BAR_YEARS_KEPT`), which is 88% of a 2020
 * save (tools/spikes/coarse/README.md). No formula reads the bars: only the price chart's reach
 * back changes. The yearly archive then lets them grow back to 10 as the game is played. The index
 * closes are small and keep their 10.
 */
export const HYDRATE_BAR_YEARS = 3;

/** What `hydrateFull` did. */
export interface HydrateReport {
  /** The day the world became Full. */
  date: SimDate;
  /** The scenario the pre-history ran under, now shown (1995-rework 8.4). */
  scenario: string;
  /** True when hydration ended the run itself; false when the world's own reveal already had. */
  ended_here: boolean;
  /** Daily bars dropped and kept, over every stock. Whole numbers. */
  bars_dropped: number;
  bars_kept: number;
}

/** The first bar day a hydrated world keeps: the 1st of this month, `years` years back. */
export function hydrateFirstBarKept(date: SimDate, years: number = HYDRATE_BAR_YEARS): SimDate {
  return simDateYmd(date.year - years, date.month, 1);
}

/**
 * Switches a Coarse world to Full where it stands (pivot 3.3, 3.4). Afterwards `world.fidelity` is
 * Full, so Coarse-only jobs stop and Full-only jobs start with the next tick, and the world keeps
 * running.
 *
 * The run's end (1995-rework 8.3): a world pre-simulated to its reveal date has already ended its
 * run on its last Coarse tick (`eraRevealJob`: `ended`, the scenario's headline), and the
 * pre-simulation dropped that tick's pause. A world hydrated before its reveal date ends here in
 * the same way: `ended` is set, the reveal date becomes today, and the same headline is queued.
 * Either way the scenario shows in the history from now on, and `eraRevealJob`, a Coarse-only job,
 * never fires in play.
 *
 * Throws on a world with no `era` or one that is already Full: only a historical world's Coarse
 * run is hydrated.
 */
export function hydrateFull(world: World, barYears: number = HYDRATE_BAR_YEARS): HydrateReport {
  const era = world.era;
  if (era === undefined) throw new Error("hydrateFull: not a historical world");
  if (world.fidelity !== "Coarse") throw new Error("hydrateFull: the world is already Full");
  const date = dateTimeDate(world.clock);

  const endedHere = !era.ended;
  if (endedHere) {
    era.ended = true;
    era.reveal_date = date;
    // era/jobs.ts `eraRevealJob`'s headline, word for word.
    newsWireQueue(world.news, eraHeadline(date, `The run ends. This world was ${era.scenario.label}`));
  }

  // pivot 3.4 "era-only state is trimmed": the bars older than the chart needs on day one.
  const firstKept = hydrateFirstBarKept(date, barYears);
  let before = 0;
  let after = 0;
  for (const s of world.market.stocks) {
    before += barHistoryLen(s.bars);
    barHistoryDropBefore(s.bars, firstKept);
    after += barHistoryLen(s.bars);
  }

  world.fidelity = "Full";
  return {
    date,
    scenario: era.scenario.label,
    ended_here: endedHere,
    bars_dropped: before - after,
    bars_kept: after,
  };
}
