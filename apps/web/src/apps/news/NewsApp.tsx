// The news app, "Kiosk" (pivot 8.2, 8.7, 8.8): the in-world press. It reads v_feed: every outlet's
// front page, the stream of articles, one article at a time. Hidden values (an outlet's slant and
// reliability) show only when the view carries them. The route (./route.ts) is the app's whole
// state; the back and forward buttons walk this window's own history.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppProps } from "../../os/apps.ts";
import { useViewData } from "../../sim/hooks.ts";
import ArticleView from "./ArticleView.tsx";
import HomeView from "./HomeView.tsx";
import LatestView from "./LatestView.tsx";
import { indexFeed } from "./model.ts";
import OutletView from "./OutletView.tsx";
import { NavCtx, Pane } from "./parts.tsx";
import { formatRoute, HOME, latestRoute, type NewsRoute, parseRoute, sameRoute } from "./route.ts";
import "./news.css";

interface History {
  stack: NewsRoute[];
  at: number;
}

export default function NewsApp({ route, onRoute, setTitle }: AppProps) {
  const feed = useViewData("feed");
  const [hist, setHist] = useState<History>(() => ({ stack: [parseRoute(route)], at: 0 }));
  const current = hist.stack[hist.at] ?? HOME;

  // A route handed in from outside (a link opened here) is a new entry.
  const seen = useRef(formatRoute(current));
  useEffect(() => {
    if (route === seen.current) return;
    const next = parseRoute(route);
    seen.current = formatRoute(next);
    setHist((h) =>
      sameRoute(h.stack[h.at] ?? HOME, next)
        ? h
        : { stack: [...h.stack.slice(0, h.at + 1), next], at: h.at + 1 },
    );
  }, [route]);

  const move = useCallback(
    (next: History) => {
      const r = next.stack[next.at] ?? HOME;
      seen.current = formatRoute(r);
      setHist(next);
      onRoute(seen.current);
    },
    [onRoute],
  );
  const nav = useMemo(
    () => ({
      go(to: NewsRoute, replace = false) {
        if (sameRoute(to, current)) return;
        move(
          replace
            ? { stack: hist.stack.map((r, i) => (i === hist.at ? to : r)), at: hist.at }
            : { stack: [...hist.stack.slice(0, hist.at + 1), to], at: hist.at + 1 },
        );
      },
    }),
    [current, hist, move],
  );

  const index = useMemo(() => (feed === undefined ? null : indexFeed(feed)), [feed]);

  // The window's title follows the page.
  const title = useMemo(() => {
    if (index === null) return null;
    switch (current.kind) {
      case "home":
        return null;
      case "outlet":
        return `${index.outlets.get(current.id)?.name ?? "Outlet"} - News`;
      case "article":
        return `${index.articles.get(current.id)?.headline ?? "Article"} - News`;
      case "latest":
        return "Latest - News";
    }
  }, [current, index]);
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);

  const [draft, setDraft] = useState("");
  const tab = current.kind === "latest" ? "latest" : current.kind === "home" ? "home" : "";

  return (
    <NavCtx.Provider value={nav}>
      <div className="news" data-testid="app-root-news">
        <header className="news-mast">
          <div className="news-brand">
            <span className="news-name">KIOSK</span>
            <span className="news-tag">every front page, every morning</span>
          </div>
          <nav className="news-nav" aria-label="News">
            <button
              type="button"
              data-testid="news-back"
              disabled={hist.at === 0}
              onClick={() => move({ ...hist, at: hist.at - 1 })}
              aria-label="Back"
            >
              Back
            </button>
            <button
              type="button"
              data-testid="news-forward"
              disabled={hist.at >= hist.stack.length - 1}
              onClick={() => move({ ...hist, at: hist.at + 1 })}
              aria-label="Forward"
            >
              Forward
            </button>
            <button
              type="button"
              data-testid="news-tab-home"
              className={tab === "home" ? "on" : ""}
              aria-current={tab === "home" ? "page" : undefined}
              onClick={() => nav.go(HOME)}
            >
              Front pages
            </button>
            <button
              type="button"
              data-testid="news-tab-latest"
              className={tab === "latest" ? "on" : ""}
              aria-current={tab === "latest" ? "page" : undefined}
              onClick={() => nav.go(latestRoute())}
            >
              Latest
            </button>
          </nav>
          <form
            className="news-quick"
            onSubmit={(e) => {
              e.preventDefault();
              nav.go(latestRoute({ q: draft.trim() }));
            }}
          >
            <input
              type="search"
              data-testid="news-quick-search"
              aria-label="Search headlines"
              placeholder="Search headlines"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </form>
        </header>
        <main className="news-main">
          {feed === undefined || index === null ? (
            <Pane title="Opening the press room" testId="news-loading">
              Waiting for the first edition.
            </Pane>
          ) : current.kind === "home" ? (
            <HomeView feed={feed} index={index} />
          ) : current.kind === "outlet" ? (
            <OutletView id={current.id} date={current.date} feed={feed} index={index} />
          ) : current.kind === "article" ? (
            <ArticleView id={current.id} feed={feed} index={index} />
          ) : (
            <LatestView filter={current.filter} feed={feed} index={index} />
          )}
        </main>
      </div>
    </NavCtx.Provider>
  );
}
