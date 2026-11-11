// React bindings for the store: one hook per kind of read. Each subscribes to a single key, so a
// component re-renders only when its own view moves. The subscribe functions are memoized, so
// React does not resubscribe on every render.

import {
  type ClockView,
  type SimViews,
  type SliceData,
  type SliceKey,
  sliceId,
  type ViewName,
} from "@tc20ff/sim";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { SimClient } from "./client.ts";
import type { Message, NoticeEntry, Status, StoreKey } from "./store.ts";

export const SimContext = createContext<SimClient | null>(null);

export function useSim(): SimClient {
  const c = useContext(SimContext);
  if (!c) throw new Error("useSim outside a SimContext");
  return c;
}

/** A view's data, or undefined before the first frame (or for a view the sim has not ported). */
export function useViewData<K extends ViewName>(name: K): SimViews[K]["data"] | undefined {
  const { store } = useSim();
  const subscribe = useCallback((cb: () => void) => store.subscribe(name, cb), [store, name]);
  const get = useCallback(() => store.getView(name), [store, name]);
  return useSyncExternalStore(subscribe, get)?.data;
}

/**
 * A view's data, re-read at most once per `ms`. For heavy readers of a view that moves every frame
 * (a 10,000-row table reading the quotes): the component renders a few times a second, not 60,
 * because the throttle sits in the subscription, before React hears of the change.
 */
export function useViewDataThrottled<K extends ViewName>(
  name: K,
  ms: number,
): SimViews[K]["data"] | undefined {
  const { store } = useSim();
  const subscribe = useCallback(
    (cb: () => void) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const off = store.subscribe(name, () => {
        if (timer !== null) return;
        timer = setTimeout(() => {
          timer = null;
          cb();
        }, ms);
      });
      return () => {
        off();
        if (timer !== null) clearTimeout(timer);
      };
    },
    [store, name, ms],
  );
  const get = useCallback(() => store.getView(name), [store, name]);
  return useSyncExternalStore(subscribe, get)?.data;
}

/**
 * A slice of a view (protocol.ts `SliceKey`; D1016, D1037): a contract's book or history, a race's
 * county returns, a roll call's votes, a day's front pages. It is wanted while a component reads
 * it, and the sim sends it again whenever its view moves; undefined until the first copy arrives,
 * and null when the sim has nothing by that key. Pass null to read nothing.
 */
export function useSlice<K extends SliceKey>(key: K | null): SliceData<K> | null | undefined {
  const { store } = useSim();
  const id = key === null ? null : sliceId(key);
  // The key by its identity, so a caller may build a new object each render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `id` is the key's identity
  const stable = useMemo(() => key, [id]);
  const subscribe = useCallback(
    (cb: () => void) => (stable === null ? () => {} : store.subscribeSlice(stable, cb)),
    [store, stable],
  );
  const get = useCallback(() => (stable === null ? undefined : store.getSlice(stable)), [store, stable]);
  const entry = useSyncExternalStore(subscribe, get);
  return entry === undefined ? undefined : (entry.data as SliceData<K>);
}

export function useClock(): ClockView | undefined {
  return useViewData("clock");
}

function useKey<T>(key: StoreKey, read: (s: SimClient["store"]) => T): T {
  const { store } = useSim();
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key]);
  const get = useCallback(() => read(store), [store, read]);
  return useSyncExternalStore(subscribe, get);
}

const readNotices = (s: SimClient["store"]): readonly NoticeEntry[] => s.notices;
const readMessages = (s: SimClient["store"]): readonly Message[] => s.messages;
const readStatus = (s: SimClient["store"]): Status => s.status;

export function useNotices(): readonly NoticeEntry[] {
  return useKey("notices", readNotices);
}

export function useMessages(): readonly Message[] {
  return useKey("messages", readMessages);
}

export function useStatus(): Status {
  return useKey("status", readStatus);
}
