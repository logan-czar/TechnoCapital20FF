// Murmur on the phone (pivot 15.2): a compact timeline. The home timeline (the accounts the player
// follows) or everything, a "new posts" bar, and a tap on a post's name or time opens the full app.

import { useMemo, useState } from "react";
import { openApp } from "../../links/nav.ts";
import type { AppProps } from "../../os/apps.ts";
import { useClock, useViewData } from "../../sim/hooks.ts";
import { handleIndex } from "./model.ts";
import { LabelsProvider, type Nav, Timeline } from "./parts.tsx";
import "./social.css";

export default function SocialAppPhone(_props: AppProps) {
  const view = useViewData("social");
  const clock = useClock();
  const [mine, setMine] = useState(true);
  const handles = useMemo(() => handleIndex(view?.handles ?? []), [view?.handles]);
  // A tap goes to the full app at that route: the phone has no room for pages of its own.
  const nav = useMemo<Nav>(() => ({ go: (r) => void openApp("social", r) }), []);
  if (view === undefined) {
    return (
      <div className="soc soc-phone" data-testid="app-root-social">
        <div className="soc-empty" data-testid="soc-loading">
          <p className="soc-empty-title">Tuning in</p>
        </div>
      </div>
    );
  }
  const following = view.handles.some((h) => h.followed);
  // With no one followed the home list would only be empty: show everything.
  const home = mine && following;
  const now = clock?.now ?? view.posts.at(-1)?.time ?? 0;
  return (
    <div className="soc soc-phone" data-testid="app-root-social">
      <header className="soc-mast">
        <span className="soc-logo">murmur</span>
        <div className="soc-tabs" role="tablist" aria-label="Feeds">
          <button
            type="button"
            role="tab"
            aria-selected={home}
            className={`soc-tab${home ? " soc-tab-on" : ""}`}
            data-testid="phone-tab-home"
            onClick={() => setMine(true)}
          >
            Following
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!home}
            className={`soc-tab${home ? "" : " soc-tab-on"}`}
            data-testid="phone-tab-all"
            onClick={() => setMine(false)}
          >
            All
          </button>
        </div>
      </header>
      <main className="soc-body">
        <LabelsProvider handles={view.handles}>
          <Timeline
            key={home ? "home" : "all"}
            posts={view.posts}
            keep={home ? (p) => handles.get(p.handle)?.followed === true : () => true}
            handles={handles}
            now={now}
            nav={nav}
            compact
            empty={<p className="soc-empty-title">Nothing yet</p>}
          />
        </LabelsProvider>
      </main>
    </div>
  );
}
