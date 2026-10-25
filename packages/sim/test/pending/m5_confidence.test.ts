// Port of crates/sim/tests/m5_confidence.rs: build-plan M5.7 on the live engine (spec 5.1.2;
// batch 157, 2a; D251): each zone exchange's investor confidence moves once a day at 00:00 by
// clamp(0.9 x c + 3 x r + news, -100, +100), r the headline index's return that day in %, written
// out from the index levels at each daily close. An exchange with no listed company has r 0 and
// no news and decays to 0: a test job puts one at +100 on the first tick, it falls 10% a day to
// exactly 0 after 94 quiet days (under 0.005 reads 0, D251).
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld, simRegisterTestJob
//   ../../src/market/jobs.ts      confidenceHeadlines(world, zone) -> { company: CompanyId | null }[]
//                                 [confidence_headlines], confidenceNews(headlines) -> number
//   ../../src/time/calendar.ts    simDateYmd, dateTimeAt, dateTimeMidnight, dateTimeHour
//   ./common/market.ts            specLevel (new, this lane)
//
// Changed from the Rust: the static EMPTY_ZONE is a module variable. Sim::new(.., 6) seeds the
// new generator (D951), so the run differs from Rust's. Every assertion is structural (the
// formula, the exact decay of the empty exchange); `news_days > 0` relies on the April release
// moving some exchange, which holds for any draws. The println is dropped.
import { describe, expect, it } from "vitest";
import { simNew, simNow, simRegisterTestJob, simStep, simWorld } from "../../src/lib.ts";
import { confidenceHeadlines, confidenceNews } from "../../src/market/jobs.ts";
import { dateTimeAt, dateTimeHour, dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import type { ZoneId } from "../../src/types/ids.ts";
import { clamp } from "../../src/types/num.ts";
import type { World } from "../../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { specLevel } from "./common/market.ts";

/** Spec 5.1.2: 0.9 kept a day, 3 points per 1% of index return. */
const RETAIN = 0.9;
const POINTS_PER_PERCENT = 3.0;
/** D251: days from +-100 to exactly 0. */
const QUIET_DAYS_TO_ZERO = 94;

let emptyZone = -1;

function shockEmptyZone(w: World, ctx: JobCtx): void {
  if (ctx.facts.now === dateTimeAt(simDateYmd(2020, 1, 1), 1)) {
    (w.zones[emptyZone] as World["zones"][number]).confidence = 100.0;
  }
}

describe("m5 confidence", () => {
  it("confidence_follows_the_index_and_decays_to_zero_with_no_news", { timeout: 600_000 }, () => {
    const sim = unwrap(simNew(data(), 6), "Sim::new");
    const w0 = simWorld(sim);
    const zones = w0.zones.map((_, i) => i as ZoneId);
    const empty = zones.find((z) => !w0.market.stocks.some((s) => s.exchange === z));
    if (empty === undefined) throw new Error("an exchange with no listed company");
    emptyZone = empty;
    // Every zone starts at confidence_start, 0 for all (5.1.2).
    expect(w0.zones.every((z) => z.confidence === 0.0)).toBe(true);
    simRegisterTestJob(sim, "Alerts", "test.shock", shockEmptyZone);
    const prevConf = zones.map((z) => (w0.zones[z] as World["zones"][number]).confidence);
    const prevLevel = zones.map((z) => specLevel(w0, z));
    let days = 0;
    let newsDays = 0;
    const emptyPath: number[] = [];
    const end = dateTimeMidnight(simDateYmd(2020, 5, 1));
    while (simNow(sim) < end) {
      simStep(sim);
      const w = simWorld(sim);
      if (simNow(sim) === dateTimeAt(simDateYmd(2020, 1, 1), 1)) prevConf[empty] = 100.0;
      if (dateTimeHour(simNow(sim)) !== 0) continue;
      days += 1;
      for (const z of zones) {
        // Since M6.5 the day's Pdoomberg Wire headlines on the exchange's companies carry their
        // 5.1.2 points (D137, D158); the empty exchange has none.
        const headlines = confidenceHeadlines(w, z);
        for (const h of headlines) {
          expect(h.company, "a confidence headline names its company").not.toBeNull();
          expect((w.market.stocks[h.company as number] as World["market"]["stocks"][number]).exchange).toBe(
            z,
          );
        }
        const news = confidenceNews(headlines);
        if (news !== 0.0) newsDays += 1;
        if (z === empty) expect(headlines.length).toBe(0);
        const now = specLevel(w, z);
        const a = prevLevel[z] ?? null;
        const r = a !== null && now !== null ? (now / a - 1.0) * 100.0 : 0.0;
        let want = clamp(RETAIN * (prevConf[z] as number) + POINTS_PER_PERCENT * r + news, -100.0, 100.0);
        if (Math.abs(want) < 0.005) want = 0.0;
        const zone = w.zones[z] as World["zones"][number];
        const got = zone.confidence;
        expect(
          Math.abs(got - want) < 1e-9,
          `${simNow(sim)} ${zone.exchange_code}: confidence ${got} vs ${want}`,
        ).toBe(true);
        prevConf[z] = got;
        prevLevel[z] = now;
      }
      emptyPath.push((w.zones[empty] as World["zones"][number]).confidence);
    }
    expect(days).toBeGreaterThan(0);
    expect(newsDays, "the April release's beats and misses move their exchanges").toBeGreaterThan(0);
    // From +100: 90 after the first close, 0.9^n x 100 after n, exactly 0 from day 94 on.
    emptyPath.forEach((c, n) => {
      const k = n + 1;
      if (k < QUIET_DAYS_TO_ZERO) {
        expect(Math.abs(c - 100.0 * RETAIN ** k) < 1e-9, `day ${k}: ${c}`).toBe(true);
        expect(c).toBeGreaterThan(0.0);
      } else {
        expect(c, `day ${k}`).toBe(0.0);
      }
    });
    expect(emptyPath.length).toBeGreaterThan(QUIET_DAYS_TO_ZERO);
    // Listed exchanges did move (index returns).
    expect(simWorld(sim).zones.some((c, z) => z !== empty && c.confidence !== 0.0)).toBe(true);
  });
});
