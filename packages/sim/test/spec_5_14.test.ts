// Port of crates/sim/tests/spec_5_14.rs: spec 5.14 hourly share price (3.3.3, flow removed), the
// 4.2 daily bar and the headline indices: build-plan M5.3 (price noise sd matches sigma_h over a
// long run, NoNoise against the game's streams), M5.4 (bars close at 00:00 each day) and M5.6 (an
// index does not jump when a company lists or leaves).
//
// Expects (Rust methods are free functions named type + method, camelCased):
//   ../../src/market/daily.ts   barBuilderStart(date, price) -> BarBuilder, barBuilderTick(b, p),
//                               barBuilderClose(b, efv) -> DailyBar | null, dailyBarEfvLow(bar),
//                               dailyBarEfvHigh(bar)
//   ../../src/market/exchange_index.ts  INDEX_BASE, marketCap(price, shares), exchangeIndexAtLoad(cap) ->
//                               ExchangeIndex, exchangeIndexLevel(idx, cap) -> number | null,
//                               exchangeIndexReweight(idx, before, after),
//                               exchangeIndexCloseDay(idx, cap) -> number.
//                               NAME TO CONFIRM: Rust market/index.rs collides with mod.rs, which
//                               becomes market/index.ts; this file assumes index_.ts.
//   ../../src/market/price.ts   MIN_PRICE_USD, SECTOR_BETA, SECTOR_VOLATILITY, type StockTick,
//                               fatTailedNormal(draws), pricesMove(t), reactionVolatilityMult(t),
//                               rho, sigmaHourly, stepPrice, stepPrices(t, stocks, draws) ->
//                               number[], targetValue(v, buzz)
//   ./common/rng.ts            newRng(seed), newNoNoise(), newScripted(), scriptedPush
//
// Changed from the Rust: RngStreams::new(seed) is the new generator (D951), so the seeds (42, 7,
// 11, 3, 5) no longer reproduce Rust draws. The statistical checks (noise sd, 2% wide draws,
// correlation 0.25, sd doubled in reaction week) hold for any good generator at the same
// tolerances; if one fails by a hair on a seed, change the seed, not the tolerance. The whole-day
// bar test asserts the bar's open/close/high/low against the path the test itself walks, which
// holds for any draws.
import { describe, expect, it } from "vitest";
import {
  barBuilderClose,
  barBuilderStart,
  barBuilderTick,
  dailyBarEfvHigh,
  dailyBarEfvLow,
} from "../src/market/daily.ts";
import {
  type ExchangeIndex,
  exchangeIndexAtLoad,
  exchangeIndexCloseDay,
  exchangeIndexLevel,
  exchangeIndexReweight,
  INDEX_BASE,
  marketCap,
} from "../src/market/exchange_index.ts";
import {
  fatTailedNormal,
  MIN_PRICE_USD,
  pricesMove,
  reactionVolatilityMult,
  rho,
  SECTOR_BETA,
  SECTOR_VOLATILITY,
  type StockTick,
  sigmaHourly,
  stepPrice,
  stepPrices,
  targetValue,
} from "../src/market/price.ts";
import { dateTimeAddHours, dateTimeAt, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { DateTime } from "../src/types/calendar.ts";
import type { DrawSource } from "../src/types/draws.ts";
import { roundTiesEven } from "../src/types/num.ts";
import { newNoNoise, newRng, newScripted, scriptedPush } from "./common/rng.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b), 1.0), `${a} vs ${b}`).toBe(true);
}

const at = (y: number, m: number, d: number, h: number): DateTime => dateTimeAt(simDateYmd(y, m, d), h);

/** An ordinary trading hour: not 1 January, not a release tick, not reaction week. */
const plainHour = (): DateTime => at(2021, 2, 10, 5);

const stock = (price: number, value: number): StockTick => ({
  price,
  value,
  buzz: 0.0,
  annual_volatility: SECTOR_VOLATILITY,
  beta: SECTOR_BETA,
});

/** The noise of each tick, read back from a price path: `P' / P - 1 - pull`. */
function noisePath(t: DateTime, ticks: number, seed: number | null): [number, number][] {
  const rng: DrawSource = seed === null ? newNoNoise() : newRng(seed);
  const s = [stock(100.0, 100.0), stock(100.0, 100.0)] as [StockTick, StockTick];
  const out: [number, number][] = [];
  for (let n = 0; n < ticks; n++) {
    const next = stepPrices(t, s, rng);
    const row: [number, number] = [0, 0];
    for (let i = 0; i < 2; i++) {
      const si = s[i] as StockTick;
      const pull = 0.0003 * (si.value / si.price - 1.0);
      row[i] = (next[i] as number) / si.price - 1.0 - pull;
      si.price = next[i] as number;
    }
    out.push(row);
  }
  return out;
}

function sd(xs: number[]): number {
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / n);
}

/** Total cap of (price, shares) constituents. */
const cap = (list: [number, number][]): number => list.reduce((a, [p, s]) => a + marketCap(p, s), 0);

describe("spec 5.14 hourly share price", () => {
  it("sigma_and_rho_follow_the_spec", () => {
    // sigma_h = annual volatility / 19.1 / sqrt(24); D245: the shared sector default is 26%, beta 1.0.
    near(SECTOR_VOLATILITY, 0.26);
    near(SECTOR_BETA, 1.0);
    near(sigmaHourly(0.26), 0.26 / 19.1 / Math.sqrt(24));
    expect(Math.abs(sigmaHourly(0.26) - 0.0027786) < 1e-7).toBe(true);
    // rho = min(0.8, 0.5 x beta).
    near(rho(1.0), 0.5);
    near(rho(1.4), 0.7);
    near(rho(2.0), 0.8);
  });

  it("markets_close_on_1_january_and_freeze_on_the_release_tick", () => {
    // 3.1.0: closed all of 1 January; 4.4, 21.2: the 00:00 release tick is frozen.
    for (let h = 0; h < 24; h++) expect(pricesMove(at(2021, 1, 1, h)), `1 Jan ${h}:00`).toBe(false);
    for (const m of [1, 4, 7, 10]) {
      expect(pricesMove(at(2021, m, 2, 0)), `release ${m}`).toBe(false);
      expect(pricesMove(at(2021, m, 2, 1)), `price move ${m}`).toBe(true);
    }
    expect(pricesMove(at(2021, 2, 2, 0)), "the 2nd of a non-release month").toBe(true);
    expect(pricesMove(at(2020, 12, 31, 23))).toBe(true);
    expect(pricesMove(plainHour())).toBe(true);
    // A closed tick draws nothing and leaves prices as they are.
    const none = newScripted();
    expect(stepPrices(at(2021, 1, 1, 7), [stock(50.0, 100.0)], none)).toEqual([50.0]);
  });

  it("drift_closes_the_gap_toward_v_star", () => {
    // 5.14 with no noise: P x (1 + 0.0003 x (V / P - 1)): 50 x (1 + 0.0003 x 1) = 50.015.
    let p = stepPrices(plainHour(), [stock(50.0, 100.0)], newNoNoise());
    near(p[0] as number, 50.015);
    // Buzz +50: V* = 100 x 1.05; 50 x (1 + 0.0003 x 1.1) = 50.0165.
    near(targetValue(100.0, 50.0), 105.0);
    near(targetValue(100.0, -100.0), 90.0);
    p = stepPrices(plainHour(), [{ ...stock(50.0, 100.0), buzz: 50.0 }], newNoNoise());
    near(p[0] as number, 50.0165);
    // 3.3.3: "A gap between P and V* halves in about 2,300 ticks": the pull is 0.0003 x (V - P) a
    // tick, so the gap halves in ln 2 / -ln(1 - 0.0003) = 2,310 ticks.
    const n = roundTiesEven(Math.log(2) / -Math.log(1.0 - 0.0003));
    expect(n).toBe(2310);
    const s = stock(50.0, 100.0);
    for (let i = 0; i < n; i++) s.price = stepPrices(plainHour(), [s], newNoNoise())[0] as number;
    expect(Math.abs((100.0 - s.price) / 50.0 - 0.5) < 1e-3, `${s.price}`).toBe(true);
    // At P = V nothing moves without noise.
    p = stepPrices(plainHour(), [stock(100.0, 100.0)], newNoNoise());
    expect(p[0]).toBe(100.0);
    // The price never goes below $0.01.
    near(stepPrice(0.02, 0.01, -0.9), MIN_PRICE_USD);
  });

  it("price_noise_sd_matches_sigma_h_over_a_long_run", () => {
    // Build-plan M5.3. The 2%-of-draws x3 tails (D246) lift the variance by 0.98 + 0.02 x 9 =
    // 1.16 for z_market and z_stock alike, so the noise sd is sigma_h x sqrt(1.16) and two stocks
    // correlate at rho^2 = 0.25 (they share z_market).
    const TICKS = 200_000;
    const quiet = noisePath(plainHour(), TICKS, null);
    expect(
      quiet.every((r) => r[0] === 0.0 && r[1] === 0.0),
      "NoNoise moves nothing",
    ).toBe(true);
    const noisy = noisePath(plainHour(), TICKS, 42);
    const a = noisy.map((r) => r[0]);
    const b = noisy.map((r) => r[1]);
    const want = sigmaHourly(0.26) * Math.sqrt(1.16);
    const got = sd(a);
    expect(Math.abs(got / want - 1.0) < 0.015, `sd ${got} vs ${want}`).toBe(true);
    expect(Math.abs(sd(b) / want - 1.0) < 0.015).toBe(true);
    const ma = a.reduce((x, y) => x + y, 0) / TICKS;
    const mb = b.reduce((x, y) => x + y, 0) / TICKS;
    let cov = 0;
    for (let i = 0; i < TICKS; i++) cov += ((a[i] as number) - ma) * ((b[i] as number) - mb);
    cov /= TICKS;
    const corr = cov / (sd(a) * sd(b));
    expect(Math.abs(corr - 0.25) < 0.02, `corr ${corr}`).toBe(true);
  });

  it("two_percent_of_draws_are_three_times_as_wide", () => {
    // D246: a prices-stream uniform below 0.02 makes the next normal x3.
    const s = newScripted();
    scriptedPush(s, "Prices", [0.0199, 1.5, 0.02, 1.5]);
    near(fatTailedNormal(s), 4.5);
    near(fatTailedNormal(s), 1.5);
    // The rate from a long run: |z| > 3 has probability p3 = 0.0026998 for a standard normal and
    // p1 = 0.3173105 (|N| > 1) for a x3 draw, so the share f of |z| > 3 is p3 + w x (p1 - p3) and
    // the wide rate is w = (f - p3) / (p1 - p3). Its sampling sd is sqrt(f (1 - f) / n) / (p1 -
    // p3), about 0.0003 at n = 1,000,000; allow 4 sd.
    const N = 1_000_000;
    const P3 = 0.0026997960632602;
    const P1 = 0.317310507862914;
    const r = newRng(11);
    let beyond = 0;
    for (let i = 0; i < N; i++) if (Math.abs(fatTailedNormal(r)) > 3.0) beyond += 1;
    const f = beyond / N;
    const w = (f - P3) / (P1 - P3);
    const sdW = Math.sqrt((f * (1.0 - f)) / N) / (P1 - P3);
    expect(Math.abs(w - 0.02) < 4.0 * sdW, `wide rate ${w} (sd ${sdW})`).toBe(true);
  });

  it("reaction_week_doubles_volatility_and_fades_by_day_7", () => {
    // 4.4 row 2, 21.3.1: x2 from the 01:00 price move, linear by day to x1 on the 8th (D247).
    near(reactionVolatilityMult(at(2021, 4, 2, 0)), 1.0);
    near(reactionVolatilityMult(at(2021, 4, 2, 1)), 2.0);
    near(reactionVolatilityMult(at(2021, 4, 2, 23)), 2.0);
    near(reactionVolatilityMult(at(2021, 4, 3, 0)), 2.0 - 1.0 / 6.0);
    near(reactionVolatilityMult(at(2021, 4, 5, 12)), 1.5);
    near(reactionVolatilityMult(at(2021, 4, 8, 12)), 1.0);
    near(reactionVolatilityMult(at(2021, 4, 9, 0)), 1.0);
    near(reactionVolatilityMult(at(2021, 5, 3, 0)), 1.0);
    near(reactionVolatilityMult(at(2021, 1, 2, 1)), 2.0);
    // Over a run on the release day the noise sd is twice the ordinary one.
    const noisy = noisePath(at(2021, 7, 2, 5), 100_000, 7);
    const a = noisy.map((r) => r[0]);
    const want = 2.0 * sigmaHourly(0.26) * Math.sqrt(1.16);
    expect(Math.abs(sd(a) / want - 1.0) < 0.02, `${sd(a)} vs ${want}`).toBe(true);
  });

  it("bars_close_at_00_00_each_day", () => {
    // 4.2 step 1 (D248): the bar opens at the price the 00:00 daily jobs leave, takes every moving
    // hourly price through 00:00 the next day, then closes.
    const b = barBuilderStart(simDateYmd(2021, 3, 4), 10.0);
    for (const p of [11.0, 9.0, 10.5]) barBuilderTick(b, p);
    const bar = barBuilderClose(b, 12.0);
    expect(bar).toEqual({
      date: simDateYmd(2021, 3, 4),
      open: 10.0,
      high: 11.0,
      low: 9.0,
      close: 10.5,
      efv: 12.0,
    });
    if (bar === null) throw new Error("the bar closes");
    // The EFV band is +-15% of the EFV (spec 8 F3, D140, D424).
    expect(
      Math.abs(dailyBarEfvLow(bar) - 10.2) < 1e-12 && Math.abs(dailyBarEfvHigh(bar) - 13.8) < 1e-12,
    ).toBe(true);
    // A whole simulated day: 24 ticks from 01:00 to 00:00, the bar closes after the 00:00 tick.
    const rng = newRng(3);
    const day = simDateYmd(2021, 3, 4);
    const s = stock(100.0, 100.0);
    const bb = barBuilderStart(day, s.price);
    let hi = s.price;
    let lo = s.price;
    for (let h = 1; h <= 24; h++) {
      const t = dateTimeAddHours(dateTimeMidnight(day), h);
      s.price = stepPrices(t, [s], rng)[0] as number;
      if (pricesMove(t)) barBuilderTick(bb, s.price);
      hi = Math.max(hi, s.price);
      lo = Math.min(lo, s.price);
    }
    const closed = barBuilderClose(bb, 100.0);
    if (closed === null) throw new Error("the day's bar closes");
    expect(closed.date).toEqual(day);
    expect(closed.open).toBe(100.0);
    expect(closed.close).toBe(s.price);
    expect([closed.high, closed.low]).toEqual([hi, lo]);
    // 1 January trades no tick, so it leaves no bar.
    const jan1 = simDateYmd(2021, 1, 1);
    const bj = barBuilderStart(jan1, 100.0);
    for (let h = 1; h <= 24; h++) {
      const t = dateTimeAddHours(dateTimeMidnight(jan1), h);
      if (pricesMove(t)) barBuilderTick(bj, 100.0);
    }
    expect(barBuilderClose(bj, 100.0)).toBeNull();
  });

  it("index_starts_at_1000_and_keeps_its_level_through_listings_and_removals", () => {
    // 5.14: market-cap weighted, 1,000 at load. A $10 x 1,000, B $20 x 500, C $5 x 4,000: $40,000
    // of cap.
    expect(INDEX_BASE).toBe(1000.0);
    near(marketCap(2.5, 4), 10.0);
    const cos: [number, number][] = [
      [10.0, 1000],
      [20.0, 500],
      [5.0, 4000],
    ];
    const idx: ExchangeIndex = exchangeIndexAtLoad(cap(cos));
    const level = (): number => {
      const l = exchangeIndexLevel(idx, cap(cos));
      if (l === null) throw new Error("no level");
      return l;
    };
    near(level(), 1000.0);
    // A rises to $12: the level moves with the cap, 1,000 x 42,000 / 40,000 = 1,050.
    (cos[0] as [number, number])[0] = 12.0;
    near(level(), 1050.0);
    // D lists at $7 x 3,000 = $21,000 (build-plan M5.6): no jump.
    let before = cap(cos);
    cos.push([7.0, 3000]);
    exchangeIndexReweight(idx, before, cap(cos));
    near(level(), 1050.0);
    // D rises to $8: 1,050 x 66,000 / 63,000 = 1,100.
    (cos[3] as [number, number])[0] = 8.0;
    near(level(), 1100.0);
    // C ($20,000) is removed: no jump either (D250).
    before = cap(cos);
    cos.splice(2, 1);
    exchangeIndexReweight(idx, before, cap(cos));
    near(level(), 1100.0);
    // A falls to $6: 1,100 x 40,000 / 46,000.
    (cos[0] as [number, number])[0] = 6.0;
    near(level(), (1100.0 * 40_000.0) / 46_000.0);
    // A share issue (6.6) is a constituent change too: B issues 500 shares at $20.
    before = cap(cos);
    (cos[1] as [number, number])[1] += 500;
    exchangeIndexReweight(idx, before, cap(cos));
    near(level(), (1100.0 * 40_000.0) / 46_000.0);
  });

  it("an_exchange_with_no_listing_shows_no_level", () => {
    // 5.14 (A): no listed company, no level; its return is 0 (5.1.2).
    const empty = exchangeIndexAtLoad(0.0);
    expect(exchangeIndexLevel(empty, 0.0)).toBeNull();
    expect(exchangeIndexCloseDay(empty, 0.0)).toBe(0.0);
    // Its first listing starts the index at 1,000 (D250).
    exchangeIndexReweight(empty, 0.0, 5_000.0);
    near(exchangeIndexLevel(empty, 5_000.0) as number, 1000.0);
    // When the last company leaves, the level goes and the last one is kept; a later listing
    // resumes from it.
    const idx = exchangeIndexAtLoad(10_000.0);
    near(exchangeIndexLevel(idx, 12_000.0) as number, 1200.0);
    exchangeIndexReweight(idx, 12_000.0, 0.0);
    expect(exchangeIndexLevel(idx, 0.0)).toBeNull();
    exchangeIndexReweight(idx, 0.0, 3_000.0);
    near(exchangeIndexLevel(idx, 3_000.0) as number, 1200.0);
  });

  it("the_daily_return_is_the_level_change_in_percent", () => {
    // 5.1.2 r_z: the headline index's return that day in %.
    const idx = exchangeIndexAtLoad(40_000.0);
    near(exchangeIndexCloseDay(idx, 42_000.0), 5.0);
    near(exchangeIndexCloseDay(idx, 42_000.0), 0.0);
    near(exchangeIndexCloseDay(idx, 39_900.0), -5.0);
    // A listing between closes does not count as a return.
    exchangeIndexReweight(idx, 39_900.0, 60_000.0);
    near(exchangeIndexCloseDay(idx, 60_000.0), 0.0);
  });
});
