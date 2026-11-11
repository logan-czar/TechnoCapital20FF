// The county shapes at runtime (D1048): fetched once from /data/usmap/ (the gameData plugin in
// apps/web/vite.config.ts serves assets/usmap/; the desktop serves the build's copy) and decoded
// once. A test swaps the loader for one that reads the file from disk.

import { useEffect, useState } from "react";
import { type BaseGeometry, type CountyTopology, decodeTopology } from "./geometry.ts";

export const TOPOLOGY_URL = "/data/usmap/counties.topo.json";

async function fetchTopology(): Promise<CountyTopology> {
  const res = await fetch(TOPOLOGY_URL);
  if (!res.ok) throw new Error(`${TOPOLOGY_URL}: ${res.status} ${res.statusText}`);
  return (await res.json()) as CountyTopology;
}

let loader: () => Promise<CountyTopology> = fetchTopology;
let loading: Promise<BaseGeometry> | null = null;

/** Replaces where the topology comes from (tests); resets the cache. Null restores the fetch. */
export function setTopologyLoader(load: (() => Promise<CountyTopology>) | null): void {
  loader = load ?? fetchTopology;
  loading = null;
}

/** The decoded shapes, loaded once for every window. */
export function loadBaseGeometry(): Promise<BaseGeometry> {
  loading ??= loader().then(decodeTopology);
  return loading;
}

export type Loaded<T> =
  | { state: "loading" }
  | { state: "ready"; value: T }
  | { state: "error"; message: string };

export function useBaseGeometry(): Loaded<BaseGeometry> {
  const [s, set] = useState<Loaded<BaseGeometry>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    loadBaseGeometry().then(
      (value) => live && set({ state: "ready", value }),
      (e: unknown) => {
        loading = null;
        if (live) set({ state: "error", message: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return s;
}
