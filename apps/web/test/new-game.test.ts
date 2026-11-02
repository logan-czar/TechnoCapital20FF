// A historical world's start in the real worker (1995-rework 4.1): Ready lists the choices, NewGame
// takes one, and the picker's seed field; the 2020 world needs no picking.

import type { FromSim, ToSim } from "@tc20ff/sim";
import { defaultDataDir, loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { parseSeed } from "../src/shell/NewGamePicker.tsx";
import { RealHost } from "../src/sim/real/host.ts";
import { WorkerLoop } from "../src/sim/real/loop.ts";

function host(dir: string): RealHost {
  const loaded = loadWorld(dir);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return new RealHost(loaded.value, { now: () => 0 });
}

const newGame = (scenario?: string): ToSim =>
  scenario === undefined
    ? { kind: "NewGame", id: 1, seed: 7 }
    : { kind: "NewGame", id: 1, seed: 7, scenario };

async function readyOf(h: RealHost): Promise<FromSim | undefined> {
  const posted: FromSim[] = [];
  const loop = new WorkerLoop({
    post: (m) => posted.push(m),
    load: async () => h,
    now: () => 0,
    setInterval: () => 0,
    clearInterval: () => {},
  });
  await loop.start();
  return posted[0];
}

describe("Ready", () => {
  it("lists a historical world's choices", async () => {
    const ready = await readyOf(host(worldDataDir("1995")));
    expect(ready?.kind === "Ready" && ready.choices?.scenarios.map((s) => s.id)).toEqual([
      "stable",
      "unstable",
      "stagnation",
      "random",
    ]);
  });

  it("lists none for the 2020 world", async () => {
    expect(await readyOf(host(defaultDataDir()))).toEqual({ kind: "Ready" });
  });
});

describe("NewGame", () => {
  it("takes the scenario, keeping Random's name back", () => {
    const named = host(worldDataDir("1995"));
    named.handle(newGame("unstable"));
    expect(named.sim?.views().history?.data.scenario).toBe("Unstable growth");
    const random = host(worldDataDir("1995"));
    random.handle(newGame("random"));
    expect(random.sim?.views().history?.data.scenario).toBeNull();
  });

  it("refuses a scenario the world does not have, and starts no game", () => {
    const h = host(worldDataDir("1995"));
    const out = h.handle(newGame("no such"));
    expect(out.map((m) => m.kind)).toEqual(["Reply"]);
    expect(h.sim).toBeNull();
  });
});

describe("the seed field", () => {
  it("takes a whole number, and nothing else", () => {
    expect(parseSeed(" 42 ")).toBe(42);
    expect(parseSeed("0")).toBe(0);
    expect(parseSeed("")).toBeNull();
    expect(parseSeed("-1")).toBeNull();
    expect(parseSeed("1.5")).toBeNull();
    expect(parseSeed("abc")).toBeNull();
  });
});
