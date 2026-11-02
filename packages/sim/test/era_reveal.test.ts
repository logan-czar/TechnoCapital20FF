// The end of a historical world's run (1995-rework 3.2, 8.3, 8.4): the pause no setting gets past, the
// scenario kept back until then, and a save staying in its own world.
import { describe, expect, it } from "vitest";
import { eraRevealJob } from "../src/era/jobs.ts";
import {
  type Sim,
  simApply,
  simControls,
  simLoadBytes,
  simNew,
  simSaveBytes,
  simStep,
  simViews,
  simWorld,
} from "../src/lib.ts";
import { saveErrorMessage } from "../src/save.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { data, data1995, macrotask } from "./common/index.ts";

function start(seed: number, scenario: string): Sim {
  const made = simNew(data1995(), seed, { scenario });
  if (!made.ok) throw new Error("did not load");
  return made.value;
}

/** Every serialised view, as a page could read them. */
const allViews = (sim: Sim): string => JSON.stringify(simViews(sim));

/** A run set to end on 1 January 1996, stepped to that tick. */
async function runToEnd(sim: Sim): Promise<ReturnType<typeof simStep>> {
  const era = simWorld(sim).era;
  if (era === undefined) throw new Error("no era");
  era.reveal_date = simDateYmd(1996, 1, 1);
  const end = dateTimeMidnight(simDateYmd(1996, 1, 1));
  let n = 0;
  let last: ReturnType<typeof simStep> = [];
  while (sim.now() < end) {
    last = simStep(sim);
    if (++n % 2190 === 0) await macrotask();
  }
  return last;
}

describe("the end of a run", () => {
  it("pauses at the reveal date, shows the scenario and can carry on", async () => {
    const sim = start(1, "random");
    expect(simViews(sim).history.data.scenario).toBeNull();
    expect(simViews(sim).history.data.run?.ended).toBe(false);
    simApply(sim, { kind: "SetSpeed", speed: 1 });
    const last = await runToEnd(sim);
    expect(last).toContainEqual({ kind: "Paused", reason: { kind: "RunEnded" } });
    expect(simControls(sim).paused).toBe(true);
    const h = simViews(sim).history.data;
    expect(h.run?.ended).toBe(true);
    expect(h.scenario).toBe(simWorld(sim).era?.scenario.label);
    expect(h.years).toEqual([1995]);
    expect(simApply(sim, { kind: "Resume" }).ok).toBe(true);
    const next = simStep(sim);
    expect(next.some((n) => n.kind === "Paused")).toBe(false);
    expect(simControls(sim).paused).toBe(false);
  }, 200_000);

  it("stops a skip running past it", async () => {
    const sim = start(2, "stable");
    const era = simWorld(sim).era;
    if (era === undefined) throw new Error("no era");
    era.reveal_date = simDateYmd(1996, 1, 1);
    const before = dateTimeMidnight(simDateYmd(1995, 12, 31));
    let n = 0;
    while (sim.now() < before) {
      simStep(sim);
      if (++n % 2190 === 0) await macrotask();
    }
    // The next release is 2 January 1996, a day past the end.
    expect(simApply(sim, { kind: "SkipTo", skip: "NextRelease" }).ok).toBe(true);
    let last = simStep(sim);
    while (!era.ended) last = simStep(sim);
    expect(last).toContainEqual({ kind: "Paused", reason: { kind: "RunEnded" } });
    expect(simControls(sim).skip).toBeNull();
  }, 200_000);

  it("comes once", () => {
    const w = simWorld(start(2, "stable"));
    let ended = 0;
    const ctxAt = (year: number): never =>
      ({
        facts: { date: simDateYmd(year, 1, 1) },
        endRun: () => {
          ended += 1;
        },
      }) as never;
    eraRevealJob(w, ctxAt(2020));
    expect(ended).toBe(1);
    expect(w.era?.ended).toBe(true);
    eraRevealJob(w, ctxAt(2021));
    expect(ended).toBe(1);
  });

  it("does not come before the reveal date", () => {
    const w = simWorld(start(3, "stable"));
    eraRevealJob(w, { facts: { date: simDateYmd(2019, 1, 1) }, endRun: () => {} } as never);
    expect(w.era?.ended).toBe(false);
  });

  it("is not in the 2020 world", () => {
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    const w = simWorld(made.value);
    eraRevealJob(w, { facts: { date: simDateYmd(2100, 1, 1) }, endRun: () => {} } as never);
    expect(w.era).toBeUndefined();
    expect(simViews(made.value).history.data.run).toBeUndefined();
  });
});

describe("the hidden scenario (1995-rework 8.4)", () => {
  // Words of the labels and ids that appear nowhere else in the views.
  const SECRETS = [
    "Stable growth",
    "Unstable growth",
    "Stagnation",
    '"stable"',
    '"unstable"',
    '"stagnation"',
  ];

  it("is in no view before the reveal under Random, for each seed's pick", async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = start(seed, "random");
      for (let i = 0; i < 200; i++) simStep(sim);
      await macrotask();
      const text = allViews(sim);
      for (const s of SECRETS) expect(text.includes(s), `${seed}: ${s}`).toBe(false);
      expect(simWorld(sim).era?.scenario_hidden).toBe(true);
    }
  }, 120_000);

  it("shows at once when picked openly", () => {
    expect(simViews(start(1, "stagnation")).history.data.scenario).toBe("Stagnation");
  });
});

describe("a save", () => {
  it("loads back in its own world", () => {
    const sim = start(4, "stable");
    expect(simLoadBytes(sim, simSaveBytes(sim)).ok).toBe(true);
  });

  it("is refused by another world, which it leaves as it was", () => {
    const era = start(5, "stable");
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    const old = made.value;
    const refused = simLoadBytes(old, simSaveBytes(era));
    expect(refused).toEqual({
      ok: false,
      error: { kind: "Save", error: { kind: "WrongWorld", save: "1995", world: "2020" } },
    });
    expect(simWorld(old).era).toBeUndefined();
    expect(simLoadBytes(era, simSaveBytes(old)).ok).toBe(false);
    expect(saveErrorMessage({ kind: "WrongWorld", save: "1995", world: "2020" })).toContain("1995");
  });
});
