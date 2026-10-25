// BLOCKED: needs simNew on real data, which waits for births/state BirthsState::from_data (lane W3b)
// in START_DEPS / LoadDeps. Everything it exercises in market/ is ported; promote when births lands.
// Port of crates/sim/tests/m5_prices.rs: build-plan M5.3 on the live engine (spec 5.14; 3.3.3,
// 3.1.0): every quoted stock steps each hour toward V*, P_next = P x (1 + 0.0003 x (V* / P - 1) +
// noise), closed on 1 January and frozen on the release tick. Over a long run the noise each
// stock takes, the price change less the pull (written out here), has the spec's sd: sigma_h =
// 26% / 19.1 / sqrt(24) (the shared sector volatility, D245) times sqrt(0.98 + 0.02 x 3^2) for
// the 2% of draws three times as wide (D246); two stocks' noises correlate at rho^2 = 0.25
// (one z_market a tick, rho = 0.5 x beta 1.0). Reaction weeks are left out.
//
// The engine's hourly loop also draws exactly what step_prices draws for the same stocks (D135):
// the same seed gives the same prices.
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld, simSaveBytes(sim) -> Uint8Array
//                                 [Sim::save_bytes]
//   ../../src/save.ts             decode(bytes) -> Result<{ rng: RngStreams, ... }, SaveError>
//   ../../src/market/price.ts     stepPrices(next: DateTime, stocks: StockTick[], draws: DrawSource)
//                                 -> number[], SECTOR_VOLATILITY, SECTOR_BETA
//                                 [step_prices takes &mut RngStreams in Rust; here a DrawSource over
//                                 the decoded streams, from rngStreamsDraws]
//   ../../src/time/calendar.ts    simDateYmd, dateTimeAt, dateTimeMidnight, dateTimeDate, dateTimeHour,
//                                 dateTimeNext
//
// Changed from the Rust: the run uses the new generator (D951), so the statistics are from
// different draws but have the same distribution: the tolerances (2% on sd, 0.06 on correlation)
// are unchanged; if the rewrite of the stream layout moves them, re-tune with a comment. The
// "same prices as step_prices" test stays an exact equality: both sides read the same stream
// positions, so it needs no Rust draws. The println is dropped.
import { describe, expect, it } from "vitest";
import { simNew, simNow, simSaveBytes, simStep, simWorld } from "../../src/lib.ts";
import { SECTOR_BETA, SECTOR_VOLATILITY, stepPrices } from "../../src/market/price.ts";
import { rngStreamsDraws } from "../../src/rng.ts";
import { decode } from "../../src/save.ts";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  dateTimeNext,
  simDateYmd,
} from "../../src/time/calendar.ts";
import { data, unwrap } from "./common/index.ts";

/** Spec 5.14 (3.3.3): the pull per tick. */
const PULL = 0.0003;
/** D245: annual volatility 26% for every industry; spec 5.14 sigma_h = annual / 19.1 / sqrt(24). */
const ANNUAL_VOLATILITY = 0.26;
/** D246: 2% of draws are 3 times as wide, so the variance is 0.98 + 0.02 x 9 = 1.16 times. */
const TAIL_VARIANCE = 0.98 + 0.02 * 9.0;
/** Spec 5.14: V* = V x (1 + 0.10 x buzz / 100). */
const BUZZ_WEIGHT = 0.1;
/** Spec 5.14: rho = min(0.8, 0.5 x beta), beta 1.0 (D245); two stocks share rho^2 of the variance. */
const RHO = 0.5;

const QUARTER_FIRST_MONTHS = [1, 4, 7, 10];

/** The run: the first half of 2020 (reaction weeks and 1 January excluded). */
const RUN_END = dateTimeMidnight(simDateYmd(2020, 7, 1));

type Snap = ([number, number] | null)[];

describe("m5 prices", () => {
  it("live_price_noise_sd_matches_sigma_h", { timeout: 1_800_000 }, () => {
    const sim = unwrap(simNew(data(), 5), "Sim::new");
    const n = simWorld(sim).companies.length;
    const snapshot = (): Snap =>
      simWorld(sim).market.stocks.map((s) =>
        s.quoted ? [s.price, s.value * (1.0 + (BUZZ_WEIGHT * s.buzz) / 100.0)] : null,
      );
    let before = snapshot();
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    // Two fixed stocks for the correlation: the first two quoted ids.
    const pair: number[] = [];
    for (let i = 0; i < n && pair.length < 2; i++) if (before[i] !== null) pair.push(i);
    let sxy = 0;
    let sx2 = 0;
    let sy2 = 0;
    let closedTicksUnchanged = 0;
    while (simNow(sim) < RUN_END) {
      simStep(sim);
      const t = simNow(sim);
      const after = snapshot();
      const d = dateTimeDate(t);
      const releaseTick = QUARTER_FIRST_MONTHS.includes(d.month) && d.day === 2 && dateTimeHour(t) === 0;
      const holiday = d.month === 1 && d.day === 1;
      const reactionWeek = QUARTER_FIRST_MONTHS.includes(d.month) && d.day >= 2 && d.day <= 8;
      if (holiday || releaseTick) {
        // Spec 4.1 step 2, 3.1.0, 4.4: no price moves.
        for (let i = 0; i < n; i++) {
          const a = before[i];
          const b = after[i];
          if (a && b) expect(a[0], `${t}: price moved on a closed tick`).toBe(b[0]);
        }
        closedTicksUnchanged += 1;
      } else if (!reactionWeek) {
        const noises = [0, 0];
        for (let i = 0; i < n; i++) {
          const a = before[i];
          const b = after[i];
          if (a && b) {
            const [p, vStar] = a;
            const noise = b[0] / p - 1.0 - PULL * (vStar / p - 1.0);
            sum += noise;
            sumSq += noise * noise;
            count += 1;
            const k = pair.indexOf(i);
            if (k >= 0) noises[k] = noise;
          }
        }
        sxy += (noises[0] as number) * (noises[1] as number);
        sx2 += (noises[0] as number) ** 2;
        sy2 += (noises[1] as number) ** 2;
      }
      before = after;
    }
    const mean = sum / count;
    const sd = Math.sqrt(sumSq / count - mean * mean);
    const sigmaH = ANNUAL_VOLATILITY / 19.1 / Math.sqrt(24);
    const want = sigmaH * Math.sqrt(TAIL_VARIANCE);
    const corr = sxy / Math.sqrt(sx2 * sy2);
    // 1 January 01:00 to 23:00 (its 00:00 is the load) and the 2 January and 2 April release ticks.
    expect(closedTicksUnchanged).toBe(23 + 2);
    expect(count).toBeGreaterThan(1_000_000);
    expect(Math.abs(sd / want - 1.0), `sd ${sd} vs ${want}`).toBeLessThan(0.02);
    expect(Math.abs(mean), `mean ${mean}`).toBeLessThan(0.05 * want);
    expect(Math.abs(corr - RHO * RHO), `correlation ${corr}`).toBeLessThan(0.06);
  });

  it("the_hourly_job_draws_as_step_prices_does", () => {
    // One plain hour (2 March 2020, 10:00) from the same world and the same seed: the engine's
    // job against step_prices over the quoted stocks in id order.
    const sim = unwrap(simNew(data(), 9), "Sim::new");
    const target = dateTimeAt(simDateYmd(2020, 3, 2), 9);
    while (simNow(sim) < target) simStep(sim);
    const stocks = simWorld(sim)
      .market.stocks.filter((s) => s.quoted)
      .map((s) => ({
        price: s.price,
        value: s.value,
        buzz: s.buzz,
        annual_volatility: SECTOR_VOLATILITY,
        beta: SECTOR_BETA,
      }));
    // Replay the save's RNG position on a copy.
    const state = unwrap(decode(simSaveBytes(sim)), "save decodes");
    const want = stepPrices(dateTimeNext(target), stocks, rngStreamsDraws(state.rng));
    simStep(sim);
    const got = simWorld(sim)
      .market.stocks.filter((s) => s.quoted)
      .map((s) => s.price);
    expect(got).toEqual(want);
  });
});
