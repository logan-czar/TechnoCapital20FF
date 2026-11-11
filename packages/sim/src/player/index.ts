// Lane P's module (pivot 1.3, 2.4, 3.6, 13.1, 14; D1027, D1037): the player's account. Cash at the
// brokerage and the exchange with transfers; price-taker stock trades at the formula price plus
// spread and commission, long only, under the 5% cap; FIFO lots and the April tax bill; interest on
// cash; alerts and follows; the bankruptcy end; `simAct` applying actions inside the state hash and
// recording them for replay; the fixed auto-pauses of pivot 2.4 that exist so far; the difficulty
// presets. The player draws nothing (pivot-lanes.md "RNG streams").
//
// The contracts change wrote the seams only: `registerPlayerJobs` (jobs.ts calls it, in the
// `HourlyPlayer` and `DailyPlayer` slots), `playerStart` (lib.ts `START_DEPS`, last) and `playerAct`
// (lib.ts `simAct`). Their signatures are contracts.

import type { Scheduler } from "../time/scheduler.ts";
import type { ActError, PlayerAction } from "../types/action.ts";
import type { Notice } from "../types/notice.ts";
import type { Result, World } from "../types/world.ts";

/**
 * Lane P's jobs. Pivot 3.3: the player exists only at Full fidelity, so every job here is
 * registered `{ fidelity: "Full" }`. Registered by jobs.ts: the hourly ones (fills at the hour's
 * price, after it is set; price alerts) in `HourlyPlayer`, the daily ones (interest, the April tax,
 * Day orders expiring) in `DailyPlayer`. Empty until lane P adds them.
 */
export function registerPlayerJobs(_s: Scheduler): void {}

/**
 * The player at a world's start, last of the start's steps: nothing until lane P opens the account
 * in a Full world (`World.player` stays null). Draws nothing.
 */
export function playerStart(_world: World): void {}

/**
 * Applies one action between ticks (D1027; lib.ts `simAct` calls it and then refreshes the views
 * marked `on_act`). A refused action changes nothing and is not recorded; an applied one is
 * recorded in `World.player.actions` by lane P at `world.clock` (it applies after that tick). Until
 * lane P every action is `NotAvailable`.
 */
export function playerAct(_world: World, action: PlayerAction): Result<Notice[], ActError> {
  return { ok: false, error: { kind: "NotAvailable", action: action.kind } };
}
