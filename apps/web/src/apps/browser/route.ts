// The browser's route grammar (pivot 15.3, 15.2; D1047): the app's whole state that matters is its
// route string, so a link, back and forward and a saved desktop all reach the same page. The
// address bar shows it as `orr://browser/<route>` (os/url.ts).
//
//   (null)                 the encyclopedia's home
//   search/<text>          a search over every entity
//   people | states | races | bills | outlets | pollsters
//                          an index of one kind of article
//   person/12  race/3  bill/7  state/12  county/44  district/1202  outlet/2  pollster/1
//                          an encyclopedia article (the `entityRoute` of the thing it is about)
//   company/5  industry/9  exchange/0  recap/2020-Q3
//   companies | industries | exchanges | world-history
//                          a page of the pages/ framework, drawn through DocView (pageKey's form)
//   anything else          a clean "no article" page that keeps the route it was asked for
//
// `entityRoute` writes "person/12" and the ENTITY_APP map sends every such route of a kind it names
// here, so a route this file cannot read still opens a page.

import { type PageRef, pageFromKey, pageKey } from "../../pages/ref.ts";

/** The kinds that have an article written by this app (./articles.ts). */
export const ARTICLE_KINDS = [
  "person",
  "race",
  "bill",
  "state",
  "county",
  "district",
  "outlet",
  "pollster",
] as const;
export type ArticleKind = (typeof ARTICLE_KINDS)[number];

/** The index pages, one per article kind that has many. */
export const INDEX_KINDS = ["people", "states", "races", "bills", "outlets", "pollsters"] as const;
export type IndexKind = (typeof INDEX_KINDS)[number];

/** Which article kind an index lists. */
export const INDEX_OF: Readonly<Record<IndexKind, ArticleKind>> = {
  people: "person",
  states: "state",
  races: "race",
  bills: "bill",
  outlets: "outlet",
  pollsters: "pollster",
};

/** The pages/ kinds this app draws: public, and meaningful in a game that is only the USA. */
export const FRAMEWORK_KINDS = [
  "company",
  "industry",
  "exchange",
  "recap",
  "companies",
  "industries",
  "exchanges",
  "world-history",
] as const satisfies readonly PageRef["kind"][];
export type FrameworkKind = (typeof FRAMEWORK_KINDS)[number];

export type BrowserRoute =
  | { kind: "home" }
  | { kind: "search"; q: string }
  | { kind: "index"; list: IndexKind }
  | { kind: "article"; article: ArticleKind; id: number }
  | { kind: "page"; page: PageRef }
  /** A route no page answers to: shown as "no article yet", with the route kept (D1047). */
  | { kind: "missing"; route: string };

export const HOME: BrowserRoute = { kind: "home" };

const isArticleKind = (s: string): s is ArticleKind => (ARTICLE_KINDS as readonly string[]).includes(s);
const isIndexKind = (s: string): s is IndexKind => (INDEX_KINDS as readonly string[]).includes(s);
const isFrameworkKind = (s: string): s is FrameworkKind => (FRAMEWORK_KINDS as readonly string[]).includes(s);

/** A whole non-negative number written in digits only. */
function parseId(s: string | undefined): number | null {
  if (s === undefined || !/^\d{1,9}$/.test(s)) return null;
  return Number(s);
}

/** The route text of `r` the window keeps; null for the home page. */
export function formatRoute(r: BrowserRoute): string | null {
  switch (r.kind) {
    case "home":
      return null;
    case "search":
      return r.q === "" ? "search" : `search/${r.q}`;
    case "index":
      return r.list;
    case "article":
      return `${r.article}/${r.id}`;
    case "page":
      return pageKey(r.page);
    case "missing":
      return r.route;
  }
}

/**
 * The route a window's route text names. Total: a text that names nothing here is a `missing`
 * route, so an entity link, a typed address or a stale saved desktop always lands on a page.
 */
export function parseRoute(text: string | null): BrowserRoute {
  if (text === null) return HOME;
  const route = text.trim();
  if (route === "") return HOME;
  const slash = route.indexOf("/");
  const head = slash < 0 ? route : route.slice(0, slash);
  const tail = slash < 0 ? undefined : route.slice(slash + 1);
  if (head === "search") return { kind: "search", q: tail ?? "" };
  if (tail === undefined && isIndexKind(head)) return { kind: "index", list: head };
  if (isArticleKind(head)) {
    const id = parseId(tail);
    if (id !== null) return { kind: "article", article: head, id };
  }
  if (isFrameworkKind(head)) {
    const page = pageFromKey(route);
    if (page !== null && page.kind === head) return { kind: "page", page };
  }
  return { kind: "missing", route };
}

/** The route text `parseRoute` reads back to `r` (null for home): the canonical spelling of `text`. */
export function canonicalRoute(text: string | null): string | null {
  return formatRoute(parseRoute(text));
}

/** The route of an article of `article` kind. */
export function articleRoute(article: ArticleKind, id: number): string {
  return `${article}/${id}`;
}

/**
 * The route a pages/ page link opens here, or null for a page this app does not draw: a country,
 * a zone, a province, the world map, a headline, a startup event, the politics proof of concept
 * (D1047). The page links of the old pages go through this.
 */
export function routeOfPage(page: PageRef): string | null {
  return isFrameworkKind(page.kind) ? pageKey(page) : null;
}

/** True when `a` and `b` name the same page. */
export function sameRoute(a: string | null, b: string | null): boolean {
  return canonicalRoute(a) === canonicalRoute(b);
}
