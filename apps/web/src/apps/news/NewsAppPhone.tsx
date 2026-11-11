// The news app on the phone (pivot 15.2): a compact front page and latest list at the phone's
// width. A tap on a story, an outlet or "all latest" opens the full app at that route.

import { useState } from "react";
import { openApp } from "../../links/nav.ts";
import type { AppProps } from "../../os/apps.ts";
import { useViewData } from "../../sim/hooks.ts";
import { formatDay, formatHour } from "../_shared/format.ts";
import { frontPageStories, indexFeed, latestFrontDate, outletsByKind } from "./model.ts";
import { Pane } from "./parts.tsx";
import { formatRoute, latestRoute, outletRoute } from "./route.ts";
import { useIsRead } from "./unread.ts";
import "./news.css";

const PHONE_LATEST = 30;
/** Ranked stories under an outlet's lead on the phone. */
const PHONE_STORIES = 2;

const open = (route: string | null) => openApp("news", route);

export default function NewsAppPhone(_props: AppProps) {
  const feed = useViewData("feed");
  const isRead = useIsRead();
  const [tab, setTab] = useState<"front" | "latest">("front");
  if (feed === undefined) {
    return (
      <div className="news news-phone" data-testid="app-root-news-phone">
        <Pane title="Opening the press room" testId="news-loading" />
      </div>
    );
  }
  const index = indexFeed(feed);
  const date = latestFrontDate(feed.front_pages);
  const story = (id: number, headline: string, lead = false) => (
    <button
      type="button"
      key={id}
      className={`news-story${lead ? " is-lead" : ""}${isRead(id) ? " is-read" : ""}`}
      data-testid={`phone-story-${id}`}
      onClick={() => open(`article/${id}`)}
    >
      {isRead(id) ? null : <span className="news-unread" role="img" aria-label="unread" />}
      <span className="news-story-text">{headline}</span>
    </button>
  );

  return (
    <div className="news news-phone" data-testid="app-root-news-phone">
      <header className="news-mast">
        <span className="news-name">KIOSK</span>
        <nav className="news-nav" aria-label="News">
          <button
            type="button"
            className={tab === "front" ? "on" : ""}
            data-testid="phone-tab-front"
            onClick={() => setTab("front")}
          >
            Front
          </button>
          <button
            type="button"
            className={tab === "latest" ? "on" : ""}
            data-testid="phone-tab-latest"
            onClick={() => setTab("latest")}
          >
            Latest
          </button>
        </nav>
      </header>
      <main className="news-main">
        {feed.outlets.length === 0 ? (
          <Pane title="No press yet" testId="news-empty" />
        ) : tab === "front" ? (
          <div data-testid="phone-front">
            <p className="news-dim">{date === null ? "Front pages" : `Front pages of ${formatDay(date)}`}</p>
            {outletsByKind(feed.outlets).flatMap((g) =>
              g.rows.map((o) => {
                const page = feed.front_pages.find((p) => p.outlet === o.id);
                const stories = page === undefined ? [] : frontPageStories(page, index.articles);
                const [lead, ...rest] = stories;
                return (
                  <section key={o.id} className="news-card" data-testid={`phone-front-${o.id}`}>
                    <button
                      type="button"
                      className="news-outlet-link"
                      onClick={() => open(formatRoute(outletRoute(o.id)))}
                    >
                      {o.name}
                    </button>
                    {lead === undefined ? (
                      <p className="news-empty">No front page yet.</p>
                    ) : (
                      story(lead.id, lead.headline, true)
                    )}
                    {rest.slice(0, PHONE_STORIES).map((a) => story(a.id, a.headline))}
                  </section>
                );
              }),
            )}
          </div>
        ) : (
          <div data-testid="phone-latest">
            <ul className="news-list">
              {feed.articles
                .slice(-PHONE_LATEST)
                .reverse()
                .map((a) => (
                  <li key={a.id}>
                    <span className="news-when">{formatHour(a.time)}</span>
                    <span className="news-dim">
                      {index.outlets.get(a.outlet)?.name ?? `Outlet ${a.outlet}`}
                    </span>
                    {story(a.id, a.headline)}
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="news-more"
              data-testid="phone-all-latest"
              onClick={() => open(formatRoute(latestRoute()))}
            >
              All latest stories
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
