// What the news app derives from v_feed (pivot 8.2, 8.8): lookups, the latest stream's filters,
// related stories and a front page's resolved stories. Pure functions over the view's rows; nothing
// here reads hidden state or guesses an outlet's slant (pivot 8.1).

import type {
  Article,
  ArticleKind,
  EntityRef,
  FeedView,
  FrontPage,
  OutletKind,
  OutletRow,
  SimDate,
} from "@tc20ff/sim";
import { dateEq } from "@tc20ff/sim";
import type { LatestFilter } from "./route.ts";

/** Articles the latest stream shows at once; "older" adds a page. */
export const PAGE_SIZE = 100;
/** Stories offered under "more on this story". */
export const RELATED_LIMIT = 6;
/** Ranked stories shown on a front-page card before the outlet page. */
export const CARD_STORIES = 5;

export const KIND_LABEL: Readonly<Record<ArticleKind, string>> = {
  Report: "Report",
  Analysis: "Analysis",
  Opinion: "Opinion",
  Call: "Race call",
  Correction: "Correction",
};

export const OUTLET_KIND_LABEL: Readonly<Record<OutletKind, string>> = {
  Wire: "Wire",
  National: "National",
  Regional: "Regional",
};

/** The feed indexed by id. Articles are in id order, oldest first. */
export interface FeedIndex {
  outlets: Map<number, OutletRow>;
  articles: Map<number, Article>;
}

export function indexFeed(feed: FeedView): FeedIndex {
  const outlets = new Map<number, OutletRow>();
  for (const o of feed.outlets) outlets.set(o.id, o);
  const articles = new Map<number, Article>();
  for (const a of feed.articles) articles.set(a.id, a);
  return { outlets, articles };
}

/** Wire first, then nationals, then regionals; each in outlet id order. */
export function outletsByKind(outlets: readonly OutletRow[]): { kind: OutletKind; rows: OutletRow[] }[] {
  const order: OutletKind[] = ["Wire", "National", "Regional"];
  return order
    .map((kind) => ({ kind, rows: outlets.filter((o) => o.kind === kind) }))
    .filter((g) => g.rows.length > 0);
}

/** A front page's stories that the feed holds, the lead first. */
export function frontPageStories(page: FrontPage, articles: ReadonlyMap<number, Article>): Article[] {
  const out: Article[] = [];
  for (const id of page.articles) {
    const a = articles.get(id);
    if (a !== undefined) out.push(a);
  }
  return out;
}

/** The latest day any outlet's front page is of, or null before the first front page. */
export function latestFrontDate(pages: readonly FrontPage[]): SimDate | null {
  let best: SimDate | null = null;
  for (const p of pages) {
    if (
      best === null ||
      p.date.year * 10000 + p.date.month * 100 + p.date.day > best.year * 10000 + best.month * 100 + best.day
    ) {
      best = p.date;
    }
  }
  return best;
}

/** The front pages dated `date`, from a list of them. */
export function pagesOn(pages: readonly FrontPage[], date: SimDate): FrontPage[] {
  return pages.filter((p) => dateEq(p.date, date));
}

/** True when `a` names something in `follows` (an entity the player follows), or is by a followed outlet. */
export function isFollowed(a: Article, follows: readonly EntityRef[]): boolean {
  return follows.some(
    (f) =>
      (f.kind === "Outlet" && f.id === a.outlet) || a.refs.some((r) => r.kind === f.kind && r.id === f.id),
  );
}

/** Articles matching `filter`, newest first. `follows` is what the player follows. */
export function filterArticles(
  articles: readonly Article[],
  filter: LatestFilter,
  follows: readonly EntityRef[],
): Article[] {
  const needle = filter.q.trim().toLowerCase();
  const out: Article[] = [];
  for (let i = articles.length - 1; i >= 0; i--) {
    const a = articles[i];
    if (a === undefined) continue;
    if (filter.outlet !== null && a.outlet !== filter.outlet) continue;
    if (filter.kind !== null && a.kind !== filter.kind) continue;
    if (filter.followed && !isFollowed(a, follows)) continue;
    if (needle !== "" && !a.headline.toLowerCase().includes(needle)) continue;
    out.push(a);
  }
  return out;
}

/** One outlet's articles, newest first. */
export function outletArchive(articles: readonly Article[], outlet: number): Article[] {
  return filterArticles(articles, { outlet, kind: null, followed: false, q: "" }, []);
}

const sameRef = (a: EntityRef, b: EntityRef) => a.kind === b.kind && a.id === b.id;

/**
 * Other stories on the same subject (pivot 8.8): those sharing refs with `a`, the most shared first,
 * then the newest. An outlet or a state shared by two articles says little about the story, so
 * those two kinds do not count; a correction chain is linked separately (`correctionsOf`).
 */
export function relatedStories(a: Article, articles: readonly Article[], limit = RELATED_LIMIT): Article[] {
  const mine = a.refs.filter((r) => r.kind !== "Outlet" && r.kind !== "State");
  if (mine.length === 0) return [];
  const scored: { article: Article; shared: number }[] = [];
  for (const b of articles) {
    if (b.id === a.id) continue;
    let shared = 0;
    for (const r of mine) if (b.refs.some((x) => sameRef(x, r))) shared++;
    if (shared > 0) scored.push({ article: b, shared });
  }
  scored.sort((x, y) => y.shared - x.shared || y.article.id - x.article.id);
  return scored.slice(0, limit).map((s) => s.article);
}

/** The corrections and retractions that name `id` as the article they correct, oldest first. */
export function correctionsOf(id: number, articles: readonly Article[]): Article[] {
  return articles.filter(
    (b) => b.kind === "Correction" && b.source?.kind === "Article" && b.source.id === id,
  );
}

/** The body's paragraphs (blank-line separated). */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

/** Marks the note an outlet appends to a corrected article's rendered text. */
const CORRECTION_MARK = "Correction:";

/**
 * A corrected article's body is the original text followed by the outlet's note ("... Correction:
 * ..."): the two parts, the note null when the body carries none.
 */
export function splitCorrection(body: string): { text: string; note: string | null } {
  const at = body.indexOf(CORRECTION_MARK);
  if (at < 0) return { text: body, note: null };
  return { text: body.slice(0, at).trim(), note: body.slice(at + CORRECTION_MARK.length).trim() };
}

/**
 * The standfirst: the first sentence of the first paragraph, when the text goes on past it. The
 * view carries a headline and a body only, so the dek is read from the body, never invented.
 */
export function dekOf(text: string): string | null {
  const first = paragraphs(text)[0];
  if (first === undefined) return null;
  const m = /^(.+?[.!?])(\s|$)/.exec(first);
  if (m === null || m[1] === undefined) return null;
  return m[1].length < text.trim().length ? m[1] : null;
}

/** "Continental Wire", or "Ohio Courier (regional)": the outlet as a byline. */
export function outletLabel(o: OutletRow | undefined, id: number): string {
  return o === undefined ? `Outlet ${id}` : o.name;
}
