// What the Records tests share: the app mounted on the mock sim (an in-process host feeding a real
// store, as the worker would), a window manager stand-in that keeps the route, and a way to step the
// mock's clock to a scripted event.

import type { DateTime, FromSim } from "@tc20ff/sim";
import { act, render } from "@testing-library/react";
import { useState } from "react";
import RecordsApp from "../../../src/apps/records/RecordsApp.tsx";
import type { SimClient } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockSim } from "../../../src/sim/mock/mockSim.ts";
import { SimStore } from "../../../src/sim/store.ts";
import { mockWorld } from "../../mock/common.ts";

export interface Mounted {
  host: SimHost;
  sim: MockSim;
  store: SimStore;
  /** Every route the app reported to the window manager, in order. */
  routes: (string | null)[];
  titles: (string | null)[];
  /** Steps the mock to `t` and delivers what moved. */
  advanceTo(t: DateTime): void;
  omniscient(on: boolean): void;
  /** The window manager changes the app's route from outside (an entity link reaching an open window). */
  setRoute(route: string | null): void;
  unmount(): void;
}

/** Opens the app at `route` on a mock game (debug, so Omniscient works) starting at `start`. */
export async function mountRecords(
  route: string | null,
  opts: { start?: number; width?: number; height?: number } = {},
): Promise<Mounted> {
  const host = new SimHost(mockWorld(), {
    ...MOCK_PIVOT,
    debug: true,
    ...(opts.start === undefined ? {} : { start: opts.start }),
  });
  const store = new SimStore();
  store.setStatus({ ready: true, started: true });
  const deliver = (out: FromSim[]) => {
    for (const m of out) if (m.kind === "Frame") store.applyFrame(m);
  };
  deliver(host.handle({ kind: "NewGame", id: 1, seed: 7 }));
  store.onWant = (views, slices) => deliver(host.handle({ kind: "Want", views, slices }));
  const sim = host.sim as MockSim;
  const routes: (string | null)[] = [];
  const titles: (string | null)[] = [];
  let outside: (r: string | null) => void = () => {};
  const client = { store } as unknown as SimClient;
  function Window() {
    const [r, setR] = useState<string | null>(route);
    outside = setR;
    return (
      <div style={{ width: opts.width ?? 1000, height: opts.height ?? 700 }}>
        <RecordsApp
          route={r}
          onRoute={(next) => {
            routes.push(next);
            setR(next);
          }}
          close={() => {}}
          setTitle={(t) => titles.push(t)}
        />
      </div>
    );
  }
  const view = render(
    <SimContext.Provider value={client}>
      <Window />
    </SimContext.Provider>,
  );
  // The store asks for what the page reads after the current task.
  await act(async () => {});
  let ctl = 100;
  return {
    host,
    sim,
    store,
    routes,
    titles,
    advanceTo(t) {
      act(() => {
        while (sim.now < t) {
          sim.paused = false;
          sim.step();
        }
        deliver(host.tick(0));
      });
    },
    omniscient(on) {
      act(() => {
        deliver(host.handle({ kind: "Control", id: ctl++, control: { kind: "SetOmniscient", on } }));
      });
    },
    setRoute: (r) => act(() => outside(r)),
    unmount: view.unmount,
  };
}
