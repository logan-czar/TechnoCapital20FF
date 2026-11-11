// The browser's window (pivot 15.3, 1.2; D1047): an in-world web browser whose home site is the
// Almanac, an encyclopedia of public facts. A toolbar (back, forward, home), an address bar that
// shows and accepts the fake address `orr://browser/<route>` (os/url.ts), a search box over every
// entity, and the page: an article of this app (articles.ts) or a page of the pages/ framework
// (FrameworkPage.tsx). One page at a time with a history (history.ts); tabs are not built.
//
// The route is the app's state (route.ts): the window keeps it, so a saved desktop and a link from
// another app ("person/12") land on the same page. A route set from outside is pushed on the
// history like a click.

import "./browser.css";
import type { ViewName } from "@tc20ff/sim";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openApp } from "../../links/nav.ts";
import type { AppProps } from "../../os/apps.ts";
import { formatUrl, parseUrl } from "../../os/url.ts";
import { usePageViews, type ViewsData } from "../../pages/views.ts";
import { ArticleView, type Go } from "./ArticleView.tsx";
import {
  ARTICLE_VIEWS,
  type Article,
  buildArticle,
  HOME_VIEWS,
  homeArticle,
  INDEX_VIEWS,
  indexArticle,
  noArticle,
} from "./articles.ts";
import { FrameworkPage } from "./FrameworkPage.tsx";
import {
  canBack,
  canForward,
  historyBack,
  historyCurrent,
  historyForward,
  historyNew,
  historyPush,
} from "./history.ts";
import { type BrowserRoute, formatRoute, parseRoute } from "./route.ts";
import { coverageOf } from "./sanitize.ts";
import {
  buildSearchIndex,
  KIND_LABEL,
  SEARCH_VIEWS,
  type SearchEntry,
  SUGGEST_LIMIT,
  searchArticle,
  searchEntries,
} from "./search.ts";

/** The browser's name on its window title: "Ohio - Almanac". */
export const SITE_NAME = "Almanac";

/** The text the address bar shows for a route. */
export const addressOf = (route: string | null): string => formatUrl({ app: "browser", route });

/**
 * A page of this app that reads `names` and builds an article from them. `at` is the page's
 * identity: `build` may be a new function each render, it is read when the views or `at` change.
 */
function ArticlePage({
  names,
  build,
  at,
  go,
  onTitle,
}: {
  names: readonly ViewName[];
  build: (v: ViewsData) => Article;
  at: string;
  go: Go;
  onTitle: (title: string | null) => void;
}) {
  const v = usePageViews(names);
  const buildRef = useRef(build);
  buildRef.current = build;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `at` stands for `build`
  const article = useMemo(() => buildRef.current(v), [v, at]);
  const title = article.route === null ? null : article.title;
  useEffect(() => {
    onTitle(title);
  }, [title, onTitle]);
  return <ArticleView article={article} go={go} />;
}

function SearchPage({ q, go, onTitle }: { q: string; go: Go; onTitle: (title: string | null) => void }) {
  const v = usePageViews(SEARCH_VIEWS);
  const index = useMemo(() => buildSearchIndex(v, coverageOf(v)), [v]);
  const article = useMemo(() => searchArticle(q, index), [q, index]);
  const title = article.title;
  useEffect(() => {
    onTitle(title);
  }, [title, onTitle]);
  return <ArticleView article={article} go={go} />;
}

/** The page a route names. */
function Page({
  route,
  go,
  onTitle,
}: {
  route: BrowserRoute;
  go: Go;
  onTitle: (title: string | null) => void;
}) {
  switch (route.kind) {
    case "home":
      return <ArticlePage names={HOME_VIEWS} build={homeArticle} at="home" go={go} onTitle={onTitle} />;
    case "search":
      return <SearchPage q={route.q} go={go} onTitle={onTitle} />;
    case "index": {
      const list = route.list;
      return (
        <ArticlePage
          key={list}
          names={INDEX_VIEWS[list]}
          build={(v) => indexArticle(list, v)}
          at={list}
          go={go}
          onTitle={onTitle}
        />
      );
    }
    case "article": {
      const { article, id } = route;
      return (
        <ArticlePage
          key={`${article}/${id}`}
          names={ARTICLE_VIEWS[article]}
          build={(v) => buildArticle(article, id, v)}
          at={`${article}/${id}`}
          go={go}
          onTitle={onTitle}
        />
      );
    }
    case "page":
      return <FrameworkPage page={route.page} go={go} onTitle={onTitle} />;
    case "missing":
      return <MissingPage route={route.route} go={go} onTitle={onTitle} />;
  }
}

function MissingPage({
  route,
  go,
  onTitle,
}: {
  route: string;
  go: Go;
  onTitle: (title: string | null) => void;
}) {
  useEffect(() => {
    onTitle("No article yet");
  }, [onTitle]);
  return <ArticleView article={noArticle(route, `"${route}"`)} go={go} />;
}

/** The search box, with its suggestions. */
function SearchBox({ go }: { go: Go }) {
  const v = usePageViews(SEARCH_VIEWS);
  const index = useMemo(() => buildSearchIndex(v, coverageOf(v)), [v]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const hits = useMemo(() => searchEntries(index, text, SUGGEST_LIMIT), [index, text]);
  const pick = (e: SearchEntry) => {
    setOpen(false);
    setText("");
    go("browser", `${e.kind}/${e.id}`);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit !== undefined) pick(hit);
      else if (text.trim() !== "") {
        setOpen(false);
        go("browser", `search/${text.trim()}`);
      }
    }
  };
  return (
    <div className="br-search">
      <input
        type="search"
        data-testid="browser-search"
        aria-label="Search the Almanac"
        placeholder="Search the Almanac"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
      />
      {open && text.trim() !== "" && (
        <ul className="br-suggest" data-testid="browser-suggest">
          {hits.length === 0 ? (
            <li className="br-suggest-none">No match</li>
          ) : (
            hits.map((h, i) => (
              <li key={`${h.kind}-${h.id}`}>
                <button
                  type="button"
                  className={i === active ? "on" : ""}
                  data-testid={`suggest-${h.kind}-${h.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(h)}
                >
                  <span>{h.name}</span>
                  <span className="br-suggest-kind">{KIND_LABEL[h.kind]}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function BrowserApp({ route, onRoute, setTitle }: AppProps) {
  const [history, setHistory] = useState(() => historyNew(route));
  const current = historyCurrent(history);
  const parsed = useMemo(() => parseRoute(current), [current]);
  const [typed, setTyped] = useState<string | null>(null);
  const latest = useRef({ history, onRoute });
  latest.current = { history, onRoute };

  // A route set from outside (a link in another app) is a click: pushed on the history.
  useEffect(() => {
    setHistory((h) => historyPush(h, route));
  }, [route]);
  // The window keeps the route the history shows.
  useEffect(() => {
    onRoute(current);
  }, [current, onRoute]);

  const navigate = useCallback((to: string | null) => {
    setTyped(null);
    setHistory((h) => historyPush(h, to));
  }, []);
  const go = useCallback<Go>(
    (app, to) => {
      if (app === "browser") navigate(to);
      else openApp(app, to);
    },
    [navigate],
  );
  const onTitle = useCallback(
    (title: string | null) => setTitle(title === null ? null : `${title} - ${SITE_NAME}`),
    [setTitle],
  );

  const submitAddress = (text: string) => {
    const t = text.trim();
    setTyped(null);
    if (t === "") return;
    const place = parseUrl(t);
    if (place === null) navigate(`search/${t}`);
    else go(place.app, place.route);
  };

  // Alt+Left and Alt+Right, as in any browser, while the focus is inside the window.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (el === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft") setHistory(historyBack);
      else if (e.key === "ArrowRight") setHistory(historyForward);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  // Another page starts at its top.
  const pageBox = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `current` is a new page
  useEffect(() => {
    if (pageBox.current !== null) pageBox.current.scrollTop = 0;
  }, [current]);

  const address = typed ?? addressOf(formatRoute(parsed));
  return (
    <div className="br-root" data-testid="app-root-browser" ref={root}>
      <header className="br-bar">
        <span className="br-mark" aria-hidden="true">
          A
        </span>
        <div className="br-nav" role="toolbar" aria-label="Navigation">
          <button
            type="button"
            data-testid="browser-back"
            title="Back (Alt+Left)"
            aria-label="Back"
            disabled={!canBack(history)}
            onClick={() => setHistory(historyBack)}
          >
            {"<"}
          </button>
          <button
            type="button"
            data-testid="browser-forward"
            title="Forward (Alt+Right)"
            aria-label="Forward"
            disabled={!canForward(history)}
            onClick={() => setHistory(historyForward)}
          >
            {">"}
          </button>
          <button
            type="button"
            data-testid="browser-home"
            title="Home"
            aria-label="Home"
            onClick={() => navigate(null)}
          >
            Home
          </button>
        </div>
        <input
          className="br-address"
          data-testid="browser-address"
          aria-label="Address"
          spellCheck={false}
          value={address}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => setTyped(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitAddress(e.currentTarget.value);
            else if (e.key === "Escape") {
              setTyped(null);
              e.currentTarget.blur();
            }
          }}
        />
        <SearchBox go={go} />
      </header>
      <div className="br-page" data-testid="browser-page" ref={pageBox}>
        <Page key={current ?? ""} route={parsed} go={go} onTitle={onTitle} />
      </div>
    </div>
  );
}
