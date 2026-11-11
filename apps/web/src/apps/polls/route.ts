// The Polls app's route grammar (pivot 15.2): the whole state that matters is in one string, so a
// link, back/forward and a saved desktop reopen the same page.
//
//   (null)                      the national overview
//   race/<id>                   a race (its general, or its first primary when it has no general yet)
//   race/<id>/general           a race's general
//   race/<id>/primary-<n>       a race's n-th primary (`RaceRow.primaries[n]`, 0 up)
//   pollster/<id>               a polling firm
//   state/<id>                  the presidency in one state
//   races[?office=&state=&rating=&q=&sort=&dir=]   the table of every race
//
// Pure functions, no DOM: parseRoute and formatRoute round-trip for every route they accept.

import type { ElectedOffice } from "@tc20ff/sim";

/** Which vote of a race a page shows: its general, or the n-th party primary. */
export type StageKey = "general" | `primary-${number}`;

/** The columns the races table sorts by. */
export const RACE_SORT_KEYS = [
  "title",
  "office",
  "state",
  "status",
  "rating",
  "leader",
  "odds",
  "margin",
  "polls",
] as const;
export type RaceSortKey = (typeof RACE_SORT_KEYS)[number];

export const OFFICES: readonly ElectedOffice[] = ["President", "Senate", "House", "Governor"];

/** The races table's filters and sort. */
export interface RaceFilters {
  office: ElectedOffice | null;
  /** A `UsStateId`. */
  state: number | null;
  /** A rating slug (model.ts `ratingKey`). */
  rating: string | null;
  /** A text the race title must contain, any case. */
  q: string;
  sort: RaceSortKey;
  desc: boolean;
}

/** Closest first: the leader's odds, lowest first. */
export const DEFAULT_RACE_FILTERS: RaceFilters = {
  office: null,
  state: null,
  rating: null,
  q: "",
  sort: "odds",
  desc: false,
};

export type PollsRoute =
  | { kind: "home" }
  | { kind: "race"; id: number; stage: StageKey | null }
  | { kind: "pollster"; id: number }
  | { kind: "state"; id: number }
  | { kind: "races"; filters: RaceFilters }
  | { kind: "unknown"; route: string };

const ID = /^\d+$/;

function parseStage(s: string): StageKey | null {
  if (s === "general") return "general";
  const m = /^primary-(\d+)$/.exec(s);
  return m === null ? null : (`primary-${Number(m[1])}` as StageKey);
}

/** The party index of a primary stage key; null for the general. */
export function stagePrimary(stage: StageKey): number | null {
  return stage === "general" ? null : Number(stage.slice("primary-".length));
}

function parseFilters(query: string): RaceFilters {
  const p = new URLSearchParams(query);
  const f: RaceFilters = { ...DEFAULT_RACE_FILTERS };
  const office = p.get("office");
  if (office !== null && (OFFICES as readonly string[]).includes(office)) f.office = office as ElectedOffice;
  const state = p.get("state");
  if (state !== null && ID.test(state)) f.state = Number(state);
  const rating = p.get("rating");
  if (rating !== null && rating !== "") f.rating = rating;
  f.q = p.get("q") ?? "";
  const sort = p.get("sort");
  if (sort !== null && (RACE_SORT_KEYS as readonly string[]).includes(sort)) f.sort = sort as RaceSortKey;
  const dir = p.get("dir");
  if (dir === "desc") f.desc = true;
  else if (dir === "asc") f.desc = false;
  return f;
}

/** Reads a route string; null is the overview, and a string no page answers to is `unknown`. */
export function parseRoute(route: string | null): PollsRoute {
  if (route === null || route === "" || route === "home") return { kind: "home" };
  const q = route.indexOf("?");
  const path = q < 0 ? route : route.slice(0, q);
  const query = q < 0 ? "" : route.slice(q + 1);
  const parts = path.split("/");
  const [head, a, b] = parts;
  if (head === "races" && parts.length === 1) return { kind: "races", filters: parseFilters(query) };
  if (a !== undefined && ID.test(a)) {
    const id = Number(a);
    if (head === "race" && parts.length === 2) return { kind: "race", id, stage: null };
    if (head === "race" && parts.length === 3 && b !== undefined) {
      const stage = parseStage(b);
      if (stage !== null) return { kind: "race", id, stage };
    }
    if (head === "pollster" && parts.length === 2) return { kind: "pollster", id };
    if (head === "state" && parts.length === 2) return { kind: "state", id };
  }
  return { kind: "unknown", route };
}

/** The route string of a page; null for the overview. */
export function formatRoute(r: PollsRoute): string | null {
  switch (r.kind) {
    case "home":
      return null;
    case "race":
      return r.stage === null ? `race/${r.id}` : `race/${r.id}/${r.stage}`;
    case "pollster":
      return `pollster/${r.id}`;
    case "state":
      return `state/${r.id}`;
    case "unknown":
      return r.route;
    case "races": {
      const p = new URLSearchParams();
      const f = r.filters;
      const d = DEFAULT_RACE_FILTERS;
      if (f.office !== null) p.set("office", f.office);
      if (f.state !== null) p.set("state", String(f.state));
      if (f.rating !== null) p.set("rating", f.rating);
      if (f.q !== "") p.set("q", f.q);
      if (f.sort !== d.sort) p.set("sort", f.sort);
      if (f.sort !== d.sort || f.desc !== d.desc) p.set("dir", f.desc ? "desc" : "asc");
      const s = p.toString();
      return s === "" ? "races" : `races?${s}`;
    }
  }
}

/** The routes of the app's pages, for a link inside the app. */
export const raceRoute = (id: number, stage: StageKey | null = null): string =>
  formatRoute({ kind: "race", id, stage }) as string;
export const pollsterRoute = (id: number): string => `pollster/${id}`;
export const stateRoute = (id: number): string => `state/${id}`;
export const racesRoute = (filters: Partial<RaceFilters> = {}): string =>
  formatRoute({ kind: "races", filters: { ...DEFAULT_RACE_FILTERS, ...filters } }) as string;

/** Browser-style history of the routes visited in one window (the in-app back and forward). */
export interface RouteHistory {
  stack: (string | null)[];
  index: number;
}

export const newHistory = (route: string | null): RouteHistory => ({ stack: [route], index: 0 });

/** Visits `route`: drops any forward entries; a visit to the page already shown changes nothing. */
export function pushRoute(h: RouteHistory, route: string | null): RouteHistory {
  if (h.stack[h.index] === route) return h;
  const stack = [...h.stack.slice(0, h.index + 1), route];
  return { stack, index: stack.length - 1 };
}

export const canBack = (h: RouteHistory): boolean => h.index > 0;
export const canForward = (h: RouteHistory): boolean => h.index < h.stack.length - 1;
export const goBack = (h: RouteHistory): RouteHistory => (canBack(h) ? { ...h, index: h.index - 1 } : h);
export const goForward = (h: RouteHistory): RouteHistory =>
  canForward(h) ? { ...h, index: h.index + 1 } : h;
export const currentRoute = (h: RouteHistory): string | null => h.stack[h.index] ?? null;
