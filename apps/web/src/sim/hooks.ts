// React bindings for the store: one hook per kind of read. Each subscribes to a single key, so a
// component re-renders only when its own view moves.

import type { ClockView, SimViews, ViewName } from "@tc20ff/sim";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { SimClient } from "./client.ts";
import type { NoticeEntry, Status } from "./store.ts";

export const SimContext = createContext<SimClient | null>(null);

export function useSim(): SimClient {
  const c = useContext(SimContext);
  if (!c) throw new Error("useSim outside a SimContext");
  return c;
}

/** A view's data, or undefined before the first frame. */
export function useViewData<K extends ViewName>(name: K): SimViews[K]["data"] | undefined {
  const { store } = useSim();
  const v = useSyncExternalStore(
    (cb) => store.subscribe(name, cb),
    () => store.getView(name),
  );
  return v?.data;
}

export function useClock(): ClockView | undefined {
  return useViewData("clock");
}

export function useNotices(): readonly NoticeEntry[] {
  const { store } = useSim();
  return useSyncExternalStore(
    (cb) => store.subscribe("notices", cb),
    () => store.notices,
  );
}

export function useStatus(): Status {
  const { store } = useSim();
  return useSyncExternalStore(
    (cb) => store.subscribe("status", cb),
    () => store.status,
  );
}
