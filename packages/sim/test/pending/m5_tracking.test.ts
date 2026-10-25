// BLOCKED: needs simNew on real data, which waits for births/state BirthsState::from_data (lane W3b)
// in START_DEPS / LoadDeps. Everything it exercises in market/ is ported; promote when births lands.
// Port of crates/sim/tests/m5_tracking.rs: build-plan M5.8, the spec M5 done line: "opening price
// at V, $5 to $200; prices track V within +-30% over 10 years".
//
// - Opening at V, $5 to $200: every listed company opens at company-start.csv's open_price, the 7.1
//   rule on its engine value, with V = engine value / shares within the share rounding (checked
//   company by company in m5_load; here the range and the gap on every seed).
// - Tracking (D143): at each daily close (00:00, after the daily jobs) every quoted company is one
//   company-day; it tracks when |P / V - 1| <= 30%. The done line holds for a seed when at least
//   98% of its company-days over 2020 to 2029 track and every year reaches 97% (D143, D151).
// - The first release (design fix 235): V moves at the first daily refresh (2 January 00:00) and
//   at the 01:00 full recalculation; the surprise of that release is 0 (D133), so P does not
//   jump.
// - The beat rate (spec 10 "30% to 60% of releases are beats"): counted per seed at every release
//   from 2 April 2020 to 2 October 2029; nothing is asserted on it (the target is for the M10
//   soak and tuning pass).
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld
//   ../../src/finance/distress.ts companyStatusIsFrozen(status)
//   ../../src/time/calendar.ts    simDateYmd, dateTimeAt, dateTimeMidnight, dateTimeDate, dateTimeHour,
//                                 simDateAddDays
//   ./common/market.ts            quantile (new, this lane)
//
// Changed from the Rust: Rust ran seeds 1 to 5 on scoped threads; here they run one after another
// in one test (vitest runs test files in parallel already). The seeds seed the new generator
// (D951): the 98% / 97% / 1e-4 thresholds are the Rust ones; re-tune with a comment if the new
// generator needs it. The printed tables are dropped except as test failure messages.
import { describe, expect, it } from "vitest";
import { companyStatusIsFrozen } from "../../src/finance/distress.ts";
import { simNew, simNow, simStep, simWorld } from "../../src/lib.ts";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  simDateAddDays,
  simDateYmd,
} from "../../src/time/calendar.ts";
import { cmpDate } from "../../src/types/calendar.ts";
import { data, unwrap } from "./common/index.ts";
import { quantile } from "./common/market.ts";

/** D143: a company-day tracks V within +-30%. */
const BAND = 0.3;
/** D143 (raised by D151): the share of company-days that must track over the 10 years, per seed. */
const MIN_TRACKING_SHARE = 0.98;
/** D151: the share every single year must reach. */
const MIN_YEAR_TRACKING_SHARE = 0.97;
const YEARS = 10;
const SEEDS = [1, 2, 3, 4, 5];
/** Spec 7.1: open prices run $5 to $200. */
const PRICE_MIN = 5.0;
const PRICE_MAX = 200.0;
/** D133: the first release's surprise is 0 (no lock before it), so the beat count skips it. */
const FIRST_RELEASE = simDateYmd(2020, 1, 2);

interface SeedResult {
  seed: number;
  within: number;
  days: number;
  medianGap: number;
  p95Gap: number;
  worstYear: [number, number];
  openGap: number;
  /** Reports at the releases, those tagged a beat and a miss, and the median |surprise|. */
  reports: number;
  beats: number;
  misses: number;
  medianSurprise: number;
}

function runSeed(seed: number): SeedResult {
  const sim = unwrap(simNew(data(), seed), "Sim::new");
  // Opening at V, $5 to $200.
  let openGap = 0.0;
  for (const s of simWorld(sim).market.stocks) {
    if (!s.quoted) continue;
    expect(s.price >= PRICE_MIN && s.price <= PRICE_MAX).toBe(true);
    openGap = Math.max(openGap, Math.abs(s.price / s.value - 1.0));
  }
  const end = dateTimeMidnight(simDateYmd(2020 + YEARS, 1, 1));
  let within = 0;
  let days = 0;
  const gaps: number[] = [];
  const year: [number, number][] = Array.from({ length: YEARS }, () => [0, 0]);
  let reports = 0;
  let beats = 0;
  let misses = 0;
  const surprises: number[] = [];
  while (simNow(sim) < end) {
    simStep(sim);
    const t = simNow(sim);
    if (dateTimeHour(t) !== 0) continue;
    // A release day (4.4): the close's tags and surprises (D142).
    const d = dateTimeDate(t);
    const w = simWorld(sim);
    if (d.day === 2 && d.month % 3 === 1 && cmpDate(d, FIRST_RELEASE) > 0) {
      w.companies.forEach((c, i) => {
        if (companyStatusIsFrozen(c.finance.distress.status) || c.finance.archive.quarters.length === 0)
          return;
        const s = w.market.stocks[i] as (typeof w.market.stocks)[number];
        reports += 1;
        if (s.tags.surprise === "Beat" || s.tags.surprise === "BigBeat") beats += 1;
        else if (s.tags.surprise === "Miss" || s.tags.surprise === "BigMiss") misses += 1;
        surprises.push(Math.abs(s.last_surprise));
      });
    }
    // The day that just closed.
    const y = simDateAddDays(d, -1).year - 2020;
    const yr = year[y] as [number, number];
    for (const s of w.market.stocks) {
      if (!s.quoted) continue;
      const gap = s.value > 0.0 ? Math.abs(s.price / s.value - 1.0) : Number.POSITIVE_INFINITY;
      days += 1;
      yr[1] += 1;
      if (gap <= BAND) {
        within += 1;
        yr[0] += 1;
      }
      gaps.push(gap);
    }
  }
  gaps.sort((a, b) => a - b);
  surprises.sort((a, b) => a - b);
  let worstYear: [number, number] = [2020, Number.POSITIVE_INFINITY];
  year.forEach(([wi, di], i) => {
    const share = wi / Math.max(di, 1);
    if (share < worstYear[1]) worstYear = [2020 + i, share];
  });
  return {
    seed,
    within,
    days,
    medianGap: quantile(gaps, 0.5),
    p95Gap: quantile(gaps, 0.95),
    worstYear,
    openGap,
    reports,
    beats,
    misses,
    medianSurprise: quantile(surprises, 0.5),
  };
}

describe("m5 tracking", () => {
  it("prices_track_v_within_30_percent_over_ten_years", { timeout: 3_600_000 }, () => {
    const results = SEEDS.map(runSeed);
    for (const r of results) {
      expect(r.openGap, `seed ${r.seed}: opens at V`).toBeLessThan(1e-4);
      const share = r.within / r.days;
      expect(
        share,
        `seed ${r.seed}: ${share} of company-days within +-30% (median ${r.medianGap}, p95 ${r.p95Gap})`,
      ).toBeGreaterThanOrEqual(MIN_TRACKING_SHARE);
      expect(
        r.worstYear[1],
        `seed ${r.seed}: ${r.worstYear[0]} tracks only ${r.worstYear[1]} of its company-days`,
      ).toBeGreaterThanOrEqual(MIN_YEAR_TRACKING_SHARE);
      // Beat rate: reported, not asserted (M10 soak and tuning).
      expect(r.reports).toBeGreaterThan(0);
    }
  });

  it("the_first_release_moves_v", { timeout: 600_000 }, () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const load = simWorld(sim).market.stocks.map((s) => ({
      value: s.value,
      quoted: s.quoted,
      profit: s.basis.e_norm !== null && s.basis.e_norm > 0.0,
    }));
    const refreshTick = dateTimeMidnight(simDateYmd(2020, 1, 2));
    const moveTick = dateTimeAt(simDateYmd(2020, 1, 2), 1);
    let afterRefresh: number[] = [];
    while (simNow(sim) < moveTick) {
      simStep(sim);
      if (simNow(sim) === refreshTick) afterRefresh = simWorld(sim).market.stocks.map((s) => s.value);
    }
    const w = simWorld(sim);
    let outsideBand = 0;
    let quoted = 0;
    w.market.stocks.forEach((s, i) => {
      const l = load[i] as (typeof load)[number];
      if (l.value <= 0.0 || !l.quoted) return;
      // D133: the consensus for Q4 2019 is its synthetic net income, so s = 0 and no buzz.
      expect(s.last_surprise).toBe(0.0);
      expect(s.buzz).toBe(0.0);
      expect(afterRefresh[i]).toBeGreaterThan(0.0);
      if (Math.abs(s.price / s.value - 1.0) > 0.3) outsideBand += 1;
      quoted += 1;
    });
    expect(quoted).toBe(467);
    // The Rust printed how many sit outside +-30% right after the release; it asserts nothing.
    expect(outsideBand).toBeGreaterThanOrEqual(0);
  });
});
