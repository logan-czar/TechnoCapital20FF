// The USA map's route (D1048): what the window shows, as a path, so links, back and forward and a
// restored desktop all land in the same place.
//
//   (home)                         the last presidential vote by county, nothing selected
//   state/<id>                     a state selected (`UsStateId`)
//   district/<id>                  a district selected (`districtRefId(state, number)`)
//   county/<fips>                  a county selected by its five-digit code; county/<index> (an
//                                  `EntityRef` of kind County) is read too
//   race/<id>/live                 live returns for a race (`RaceId`)
//   .../layer/<name>               another layer than the default
//
// Parts combine in that order: "race/12/live/county/19153", "district/1203/layer/districts".
// Anything unreadable is dropped, so a stale route opens the home view rather than an error.

/** The layers a county can be coloured by (./layers.ts). */
export const LAYER_IDS = ["president", "population", "turnout", "districts", "lean", "live"] as const;
export type LayerId = (typeof LAYER_IDS)[number];

/** The layer a route without one shows. */
export const DEFAULT_LAYER: LayerId = "president";

export type Selection =
  | { kind: "state"; id: number }
  | { kind: "district"; id: number }
  /** A five-digit FIPS code, or a county index written in decimal (an `EntityRef`'s id). */
  | { kind: "county"; key: string };

export interface MapRoute {
  layer: LayerId;
  /** The race whose returns the live layer shows; null for none chosen. */
  race: number | null;
  sel: Selection | null;
}

export const HOME: MapRoute = { layer: DEFAULT_LAYER, race: null, sel: null };

const isId = (s: string | undefined): s is string => s !== undefined && /^\d{1,9}$/.test(s);

/** Reads a route; null or anything unreadable is the home view. */
export function parseRoute(route: string | null): MapRoute {
  if (route === null || route === "") return HOME;
  const t = route.split("/");
  let layer: LayerId = DEFAULT_LAYER;
  let race: number | null = null;
  let sel: Selection | null = null;
  let i = 0;
  if (t[0] === "race" && isId(t[1]) && t[2] === "live") {
    race = Number(t[1]);
    layer = "live";
    i = 3;
  }
  const kind = t[i];
  const arg = t[i + 1];
  if ((kind === "state" || kind === "district") && isId(arg)) {
    sel = { kind, id: Number(arg) };
    i += 2;
  } else if (kind === "county" && isId(arg)) {
    sel = { kind: "county", key: arg };
    i += 2;
  }
  if (t[i] === "layer") {
    const name = t[i + 1];
    if ((LAYER_IDS as readonly string[]).includes(name ?? "") && race === null) layer = name as LayerId;
  }
  return { layer, race, sel };
}

/** Writes a route; the home view is null. */
export function formatRoute(r: MapRoute): string | null {
  const parts: string[] = [];
  if (r.race !== null) parts.push("race", String(r.race), "live");
  if (r.sel !== null) {
    parts.push(r.sel.kind, r.sel.kind === "county" ? r.sel.key : String(r.sel.id));
  }
  if (r.race === null && r.layer !== DEFAULT_LAYER) parts.push("layer", r.layer);
  return parts.length === 0 ? null : parts.join("/");
}

/** The county a selection's key names, given the counties' codes; -1 for none. */
export function countyOfKey(key: string, fips: readonly string[]): number {
  if (key.length === 5) return fips.indexOf(key);
  const i = Number(key);
  return Number.isInteger(i) && i >= 0 && i < fips.length ? i : -1;
}
