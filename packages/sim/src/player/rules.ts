// The player's tuning (pivot 1.3, 3.6, 13.1, 14; D1042): the difficulty presets and the named
// constants every player rule reads. Values marked (T) are tuning the spec leaves to the build.

import type { Venue } from "../types/action.ts";
import type { AccountId } from "../types/ids.ts";
import type { Difficulty, DifficultySettings } from "../types/state/player.ts";

/** pivot 1.3 `PLAYER_MAX_STAKE`: the most of a company's shares outstanding the player may hold. */
export const PLAYER_MAX_STAKE = 0.05;

/** pivot 3.6 `START_CASH` at Normal (D1027): USD at the brokerage when the account opens. */
export const START_CASH = 50_000;

/**
 * The difficulty presets (pivot 3.6; T, D1042), copied into `PlayerState.difficulty` when the
 * account opens. Easy has more cash, a tighter spread, no commission and more wrong bettors;
 * Hard the reverse. `margin_limit` is 0 until margin exists (pivot 13.2) and `bet_fee` and
 * `bettor_error` are read from M5 on (pivot 10.5, 11.4).
 */
export const DIFFICULTY_PRESETS: Readonly<Record<Difficulty, Readonly<DifficultySettings>>> = Object.freeze({
  Easy: Object.freeze({
    id: "Easy",
    start_cash: 100_000,
    stock_spread: 0.0005,
    commission: 0,
    bet_fee: 0.01,
    margin_limit: 0,
    bettor_error: 1.25,
  }),
  Normal: Object.freeze({
    id: "Normal",
    start_cash: START_CASH,
    stock_spread: 0.001,
    commission: 5,
    bet_fee: 0.02,
    margin_limit: 0,
    bettor_error: 1,
  }),
  Hard: Object.freeze({
    id: "Hard",
    start_cash: 25_000,
    stock_spread: 0.002,
    commission: 10,
    bet_fee: 0.05,
    margin_limit: 0,
    bettor_error: 0.75,
  }),
});

/** The preset a game opens with when none is chosen (pivot 3.6). */
export const DEFAULT_DIFFICULTY: Difficulty = "Normal";

/**
 * The player's account ids on the two venues (`PlayerAccount.account`; D1042): 0 at the brokerage
 * and 1 on the exchange. M5's bettor cohorts take the ids after these.
 */
export const PLAYER_ACCOUNT_IDS: Readonly<Record<Venue, AccountId>> = Object.freeze({
  Brokerage: 0 as AccountId,
  Exchange: 1 as AccountId,
});

/**
 * pivot 14.3: cash earns the policy rate (`World.base_rate`) less this spread, a year, never below
 * 0 (T).
 */
export const CASH_RATE_SPREAD = 0.005;

/**
 * pivot 14.2 `gains_tax` and `income_tax` at the account's opening when the levers are still
 * neutral (T, D1042): the 2020 US long-term gains rate and a middle income bracket. Laws move them
 * from then on (pivot 7.7).
 */
export const START_GAINS_TAX = 0.15;
export const START_INCOME_TAX = 0.24;

/** pivot 14.2: the tax bill falls due at 00:00 on this day of April (T). */
export const TAX_BILL_MONTH = 4;
export const TAX_BILL_DAY = 15;

/**
 * Closed orders kept after the open ones (`PlayerState.orders`, a bounded tail; T): the oldest
 * closed order is dropped when one more closes.
 */
export const ORDERS_CLOSED_KEPT = 50;
