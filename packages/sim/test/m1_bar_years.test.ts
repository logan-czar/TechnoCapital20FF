// How many years of daily bars a stock keeps (spec 4.5 step 2; D139, D1035, D1038): 10 in the 2020
// world, 3 in a historical world, the 3 its hydration starts play with, so a played game's save does
// not grow back to 10 years of bars. The index closes keep 10 in both. Not a Rust test.

import { describe, expect, it } from "vitest";
import { HYDRATE_BAR_YEARS } from "../src/fidelity/hydrate.ts";
import { simNew, simWorld } from "../src/lib.ts";
import {
  archiveBarsJob,
  BAR_YEARS_KEPT,
  ERA_STOCK_BAR_YEARS_KEPT,
  stockBarYearsKept,
} from "../src/market/jobs.ts";
import { barHistoryIter, barHistoryPush } from "../src/market/state.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import type { SimDate } from "../src/types/calendar.ts";
import type { World } from "../src/types/world.ts";
import { data, data1995, unwrap } from "./common/index.ts";

const bar = (date: SimDate) => ({ date, open: 10, high: 10, low: 10, close: 10, efv: 10 });

/** Bar days left on stock 0 after the 1 January 2020 archive, given bars on these days. */
function keptAfterArchive(w: World, days: readonly SimDate[]): number[] {
  const s = w.market.stocks[0] as World["market"]["stocks"][number];
  for (const d of days) barHistoryPush(s.bars, bar(d));
  archiveBarsJob(w, { facts: { date: simDateYmd(2020, 1, 1) } } as unknown as JobCtx);
  return [...barHistoryIter(s.bars)].map((b) => b.date.year);
}

describe("daily bars kept (spec 4.5 step 2)", () => {
  it("are 3 years in a historical world, the hydration's, and 10 in the 2020 world", () => {
    expect(ERA_STOCK_BAR_YEARS_KEPT).toBe(HYDRATE_BAR_YEARS);
    expect(BAR_YEARS_KEPT).toBe(10);
    expect(stockBarYearsKept(simWorld(unwrap(simNew(data1995(), 1), "1995")))).toBe(3);
    expect(stockBarYearsKept(simWorld(unwrap(simNew(data(), 1), "2020")))).toBe(10);
  });

  it("drop a historical stock's bars older than 3 years, and a 2020 one's older than 10", () => {
    const days = [
      simDateYmd(2012, 6, 1),
      simDateYmd(2016, 12, 31),
      simDateYmd(2017, 1, 1),
      simDateYmd(2019, 6, 1),
    ];
    const era = simWorld(unwrap(simNew(data1995(), 1), "1995"));
    expect(keptAfterArchive(era, days)).toEqual([2017, 2019]);
    const now = simWorld(unwrap(simNew(data(), 1), "2020"));
    expect(keptAfterArchive(now, days)).toEqual([2012, 2016, 2017, 2019]);
  });
});
