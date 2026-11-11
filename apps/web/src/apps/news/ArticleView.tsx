// One article (pivot 8.2, 8.7): headline, standfirst, the rendered text, the outlet and time, a
// visible notice when the outlet corrected it, the things it names as links to their apps, and
// more on the story by shared references.

import type { EntityRef, FeedView } from "@tc20ff/sim";
import { useEffect } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { formatWhen } from "../_shared/format.ts";
import { EntityLink, PersonChip } from "../_shared/index.ts";
import {
  correctionsOf,
  dekOf,
  type FeedIndex,
  paragraphs,
  relatedStories,
  splitCorrection,
} from "./model.ts";
import { OutletTag, Pane, SectionTag, StoryLink, useNewsNav } from "./parts.tsx";
import { markRead } from "./unread.ts";

/** What an `EntityRef` is called when the view that names it has not arrived. */
function fallback(r: EntityRef): string {
  return `${r.kind} ${r.id}`;
}

function PersonRef({ id }: { id: number }) {
  const people = useViewData("people");
  const p = people?.people.find((x) => x.id === id);
  return p === undefined ? (
    <EntityLink to={{ kind: "Person", id }}>{fallback({ kind: "Person", id })}</EntityLink>
  ) : (
    <PersonChip id={id} name={p.name} party={p.party} />
  );
}

function RaceRef({ id }: { id: number }) {
  const races = useViewData("races");
  const r = races?.races.find((x) => x.id === id);
  return (
    <EntityLink to={{ kind: "Race", id }}>
      {r === undefined ? fallback({ kind: "Race", id }) : r.title}
    </EntityLink>
  );
}

function BillRef({ id }: { id: number }) {
  const records = useViewData("records");
  const b = records?.bills.find((x) => x.id === id);
  return (
    <EntityLink to={{ kind: "Bill", id }}>
      {b === undefined ? fallback({ kind: "Bill", id }) : b.title}
    </EntityLink>
  );
}

function HandleRef({ id }: { id: number }) {
  const social = useViewData("social");
  const h = social?.handles.find((x) => x.id === id);
  return (
    <EntityLink to={{ kind: "Handle", id }}>
      {h === undefined ? fallback({ kind: "Handle", id }) : h.name}
    </EntityLink>
  );
}

/** One thing the article names, as a link to its home app (apps/_shared/entity.ts). */
function RefChip({ r, index }: { r: EntityRef; index: FeedIndex }) {
  const nav = useNewsNav();
  switch (r.kind) {
    case "Person":
      return <PersonRef id={r.id} />;
    case "Race":
      return <RaceRef id={r.id} />;
    case "Bill":
      return <BillRef id={r.id} />;
    case "Handle":
      return <HandleRef id={r.id} />;
    case "Outlet": {
      // An outlet is this app's own: it opens in place.
      const o = index.outlets.get(r.id);
      return (
        <button
          type="button"
          className="app-link"
          data-testid={`link-outlet-${r.id}`}
          onClick={() => nav.go({ kind: "outlet", id: r.id, date: null })}
        >
          {o === undefined ? fallback(r) : o.name}
        </button>
      );
    }
    default:
      return <EntityLink to={r}>{fallback(r)}</EntityLink>;
  }
}

export default function ArticleView({ id, feed, index }: { id: number; feed: FeedView; index: FeedIndex }) {
  const nav = useNewsNav();
  const article = index.articles.get(id);
  useEffect(() => {
    if (article !== undefined) markRead(article.id);
  }, [article]);
  if (article === undefined) {
    return (
      <Pane title="Article not found" testId="news-notfound">
        Article {id} has not been published.
      </Pane>
    );
  }
  const { text, note } = splitCorrection(article.body);
  const dek = dekOf(text);
  const body = paragraphs(text);
  const corrections = correctionsOf(article.id, feed.articles);
  const corrects = article.source?.kind === "Article" ? index.articles.get(article.source.id) : undefined;
  const related = relatedStories(article, feed.articles);
  const seen = new Set<string>();
  const refs = article.refs.filter((r) => {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const outlet = index.outlets.get(article.outlet);

  return (
    <article className="news-article" data-testid={`article-${article.id}`}>
      <p className="news-kicker">
        <SectionTag article={article} />
        {article.unconfirmed ? <span className="news-flag flag-unconfirmed">Unconfirmed claim</span> : null}
      </p>
      <h2 className="news-headline" data-testid="article-headline">
        {article.headline}
      </h2>
      {dek === null ? null : (
        <p className="news-dek" data-testid="article-dek">
          {dek}
        </p>
      )}
      <p className="news-byline" data-testid="article-byline">
        <OutletTag outlet={outlet} id={article.outlet} /> <time>{formatWhen(article.time)}</time>
      </p>

      {article.corrected ? (
        <aside className="news-correction" role="note" data-testid="correction-notice">
          <strong>Corrected.</strong> {outlet === undefined ? "The outlet" : outlet.name} has since corrected
          or withdrawn this story.
          {note === null ? null : <span className="news-correction-note"> {note}</span>}
          {corrections.map((c) => (
            <span key={c.id} className="news-correction-link">
              {" "}
              <StoryLink article={c}>See the correction: {c.headline}</StoryLink>
            </span>
          ))}
        </aside>
      ) : null}
      {article.kind === "Correction" ? (
        <aside className="news-correction is-correction" role="note" data-testid="is-correction">
          This is a correction
          {corrects === undefined ? (
            "."
          ) : (
            <>
              {" "}
              of <StoryLink article={corrects} />.
            </>
          )}
        </aside>
      ) : null}
      {article.source?.kind === "Post" ? (
        <p className="news-dim" data-testid="from-post">
          Reports a post on the social feed.
        </p>
      ) : null}

      <div className="news-body" data-testid="article-body">
        {body.map((p, i) => (
          // The text is rendered by the sim; a paragraph's place is its identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs never reorder
          <p key={i}>{p}</p>
        ))}
      </div>

      {refs.length === 0 ? null : (
        <section
          className="news-mentions"
          data-testid="article-mentions"
          aria-label="Mentioned in this story"
        >
          <h3 className="news-h3">Mentioned</h3>
          <ul>
            {refs.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <span className="news-dim">{r.kind}</span> <RefChip r={r} index={index} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="news-related" data-testid="article-related" aria-label="More on this story">
        <h3 className="news-h3">More on this story</h3>
        {related.length === 0 ? (
          <p className="news-empty">No other story names the same people or things.</p>
        ) : (
          <ul>
            {related.map((a) => (
              <li key={a.id}>
                <OutletTag outlet={index.outlets.get(a.outlet)} id={a.outlet} kind={false} />
                <StoryLink article={a} />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="news-more"
          onClick={() => nav.go({ kind: "outlet", id: article.outlet, date: null })}
        >
          More from {outlet === undefined ? "this outlet" : outlet.name}
        </button>
      </section>
    </article>
  );
}
