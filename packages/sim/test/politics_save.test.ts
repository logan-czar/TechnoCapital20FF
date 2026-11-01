// A save anywhere between November and the January handovers plays on exactly as an unsaved game
// does, through the real save codec: the saved world and RNG must hold nothing that differs once
// decoded (the politics POC, D985).
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { canonicalString } from "../src/canonical.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { electionDay } from "../src/politics/calendar.ts";
import { politicsJob } from "../src/politics/jobs.ts";
import { rngStreamsDraws, rngStreamsNew } from "../src/rng.ts";
import { decode, encode } from "../src/save.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import { controlsDefault } from "../src/time/control.ts";
import type { SimDate } from "../src/types/calendar.ts";

const loaded = loadWorld(defaultDataDir());
if (!loaded.ok) throw new Error("data does not load");
const DATA = loaded.value;

/** The politics state after each of `days`, saving and loading just before day `at` (-1: never). */
function runOn(seed: number, days: readonly SimDate[], at: number): string[] {
  const r = simNew(DATA, seed);
  if (!r.ok) throw new Error("no world");
  let world = simWorld(r.value);
  let rng = rngStreamsNew(seed);
  const seen: string[] = [];
  days.forEach((date, i) => {
    if (i === at) {
      const back = decode(encode(world, rng, controlsDefault()));
      if (!back.ok) throw new Error("the save does not decode");
      world = back.value.world;
      rng = back.value.rng;
    }
    politicsJob(world, { facts: { date }, draws: rngStreamsDraws(rng) } as never);
    seen.push(canonicalString(world.politics));
  });
  return seen;
}

describe("politics across a save", () => {
  it("gives the same state after every handover, wherever the save falls", () => {
    const days = [electionDay(2020), simDateYmd(2021, 1, 1), simDateYmd(2021, 1, 3), simDateYmd(2021, 1, 20)];
    for (const seed of [1, 2, 3]) {
      const plain = runOn(seed, days, -1);
      for (const at of [1, 2, 3]) expect(runOn(seed, days, at)).toEqual(plain);
    }
  });
});
