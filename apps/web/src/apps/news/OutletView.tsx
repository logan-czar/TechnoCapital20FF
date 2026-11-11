// An outlet's page (pivot 8.2, 8.8): its front page, a day at a time (the latest from v_feed, earlier
// days from the `front_pages` slice), and its archive. Slant and reliability are hidden values
// (pivot 8.1, 5.11): they appear only when the view carries them (Omniscient), as the view gives them.

import type { FeedView, SimDate } from "@tc20ff/sim";
import { useState } from "react";
import { useSlice } from "../../sim/hooks.ts";
import { formatDay, formatMargin, formatPct } from "../_shared/format.ts";
import { EntityLink } from "../_shared/index.ts";
import {
  type FeedIndex,
  frontPageStories,
  latestFrontDate,
  OUTLET_KIND_LABEL,
  outletArchive,
  PAGE_SIZE,
} from "./model.ts";
import { Pane, SectionTag, StoryLink, useNewsNav, When } from "./parts.tsx";
import { addDays, formatIsoDate, outletRoute, parseIsoDate } from "./route.ts";

function cmpDay(a: SimDate, b: SimDate): number {
  return a.year * 10000 + a.month * 100 + a.day - (b.year * 10000 + b.month * 100 + b.day);
}

export default function OutletView({
  id,
  date,
  feed,
  index,
}: {
  id: number;
  date: SimDate | null;
  feed: FeedView;
  index: FeedIndex;
}) {
  const nav = useNewsNav();
  const outlet = index.outlets.get(id);
  // Only a past day reads the slice; the latest page is in the view.
  const slice = useSlice(date === null ? null : { view: "feed", slice: "front_pages", date });
  const [shown, setShown] = useState(PAGE_SIZE);
  if (outlet === undefined) {
    return (
      <Pane title="No such outlet" testId="news-notfound">
        Outlet {id} is not in the press directory.
      </Pane>
    );
  }
  const latest = feed.front_pages.find((p) => p.outlet === id) ?? null;
  const page = date === null ? latest : ((slice ?? []).find((p) => p.outlet === id) ?? null);
  const shownDate = date ?? latest?.date ?? null;
  const newest = latestFrontDate(feed.front_pages);
  const stories = page === null ? [] : frontPageStories(page, index.articles);
  const archive = outletArchive(feed.articles, id);
  const goDate = (d: SimDate) => {
    // Past the newest page is the latest page itself.
    nav.go(outletRoute(id, newest !== null && cmpDay(d, newest) >= 0 ? null : d), true);
  };
  const loading = date !== null && slice === undefined;

  return (
    <div className="news-outlet" data-testid={`news-outlet-${id}`}>
      <header className="news-outlet-head">
        <h2 className="news-h2">{outlet.name}</h2>
        <span className={`news-kind kind-${outlet.kind.toLowerCase()}`}>
          {OUTLET_KIND_LABEL[outlet.kind]}
        </span>
        {outlet.state === null ? null : (
          <span className="news-dim">
            <EntityLink to={{ kind: "State", id: outlet.state }}>Home state</EntityLink>
          </span>
        )}
      </header>
      {outlet.slant === null && outlet.reliability === null ? null : (
        <dl className="news-hidden" data-testid="outlet-hidden">
          <dt>Slant (Omniscient)</dt>
          <dd data-testid="outlet-slant">{outlet.slant === null ? "hidden" : formatMargin(outlet.slant)}</dd>
          <dt>Reliability (Omniscient)</dt>
          <dd data-testid="outlet-reliability">
            {outlet.reliability === null ? "hidden" : formatPct(outlet.reliability)}
          </dd>
        </dl>
      )}

      <nav className="news-datebar" aria-label="Front page date">
        <button
          type="button"
          data-testid="date-prev"
          disabled={shownDate === null}
          onClick={() => shownDate !== null && goDate(addDays(shownDate, -1))}
        >
          Earlier
        </button>
        <label>
          <span className="news-dim">Front page of </span>
          <input
            type="date"
            data-testid="date-input"
            value={shownDate === null ? "" : formatIsoDate(shownDate)}
            onChange={(e) => {
              const d = parseIsoDate(e.target.value);
              if (d !== null) goDate(d);
            }}
          />
        </label>
        <button
          type="button"
          data-testid="date-next"
          disabled={date === null}
          onClick={() => date !== null && goDate(addDays(date, 1))}
        >
          Later
        </button>
        <button
          type="button"
          data-testid="date-latest"
          disabled={date === null}
          onClick={() => nav.go(outletRoute(id), true)}
        >
          Latest
        </button>
      </nav>

      <section className="news-front" data-testid="outlet-front" aria-label="Front page">
        {loading ? (
          <p className="news-empty" data-testid="front-loading">
            Loading the front page...
          </p>
        ) : stories.length === 0 ? (
          <p className="news-empty" data-testid="front-none">
            {shownDate === null
              ? "This outlet has not printed a front page yet."
              : `No front page from ${outlet.name} on ${formatDay(shownDate)}.`}
          </p>
        ) : (
          <>
            {page === null ? null : <h3 className="news-h3">{formatDay(page.date)}</h3>}
            {stories.map((a, i) =>
              i === 0 ? (
                <div key={a.id} className="news-lead">
                  <StoryLink article={a} className="is-lead" />
                  <p className="news-meta">
                    <SectionTag article={a} /> <When article={a} />
                  </p>
                </div>
              ) : (
                <div key={a.id} className="news-ranked-row">
                  <span className="news-rank">{i + 1}</span>
                  <StoryLink article={a} />
                  <SectionTag article={a} />
                </div>
              ),
            )}
          </>
        )}
      </section>

      <section className="news-archive" data-testid="outlet-archive" aria-label="Archive">
        <h3 className="news-h3">Archive ({archive.length})</h3>
        {archive.length === 0 ? <p className="news-empty">Nothing published yet.</p> : null}
        <ul className="news-list">
          {archive.slice(0, shown).map((a) => (
            <li key={a.id} data-testid={`archive-row-${a.id}`}>
              <When article={a} />
              <SectionTag article={a} />
              <StoryLink article={a} />
            </li>
          ))}
        </ul>
        {archive.length > shown ? (
          <button type="button" className="news-more" onClick={() => setShown(shown + PAGE_SIZE)}>
            Older ({archive.length - shown} more)
          </button>
        ) : null}
      </section>
    </div>
  );
}
