// The news app's route grammar (pivot 8.2, 8.8; D1037 AppProps.route): the whole state that
// matters is the route string, so links, back/forward and a saved desktop all work.
//
//   (null) or "home"                  today's front pages across outlets
//   outlet/<id>                       an outlet's latest front page and archive
//   outlet/<id>/<YYYY-MM-DD>          its front page of that day (the `front_pages` slice)
//   article/<id>                      one article
//   latest[?outlet=<id>&kind=<ArticleKind>&followed=1&q=<text>]
//                                     the stream across outlets, filtered
//
// Pure functions only: `parseRoute` never throws (anything unreadable is the home) and
// `formatRoute(parseRoute(s))` is canonical.

import { ARTICLE_KIND_VALUES, type ArticleKind, type SimDate } from "@tc20ff/sim";

export interface LatestFilter {
  /** Only this outlet's articles. */
  outlet: number | null;
  /** Only this kind (the section: report, analysis, opinion, call, correction). */
  kind: ArticleKind | null;
  /** Only articles naming something the player follows. */
  followed: boolean;
  /** Headlines containing this text, case-insensitively; "" for no search. */
  q: string;
}

export type NewsRoute =
  | { kind: "home" }
  | { kind: "outlet"; id: number; date: SimDate | null }
  | { kind: "article"; id: number }
  | { kind: "latest"; filter: LatestFilter };

export const NO_FILTER: LatestFilter = { outlet: null, kind: null, followed: false, q: "" };

export const HOME: NewsRoute = { kind: "home" };

/** The route of an outlet page, on `date` or on its latest front page when null. */
export function outletRoute(id: number, date: SimDate | null = null): NewsRoute {
  return { kind: "outlet", id, date };
}

export function latestRoute(filter: Partial<LatestFilter> = {}): NewsRoute {
  return { kind: "latest", filter: { ...NO_FILTER, ...filter } };
}

/** "2020-11-04". */
export function formatIsoDate(d: SimDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** Reads "2020-11-04"; null for anything that is not a real calendar day. */
export function parseIsoDate(s: string): SimDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m === null) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day } as SimDate;
}

/** The day `delta` days from `d` (negative for earlier). */
export function addDays(d: SimDate, delta: number): SimDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + delta));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() } as SimDate;
}

function parseId(s: string | undefined): number | null {
  if (s === undefined || !/^\d+$/.test(s)) return null;
  return Number(s);
}

function parseFilter(query: string): LatestFilter {
  const f: LatestFilter = { ...NO_FILTER };
  for (const part of query.split("&")) {
    if (part === "") continue;
    const eq = part.indexOf("=");
    const key = eq < 0 ? part : part.slice(0, eq);
    let value = eq < 0 ? "" : part.slice(eq + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // A malformed escape: keep the text as written.
    }
    if (key === "outlet") f.outlet = parseId(value);
    else if (key === "kind")
      f.kind = (ARTICLE_KIND_VALUES as readonly string[]).includes(value) ? (value as ArticleKind) : null;
    else if (key === "followed") f.followed = value === "1";
    else if (key === "q") f.q = value;
  }
  return f;
}

/** Reads a route string; the home for null, "" and anything unreadable. */
export function parseRoute(route: string | null): NewsRoute {
  if (route === null || route === "" || route === "home") return HOME;
  const qi = route.indexOf("?");
  const path = qi < 0 ? route : route.slice(0, qi);
  const query = qi < 0 ? "" : route.slice(qi + 1);
  const seg = path.split("/");
  if (seg[0] === "outlet") {
    const id = parseId(seg[1]);
    if (id === null || seg.length > 3) return HOME;
    if (seg.length === 3) {
      const date = parseIsoDate(seg[2] ?? "");
      return date === null ? HOME : outletRoute(id, date);
    }
    return outletRoute(id);
  }
  if (seg[0] === "article" && seg.length === 2) {
    const id = parseId(seg[1]);
    return id === null ? HOME : { kind: "article", id };
  }
  if (seg[0] === "latest" && seg.length === 1) return { kind: "latest", filter: parseFilter(query) };
  return HOME;
}

/** The canonical route string of `r`; null for the home. */
export function formatRoute(r: NewsRoute): string | null {
  switch (r.kind) {
    case "home":
      return null;
    case "outlet":
      return r.date === null ? `outlet/${r.id}` : `outlet/${r.id}/${formatIsoDate(r.date)}`;
    case "article":
      return `article/${r.id}`;
    case "latest": {
      const q: string[] = [];
      if (r.filter.outlet !== null) q.push(`outlet=${r.filter.outlet}`);
      if (r.filter.kind !== null) q.push(`kind=${r.filter.kind}`);
      if (r.filter.followed) q.push("followed=1");
      if (r.filter.q !== "") q.push(`q=${encodeURIComponent(r.filter.q)}`);
      return q.length === 0 ? "latest" : `latest?${q.join("&")}`;
    }
  }
}

/** Two routes are the same place. */
export function sameRoute(a: NewsRoute, b: NewsRoute): boolean {
  return formatRoute(a) === formatRoute(b);
}
