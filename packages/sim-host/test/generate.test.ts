// A generated history in the host (pivot 3.2 to 3.5; D1037): `NewGame` with `start: generate`
// answers with Progress at once, each `tick` runs one chunk and posts its Progress, and the end
// installs the hydrated game with its Frame and then the Reply. `Cancel` stops it between chunks,
// and a new game replaces it. The 1995 world, run to its second day in chunks of 10 ticks, so it
// is quick.

import { type FromSim, simDateYmd, type ToSim } from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { beforeAll, describe, expect, it } from "vitest";
import { data1995 } from "../../sim/test/common/index.ts";
import { presimGenerate, RealHost } from "../src/host.ts";

let data: WorldData;
beforeAll(() => {
  data = data1995();
});

const generate: ToSim = { kind: "NewGame", id: 7, seed: 3, start: { kind: "generate" } };

function hostOf(): RealHost {
  return new RealHost(data, {
    generate: presimGenerate(data, { until: simDateYmd(1995, 1, 2) }),
    generateChunkTicks: 10,
    now: () => 0,
  });
}

describe("a generated history", () => {
  it("reports progress chunk by chunk, then installs the hydrated game: Frame, then Reply", () => {
    const host = hostOf();
    const first = host.handle(generate);
    expect(first).toEqual([
      { kind: "Progress", id: 7, phase: "Presim", done: 0, total: 24, date: simDateYmd(1995, 1, 1) },
    ]);
    expect(host.isGenerating()).toBe(true);
    expect(host.sim).toBeNull();
    const out: FromSim[] = [];
    for (let i = 0; i < 10 && host.isGenerating(); i++) out.push(...host.tick(16));
    const kinds = out.map((m) => (m.kind === "Progress" ? `${m.kind}:${m.phase}:${m.done}` : m.kind));
    expect(kinds).toEqual([
      "Progress:Presim:10",
      "Progress:Presim:20",
      "Progress:Presim:24",
      "Progress:Hydrate:0",
      "Frame",
      "Reply",
    ]);
    expect(out.at(-1)).toEqual({ kind: "Reply", id: 7, result: { kind: "Ok", notices: [] } });
    const sim = host.sim;
    if (sim === null) throw new Error("no game");
    expect(sim.clock().date).toEqual(simDateYmd(1995, 1, 2));
    // Hydrated (pivot 3.4): the game plays at Full fidelity from here, paused as a new game is.
    expect(sim.clock().paused).toBe(true);
    // The same seed run straight through reaches the same state (chunking does not matter, D1035).
    const again = new RealHost(data, {
      generate: presimGenerate(data, { until: simDateYmd(1995, 1, 2) }),
      generateChunkTicks: 24,
    });
    again.handle(generate);
    while (again.isGenerating()) again.tick(16);
    expect(again.sim?.stateHash()).toBe(sim.stateHash());
  }, 60_000);

  it("stops on Cancel between chunks, and a new game replaces a running one", () => {
    const host = hostOf();
    host.handle(generate);
    host.tick(16);
    expect(host.handle({ kind: "Cancel", id: 99 })).toEqual([]);
    expect(host.handle({ kind: "Cancel", id: 7 })).toEqual([
      { kind: "Reply", id: 7, result: { kind: "Cancelled" } },
    ]);
    expect(host.isGenerating()).toBe(false);
    expect(host.sim).toBeNull();
    expect(host.tick(16)).toEqual([]);

    host.handle(generate);
    const replaced = host.handle({ kind: "NewGame", id: 8, seed: 1 });
    expect(replaced[0]).toEqual({ kind: "Reply", id: 7, result: { kind: "Cancelled" } });
    expect(replaced.at(-1)).toEqual({ kind: "Reply", id: 8, result: { kind: "Ok", notices: [] } });
    expect(host.isGenerating()).toBe(false);
  }, 60_000);
});
