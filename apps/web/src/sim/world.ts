// Which starting world this page plays (1995-rework 3.2, 10): the 1995 world, or another of sim-data's
// worlds named by `?world=<id>`, where null stands for the 2020 world. One world per worker, so
// changing it means reloading.

import { DEFAULT_WORLD_ID, WORLD_2020_ID, WORLD_IDS } from "@tc20ff/sim-data";

/** The world `id` names, or null when it names none of them. */
export function knownWorld(id: string | null | undefined): string | null {
  return id !== null && id !== undefined && WORLD_IDS.includes(id) ? id : null;
}

/** This page's world, or null for the 2020 world, which the mock sim always plays (mock/worker.ts). */
export function selectedWorld(): string | null {
  const url = new URLSearchParams(globalThis.location?.search ?? "");
  const asked = url.get("world");
  if (url.get("mock") === "1" || asked === WORLD_2020_ID) return null;
  return knownWorld(asked) ?? DEFAULT_WORLD_ID;
}

/** Where a world's CSVs are served (apps/web/vite.config.ts), with the trailing slash. */
export function worldDataBase(world: string | null): string {
  return world === null ? "/data/design/" : `/data/worlds/${world}/`;
}
