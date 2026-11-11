// The Social app's pieces (pivot 8.3): a post, its mentions, the follow button and a timeline with
// its "new posts" bar. They read nothing themselves but the labels and the client; the routes
// hand them the view's rows.

import { actErrorMessage, type DateTime, type EntityRef, type HandleRow, type Post } from "@tc20ff/sim";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useSim, useViewData } from "../../sim/hooks.ts";
import { EntityLink, formatWhen } from "../_shared/index.ts";
import { HANDLE_KIND_LABEL, pendingCount, postAge, RUMOUR_LABEL, timeline } from "./model.ts";

// ---------------------------------------------------------------- labels for mentions

/** The names a mention can show: people and races have a view that names them; the rest read "Bill 3". */
export interface Labels {
  person: ReadonlyMap<number, string>;
  race: ReadonlyMap<number, string>;
  handle: ReadonlyMap<number, string>;
}

const NO_LABELS: Labels = { person: new Map(), race: new Map(), handle: new Map() };
const LabelsContext = createContext<Labels>(NO_LABELS);

/** Provides the mention labels to the posts under it: subscribes to v_people and v_races. */
export function LabelsProvider({
  handles,
  children,
}: {
  handles: readonly HandleRow[];
  children: ReactNode;
}) {
  const people = useViewData("people");
  const races = useViewData("races");
  const labels = useMemo<Labels>(
    () => ({
      person: new Map((people?.people ?? []).map((p) => [p.id as number, p.name])),
      race: new Map((races?.races ?? []).map((r) => [r.id as number, r.title])),
      handle: new Map(handles.map((h) => [h.id as number, h.name])),
    }),
    [people, races, handles],
  );
  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

export function labelOf(labels: Labels, ref: EntityRef): string {
  const known =
    ref.kind === "Person"
      ? labels.person.get(ref.id)
      : ref.kind === "Race"
        ? labels.race.get(ref.id)
        : ref.kind === "Handle"
          ? labels.handle.get(ref.id)
          : undefined;
  return known ?? `${ref.kind} ${ref.id}`;
}

// ---------------------------------------------------------------- a post

export interface Nav {
  /** Goes to a route of this app. */
  go: (route: string) => void;
}

function Avatar({ handle }: { handle: HandleRow | undefined }) {
  const kind = handle?.kind ?? "Anonymous";
  const letter = (handle?.name.replace(/^@/, "")[0] ?? "?").toUpperCase();
  return (
    <span className={`soc-avatar soc-kind-${kind.toLowerCase()}`} aria-hidden="true">
      {letter}
    </span>
  );
}

/** What a post says of its rumour: the published status only (pivot 8.3), never its truth. */
export function RumourBadge({ status }: { status: NonNullable<Post["rumour"]> }) {
  return (
    <span className={`soc-rumour soc-rumour-${status.toLowerCase()}`} data-testid="rumour-status">
      Rumour: {RUMOUR_LABEL[status]}
    </span>
  );
}

export function PostCard({
  post,
  handle,
  now,
  nav,
  compact = false,
  focus = false,
}: {
  post: Post;
  handle: HandleRow | undefined;
  now: DateTime;
  nav: Nav;
  compact?: boolean;
  focus?: boolean;
}) {
  const labels = useContext(LabelsContext);
  const name = handle?.name ?? `@unknown${post.handle}`;
  const age = postAge(now, post.time);
  return (
    <article
      className={`soc-post${focus ? " soc-post-focus" : ""}${compact ? " soc-post-compact" : ""}`}
      data-testid={`post-row-${post.id}`}
    >
      {compact ? null : <Avatar handle={handle} />}
      <div className="soc-post-main">
        <header className="soc-post-head">
          <button
            type="button"
            className="soc-handle"
            data-testid={`post-handle-${post.id}`}
            onClick={() => nav.go(`handle/${post.handle}`)}
          >
            {name}
          </button>
          {handle === undefined ? null : <span className="soc-kind">{HANDLE_KIND_LABEL[handle.kind]}</span>}
          <button
            type="button"
            className="soc-when"
            title={formatWhen(post.time)}
            data-testid={`post-open-${post.id}`}
            onClick={() => nav.go(`post/${post.id}`)}
          >
            {age === "" ? formatWhen(post.time) : age}
          </button>
        </header>
        <p className="soc-text">{post.text}</p>
        {post.rumour === null ? null : <RumourBadge status={post.rumour} />}
        {post.refs.length === 0 ? null : (
          <ul className="soc-mentions" aria-label="Mentions">
            {post.refs.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                {r.kind === "Handle" ? (
                  <button
                    type="button"
                    className="soc-mention"
                    data-testid={`mention-handle-${r.id}`}
                    onClick={() => nav.go(`handle/${r.id}`)}
                  >
                    {labelOf(labels, r)}
                  </button>
                ) : (
                  <span className="soc-mention">
                    <EntityLink to={r}>{labelOf(labels, r)}</EntityLink>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- follow

/**
 * Follow or unfollow `handle`. It sends the action and shows what the view says (`followed`): the
 * button changes when the sim's next frame says so, not when it is pressed (pivot 8.3).
 */
export function FollowButton({ handle }: { handle: HandleRow }) {
  const client = useSim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const press = useCallback(async () => {
    setBusy(true);
    setError(null);
    const target: EntityRef = { kind: "Handle", id: handle.id };
    try {
      const reply = await client.act({ kind: handle.followed ? "Unfollow" : "Follow", target });
      if (reply.kind === "ActError") setError(actErrorMessage(reply.error));
      else if (reply.kind !== "Ok") setError("The sim did not take that.");
    } finally {
      setBusy(false);
    }
  }, [client, handle.id, handle.followed]);
  return (
    <span className="soc-follow-wrap">
      <button
        type="button"
        className={`soc-follow${handle.followed ? " soc-following" : ""}`}
        data-testid={`follow-${handle.id}`}
        aria-pressed={handle.followed}
        disabled={busy}
        onClick={() => void press()}
      >
        {handle.followed ? "Following" : "Follow"}
      </button>
      {error === null ? null : (
        <span className="soc-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- a timeline

/** How many posts a timeline draws before "Show older posts". */
export const PAGE = 40;

/**
 * Posts newest first. Posts that arrive while it is on screen wait behind a "N new posts" bar, so
 * the list the reader is looking at never moves under them; pressing the bar lets them in and
 * returns to the top. Mount it with a `key` that changes with the page, so it starts fresh.
 */
export function Timeline({
  posts,
  keep,
  handles,
  now,
  nav,
  empty,
  compact = false,
  header,
}: {
  posts: readonly Post[];
  keep: (p: Post) => boolean;
  handles: ReadonlyMap<number, HandleRow>;
  now: DateTime;
  nav: Nav;
  empty: ReactNode;
  compact?: boolean;
  header?: ReactNode;
}) {
  const [through, setThrough] = useState(posts.length - 1);
  const [pages, setPages] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = timeline(posts, through, keep);
  const pending = pendingCount(posts, through, keep);
  const letIn = () => {
    setThrough(posts.length - 1);
    scroller.current?.scrollTo?.({ top: 0 });
  };
  const shown = rows.slice(0, pages * PAGE);
  return (
    <div className="soc-scroll" ref={scroller} data-testid="soc-timeline">
      {header}
      {pending === 0 ? null : (
        <button type="button" className="soc-newbar" data-testid="soc-new-posts" onClick={letIn}>
          {pending === 1 ? "1 new post" : `${pending} new posts`}
        </button>
      )}
      {rows.length === 0 ? (
        <div className="soc-empty" data-testid="soc-empty">
          {empty}
        </div>
      ) : (
        <div className="soc-list">
          {shown.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              handle={handles.get(p.handle)}
              now={now}
              nav={nav}
              compact={compact}
            />
          ))}
          {shown.length < rows.length ? (
            <button
              type="button"
              className="soc-more"
              data-testid="soc-more"
              onClick={() => setPages((n) => n + 1)}
            >
              Show older posts ({rows.length - shown.length} more)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
