// Murmur, the Social app's window (pivot 8.1, 8.3, 14.4): the in-world short-post feed. A home
// timeline of the accounts the player follows, everything, an account's page, one post with its
// thread and a lens on rumours. It reads v_social; following sends `Follow` / `Unfollow`. What is
// hidden stays hidden: a rumour shows only the status the view publishes (pivot 5.11, 8.1).

import type { HandleRow, Post, RumourStatus, SocialView } from "@tc20ff/sim";
import { useEffect, useMemo, useState } from "react";
import type { AppProps } from "../../os/apps.ts";
import { useClock, useViewData } from "../../sim/hooks.ts";
import { EntityLink } from "../_shared/index.ts";
import { HANDLE_KIND_LABEL, handleIndex, RUMOUR_LABEL, rumourCounts, sameSubject } from "./model.ts";
import { FollowButton, LabelsProvider, type Nav, PostCard, Timeline } from "./parts.tsx";
import { canonicalRoute, parseSocialRoute, type SocialRoute } from "./route.ts";
import "./social.css";

/** The most posts a post page lists on its subject (D1044). */
const THREAD_LIMIT = 30;

/** In-app back and forward over the route the window keeps (the route string is the state). */
function useHistory(route: string | null, onRoute: (r: string | null) => void) {
  const cur = canonicalRoute(route);
  const [h, setH] = useState({ stack: [cur], i: 0 });
  if (h.stack[h.i] !== cur) setH({ stack: [...h.stack.slice(0, h.i + 1), cur], i: h.i + 1 });
  // Back and forward move inside the stack the window already holds, then tell the window.
  const go = (to: number) => {
    setH({ stack: h.stack, i: to });
    onRoute(h.stack[to] as string);
  };
  return {
    back: h.i > 0 ? () => go(h.i - 1) : null,
    forward: h.i < h.stack.length - 1 ? () => go(h.i + 1) : null,
  };
}

function Loading() {
  return (
    <div className="soc-empty" data-testid="soc-loading">
      <p className="soc-empty-title">Tuning in</p>
      <p>Waiting for the first posts to come through.</p>
    </div>
  );
}

function NotFound({ what, nav }: { what: string; nav: Nav }) {
  return (
    <div className="soc-empty" data-testid="soc-not-found">
      <p className="soc-empty-title">{what} not found</p>
      <p>It may not exist yet in this game.</p>
      <button type="button" className="soc-more" onClick={() => nav.go("all")}>
        Back to everything
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- the pages

function Home({ view, now, nav }: { view: SocialView; now: number; nav: Nav }) {
  const handles = useMemo(() => handleIndex(view.handles), [view.handles]);
  const following = view.handles.filter((h) => h.followed).length;
  const keep = (p: Post) => handles.get(p.handle)?.followed === true;
  return (
    <Timeline
      key="home"
      posts={view.posts}
      keep={keep}
      handles={handles}
      now={now}
      nav={nav}
      empty={
        following === 0 ? (
          <>
            <p className="soc-empty-title">Your timeline is empty</p>
            <p>Follow accounts to see their posts here. Everything shows every account.</p>
            <button type="button" className="soc-more" onClick={() => nav.go("all")}>
              See everything
            </button>
          </>
        ) : (
          <>
            <p className="soc-empty-title">Nothing yet</p>
            <p>The {following} accounts you follow have not posted.</p>
          </>
        )
      }
      header={
        <p className="soc-lede" data-testid="soc-following-count">
          Following {following} {following === 1 ? "account" : "accounts"}
        </p>
      }
    />
  );
}

function Everything({ view, now, nav }: { view: SocialView; now: number; nav: Nav }) {
  const handles = useMemo(() => handleIndex(view.handles), [view.handles]);
  return (
    <Timeline
      key="all"
      posts={view.posts}
      keep={() => true}
      handles={handles}
      now={now}
      nav={nav}
      empty={
        <>
          <p className="soc-empty-title">Quiet</p>
          <p>Nobody has posted yet.</p>
        </>
      }
    />
  );
}

type Lens = RumourStatus | "All";
const LENSES: readonly Lens[] = ["All", "Open", "Confirmed", "Debunked"];

function Rumours({ view, now, nav }: { view: SocialView; now: number; nav: Nav }) {
  const handles = useMemo(() => handleIndex(view.handles), [view.handles]);
  const [lens, setLens] = useState<Lens>("All");
  const counts = rumourCounts(view.posts);
  const total = counts.Open + counts.Confirmed + counts.Debunked;
  const keep = (p: Post) => p.rumour !== null && (lens === "All" || p.rumour === lens);
  return (
    <Timeline
      key={`rumours-${lens}`}
      posts={view.posts}
      keep={keep}
      handles={handles}
      now={now}
      nav={nav}
      empty={
        <>
          <p className="soc-empty-title">No rumours</p>
          <p>{total === 0 ? "No post has been flagged as a rumour." : "No rumour has that status."}</p>
        </>
      }
      header={
        <fieldset className="soc-lens" aria-label="Rumour status">
          {LENSES.map((l) => (
            <button
              key={l}
              type="button"
              className={`soc-chip${l === lens ? " soc-chip-on" : ""}`}
              aria-pressed={l === lens}
              data-testid={`lens-${l.toLowerCase()}`}
              onClick={() => setLens(l)}
            >
              {l === "All" ? "All" : RUMOUR_LABEL[l]}{" "}
              <span className="soc-chip-n">{l === "All" ? total : counts[l]}</span>
            </button>
          ))}
        </fieldset>
      }
    />
  );
}

function ProfileHead({ handle, posts }: { handle: HandleRow; posts: number }) {
  const owner = handle.owner;
  return (
    <section className="soc-profile" data-testid={`handle-page-${handle.id}`}>
      <span className={`soc-avatar soc-avatar-big soc-kind-${handle.kind.toLowerCase()}`} aria-hidden="true">
        {(handle.name.replace(/^@/, "")[0] ?? "?").toUpperCase()}
      </span>
      <div className="soc-profile-main">
        <h2 className="soc-profile-name">{handle.name}</h2>
        <p className="soc-profile-kind" data-testid="handle-kind">
          {HANDLE_KIND_LABEL[handle.kind]}
          {" · "}
          {posts} {posts === 1 ? "post" : "posts"}
        </p>
        <p className="soc-profile-owner">
          {owner === null ? (
            handle.kind === "Anonymous" ? (
              "Nobody knows who is behind this account."
            ) : (
              "An independent voice; no one official stands behind it."
            )
          ) : (
            <>
              {owner.kind === "Person"
                ? "Account of "
                : owner.kind === "Race"
                  ? "Campaign account for "
                  : "Account of "}
              <EntityLink to={owner}>
                {owner.kind === "Person"
                  ? "this person's page"
                  : owner.kind === "Race"
                    ? "the race"
                    : owner.kind === "Pollster"
                      ? "the pollster"
                      : "the outlet"}
              </EntityLink>
            </>
          )}
        </p>
      </div>
      <FollowButton handle={handle} />
    </section>
  );
}

function Profile({ id, view, now, nav }: { id: number; view: SocialView; now: number; nav: Nav }) {
  const handles = useMemo(() => handleIndex(view.handles), [view.handles]);
  const handle = handles.get(id);
  if (handle === undefined) return <NotFound what="Account" nav={nav} />;
  const count = view.posts.reduce((n, p) => (p.handle === id ? n + 1 : n), 0);
  return (
    <Timeline
      key={`handle-${id}`}
      posts={view.posts}
      keep={(p) => p.handle === id}
      handles={handles}
      now={now}
      nav={nav}
      empty={
        <>
          <p className="soc-empty-title">No posts</p>
          <p>{handle.name} has not posted.</p>
        </>
      }
      header={<ProfileHead handle={handle} posts={count} />}
    />
  );
}

function PostPage({ id, view, now, nav }: { id: number; view: SocialView; now: number; nav: Nav }) {
  const handles = useMemo(() => handleIndex(view.handles), [view.handles]);
  const post = view.posts[id];
  if (post === undefined) return <NotFound what="Post" nav={nav} />;
  const thread = sameSubject(view.posts, post, THREAD_LIMIT);
  return (
    <div className="soc-scroll" data-testid={`post-page-${id}`}>
      <PostCard post={post} handle={handles.get(post.handle)} now={now} nav={nav} focus />
      <h3 className="soc-thread-title">
        {thread.length === 0 ? "No other posts on this subject" : "Other posts on this subject"}
      </h3>
      <div className="soc-list" data-testid="soc-thread">
        {thread.map((p) => (
          <PostCard key={p.id} post={p} handle={handles.get(p.handle)} now={now} nav={nav} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the window

function titleOf(r: SocialRoute, view: SocialView | undefined): string | null {
  switch (r.page) {
    case "home":
      return null;
    case "all":
      return "Everything - Murmur";
    case "rumours":
      return "Rumours - Murmur";
    case "handle":
      return `${view?.handles[r.id]?.name ?? "Account"} - Murmur`;
    case "post":
      return `Post ${r.id} - Murmur`;
  }
}

export default function SocialApp({ route, onRoute, setTitle }: AppProps) {
  const view = useViewData("social");
  const clock = useClock();
  const parsed = parseSocialRoute(route);
  const hist = useHistory(route, onRoute);
  const nav = useMemo<Nav>(() => ({ go: (r) => onRoute(r) }), [onRoute]);
  const title = titleOf(parsed, view);
  useEffect(() => setTitle(title), [setTitle, title]);

  const now = clock?.now ?? view?.posts.at(-1)?.time ?? 0;
  const here = parsed.page;
  const open = view === undefined ? 0 : rumourCounts(view.posts).Open;
  const tab = (page: "home" | "all" | "rumours", label: string, extra?: number) => (
    <button
      key={page}
      type="button"
      role="tab"
      aria-selected={here === page}
      className={`soc-tab${here === page ? " soc-tab-on" : ""}`}
      data-testid={`tab-${page}`}
      onClick={() => nav.go(page)}
    >
      {label}
      {extra === undefined || extra === 0 ? null : <span className="soc-tab-n">{extra}</span>}
    </button>
  );

  return (
    <div className="soc" data-testid="app-root-social">
      <header className="soc-mast">
        <div className="soc-brand">
          <button
            type="button"
            className="soc-nav"
            aria-label="Back"
            disabled={hist.back === null}
            onClick={() => hist.back?.()}
            data-testid="soc-back"
          >
            {"‹"}
          </button>
          <button
            type="button"
            className="soc-nav"
            aria-label="Forward"
            disabled={hist.forward === null}
            onClick={() => hist.forward?.()}
            data-testid="soc-forward"
          >
            {"›"}
          </button>
          <span className="soc-logo">murmur</span>
        </div>
        <div className="soc-tabs" role="tablist" aria-label="Feeds">
          {tab("home", "Home")}
          {tab("all", "Everything")}
          {tab("rumours", "Rumours", open)}
        </div>
      </header>
      <main className="soc-body">
        {view === undefined ? (
          <Loading />
        ) : (
          <LabelsProvider handles={view.handles}>
            {parsed.page === "home" ? (
              <Home view={view} now={now} nav={nav} />
            ) : parsed.page === "all" ? (
              <Everything view={view} now={now} nav={nav} />
            ) : parsed.page === "rumours" ? (
              <Rumours view={view} now={now} nav={nav} />
            ) : parsed.page === "handle" ? (
              <Profile id={parsed.id} view={view} now={now} nav={nav} />
            ) : (
              <PostPage id={parsed.id} view={view} now={now} nav={nav} />
            )}
          </LabelsProvider>
        )}
      </main>
    </div>
  );
}
