// Shared by the mock pivot tests: the mock world, a pivot host, and a way to run the clock.

import type { DateTime, FromSim, Notice, PlayerAction, Reply, SimViews, UiControl } from "@tc20ff/sim";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { SimHost } from "../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockOptions, type MockSim } from "../../src/sim/mock/mockSim.ts";
import { buildMockWorld, type MockWorld } from "../../src/sim/mock/mockWorld.ts";

let cached: MockWorld | null = null;

export function mockWorld(): MockWorld {
  if (cached === null) {
    const data = loadWorld(defaultDataDir());
    if (!data.ok) throw new Error(JSON.stringify(data.error));
    cached = buildMockWorld(data.value);
  }
  return cached;
}

export interface Game {
  host: SimHost;
  sim: MockSim;
  /** Every message the host has returned, in order. */
  log: FromSim[];
  control(c: UiControl): Reply;
  act(a: PlayerAction): Reply;
  /** Steps the clock to `t`, through any pause, and returns the notices. */
  runTo(t: DateTime): Notice[];
  views(): SimViews;
}

/** A new pivot game on the mock host. */
export function newGame(seed = 7, opts: MockOptions = {}): Game {
  const host = new SimHost(mockWorld(), { ...MOCK_PIVOT, ...opts });
  const log: FromSim[] = [];
  const send = (msg: Parameters<SimHost["handle"]>[0]): Reply => {
    const out = host.handle(msg);
    log.push(...out);
    const reply = out[out.length - 1];
    if (reply?.kind !== "Reply") throw new Error("no reply");
    return reply.result;
  };
  let id = 0;
  send({ kind: "NewGame", id: ++id, seed });
  const sim = host.sim as MockSim;
  return {
    host,
    sim,
    log,
    control: (control) => send({ kind: "Control", id: ++id, control }),
    act: (action) => send({ kind: "Act", id: ++id, action }),
    runTo(t) {
      const notices: Notice[] = [];
      while (sim.now < t) {
        sim.paused = false;
        notices.push(...sim.step());
      }
      return notices;
    },
    views: () => sim.views,
  };
}

/** The bytes a message is as JSON: what the worker boundary roughly costs. */
export function bytes(x: unknown): number {
  return JSON.stringify(x).length;
}
