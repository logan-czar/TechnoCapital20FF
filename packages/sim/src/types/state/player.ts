// The player (pivot 1.3, 2.4, 3.6, 13.1, 14; D1027, D1037): `World.player`. Types only. Lane P
// (packages/sim/src/player/) builds it in M2: cash at the two venues, price-taker stock trades at
// the formula price plus spread and commission, long only and capped at `PLAYER_MAX_STAKE` (pivot
// 1.3, 13.1), FIFO lots and the April tax bill (14.2), interest (14.3), follows and alerts (14.4),
// the bankruptcy end (14.5), notifications with their fixed pauses (2.4, 12), and the action log
// that replays a game (pivot 16.1). The exchange's book orders and contract positions arrive in M5
// on the same tables.
//
// The player is world state: inside the state hash and the save (D1027). It exists only at Full
// fidelity (pivot 3.3): `World.player` is null in a Coarse world and until lane P opens it.

import type { AlertRule, AlertRuleId, OrderSide, PlayerAction, TimeInForce, Venue } from "../action.ts";
import type { DateTime, SimDate } from "../calendar.ts";
import type { AccountId, ContractId, InstrumentId, OrderId } from "../ids.ts";
import type { FixedPause } from "../notice.ts";
import type { OrderCloseReason, OrderStatus, PositionSide } from "../views/account.ts";
import type { EntityRef } from "../views/entity.ts";
import type { NotificationKind } from "../views/notifications.ts";

/** The difficulty presets (pivot 3.6). */
export type Difficulty = "Easy" | "Normal" | "Hard";

/** Difficulty in declaration order; `Normal` is the default. */
export const DIFFICULTY_VALUES = ["Easy", "Normal", "Hard"] as const;

/** What a difficulty preset sets (pivot 3.6), copied into the player at new game. Lane P fills the presets' values (T). */
export interface DifficultySettings {
  id: Difficulty;
  /** USD at the brokerage at the start (pivot 3.6 `START_CASH`, $50,000 at Normal). */
  start_cash: number;
  /** The stock spread over the hourly price, a fraction (pivot 13.1 `STOCK_SPREAD`). */
  stock_spread: number;
  /** USD per stock trade (pivot 13.1). */
  commission: number;
  /** The fee on contract winnings, a fraction (pivot 10.5 `BET_FEE`; M5). */
  bet_fee: number;
  /** The most margin debt as a share of net worth (pivot 13.2; 0 until margin exists). */
  margin_limit: number;
  /** How wrong the bettors tend to be, 1 being the tuned level (pivot 11.4; M5). */
  bettor_error: number;
}

/** Cash at one venue (pivot 14.1). */
export interface PlayerAccount {
  venue: Venue;
  /** The account's id on its venue (shared with the bettor cohorts' accounts in M5). */
  account: AccountId;
  /** USD, reserved included. */
  cash: number;
  /** USD held for resting orders and contract collateral (pivot 10.5); never spent twice. */
  reserved: number;
}

/** A buy not yet sold (pivot 14.2): lots are sold first in, first out. */
export interface TaxLot {
  /** Whole number, above 0. */
  qty: number;
  /** Per unit, in the venue's price units (USD a share; whole cents a contract), costs included. */
  price: number;
  opened: DateTime;
}

/** What the player holds of one instrument (pivot 13.1, 10.5). */
export interface PlayerPosition {
  venue: Venue;
  instrument: InstrumentId;
  /** A stock is held `Long`; a contract's `Yes` or `No` (selling Yes is buying No, pivot 10.5). */
  side: PositionSide;
  /** Oldest first; the position's quantity is their sum. */
  lots: TaxLot[];
}

/** An order the player placed (pivot 11.1, 13.1). At the brokerage before the stock book it fills at once. */
export interface PlayerOrder {
  id: OrderId;
  venue: Venue;
  instrument: InstrumentId;
  side: OrderSide;
  /** Whole numbers. */
  qty: number;
  filled: number;
  /** In the venue's price units; null for a market order. */
  limit: number | null;
  tif: TimeInForce;
  placed: DateTime;
  status: OrderStatus;
  /** Null while open. */
  closed: DateTime | null;
  reason: OrderCloseReason | null;
}

/** One fill of a player's order (pivot 2.4 item 1). */
export interface PlayerFill {
  order: OrderId;
  time: DateTime;
  venue: Venue;
  instrument: InstrumentId;
  side: OrderSide;
  /** Whole number. */
  qty: number;
  /** In the venue's price units. */
  price: number;
  /** USD. */
  fee: number;
  /** USD of gain realised by a sale (FIFO, pivot 14.2); 0 for a buy. */
  realised: number;
}

/** A contract the player held, paid out (pivot 10.4, 10.5; M5). */
export interface Settlement {
  contract: ContractId;
  time: DateTime;
  side: PositionSide;
  /** Whole number. */
  qty: number;
  /** The contract resolved Yes. */
  outcome: boolean;
  /** USD paid in, fee taken. */
  payout: number;
  fee: number;
}

/** A notice to the player (pivot 12, 2.4, 14.4): a phone notification. Only grows. */
export interface PlayerNotification {
  /** Its place in the order raised, from 0. */
  id: number;
  time: DateTime;
  kind: NotificationKind;
  text: string;
  refs: EntityRef[];
  /** The alert rule that fired, for `Alert`. */
  rule: AlertRuleId | null;
  /**
   * It asks to pause (pivot 2.4): a fixed pause, or a rule set to pause. World state, so it cannot
   * depend on the settings: whether the game really paused is the runner's (`jobCtxNotify`).
   */
  paused: boolean;
  /** The fixed pause it is; null for an alert rule's. */
  fixed: FixedPause | null;
}

/** A player action as applied (D1027, pivot 16.1): replaying them at their ticks rebuilds the game. */
export interface RecordedAction {
  /** The clock when it was applied: between the tick `at` and the next. */
  at: DateTime;
  action: PlayerAction;
}

/** The player (`World.player`; pivot 14). */
export interface PlayerState {
  difficulty: DifficultySettings;
  /** In `VENUE_VALUES` order. */
  accounts: PlayerAccount[];
  /** In venue then instrument id order. */
  positions: PlayerPosition[];
  /** Open orders and the latest closed ones (lane P keeps a bounded tail, T), oldest first. */
  orders: PlayerOrder[];
  /** Orders placed so far, so the next one's id (`OrderId`). Whole number. */
  orders_made: number;
  /** Every fill, oldest first. */
  fills: PlayerFill[];
  /** Every settlement, oldest first. */
  settlements: Settlement[];
  /** The tax year in progress (pivot 14.2). Whole number. */
  tax_year: number;
  /** USD realised this tax year (net of losses). */
  realised_gains: number;
  /** USD of interest earned this tax year (pivot 14.3). */
  interest: number;
  /** USD owed at the next April bill (pivot 14.2). */
  tax_due: number;
  /** In the order followed (pivot 8.3, 14.4). */
  follows: EntityRef[];
  /** In id order. */
  alerts: { id: AlertRuleId; rule: AlertRule }[];
  /** Rules added so far, so the next one's id. Whole number. */
  alerts_made: number;
  /** Oldest first. */
  notifications: PlayerNotification[];
  /** The last notification the player has read (`PlayerAction` NotificationsRead); -1 for none. */
  read_through: number;
  /** Net worth fell below zero after forced liquidation: the run is over (pivot 14.5). */
  bankrupt: boolean;
  /** When the run ended; null while it goes on. */
  ended: SimDate | null;
  /** Every applied action, oldest first (D1027). */
  actions: RecordedAction[];
}
