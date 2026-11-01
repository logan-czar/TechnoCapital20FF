// Which starting world this page plays (1995-rework 3.2): `?world=<id>` in the URL, one of sim-data's
// WORLD_IDS, or null for the 2020 world. One world per worker, so changing it means reloading.

import { WORLD_IDS } from "@tc20ff/sim-data";

/** The world `id` names, or null when it names none of them. */
export function knownWorld(id: string | null | undefined): string | null {
  return id !== null && id !== undefined && WORLD_IDS.includes(id) ? id : null;
}

/** The world in this page's URL, or null for the 2020 world. */
export function selectedWorld(): string | null {
  return knownWorld(new URLSearchParams(globalThis.location?.search ?? "").get("world"));
}

/** Where a world's CSVs are served (apps/web/vite.config.ts), with the trailing slash. */
export function worldDataBase(world: string | null): string {
  return world === null ? "/data/design/" : `/data/worlds/${world}/`;
}
