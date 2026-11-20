// Which starting world this page plays (1995-rework 3.2, 10): the 1995 world, or another of sim-data's
// worlds named by `?world=<id>`. The mock sim plays the default world (mock/worker.ts; D1055). One
// world per worker, so changing it means reloading.

import { DEFAULT_WORLD_ID, WORLD_IDS } from "@tc20ff/sim-data";

/** The world `id` names, or null when it names none of them. */
export function knownWorld(id: string | null | undefined): string | null {
  return id !== null && id !== undefined && WORLD_IDS.includes(id) ? id : null;
}

/** This page's world: the default under the mock sim (mock/worker.ts), else `?world=` if known. */
export function selectedWorld(): string {
  const url = new URLSearchParams(globalThis.location?.search ?? "");
  if (url.get("mock") === "1") return DEFAULT_WORLD_ID;
  return knownWorld(url.get("world")) ?? DEFAULT_WORLD_ID;
}

/** Where a world's CSVs are served (apps/web/vite.config.ts), with the trailing slash. */
export function worldDataBase(world: string): string {
  return `/data/worlds/${world}/`;
}
