// The news app's home (pivot 8.8): today's front page of every outlet, grouped wire, national,
// regional, each with its lead and ranked stories, and a strip of the newest stories.

import type { FeedView, FrontPage, OutletRow } from "@tc20ff/sim";
import { formatDay } from "../_shared/format.ts";
import {
  CARD_STORIES,
  type FeedIndex,
  frontPageStories,
  latestFrontDate,
  OUTLET_KIND_LABEL,
  outletsByKind,
} from "./model.ts";
import { OutletTag, Pane, StoryLink, useNewsNav, When } from "./parts.tsx";
import { latestRoute, outletRoute } from "./route.ts";

const JUST_IN = 6;

/** One outlet's front page as a card: its name and kind, the lead, then the ranked stories. */
export function FrontCard({
  outlet,
  page,
  index,
  stories = CARD_STORIES,
}: {
  outlet: OutletRow;
  page: FrontPage | null | undefined;
  index: FeedIndex;
  stories?: number;
}) {
  const nav = useNewsNav();
  const list = page === null || page === undefined ? [] : frontPageStories(page, index.articles);
  const [lead, ...rest] = list;
  return (
    <section
      className="news-card"
      data-testid={`front-${outlet.id}`}
      aria-label={`${outlet.name} front page`}
    >
      <header className="news-card-head">
        <OutletTag outlet={outlet} id={outlet.id} />
        {page === null || page === undefined ? null : (
          <span className="news-card-date">{formatDay(page.date)}</span>
        )}
      </header>
      {lead === undefined ? (
        <p className="news-empty">No front page yet.</p>
      ) : (
        <>
          <StoryLink article={lead} className="is-lead" />
          {rest.length === 0 ? null : (
            <ol className="news-ranked" start={2}>
              {rest.slice(0, stories - 1).map((a) => (
                <li key={a.id}>
                  <StoryLink article={a} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <footer className="news-card-foot">
        <button type="button" className="news-more" onClick={() => nav.go(outletRoute(outlet.id))}>
          {outlet.name}: full page and archive
        </button>
      </footer>
    </section>
  );
}

export default function HomeView({ feed, index }: { feed: FeedView; index: FeedIndex }) {
  const nav = useNewsNav();
  const date = latestFrontDate(feed.front_pages);
  const pageOf = (id: number) => feed.front_pages.find((p) => p.outlet === id) ?? null;
  const justIn = feed.articles.slice(-JUST_IN).reverse();
  if (feed.outlets.length === 0) {
    return (
      <Pane title="No press yet" testId="news-empty">
        No outlet has been founded.
      </Pane>
    );
  }
  return (
    <div className="news-home" data-testid="news-home">
      <div className="news-dateline">
        <h2 className="news-h2">{date === null ? "Front pages" : `Front pages of ${formatDay(date)}`}</h2>
        <span className="news-dim">{feed.outlets.length} outlets, ranked each morning by their editors</span>
      </div>
      {justIn.length === 0 ? null : (
        <aside className="news-justin" data-testid="just-in" aria-label="Just in">
          <h3 className="news-h3">Just in</h3>
          <ul>
            {justIn.map((a) => (
              <li key={a.id}>
                <When article={a} />
                <OutletTag outlet={index.outlets.get(a.outlet)} id={a.outlet} kind={false} />
                <StoryLink article={a} />
              </li>
            ))}
          </ul>
          <button type="button" className="news-more" onClick={() => nav.go(latestRoute())}>
            All latest stories
          </button>
        </aside>
      )}
      {outletsByKind(feed.outlets).map((g) => (
        <div key={g.kind} className="news-group" data-testid={`group-${g.kind.toLowerCase()}`}>
          <h3 className="news-h3">
            {g.kind === "Wire" ? "The wire" : `${OUTLET_KIND_LABEL[g.kind]} outlets`}
          </h3>
          <div className="news-cards">
            {g.rows.map((o) => (
              <FrontCard key={o.id} outlet={o} page={pageOf(o.id)} index={index} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
