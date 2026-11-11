// Shared helpers for the player tests (pivot 13.1, 14; D1042). They use the frozen test world
// (test/fixtures/world-mini), which loads Full, so its player opens at load at Normal: one world is
// built once and each test takes a deep copy, sets the prices it needs and runs the player's jobs
// directly on a tick of its choosing. The whole-sim tests (run.test.ts) step a real Sim.

import { simWorld } from "../../src/lib.ts";
import { playerAct } from "../../src/player/index.ts";
import { playerDailyJob, playerHourlyJob } from "../../src/player/jobs.ts";
import { dateTimeAt, simDateYmd } from "../../src/time/calendar.ts";
import { controlsDefault } from "../../src/time/control.ts";
import { type JobCtx, jobCtxNew, jobCtxPauseRequest, tickFactsNew } from "../../src/time/scheduler.ts";
import { type PlayerAction, stockInstrument } from "../../src/types/action.ts";
import type { DateTime } from "../../src/types/calendar.ts";
import type { Controls } from "../../src/types/control.ts";
import type { CompanyId, InstrumentId } from "../../src/types/ids.ts";
import type { Notice, PauseReason } from "../../src/types/notice.ts";
import type { PlayerState } from "../../src/types/state/player.ts";
import type { World } from "../../src/types/world.ts";
import { NO_DRAWS, testSim } from "../test_sim.ts";

let base: World | undefined;

/** A copy of the mini world at its start, with the player open at Normal. */
export function freshWorld(): World {
  if (base === undefined) base = simWorld(testSim(1));
  return structuredClone(base);
}

export function player(world: World): PlayerState {
  if (world.player === null) throw new Error("no player");
  return world.player;
}

/** The hour `h` of a day in 2020, as the clock reads it. */
export function at(month: number, day: number, h: number, year = 2020): DateTime {
  return dateTimeAt(simDateYmd(year, month, day), h);
}

/** A trading hour: 3 January 2020, 10:00 (not 1 January, not a release tick). */
export const TRADING_HOUR = at(1, 3, 10);

/** The `n`th quoted company with at least a million shares out, and its instrument. */
export function quoted(world: World, n = 0): { company: CompanyId; instrument: InstrumentId } {
  let seen = 0;
  for (let id = 0; id < world.companies.length; id++) {
    const s = world.market.stocks[id];
    const c = world.companies[id];
    if (s?.quoted === true && s.price > 0 && c !== undefined && c.shares_out >= 1_000_000) {
      if (seen === n) return { company: id as CompanyId, instrument: stockInstrument(id as CompanyId) };
      seen++;
    }
  }
  throw new Error("no quoted company");
}

export function setPrice(world: World, company: CompanyId, price: number): void {
  const s = world.market.stocks[company];
  if (s === undefined) throw new Error("no stock");
  s.price = price;
}

/** Applies an action at `time` (the clock is set there first); throws if it is refused. */
export function act(world: World, action: PlayerAction, time: DateTime = world.clock): void {
  world.clock = time;
  const r = playerAct(world, action);
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r.error)}`);
}

export interface Ran {
  ctx: JobCtx;
  notices: Notice[];
  pause: PauseReason | null;
}

function run(world: World, now: DateTime, job: (w: World, c: JobCtx) => void, controls: Controls): Ran {
  world.clock = now;
  const notices: Notice[] = [];
  const ctx = jobCtxNew(tickFactsNew(now), NO_DRAWS, notices, controls);
  job(world, ctx);
  return { ctx, notices, pause: jobCtxPauseRequest(ctx) };
}

/** Runs the player's hourly job on the tick at `now`. */
export function hourly(world: World, now: DateTime, controls: Controls = controlsDefault()): Ran {
  return run(world, now, playerHourlyJob, controls);
}

/** Runs the player's daily job on the tick at `now` (00:00 of a day). */
export function daily(world: World, now: DateTime, controls: Controls = controlsDefault()): Ran {
  return run(world, now, playerDailyJob, controls);
}

export function brokerage(world: World): { cash: number; reserved: number } {
  const a = player(world).accounts.find((x) => x.venue === "Brokerage");
  if (a === undefined) throw new Error("no brokerage");
  return a;
}

export function exchange(world: World): { cash: number; reserved: number } {
  const a = player(world).accounts.find((x) => x.venue === "Exchange");
  if (a === undefined) throw new Error("no exchange");
  return a;
}

/** Shares held of `instrument` at the brokerage. */
export function held(world: World, instrument: InstrumentId): number {
  const pos = player(world).positions.find((x) => x.instrument === instrument);
  return pos === undefined ? 0 : pos.lots.reduce((n, l) => n + l.qty, 0);
}

/** A market or limit order on the brokerage. */
export function order(
  instrument: InstrumentId,
  side: "Buy" | "Sell",
  qty: number,
  limit: number | null = null,
  tif: "Day" | "Gtc" = "Gtc",
): Extract<PlayerAction, { kind: "PlaceOrder" }> {
  return { kind: "PlaceOrder", venue: "Brokerage", instrument, side, qty, limit, tif };
}
