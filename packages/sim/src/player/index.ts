// Lane P's module (pivot 1.3, 2.4, 3.6, 13.1, 14; D1027, D1037, D1042): the player's account. Cash
// at the brokerage and the exchange with transfers; price-taker stock trades at the formula price
// plus spread and commission, long only, under the 5% cap; FIFO lots and the April tax bill;
// interest on cash; dividends; alerts and follows; the bankruptcy end; `simAct` applying actions
// inside the state hash and recording them for replay; the fixed auto-pauses of pivot 2.4 that
// exist so far; the difficulty presets. The player draws nothing (pivot-lanes.md "RNG streams").
//
// Files: rules.ts (presets and constants), book.ts (cash, lots, fills, net worth), act.ts (the
// actions), jobs.ts (the hourly and daily jobs, with the fill rule), notify.ts (notifications).
//
// The seams' signatures are contracts: `registerPlayerJobs` (jobs.ts calls it, in the
// `HourlyPlayer` and `DailyPlayer` slots), `playerStart` (lib.ts `START_DEPS`, last) and `playerAct`
// (lib.ts `simAct`).

import { LEVER_NEUTRAL } from "../governing/levers.ts";
import { dateTimeDate } from "../time/calendar.ts";
import { type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import { type ActError, type PlayerAction, VENUE_VALUES } from "../types/action.ts";
import type { Notice } from "../types/notice.ts";
import type { Difficulty, PlayerState } from "../types/state/player.ts";
import type { Result, World } from "../types/world.ts";
import { act } from "./act.ts";
import { playerDailyJob, playerHourlyJob } from "./jobs.ts";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_PRESETS,
  PLAYER_ACCOUNT_IDS,
  START_GAINS_TAX,
  START_INCOME_TAX,
} from "./rules.ts";

export { netWorth } from "./book.ts";
export { usd } from "./notify.ts";
export * from "./rules.ts";

/**
 * Lane P's jobs, every one `{ fidelity: "Full" }` (pivot 3.3: the player exists only at Full
 * fidelity): fills at the hour's price, dividends, delistings and price alerts in `HourlyPlayer`;
 * interest, the tax year, Day orders expiring and the April bill in `DailyPlayer` (player/jobs.ts).
 */
export function registerPlayerJobs(s: Scheduler): void {
  schedulerRegister(s, "HourlyPlayer", "player.hourly", playerHourlyJob, { fidelity: "Full" });
  schedulerRegister(s, "DailyPlayer", "player.daily", playerDailyJob, { fidelity: "Full" });
}

/**
 * Opens the player's account in `world` with a difficulty preset (pivot 3.6, 14.1): the preset's
 * cash at the brokerage, none on the exchange, the tax year the clock's. If the player-scope tax
 * levers are still neutral they take their starting rates (pivot 4.3, 14.2; D1042). Replaces any
 * player already there. The explicit way in for a world that is never hydrated (the frozen test
 * world, the headless tool's `record`), and what `playerStart` calls at hydration. Throws in a
 * Coarse world (pivot 3.3: the player exists only at Full fidelity). Draws nothing.
 */
export function playerOpen(world: World, difficulty: Difficulty = DEFAULT_DIFFICULTY): PlayerState {
  if (world.fidelity !== "Full")
    throw new Error("playerOpen: the player exists only in a Full world (pivot 3.3)");
  const preset = DIFFICULTY_PRESETS[difficulty];
  const p: PlayerState = {
    difficulty: { ...preset },
    accounts: VENUE_VALUES.map((venue) => ({
      venue,
      account: PLAYER_ACCOUNT_IDS[venue],
      cash: venue === "Brokerage" ? preset.start_cash : 0,
      reserved: 0,
    })),
    positions: [],
    orders: [],
    orders_made: 0,
    fills: [],
    settlements: [],
    tax_year: dateTimeDate(world.clock).year,
    realised_gains: 0,
    interest: 0,
    tax_due: 0,
    follows: [],
    alerts: [],
    alerts_made: 0,
    notifications: [],
    read_through: -1,
    bankrupt: false,
    ended: null,
    actions: [],
  };
  if (world.levers.gains_tax === LEVER_NEUTRAL) world.levers.gains_tax = START_GAINS_TAX;
  if (world.levers.income_tax === LEVER_NEUTRAL) world.levers.income_tax = START_INCOME_TAX;
  world.player = p;
  return p;
}

/**
 * The player at a world's start (D1037, D1042): the account opens at `difficulty` (Normal when
 * absent) when a historical world has become Full, that is at hydration on 2020-01-01 (pivot 3.4;
 * lib.ts `simHydrate` calls this after `hydrateFull`, D1052). At load a historical world is Coarse,
 * so nothing opens; a world with no pre-history (the frozen test world, the 2020 world) is Full from
 * its load but never hydrates, and stays without a player unless a test or the headless tool opens
 * one with `playerOpen`. Draws nothing.
 */
export function playerStart(world: World, difficulty: Difficulty = DEFAULT_DIFFICULTY): void {
  if (world.fidelity === "Full" && world.era !== undefined && world.player === null) {
    playerOpen(world, difficulty);
  }
}

/**
 * Applies one action between ticks (D1027; lib.ts `simAct` calls it and then refreshes the views
 * marked `on_act`). A refused action changes nothing and is not recorded; an applied one is
 * recorded in `World.player.actions` at `world.clock` (it applies after that tick). With no player
 * every action is `NotAvailable`, as are the exchange's orders until M5.
 */
export function playerAct(world: World, action: PlayerAction): Result<Notice[], ActError> {
  const r = act(world, action);
  return r.ok ? { ok: true, value: [] } : r;
}
