// Port of crates/sim/tests/views.rs: SimViews (build-plan M1.6, spec 9.1 `clock()` and the 9.4
// cadences), read only through the Sim API.
//
// Expects:
//   ../../../src/lib.ts                 simNew, simStep, simApply, simNow, simViews, simClock,
//                                       simSaveBytes, simLoadBytes, simStateHash, simStepObserved(
//                                       sim, observer) [Sim::step_observed, D400]
//   ../../../src/types/views/index.ts   VIEW_SPECS (cadence per view), SimViews { refresh, ... }
//   ../../../src/time/scheduler.ts      type TickObserver { started(part), finished(part) }
//   ./../common/views.ts                (local helpers)
//
// Changed from the Rust:
// - `Cadence::OnceAtLoad` is VIEW_SPECS.map_static.cadence === "OnceAtLoad".
// - views_built_on_worker_threads_match_views_built_in_turn (D801): the TS views are always built
//   one after another (no worker threads, the web worker is the thread), so the Rust test's
//   "parallel vs sequential" has nothing to compare. It is kept as the same loop over a plain
//   step and an observed step with a do-nothing observer (the observer path of D400 must not
//   change a view), and the views are compared with toEqual.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import {
  type Sim,
  simApply,
  simClock,
  simLoadBytes,
  simNew,
  simNow,
  simSaveBytes,
  simStateHash,
  simStep,
  simStepObserved,
  simViews,
} from "../../../src/lib.ts";
import { dateTimeAt, dateTimeMidnight, simDateYmd } from "../../../src/time/calendar.ts";
import type { TickObserver } from "../../../src/time/scheduler.ts";
import type { DateTime } from "../../../src/types/calendar.ts";
import { DATETIME_START } from "../../../src/types/calendar.ts";
import { VIEW_SPECS } from "../../../src/types/views/index.ts";
import { unwrap } from "../common/index.ts";

function mkSim(): Sim {
  const data = unwrap(loadWorld(defaultDataDir()), "load_world");
  return unwrap(simNew(data, 5), "Sim::new");
}

function runUntil(s: Sim, t: DateTime): void {
  while (simNow(s) < t) simStep(s);
}

describe("views", () => {
  it("clock_view_at_start_and_after_ticks", () => {
    const s = mkSim();
    let c = structuredClone(simClock(s));
    expect(c.now).toBe(DATETIME_START);
    expect([c.date, c.hour, c.weekday]).toEqual([simDateYmd(2020, 1, 1), 0, "Wed"]);
    expect([c.speed, c.selected_speed, c.paused]).toEqual([0, 1, true]);
    expect(c.quarter_phase).toBe("PreQuarterEnd");
    expect(c.days_to_next_phase).toBe(1);

    runUntil(s, dateTimeAt(simDateYmd(2020, 1, 2), 1));
    c = simClock(s);
    expect([c.hour, c.weekday]).toEqual([1, "Thu"]);
    expect(c.quarter_phase).toBe("Reaction");
    expect(c.next_phase).toBe("Locked");
    expect(c.days_to_next_phase).toBe(7);

    // Controls show at once, between ticks.
    unwrap(simApply(s, { kind: "SkipTo", skip: "NextLock" }), "SkipTo");
    expect(simClock(s).speed).toBe(5);
    expect(simClock(s).skipping).toBe("NextLock");
  });

  it("views_rebuild_on_their_cadence", () => {
    const s = mkSim();
    let v = simViews(s);
    expect(v.clock.dirty && v.map_static.dirty && v.statements.dirty).toBe(true);
    expect(VIEW_SPECS.map_static.cadence).toBe("OnceAtLoad");

    // A plain hour: only the every-tick views.
    simStep(s);
    v = simViews(s);
    expect(v.clock.dirty && v.quotes.dirty).toBe(true);
    expect(!v.price_bars.dirty && !v.company_rows.dirty && !v.map_static.dirty).toBe(true);

    // Midnight of 2 Jan: daily, and quarterly for the release.
    runUntil(s, dateTimeMidnight(simDateYmd(2020, 1, 2)));
    v = simViews(s);
    expect(v.price_bars.dirty && v.news.dirty && v.statements.dirty).toBe(true);
    expect(v.company_rows.dirty).toBe(false);

    // 1 Feb: monthly, not quarterly.
    runUntil(s, dateTimeMidnight(simDateYmd(2020, 2, 1)));
    v = simViews(s);
    expect(v.company_rows.dirty && v.province_cards.dirty).toBe(true);
    expect(!v.statements.dirty && !v.map_static.dirty).toBe(true);
    expect(v.company_rows.version).toBe(v.refresh);
    expect(v.map_static.version).toBe(1);
  });

  /** Versions of a spread of views: every tick, daily, monthly, quarterly and once at load. */
  function versions(s: Sim): number[] {
    const v = simViews(s);
    return [
      v.refresh,
      v.clock.version,
      v.price_bars.version,
      v.industry_rows.version,
      v.cycle.version,
      v.statements.version,
      v.map_static.version,
    ];
  }

  it("versions_keep_climbing_across_new_game_and_load", () => {
    // The bridge copies views by version (spec 9.4), so a NewGame or a Load must never hand out
    // a version it has handed out before.
    const s = mkSim();
    runUntil(s, dateTimeMidnight(simDateYmd(2020, 2, 3)));
    let before = versions(s);
    let top = Math.max(...before);
    unwrap(simApply(s, { kind: "NewGame", seed: 6 }), "NewGame");
    let after = versions(s);
    expect(
      after.every((v) => v > top),
      `${before} then ${after}`,
    ).toBe(true);
    expect(simNow(s)).toBe(DATETIME_START);
    expect(simViews(s).map_static.dirty && simViews(s).cycle.dirty).toBe(true);

    runUntil(s, dateTimeMidnight(simDateYmd(2020, 1, 5)));
    const save = simSaveBytes(s);
    runUntil(s, dateTimeMidnight(simDateYmd(2020, 3, 2)));
    before = versions(s);
    top = Math.max(...before);
    unwrap(simLoadBytes(s, save), "load_bytes");
    after = versions(s);
    expect(
      after.every((v) => v > top),
      `${before} then ${after}`,
    ).toBe(true);
    expect(simNow(s)).toBe(dateTimeMidnight(simDateYmd(2020, 1, 5)));
    expect(simViews(s).map_static.dirty).toBe(true);
  });

  // D801 (see the header): plain step against observed step.
  it("views_built_on_worker_threads_match_views_built_in_turn", () => {
    const par = mkSim();
    const seq = mkSim();
    const sequential: TickObserver = { started: () => {}, finished: () => {} };
    const end = dateTimeMidnight(simDateYmd(2020, 4, 3));
    let checked = 0;
    while (simNow(par) < end) {
      const a = simStep(par);
      const b = simStepObserved(seq, sequential);
      expect(a, `notices at ${simNow(par)}`).toEqual(b);
      if (simNow(par) % 24 === 0) {
        expect(simViews(par), `views at ${simNow(par)}`).toEqual(simViews(seq));
        checked += 1;
      }
    }
    expect(checked > 90).toBe(true);
    expect(simStateHash(par)).toBe(simStateHash(seq));
  });
});
