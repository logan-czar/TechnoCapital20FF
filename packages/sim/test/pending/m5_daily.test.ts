// Port of crates/sim/tests/m5_daily.rs: build-plan M5.4 and M5.5 on the live engine, over the Q1
// 2020 release (spec 4.2, 4.4, 5.13, 5.15, 21.3.1, 3.10; D248): run from load to the end of the
// Q2 2020 reaction week, tick by tick.
//
// - M5.4 Each quoted stock's daily bar closes at 00:00: dated the day before, opening at the price
//   the previous 00:00 daily jobs left, closing at the price of the 00:00 hourly step, spanning
//   every hourly price between; none for 1 January (closed, 3.1.0). Buzz decays 25% at each
//   00:00. The daily fair value refresh is spec 5.13 written out here on the stored basis with the
//   day's book equity, label, confidence factor, home spread and exchange confidence (D243).
// - M5.5 At 01:00 on the 2 April release: the full recalculation's basis is the TTM of the
//   archive (E_norm from TTM net income and the 4-quarter revenue growth, G against lt); each
//   quoted price jumps x (1 + 1.5 x clamp(0.5 x s, +-25%)) from the price the 01:00 hourly step
//   left, s from the archived quarter and the consensus set at the 9 January lock; buzz moves by
//   clamp(20 x s, +-30); the result tags follow 5.15's edges. On the 3rd to the 8th each price
//   closes 20% of its gap to V after the 00:00 step (21.3.1).
//
// Expects:
//   ../../src/lib.ts              simNew, simStep, simNow, simWorld, simRegisterTestJob
//   ../../src/finance/jobs.ts     sheet(world, company) -> BalanceSheet, companyHomeSpread(world,
//                                 company, base)
//   ../../src/finance/statements.ts trailingFour(quarters) -> Ledger | null, ledgerNetIncome(ledger)
//   ../../src/finance/distress.ts companyStatusIsFrozen(status)
//   ../../src/market/state.ts     barHistoryLast(bars) -> DailyBar | null    [BarHistory::last]
//   The archive: c.finance.archive.quarters (Statement[]), c.finance.distress.status.
//   ./common/market.ts            nearRel (new, this lane)
//
// Changed from the Rust: the sim uses the new generator (D951) with seed 3; every assertion here
// is a formula check against the world state and holds for any draws. Statics become module
// variables. Tag counts are keyed by tag name (SurpriseTag is a string union). The `jumps > 400`
// and `reversions` counts depend on the listed-at-load companies only, not on the draws. The
// println is dropped.
import { describe, expect, it } from "vitest";
import { companyStatusIsFrozen } from "../../src/finance/distress.ts";
import { companyHomeSpread, sheet } from "../../src/finance/jobs.ts";
import { ledgerNetIncome, trailingFour } from "../../src/finance/statements.ts";
import { simNew, simNow, simRegisterTestJob, simStep, simWorld } from "../../src/lib.ts";
import { barHistoryLast } from "../../src/market/state.ts";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  simDateAddDays,
  simDateYmd,
} from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import { dateEq } from "../../src/types/calendar.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import { clamp } from "../../src/types/num.ts";
import type { World } from "../../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { nearRel } from "./common/market.ts";

/** Spec 4.2 step 1 (3.3.5): buzz decays 25% a day. */
const BUZZ_KEEP = 0.75;
/** Spec 4.2 step 3 (21.3.1): 20% of the gap a day. */
const REVERSION = 0.2;
const RELEASE_MONTHS = [1, 4, 7, 10];

/**
 * Spec 5.13 written out: E_norm and G from the basis; R, cycle, confidence, X and floors from
 * today's inputs.
 */
function specFairValue(
  w: World,
  id: CompanyId,
  eNorm: number | null,
  g: number,
  zoneConfidence: readonly number[],
): number {
  const c = w.companies[id] as World["companies"][number];
  const ind = w.industries[c.industry] as World["industries"][number];
  const book = sheet(w, c).equity;
  const home = companyHomeSpread(w, c, false);
  const r = clamp(0.09 / (0.035 + home + 0.05), 0.4, 1.6);
  const cycle = { Boom: 1.2, Normal: 1.0, Glut: 0.85, Bust: 0.7 }[ind.phase_label];
  const confidence = 0.8 + c.management_score / 250.0;
  const ex = (w.market.stocks[id] as World["market"]["stocks"][number]).exchange;
  const x = ex === null ? 1.0 : 1.0 + (0.1 * (zoneConfidence[ex] as number)) / 100.0;
  const value =
    eNorm !== null && eNorm > 0.0
      ? (0.3 * book + 0.7 * eNorm * ind.params.earnings_multiple * g * r * cycle * confidence) * x
      : book * cycle * x;
  const floor = ind.key === "real_estate" ? 0.9 : 0.6;
  return Math.max(Math.max(value, floor * Math.max(book, 0.0)), 0.01 * c.shares_out);
}

/**
 * Prices and buzz after the 01:00 hourly step, before the jump (a test job in the full fair value
 * slot, which runs after the engine's recalculation there).
 */
let beforeJump: [number, number][] = [];

function recordBeforeJump(w: World, _ctx: JobCtx): void {
  beforeJump = w.market.stocks.map((s) => [s.price, s.buzz]);
}

describe("m5 daily", () => {
  it("bars_buzz_fair_value_jump_and_reaction_week", { timeout: 1_800_000 }, () => {
    const sim = unwrap(simNew(data(), 3), "Sim::new");
    simRegisterTestJob(sim, "PriceMoveFairValue", "test.before_jump", recordBeforeJump);
    const end = dateTimeMidnight(simDateYmd(2020, 4, 10));
    const n0 = simWorld(sim).companies.length;
    // Hourly prices since the day's bar opened, per company.
    const dayPrices: number[][] = Array.from({ length: n0 }, () => []);
    const open = simWorld(sim).market.stocks.map((s) => s.price);
    const buzz: number[] = new Array(n0).fill(0.0);
    let confidence = simWorld(sim).zones.map((z) => z.confidence);
    let barsChecked = 0;
    let refreshes = 0;
    let jumps = 0;
    let reversions = 0;
    const tags: Record<string, number> = { BigBeat: 0, Beat: 0, Miss: 0, BigMiss: 0 };
    while (simNow(sim) < end) {
      simStep(sim);
      const t = simNow(sim);
      const w = simWorld(sim);
      const d = dateTimeDate(t);
      const hour = dateTimeHour(t);
      // Companies born at a plan lock (5.19) join the tables.
      while (dayPrices.length < w.companies.length) dayPrices.push([]);
      while (buzz.length < w.companies.length) buzz.push(0.0);
      w.market.stocks.forEach((s, i) => {
        // The 467 that list at load; a company listed in play (5.20.1) has no bar before its
        // listing day.
        if (!s.quoted || s.listed_on !== null) return;
        if (hour !== 0) {
          (dayPrices[i] as number[]).push(s.price);
          return;
        }
        // 00:00: the bar of yesterday closed (none for 1 January).
        const yesterday = simDateAddDays(d, -1);
        const last = barHistoryLast(s.bars);
        if (dateEq(yesterday, simDateYmd(2020, 1, 1))) {
          expect(last === null || !dateEq(last.date, yesterday), "a bar on 1 January").toBe(true);
        } else {
          if (last === null) throw new Error("a bar each trading day");
          const bar = last;
          expect(dateEq(bar.date, yesterday)).toBe(true);
          nearRel(bar.open, open[i] as number, "bar open");
          const releaseTick = d.day === 2 && RELEASE_MONTHS.includes(d.month);
          const reaction = d.day >= 3 && d.day <= 8 && RELEASE_MONTHS.includes(d.month);
          if (!releaseTick && !reaction) {
            // The 00:00 step moved the price; nothing after it did.
            nearRel(bar.close, s.price, "bar close");
          }
          // The release day's bar also holds the 01:00 step before the jump, which this loop does
          // not see; elsewhere the bar spans the open and every hourly price.
          if (yesterday.day !== 2 || !RELEASE_MONTHS.includes(yesterday.month)) {
            const prices = [...(dayPrices[i] as number[]), bar.close];
            const hi = prices.reduce((a, b) => Math.max(a, b), bar.open);
            const lo = prices.reduce((a, b) => Math.min(a, b), bar.open);
            nearRel(bar.high, hi, "bar high");
            nearRel(bar.low, lo, "bar low");
          }
          barsChecked += 1;
          if (reaction) {
            // 21.3.1: 20% of the gap to V after the 00:00 step.
            nearRel(s.price, bar.close + REVERSION * (s.value - bar.close), "reversion");
            reversions += 1;
          }
        }
        // Buzz decays 25% at 00:00.
        nearRel(s.buzz, BUZZ_KEEP * (buzz[i] as number), "buzz decay");
        dayPrices[i] = [];
        open[i] = s.price;
      });
      // The daily refresh (4.2 step 2), every company not frozen (private ones too). It reads the
      // zone confidence before step 6 moves it, so yesterday's; on the 1st the monthly job moves
      // its other inputs after it, and on a plan lock day the Lite AI batch's dividends and line
      // moves change book equity after it, so those days are left out.
      const lockDay = d.day === 9 && RELEASE_MONTHS.includes(d.month);
      if (hour === 0 && d.day !== 1 && !lockDay) {
        w.companies.forEach((c, i) => {
          if (companyStatusIsFrozen(c.finance.distress.status)) return;
          const s = w.market.stocks[i] as World["market"]["stocks"][number];
          const want = specFairValue(w, i as CompanyId, s.basis.e_norm, s.basis.growth_factor, confidence);
          nearRel(s.fair_value, want, `${c.key} daily fair value`);
          nearRel(s.value, s.fair_value / c.shares_out, "V");
          refreshes += 1;
        });
      }
      if (t === dateTimeAt(simDateYmd(2020, 4, 2), 1)) {
        const before = beforeJump;
        w.companies.forEach((c, i) => {
          if (companyStatusIsFrozen(c.finance.distress.status)) return;
          const s = w.market.stocks[i] as World["market"]["stocks"][number];
          // The full recalculation: E_norm and G from the archive (5.13 steps 1, 2).
          const quarters = c.finance.archive.quarters;
          const ttmLedger = trailingFour(quarters);
          if (ttmLedger === null) throw new Error("a trailing four");
          const ttm = ledgerNetIncome(ttmLedger);
          const rev = quarters.map((q) => q.lines.revenue);
          const k = rev.length;
          const sumOf = (a: number, b: number): number => rev.slice(a, b).reduce((x, y) => x + y, 0);
          let gRaw = 0.0;
          if (k >= 8) {
            gRaw = sumOf(k - 4, k) / sumOf(k - 8, k - 4) - 1.0;
          } else if (k > 4) {
            const m = k - 4;
            gRaw = sumOf(k - m, k) / sumOf(k - m - 4, k - 4) - 1.0;
          }
          const g = clamp(gRaw, -0.3, 0.6);
          const e = 0.6 * ttm + 0.4 * ttm * (1.0 + g);
          const lt = (w.industries[c.industry] as World["industries"][number]).lt;
          const bigG = clamp(1.0 + 2.5 * (g - lt), 0.5, 2.5);
          nearRel(s.basis.e_norm as number, e, "E_norm");
          nearRel(s.basis.growth_factor, bigG, "G");
          // The surprise against the 9 January consensus (5.15), and the tags.
          const lastQ = quarters[quarters.length - 1] as (typeof quarters)[number];
          const ni = ledgerNetIncome(lastQ.lines);
          const cons = s.consensus_ni === 0.0 ? 1.0 : s.consensus_ni;
          const sp = (ni - cons) / Math.abs(cons);
          nearRel(s.last_surprise, sp, "surprise");
          const tag = s.tags.surprise;
          const wantTag =
            sp > 0.2 ? "BigBeat" : sp > 0.05 ? "Beat" : sp < -0.2 ? "BigMiss" : sp < -0.05 ? "Miss" : null;
          expect(tag, c.key).toBe(wantTag);
          expect(s.tags.loss).toBe(ni < 0.0);
          if (tag !== null) tags[tag] = (tags[tag] as number) + 1;
          if (!s.quoted) return;
          const [p0, b0] = before[i] as [number, number];
          const jump = 1.0 + 1.5 * clamp(0.5 * sp, -0.25, 0.25);
          nearRel(s.price, Math.max(p0 * jump, 0.01), `${c.key} jump`);
          const b = clamp(b0 + clamp(20.0 * sp, -30.0, 30.0), -100.0, 100.0);
          nearRel(s.buzz, b, "buzz jump");
          // The jumped price is in the day's bar.
          expect(s.bar.last).toBe(s.price);
          jumps += 1;
        });
      }
      w.market.stocks.forEach((s, i) => {
        buzz[i] = s.buzz;
      });
      confidence = w.zones.map((z) => z.confidence);
    }
    expect(refreshes).toBeGreaterThan(0);
    expect(barsChecked).toBeGreaterThan(467 * 90);
    expect(jumps).toBeGreaterThan(400);
    expect(reversions, "6 days in January and in April").toBe(467 * 6 * 2);
  });
});
