// The search box over every entity the encyclopedia covers (pivot 1.2 "look things up", 15.3;
// D1047): people, states, counties, districts, races, bills, outlets, polling firms, and the USA's
// companies and industries. The command bar's fuse index is built for the debug workspace's page
// kinds (links/names.ts), has no person, state or race and cannot be reached without a PageRef, so
// this is a small index of its own, from the views. Plain scoring, no dependency: an exact name,
// then a name that starts with the text, then a word that does, then any substring, then the
// detail line; ties go to the shorter name and then the lower id (CLAUDE.md "ties to the lower id").

import { districtRefId } from "@tc20ff/sim";
import type { ViewsData } from "../../pages/views.ts";
import type { Article } from "./articles.ts";
import { type ArticleKind, articleRoute } from "./route.ts";
import { type Coverage, coverageOf } from "./sanitize.ts";

/** What a search entry names. */
export type EntryKind = ArticleKind | "company" | "industry";

export interface SearchEntry {
  kind: EntryKind;
  id: number;
  name: string;
  /** A short line shown beside the name. */
  detail: string;
  /** Other names that match (a ticker). */
  aliases: string[];
  /** The route it opens in this app. */
  route: string;
}

export const KIND_LABEL: Readonly<Record<EntryKind, string>> = {
  person: "Person",
  race: "Election",
  bill: "Bill",
  state: "State",
  county: "County",
  district: "District",
  outlet: "Outlet",
  pollster: "Polling firm",
  company: "Company",
  industry: "Industry",
};

/** The views the index reads. */
export const SEARCH_VIEWS = [
  "people",
  "races",
  "records",
  "usmap_layers",
  "districts",
  "feed",
  "polls",
  "company_rows",
  "industry_rows",
  "places",
  "countries",
] as const;

/** Most results a search lists. */
export const SEARCH_LIMIT = 50;
/** Most suggestions the box drops down. */
export const SUGGEST_LIMIT = 8;

export function buildSearchIndex(v: ViewsData, cov: Coverage = coverageOf(v)): SearchEntry[] {
  const out: SearchEntry[] = [];
  const add = (kind: EntryKind, id: number, name: string, detail: string, aliases: string[] = []) =>
    out.push({ kind, id, name, detail, aliases, route: `${kind}/${id}` });
  const states = v.usmap_layers?.states ?? [];
  const stateName = (id: number) => states.find((s) => s.id === id)?.name ?? "";
  for (const s of states) add("state", s.id, s.name, `State, ${s.house_seats} House seats`);
  for (const p of v.people?.people ?? [])
    add(
      "person",
      p.id,
      p.name,
      [p.office ?? p.status, stateName(p.home_state)].filter((x) => x !== "").join(", "),
    );
  for (const r of v.races?.races ?? []) add("race", r.id, r.title, `${r.office} election`);
  for (const b of v.records?.bills ?? []) add("bill", b.id, b.title, `Bill, ${b.subject}`);
  for (const o of v.feed?.outlets ?? []) add("outlet", o.id, o.name, "News outlet");
  for (const p of v.polls?.pollsters ?? []) add("pollster", p.id, p.name, "Polling firm");
  for (const d of v.districts?.districts ?? [])
    add("district", districtRefId(d.state, d.number), `${stateName(d.state)} ${d.number}`, "House district");
  const c = v.usmap_layers?.counties;
  if (c !== undefined) {
    for (let i = 0; i < c.name.length; i++)
      add("county", i, c.name[i] as string, `County, ${stateName(c.state[i] as number)}`);
  }
  for (const r of v.company_rows?.rows ?? []) {
    if (r.status === "Removed" || cov.foreignCompanies.has(r.id)) continue;
    add(
      "company",
      r.id,
      r.name,
      r.public && r.ticker !== "" ? `Company, ${r.ticker}` : "Company",
      r.ticker === "" ? [] : [r.ticker],
    );
  }
  for (const i of v.industry_rows?.rows ?? []) add("industry", i.id, i.name, `Industry, ${i.sector}`);
  return out;
}

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The score of `name` for the query text (lower is better; null for no match). */
function score(q: string, name: string, extra: readonly string[]): number | null {
  const n = norm(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s,.-]+/).some((w) => w.startsWith(q))) return 2;
  if (n.includes(q)) return 3;
  if (extra.some((a) => norm(a) === q)) return 1;
  if (extra.some((a) => norm(a).includes(q))) return 4;
  return null;
}

/** The entries matching `text`, best first, at most `limit`. */
export function searchEntries(
  index: readonly SearchEntry[],
  text: string,
  limit = SEARCH_LIMIT,
): SearchEntry[] {
  const q = norm(text);
  if (q === "") return [];
  const hits: { e: SearchEntry; s: number }[] = [];
  for (const e of index) {
    let s = score(q, e.name, e.aliases);
    if (s === null && norm(e.detail).includes(q)) s = 5;
    if (s !== null) hits.push({ e, s });
  }
  hits.sort(
    (a, b) =>
      a.s - b.s ||
      a.e.name.length - b.e.name.length ||
      a.e.id - b.e.id ||
      (a.e.kind < b.e.kind ? -1 : a.e.kind > b.e.kind ? 1 : 0),
  );
  return hits.slice(0, limit).map((h) => h.e);
}

/** The route of an entry. */
export const entryRoute = (e: SearchEntry): string =>
  e.kind === "company" || e.kind === "industry" ? `${e.kind}/${e.id}` : articleRoute(e.kind, e.id);

/** The search results page for `q` (the route `search/<q>`). */
export function searchArticle(q: string, index: readonly SearchEntry[]): Article {
  const hits = searchEntries(index, q);
  return {
    route: q === "" ? "search" : `search/${q}`,
    title: q === "" ? "Search" : `Search: ${q}`,
    kind: "Search",
    lead: [
      q === ""
        ? "Type a name: a person, a state, an election, a bill, a company."
        : hits.length === 0
          ? `Nothing here matches "${q}".`
          : `${hits.length === SEARCH_LIMIT ? `The first ${SEARCH_LIMIT}` : hits.length} ${hits.length === 1 ? "match" : "matches"}.`,
    ],
    facts: [],
    sections:
      hits.length === 0
        ? []
        : [
            {
              id: "results",
              title: "Results",
              blocks: [
                {
                  k: "table",
                  id: "search.results",
                  columns: ["Name", "Kind", "About"],
                  rows: hits.map((e) => [
                    { text: e.name, app: "browser", route: entryRoute(e) },
                    KIND_LABEL[e.kind],
                    e.detail,
                  ]),
                },
              ],
            },
          ],
    elsewhere: [],
  };
}
