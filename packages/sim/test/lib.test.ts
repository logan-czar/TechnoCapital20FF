// The Sim's own rules (lib.ts; Rust lib.rs): start_world's call order, NewGame, load, pauses, the
// observer and the test hooks. Not a Rust file: Rust covered these through controls.rs,
// save_load.rs and the M10 profiling tests; these pin the parts those leave implicit.

import type { WorldData } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import {
  START_DEPS,
  type StartDeps,
  simFromWorld,
  simLastTrace,
  simNew,
  simRegisterTestJob,
  simSetTrace,
  simStepObserved,
  simViews,
  simWorld,
  startWorld,
} from "../src/lib.ts";
import { mapDataDefault } from "../src/map.ts";
import type { TickPart } from "../src/time/scheduler.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { LoadError, World } from "../src/types/world.ts";
import { viewBuildersOnly } from "../src/views/index.ts";
import { alertLevelsGet } from "../src/world/notice.ts";
import { minimalSim, minimalWorld, NO_DRAWS } from "./test_sim.ts";

/** StartDeps that record their calls and build `minimalWorld()`, or fail once `fail` is set. */
function recordingDeps(calls: string[], fail: { on: boolean }): StartDeps {
  const rec = (name: string) => () => {
    calls.push(name);
  };
  const error: LoadError = { kind: "BadValue", table: "t", key: "k", message: "m" };
  return {
    worldFromData: () => {
      calls.push("worldFromData");
      return fail.on
        ? { ok: false, error }
        : {
            ok: true,
            value: {
              ...minimalWorld(),
              industries: Array.from({ length: 5 }, () => ({ phase_label: "Normal" })),
              news: { labels: [] },
            } as unknown as World,
          };
    },
    economyStart: rec("economyStart"),
    birthsDrawTippedLabAtLoad: rec("birthsDrawTippedLabAtLoad"),
    aiPlanAtLoad: rec("aiPlanAtLoad"),
    peopleSeatingStart: rec("peopleSeatingStart"),
    birthsDrawFirstVotes: rec("birthsDrawFirstVotes"),
    financeStart: rec("financeStart"),
    marketStart: rec("marketStart"),
  };
}

const NO_DATA = {} as WorldData;

describe("startWorld", () => {
  it("runs the load's calls in their frozen order (D163) and starts the wire from the labels", () => {
    const calls: string[] = [];
    const r = startWorld(NO_DATA, NO_DRAWS, recordingDeps(calls, { on: false }));
    expect(calls).toEqual([
      "worldFromData",
      "economyStart",
      "birthsDrawTippedLabAtLoad",
      "aiPlanAtLoad",
      "peopleSeatingStart",
      "birthsDrawFirstVotes",
      "financeStart",
      "marketStart",
    ]);
    expect(r.ok && r.value.news.labels).toEqual(["Normal", "Normal", "Normal", "Normal", "Normal"]);
  });

  it("every default is the ported function, none a not-ported placeholder", () => {
    const unported = (Object.keys(START_DEPS) as (keyof StartDeps)[]).filter((k) => {
      try {
        (START_DEPS[k] as (...a: unknown[]) => unknown)(minimalWorld(), NO_DRAWS);
        return false;
      } catch (e) {
        if (!(e instanceof Error) || !e.message.includes("not ported yet")) return false;
        expect(e.message).toMatch(/^lib: \w+::.* is not ported yet/);
        return true;
      }
    });
    // Step 2 wired every member.
    expect(unported).toEqual([]);
  });
});

describe("Sim", () => {
  it("NewGame keeps the alert levels and the views; the rest is a new game", () => {
    const s = minimalSim(1);
    let ran = 0;
    simRegisterTestJob(s, "Alerts", "test.count", () => {
      ran += 1;
    });
    simSetTrace(s, true);
    s.apply({ kind: "SetAlert", alert_kind: "EarningsDay", level: "Off" });
    s.apply({ kind: "WatchlistAdd", company: 3 as CompanyId });
    s.apply({ kind: "SetSpeed", speed: 4 });
    for (let i = 0; i < 30; i++) s.step();
    const views = simViews(s);
    const refresh = views.refresh;
    expect(s.apply({ kind: "NewGame", seed: 8 })).toEqual({ ok: true, value: [] });
    expect([s.now(), s.seed(), s.controls().paused, s.controls().speed]).toEqual([0, 8, true, 1]);
    expect(alertLevelsGet(s.controls().alerts, "EarningsDay")).toBe("Off");
    expect(s.controls().watchlist.size).toBe(0);
    expect(simViews(s)).toBe(views);
    expect(views.refresh).toBe(refresh + 1);
    expect(views.clock.data.now).toBe(0);
    s.step();
    expect(ran, "a NewGame drops test jobs").toBe(30);
    expect(simLastTrace(s), "and turns the trace off").toEqual([]);
  });

  it("a NewGame that fails to load changes nothing", () => {
    const calls: string[] = [];
    const fail = { on: false };
    const deps = recordingDeps(calls, fail);
    const r = simNew(NO_DATA, 1, {
      deps: {
        start: deps,
        mapDataBuild: () => ({ ok: true, value: mapDataDefault() }),
        views: viewBuildersOnly(["clock"]),
      },
    });
    if (!r.ok) throw new Error("builds");
    const s = r.value;
    for (let i = 0; i < 5; i++) s.step();
    const before = s.stateHash();
    const refresh = simViews(s).refresh;
    fail.on = true;
    expect(s.apply({ kind: "NewGame", seed: 2 })).toEqual({
      ok: false,
      error: { kind: "Load", error: { kind: "BadValue", table: "t", key: "k", message: "m" } },
    });
    expect([s.stateHash(), s.seed(), simViews(s).refresh]).toEqual([before, 1, refresh]);
  });

  it("pausing twice posts one Paused notice", () => {
    const s = minimalSim(1);
    s.apply({ kind: "Resume" });
    expect(s.apply({ kind: "Pause" })).toEqual({
      ok: true,
      value: [{ kind: "Paused", reason: { kind: "Player" } }],
    });
    expect(s.apply({ kind: "Pause" })).toEqual({ ok: true, value: [] });
    expect(s.apply({ kind: "SetSpeed", speed: 0 })).toEqual({ ok: true, value: [] });
  });

  it("a load drops the skip, pauses, and keeps Omniscient only in a debug build", () => {
    const d = minimalSim(1, { debug: true });
    d.apply({ kind: "SetOmniscient", on: true });
    d.apply({ kind: "SkipTo", skip: "NextLock" });
    d.step();
    const bytes = d.saveBytes();
    const game = minimalSim(2);
    expect(game.loadBytes(bytes).ok).toBe(true);
    expect([game.controls().omniscient, game.controls().skip, game.controls().paused]).toEqual([
      false,
      null,
      true,
    ]);
    const debug = minimalSim(2, { debug: true });
    expect(debug.loadBytes(bytes).ok).toBe(true);
    expect([debug.controls().omniscient, debug.controls().skip]).toEqual([true, null]);
    expect(simWorld(debug)).toEqual(simWorld(d));
  });

  it("an observed step tells the slots, jobs and views in order and changes nothing (D400)", () => {
    const a = minimalSim(1);
    const b = minimalSim(1);
    const parts: string[] = [];
    const show = (p: TickPart) =>
      p.kind === "Slot"
        ? p.slot
        : p.kind === "Job"
          ? `${p.slot}/${p.name}`
          : p.kind === "View"
            ? `view ${p.name}`
            : p.kind;
    const observer = {
      started: (p: TickPart) => parts.push(`+${show(p)}`),
      finished: (p: TickPart) => parts.push(`-${show(p)}`),
    };
    for (let i = 0; i < 24; i++) expect(simStepObserved(a, observer)).toEqual(b.step());
    expect(a.stateHash()).toBe(b.stateHash());
    // The 2 Jan 00:00 tick ends with its views: only the clock is ported here.
    expect(parts.slice(-10)).toEqual([
      "+ReleasePublish",
      "+ReleasePublish/finance.removals",
      "-ReleasePublish/finance.removals",
      "+ReleasePublish/news.removals",
      "-ReleasePublish/news.removals",
      "-ReleasePublish",
      "+Views",
      "+view clock",
      "-view clock",
      "-Views",
    ]);
    expect(parts.slice(0, 6)).toEqual([
      // 1 January: no share prices (spec 4.1 step 2, 3.1.0).
      "+AdvanceClock",
      "-AdvanceClock",
      "+Alerts",
      "+Alerts/time.calendar_alerts",
      "-Alerts/time.calendar_alerts",
      "-Alerts",
    ]);
  });
});
