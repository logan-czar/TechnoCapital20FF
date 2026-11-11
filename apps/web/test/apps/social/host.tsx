// A test host for the Social app: the mock world on an in-process SimHost, its frames applied to a
// real SimStore, and a client whose `act` goes through the host and applies the frames it returns.

import type { DateTime, FromSim, PlayerAction, Reply } from "@tc20ff/sim";
import { act } from "@testing-library/react";
import { type ReactNode, useCallback, useState } from "react";
import type { AppProps } from "../../../src/os/apps.ts";
import type { SimClient } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockSim } from "../../../src/sim/mock/mockSim.ts";
import { SimStore } from "../../../src/sim/store.ts";
import { mockWorld } from "../../mock/common.ts";

export interface Rig {
  host: SimHost;
  sim: MockSim;
  store: SimStore;
  client: SimClient;
  /** Every action sent. */
  sent: PlayerAction[];
  /** Steps the mock to `t`, applying each hour's frame (inside act, so React re-renders). */
  runTo(t: DateTime): void;
}

export function newRig(seed = 7): Rig {
  const host = new SimHost(mockWorld(), MOCK_PIVOT);
  const store = new SimStore();
  const apply = (out: FromSim[]) => {
    for (const m of out) if (m.kind === "Frame") store.applyFrame(m);
  };
  apply(host.handle({ kind: "NewGame", id: 1, seed }));
  const sim = host.sim as MockSim;
  const sent: PlayerAction[] = [];
  let id = 100;
  const client = {
    store,
    act: async (action: PlayerAction): Promise<Reply> => {
      sent.push(action);
      const out = host.handle({ kind: "Act", id: ++id, action });
      await act(async () => apply(out));
      const reply = out[out.length - 1];
      if (reply?.kind !== "Reply") throw new Error("no reply");
      return reply.result;
    },
  } as unknown as SimClient;
  return {
    host,
    sim,
    store,
    client,
    sent,
    runTo(t) {
      act(() => {
        while (sim.now < t) {
          sim.paused = false;
          sim.step();
          apply(host.tick(0));
        }
      });
    },
  };
}

/** The app in a window's place: it keeps its own route, as the window manager would. */
export function Harness({
  rig,
  Body,
  start = null,
  width,
  routes,
}: {
  rig: Rig;
  Body: React.ComponentType<AppProps>;
  start?: string | null;
  width?: number;
  routes?: (string | null)[];
}): ReactNode {
  const [route, setRoute] = useState<string | null>(start);
  const onRoute = useCallback(
    (r: string | null) => {
      routes?.push(r);
      setRoute(r);
    },
    [routes],
  );
  return (
    <SimContext.Provider value={rig.client}>
      <div style={{ width: width ?? 520, height: 720 }}>
        <Body route={route} onRoute={onRoute} close={() => {}} setTitle={() => {}} />
      </div>
    </SimContext.Provider>
  );
}
