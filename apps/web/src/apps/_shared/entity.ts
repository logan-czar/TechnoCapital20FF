// Where a thing the player reads opens (pivot 15.3; D1037): each `EntityRef` kind has one home app,
// and the route inside it is `entityRoute(ref)` ("person/12", "race/3"). Every app links through
// here, so a person named in an article, a post or a notification opens the same place.
//
// Shared by the M2 app lanes and frozen after the M2 contracts change: a lane that needs another
// home for a kind asks for it in its report.

import type { EntityKind, EntityRef } from "@tc20ff/sim";
import { openApp } from "../../links/nav.ts";
import { entityRoute } from "../../os/apps.ts";

/**
 * The app each kind opens in. The browser is the encyclopedia of public facts (pivot 15.3); a race
 * and a pollster open in the polls app, a bill in the records, an outlet in the news, a handle in
 * the social feed. A contract opens in the betting exchange, which arrives in M5: until then
 * `openEntity` finds no such app and does nothing.
 */
export const ENTITY_APP: Readonly<Record<EntityKind, string>> = {
  Person: "browser",
  Race: "polls",
  Bill: "records",
  Company: "browser",
  Industry: "browser",
  State: "browser",
  County: "browser",
  District: "browser",
  Outlet: "news",
  Pollster: "polls",
  Handle: "social",
  Contract: "exchange",
};

/** The app and route `ref` opens at. */
export function entityTarget(ref: EntityRef): { app: string; route: string } {
  return { app: ENTITY_APP[ref.kind], route: entityRoute(ref) };
}

/** Opens `ref` in its home app; false when no desktop is mounted (links/nav.ts `openApp`). */
export function openEntity(ref: EntityRef): boolean {
  const t = entityTarget(ref);
  return openApp(t.app, t.route);
}

/** Reads a route `entityRoute` wrote ("person/12") back into a ref; null for any other route. */
export function parseEntityRoute(route: string | null): EntityRef | null {
  if (route === null) return null;
  const m = /^([a-z]+)\/(\d+)$/.exec(route);
  if (m === null) return null;
  const kind = (Object.keys(ENTITY_APP) as EntityKind[]).find((k) => k.toLowerCase() === m[1]);
  if (kind === undefined) return null;
  return { kind, id: Number(m[2]) };
}
