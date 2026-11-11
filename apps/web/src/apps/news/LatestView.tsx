// The latest stream (pivot 8.2): every outlet's articles, newest first, filtered by outlet, section
// (kind), what the player follows and a search over the headlines loaded. The filters live in the
// route (latest?outlet=3&kind=Report&followed=1&q=...), so the stream can be linked and restored.

import { ARTICLE_KIND_VALUES, type ArticleKind, type FeedView } from "@tc20ff/sim";
import { useEffect, useState } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { type FeedIndex, filterArticles, KIND_LABEL, PAGE_SIZE } from "./model.ts";
import { OutletTag, Pane, SectionTag, StoryLink, useNewsNav, When } from "./parts.tsx";
import { type LatestFilter, latestRoute, NO_FILTER } from "./route.ts";
import { useIsRead } from "./unread.ts";

const NO_FOLLOWS: never[] = [];

export default function LatestView({
  filter,
  feed,
  index,
}: {
  filter: LatestFilter;
  feed: FeedView;
  index: FeedIndex;
}) {
  const nav = useNewsNav();
  // What the player follows comes from the account view, read only on this page.
  const account = useViewData("account");
  const follows = account?.follows ?? NO_FOLLOWS;
  const isRead = useIsRead();
  const [shown, setShown] = useState(PAGE_SIZE);
  // A change of filter starts again at the newest page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the filter's parts are the trigger
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [filter.outlet, filter.kind, filter.followed, filter.q]);
  const set = (patch: Partial<LatestFilter>) => nav.go(latestRoute({ ...filter, ...patch }), true);
  const rows = filterArticles(feed.articles, filter, follows);
  const unread = rows.reduce((n, a) => (isRead(a.id) ? n : n + 1), 0);
  const filtered = filter.outlet !== null || filter.kind !== null || filter.followed || filter.q !== "";

  return (
    <div className="news-latest" data-testid="news-latest">
      <form className="news-filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter the stream">
        <label className="news-search">
          <span className="news-dim">Search headlines</span>
          <input
            type="search"
            data-testid="latest-search"
            value={filter.q}
            placeholder="Search headlines"
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
        <label>
          <span className="news-dim">Outlet</span>
          <select
            data-testid="latest-outlet"
            value={filter.outlet === null ? "" : String(filter.outlet)}
            onChange={(e) => set({ outlet: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">All outlets</option>
            {feed.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="news-dim">Section</span>
          <select
            data-testid="latest-kind"
            value={filter.kind ?? ""}
            onChange={(e) => set({ kind: e.target.value === "" ? null : (e.target.value as ArticleKind) })}
          >
            <option value="">All sections</option>
            {ARTICLE_KIND_VALUES.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="news-check">
          <input
            type="checkbox"
            data-testid="latest-followed"
            checked={filter.followed}
            onChange={(e) => set({ followed: e.target.checked })}
          />
          <span>Followed only</span>
        </label>
        {filtered ? (
          <button
            type="button"
            data-testid="latest-clear"
            onClick={() => nav.go(latestRoute(NO_FILTER), true)}
          >
            Clear
          </button>
        ) : null}
      </form>
      <p className="news-count" data-testid="latest-count">
        {rows.length} {rows.length === 1 ? "story" : "stories"}
        {unread > 0 ? `, ${unread} unread` : ""}
        {filter.followed && follows.length === 0 ? " (you follow nothing yet)" : ""}
      </p>
      {rows.length === 0 ? (
        <Pane title={filtered ? "Nothing matches" : "No stories yet"} testId="latest-empty">
          {filtered ? "Loosen a filter or clear the search." : "No outlet has published."}
        </Pane>
      ) : (
        <ul className="news-list" data-testid="latest-list">
          {rows.slice(0, shown).map((a) => (
            <li key={a.id} data-testid={`latest-row-${a.id}`}>
              <When article={a} />
              <OutletTag outlet={index.outlets.get(a.outlet)} id={a.outlet} kind={false} />
              <SectionTag article={a} />
              <StoryLink article={a} />
            </li>
          ))}
        </ul>
      )}
      {rows.length > shown ? (
        <button
          type="button"
          className="news-more"
          data-testid="latest-older"
          onClick={() => setShown(shown + PAGE_SIZE)}
        >
          Older ({rows.length - shown} more)
        </button>
      ) : null}
    </div>
  );
}
