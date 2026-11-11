// Small pieces the news app's pages share: in-app navigation, a story's link and tags, an outlet's
// tag and the empty/loading panes.

import type { Article, OutletRow } from "@tc20ff/sim";
import { createContext, type ReactNode, useContext } from "react";
import { formatWhen } from "../_shared/format.ts";
import { KIND_LABEL, OUTLET_KIND_LABEL } from "./model.ts";
import { type NewsRoute, outletRoute } from "./route.ts";
import { useIsRead } from "./unread.ts";

/** Moves inside the app: `replace` rewrites the current history entry (a filter being typed). */
export interface NewsNav {
  go(route: NewsRoute, replace?: boolean): void;
}

export const NavCtx = createContext<NewsNav>({ go: () => {} });

export function useNewsNav(): NewsNav {
  return useContext(NavCtx);
}

/** A story as a link: its headline, an unread mark and the flags the outlet gave it. */
export function StoryLink({
  article,
  className = "",
  children,
}: {
  article: Article;
  className?: string;
  children?: ReactNode;
}) {
  const nav = useNewsNav();
  const isRead = useIsRead();
  const read = isRead(article.id);
  return (
    <button
      type="button"
      className={`news-story ${className}${read ? " is-read" : ""}`}
      data-testid={`story-${article.id}`}
      data-read={read ? "1" : "0"}
      onClick={() => nav.go({ kind: "article", id: article.id })}
    >
      {read ? null : <span className="news-unread" role="img" aria-label="unread" />}
      <span className="news-story-text">{children ?? article.headline}</span>
      <StoryFlags article={article} />
    </button>
  );
}

/** "Unconfirmed", "Corrected": what the outlet itself said about the story. */
export function StoryFlags({ article }: { article: Article }) {
  return (
    <>
      {article.unconfirmed ? <span className="news-flag flag-unconfirmed">Unconfirmed</span> : null}
      {article.corrected ? <span className="news-flag flag-corrected">Corrected</span> : null}
    </>
  );
}

/** An outlet's name as a link to its page, with its kind. */
export function OutletTag({
  outlet,
  id,
  kind = true,
}: {
  outlet: OutletRow | undefined;
  id: number;
  kind?: boolean;
}) {
  const nav = useNewsNav();
  const name = outlet === undefined ? `Outlet ${id}` : outlet.name;
  return (
    <span className="news-outlet-tag">
      <button
        type="button"
        className="news-outlet-link"
        data-testid={`outlet-link-${id}`}
        onClick={() => nav.go(outletRoute(id))}
      >
        {name}
      </button>
      {kind && outlet !== undefined ? (
        <span className={`news-kind kind-${outlet.kind.toLowerCase()}`}>
          {OUTLET_KIND_LABEL[outlet.kind]}
        </span>
      ) : null}
    </span>
  );
}

/** "Report", "Opinion": the article's section. */
export function SectionTag({ article }: { article: Article }) {
  return <span className={`news-section sec-${article.kind.toLowerCase()}`}>{KIND_LABEL[article.kind]}</span>;
}

/** An article's dateline: "3 Nov 2020, 21:00". */
export function When({ article }: { article: Article }) {
  return <time className="news-when">{formatWhen(article.time)}</time>;
}

export function Pane({ title, children, testId }: { title: string; children?: ReactNode; testId?: string }) {
  return (
    <div className="news-pane" data-testid={testId ?? "news-pane"}>
      <p className="news-pane-title">{title}</p>
      {children === undefined ? null : <p className="news-pane-text">{children}</p>}
    </div>
  );
}
