// A historical world's controls (1995-rework 4.1, 8.2): the speed it is watched at, alert defaults
// that do not stall it, its own alerts, and what a new game can be.
import { describe, expect, it } from "vitest";
import { eraActivateSectorsJob, eraMacroJob } from "../src/era/jobs.ts";
import { newGameChoices, simApply, simControls, simNew, simWorld } from "../src/lib.ts";
import { electionDay } from "../src/politics/calendar.ts";
import { politicsJob } from "../src/politics/jobs.ts";
import { rngStreamsDraws, rngStreamsNew } from "../src/rng.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import { controlsSecondsPerTick } from "../src/time/control.ts";
import { MAX_SPEED, SECONDS_PER_HOUR, WATCH_SPEED } from "../src/types/control.ts";
import type { AlertKind } from "../src/types/notice.ts";
import { ALERT_KIND_INDEX, ALERT_KIND_VALUES, HISTORICAL_ALERT_KINDS } from "../src/types/notice.ts";
import type { World } from "../src/types/world.ts";
import { alertLevelsGet } from "../src/world/notice.ts";
import { data, data1995 } from "./common/index.ts";

function start(seed: number, scenario = "stable") {
  const made = simNew(data1995(), seed, { scenario });
  if (!made.ok) throw new Error("did not load");
  return made.value;
}

/** A job context that records the alerts raised. */
function ctxAt(date: ReturnType<typeof simDateYmd>, raised: AlertKind[]) {
  return {
    facts: { date },
    draws: rngStreamsDraws(rngStreamsNew(1)),
    raiseAlert: (k: AlertKind) => raised.push(k),
  } as never;
}

describe("the speeds (1995-rework 8.2)", () => {
  it("run a game year a minute at speed 5, and as fast as they can at Max", () => {
    expect(MAX_SPEED).toBe(6);
    expect(SECONDS_PER_HOUR.length).toBe(MAX_SPEED);
    expect((SECONDS_PER_HOUR[WATCH_SPEED - 1] as number) * 8760).toBeCloseTo(60);
    expect(SECONDS_PER_HOUR[MAX_SPEED - 1]).toBeNull();
  });

  it("start a historical world at speed 5, and the 2020 world still at 1", () => {
    const era = simControls(start(1));
    expect(era.speed).toBe(WATCH_SPEED);
    expect(era.paused).toBe(true);
    const old = simNew(data(), 1);
    if (!old.ok) throw new Error("did not load");
    expect(simControls(old.value).speed).toBe(1);
  });

  it("refuse a speed past Max", () => {
    const sim = start(1);
    expect(simApply(sim, { kind: "SetSpeed", speed: MAX_SPEED + 1 }).ok).toBe(false);
    expect(simApply(sim, { kind: "SetSpeed", speed: WATCH_SPEED }).ok).toBe(true);
    expect(controlsSecondsPerTick(simControls(sim))).toBeCloseTo(60 / 8760);
  });
});

describe("the alert levels (1995-rework 8.2)", () => {
  const CALENDAR: readonly AlertKind[] = ["EarningsDay", "QuarterlyRecap", "PlanLock", "QuarterStart"];

  it("keep every older kind's saved slot", () => {
    expect(ALERT_KIND_VALUES.map((k) => ALERT_KIND_INDEX[k])).toEqual(ALERT_KIND_VALUES.map((_, i) => i));
    expect(ALERT_KIND_VALUES.slice(0, 6)).toEqual([
      "EarningsDay",
      "QuarterlyRecap",
      "PlanLock",
      "BankruptcyInWatchlist",
      "WorldEvent",
      "QuarterStart",
    ]);
  });

  it("log the calendar in a historical world, and notify of its own alerts", () => {
    const c = simControls(start(1));
    for (const k of CALENDAR) expect(alertLevelsGet(c.alerts, k)).toBe("Log");
    for (const k of HISTORICAL_ALERT_KINDS) expect(alertLevelsGet(c.alerts, k)).toBe("Notify");
  });

  it("still pause the 2020 world on the calendar", () => {
    const old = simNew(data(), 1);
    if (!old.ok) throw new Error("did not load");
    for (const k of CALENDAR) expect(alertLevelsGet(simControls(old.value).alerts, k)).toBe("Pause");
  });

  it("can be set to pause by kind", () => {
    const sim = start(1);
    expect(simApply(sim, { kind: "SetAlert", alert_kind: "Recession", level: "Pause" }).ok).toBe(true);
    expect(alertLevelsGet(simControls(sim).alerts, "Recession")).toBe("Pause");
    expect(alertLevelsGet(simControls(sim).alerts, "Election")).toBe("Notify");
  });
});

describe("the alerts raised (1995-rework 8.2)", () => {
  it("say when the US votes, in a historical world only", () => {
    const raised: AlertKind[] = [];
    const w = simWorld(start(2));
    const e = electionDay(1996);
    politicsJob(w, ctxAt(e, raised));
    expect(raised).toEqual(["Election"]);
    const old = simNew(data(), 1);
    if (!old.ok) throw new Error("did not load");
    const none: AlertKind[] = [];
    politicsJob(simWorld(old.value), ctxAt(electionDay(2020), none));
    expect(none).toEqual([]);
  });

  it("say when an industry emerges", () => {
    const raised: AlertKind[] = [];
    const w = simWorld(start(3));
    const s = w.era?.sectors.find((x) => x.status === "Dormant");
    if (!s?.emerge_quarter) throw new Error("none dormant");
    eraActivateSectorsJob(
      w,
      ctxAt(simDateYmd(s.emerge_quarter.year, 1 + (s.emerge_quarter.q - 1) * 3, 1), raised),
    );
    expect(raised).toContain("NewSector");
  });

  it("say when a recession starts, once", () => {
    const raised: AlertKind[] = [];
    const w: World = simWorld(start(4));
    w.cycle.phase = "Contraction";
    (w.era as NonNullable<World["era"]>).macro.last_phase = "Expansion";
    eraMacroJob(w, ctxAt(simDateYmd(1996, 1, 1), raised));
    eraMacroJob(w, ctxAt(simDateYmd(1996, 4, 1), raised));
    expect(raised).toEqual(["Recession"]);
  });
});

describe("a new game's choices (1995-rework 4.1)", () => {
  it("are the three scenarios and Random in a historical world", () => {
    const c = newGameChoices(data1995());
    expect(c?.world_id).toBe("1995");
    expect(c?.scenarios.map((s) => s.id)).toEqual(["stable", "unstable", "stagnation", "random"]);
    expect(c?.scenarios.at(-1)?.label).toBe("Random");
  });

  it("are none in the 2020 world", () => {
    expect(newGameChoices(data())).toBeNull();
  });

  it("each start a game, and Random keeps its name back", () => {
    for (const s of newGameChoices(data1995())?.scenarios ?? []) {
      const era = simWorld(start(5, s.id)).era;
      expect(era?.scenario_hidden).toBe(s.id === "random");
    }
  });
});
