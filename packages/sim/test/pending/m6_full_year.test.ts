// Port of crates/sim/tests/m6_full_year.rs: build-plan M6.10, the spec M6 done line: "A full year
// runs four releases, four locks, four recaps; the fixed events F1 to F9 fire on their dates; a
// birth takes exactly its assets from the fringe (supply unchanged before PC bonuses) and a
// listing keeps assets = liabilities + equity; the same seed gives the same IPO votes, member by
// member."
//
// - The year 2020 on the live engine: the releases of Q4 2019 to Q3 2020, the four plan locks and
//   the four pre-quarter-end weeks, each with its notice or alert and its recap.
// - Every birth of the year conserves its industry's supply before PC bonuses (probes around each
//   lock) and every listing month balances (the engine's M4.9 count, D128).
// - Two runs of the same seed hold the same votes, ballot by ballot, and the same hash.
// - F1 to F9 fire at their plan locks (5.19.2) on a run to 2042, with the pop set to 1 January
//   2040 so the bust ends on 1 January 2042 and F9 falls on the 9 January 2042 lock (D275); the
//   boom posts the chatbot headline and F4 names the tipped lab.
//
// Expects:
//   ../../src/lib.ts           simNew, simStep, simNow, simWorld, simStateHash, simRegisterTestJob
//   ../../src/time/quarter.ts  isRecapDay (ported)
//   ./common/births.ts         supplyBeforeBonus (this lane)
//
// Changed from the Rust: the seeds (51, 52, 53) seed the new generator (D951); the expected
// counts (4 releases, 4 locks, 4 recaps, >= 2 births, a listing in 2020) are structural, but the
// "a listing in 2020" and ">= 2 births" depend on draws; if a seed misses them pick another seed
// rather than loosening the spec check. Rust's static Mutex vectors are per-test arrays. The
// println of each fixed event is dropped.
import { describe, expect, it } from "vitest";
import { simNew, simNow, simRegisterTestJob, simStateHash, simStep, simWorld } from "../../src/lib.ts";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  simDateYmd,
} from "../../src/time/calendar.ts";
import { isRecapDay } from "../../src/time/quarter.ts";
import { type JobCtx, tickFactsIsLockTick } from "../../src/time/scheduler.ts";
import type { Quarter } from "../../src/types/calendar.ts";
import type { Notice, World } from "../../src/types/world.ts";
import { chunkLogRows } from "../../src/world/log.ts";
import { supplyBeforeBonus } from "./common/births.ts";
import { data, rowOf, unwrap } from "./common/index.ts";

type Supplies = [number[], number];

function supplies(w: World): Supplies {
  return [w.industries.map((_, i) => supplyBeforeBonus(w, i as never)), w.companies.length];
}

const q = (year: number, quarter: number): Quarter => ({ year, q: quarter }) as Quarter;

describe("m6 full year", () => {
  it("a_full_year_runs_four_releases_four_locks_four_recaps", () => {
    const before: Supplies[] = [];
    const after: Supplies[] = [];
    const sim = unwrap(simNew(data(), 51), "Sim::new");
    simRegisterTestJob(sim, "Alerts", "test.before_lock", (w: World, ctx: JobCtx) => {
      if (tickFactsIsLockTick(ctx.facts)) before.push(supplies(w));
    });
    simRegisterTestJob(sim, "LockIpoVotes", "test.after_births", (w: World) => {
      after.push(supplies(w));
    });
    const end = dateTimeMidnight(simDateYmd(2021, 1, 1));
    const releases: Quarter[] = [];
    const locks: Quarter[] = [];
    const recaps: Quarter[] = [];
    let recapAlerts = 0;
    let listings = 0;
    while (simNow(sim) < end) {
      for (const n of simStep(sim) as Notice[]) {
        if (n.kind === "EarningsReleased") releases.push(n.quarter);
        else if (n.kind === "PlanLocked") locks.push(n.quarter);
        else if (n.kind === "Alert" && n.alert_kind === "QuarterlyRecap") recapAlerts += 1;
        else if (n.kind === "CompanyListed") listings += 1;
      }
      const t = simNow(sim);
      if (dateTimeHour(t) === 0 && isRecapDay(dateTimeDate(t))) {
        const last = simWorld(sim).recaps[simWorld(sim).recaps.length - 1];
        if (last === undefined) throw new Error("the recap is built on its day");
        recaps.push(last.world.quarter);
      }
    }
    expect(releases).toEqual([q(2019, 4), q(2020, 1), q(2020, 2), q(2020, 3)]);
    expect(locks).toEqual([q(2020, 1), q(2020, 2), q(2020, 3), q(2020, 4)]);
    expect(recapAlerts, "Quarterly recap fires each pre-quarter-end week").toBe(4);
    expect(recaps).toEqual([q(2020, 1), q(2020, 2), q(2020, 3), q(2020, 4)]);

    // Births conserve supply before PC bonuses at every lock; at least F1 was born.
    expect(before.length).toBe(4);
    let births = 0;
    before.forEach(([b, n0], k) => {
      const [a, n1] = after[k] as Supplies;
      births += n1 - n0;
      b.forEach((x, i) => {
        const y = a[i] as number;
        expect(Math.abs(x - y) <= 1e-9 * Math.max(x, 1.0), `supply ${x} vs ${y}`).toBe(true);
      });
    });
    expect(births, `${births} births in 2020`).toBeGreaterThanOrEqual(2);

    // A listing keeps A = L + E: every company-month of the year balances (D128).
    const w = simWorld(sim);
    expect(listings, "a listing in 2020").toBeGreaterThan(0);
    expect(w.books_check.failures, `${w.books_check.first_failure}`).toBe(0);
    expect(w.books_check.checked).toBeGreaterThan(651 * 12);
  });

  it("the_same_seed_gives_the_same_year", () => {
    const end = dateTimeMidnight(simDateYmd(2021, 1, 10));
    const a = unwrap(simNew(data(), 52), "Sim::new");
    const b = unwrap(simNew(data(), 52), "Sim::new");
    const na: Notice[] = [];
    const nb: Notice[] = [];
    while (simNow(a) < end) {
      na.push(...simStep(a));
      nb.push(...simStep(b));
    }
    expect(na).toEqual(nb);
    simWorld(a).companies.forEach((c, id) => {
      expect(c.ipo_last_vote, `${c.key}: the same ballots`).toEqual(
        rowOf(simWorld(b).companies, id as never).ipo_last_vote,
      );
    });
    expect(simStateHash(a)).toBe(simStateHash(b));
  });

  // Sets the pop to 1 January 2040 on the first tick (5.1.1 rolls it at load; the boom and the
  // pop are read from the dates each quarter, so a date set before 2030 runs as if rolled).
  it("fixed_events_f1_to_f9_fire_on_their_dates", () => {
    const sim = unwrap(simNew(data(), 53), "Sim::new");
    simRegisterTestJob(sim, "Alerts", "test.pop_in_2040", (w: World, ctx: JobCtx) => {
      if (ctx.facts.now === dateTimeAt(simDateYmd(2020, 1, 1), 1)) {
        w.ai.pop_date = simDateYmd(2040, 1, 1);
      }
    });
    const end = dateTimeMidnight(simDateYmd(2042, 1, 10));
    while (simNow(sim) < end) simStep(sim);
    const w = simWorld(sim);
    // Spec 5.19.2: the plan lock each fires at; F9 the first lock after the bust (the pop + 8
    // quarters).
    const want: [string, number, number, number][] = [
      ["F1", 2020, 4, 9],
      ["F2", 2021, 4, 9],
      ["F3", 2022, 1, 9],
      ["F4", 2030, 1, 9],
      ["F5", 2031, 1, 9],
      ["F6", 2032, 1, 9],
      ["F7", 2033, 1, 9],
      ["F8", 2035, 1, 9],
      ["F9", 2042, 1, 9],
    ];
    expect(
      w.births.fixed_fired.every((f) => f),
      "all nine fired",
    ).toBe(true);
    for (const [id, y, m, d] of want) {
      const fired = w.births.events.filter((e) => e.kind.kind === "Fixed" && e.kind.id === id);
      expect(fired.length, `${id} fires once`).toBe(1);
      expect(fired[0]?.date, id).toEqual(simDateYmd(y, m, d));
    }
    // The boom (5.1.1): "[tipped lab] launches its chatbot" on 1 January 2030, and F4's rush.
    const tippedId = w.births.tipped_lab;
    if (tippedId === null) throw new Error("no tipped lab");
    const tipped = rowOf(w.companies, tippedId).name;
    const feed = chunkLogRows(w.news.feed);
    const chatbot = feed.find((h) => h.kind.kind === "Chatbot");
    if (chatbot === undefined) throw new Error("the chatbot headline");
    expect(chatbot.date).toEqual(simDateYmd(2030, 1, 1));
    expect(chatbot.text).toBe(`${tipped} launches its chatbot`);
    const rush = feed.find((h) => h.kind.kind === "FixedStartupEvent" && h.kind.event === "F4");
    if (rush === undefined) throw new Error("F4's headline");
    expect(rush.text.startsWith(`${tipped}'s chatbot sets off a startup rush: `), rush.text).toBe(true);
    expect(w.books_check.failures, `${w.books_check.first_failure}`).toBe(0);
  });
});
