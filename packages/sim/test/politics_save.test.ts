// A save between November and the January handovers plays on exactly as an unsaved game does: the
// saved world must hold nothing that differs once it is decoded (the politics POC, D985).
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { canonicalString } from "../src/canonical.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { electionDay } from "../src/politics/calendar.ts";
import { politicsJob } from "../src/politics/jobs.ts";
import { rngStreamsDraws, rngStreamsNew } from "../src/rng.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { SimDate } from "../src/types/calendar.ts";
import type { World } from "../src/types/world.ts";

const loaded = loadWorld(defaultDataDir());
if (!loaded.ok) throw new Error("data does not load");
const DATA = loaded.value;

function runOn(w: World, seed: number, days: readonly SimDate[], at: number): string[] {
  const draws = rngStreamsDraws(rngStreamsNew(seed));
  const run = (world: World, date: SimDate) => politicsJob(world, { facts: { date }, draws } as never);
  const seen: string[] = [];
  let world = w;
  days.forEach((date, i) => {
    // The save and load: the world as a save encodes it, shared objects copied apart.
    if (i === at) world = JSON.parse(JSON.stringify(world)) as World;
    run(world, date);
    seen.push(canonicalString(world.politics));
  });
  return seen;
}

describe("politics across a save", () => {
  it("gives the same state after every handover, saved or not", () => {
    const days = [electionDay(2020), simDateYmd(2021, 1, 1), simDateYmd(2021, 1, 3), simDateYmd(2021, 1, 20)];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const make = () => {
        const r = simNew(DATA, seed);
        if (!r.ok) throw new Error("no world");
        return simWorld(r.value);
      };
      const plain = runOn(make(), seed, days, -1);
      const saved = runOn(make(), seed, days, 1);
      expect(saved).toEqual(plain);
    }
  });
});
