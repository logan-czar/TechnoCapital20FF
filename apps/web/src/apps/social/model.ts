// What the Social app derives from v_social (pivot 8.3), as pure functions the tests can call:
// the timelines, the rumour lens, a post's neighbours and how old a post is. The view only grows
// (posts are an append list, oldest first, ids from 0 in order), so "newest first" is reading the
// list from the back.

import type { DateTime, EntityRef, HandleKind, HandleRow, Post, RumourStatus } from "@tc20ff/sim";

export const HANDLE_KIND_LABEL: Readonly<Record<HandleKind, string>> = {
  Politician: "Politician",
  Campaign: "Campaign",
  Pundit: "Pundit",
  Pollster: "Pollster",
  Outlet: "Outlet",
  Anonymous: "Anonymous account",
};

/** What a rumour's published status is called. Open says only that nobody has settled it. */
export const RUMOUR_LABEL: Readonly<Record<RumourStatus, string>> = {
  Open: "Unconfirmed",
  Confirmed: "Confirmed",
  Debunked: "Debunked",
};

export function handleIndex(handles: readonly HandleRow[]): Map<number, HandleRow> {
  return new Map(handles.map((h) => [h.id as number, h]));
}

/**
 * The posts of a timeline, newest first, up to `through` (a post id: the newest the reader has
 * let in, so posts arriving later wait behind the "new posts" bar). `keep` picks which posts.
 */
export function timeline(posts: readonly Post[], through: number, keep: (p: Post) => boolean): Post[] {
  const out: Post[] = [];
  for (let i = Math.min(through, posts.length - 1); i >= 0; i--) {
    const p = posts[i] as Post;
    if (keep(p)) out.push(p);
  }
  return out;
}

/** How many posts after `through` pass `keep`: the number on the "new posts" bar. */
export function pendingCount(posts: readonly Post[], through: number, keep: (p: Post) => boolean): number {
  let n = 0;
  for (let i = posts.length - 1; i > through; i--) if (keep(posts[i] as Post)) n++;
  return n;
}

export function sameRef(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * The posts on the same subject as `post`: those that name one of the same things, oldest first,
 * the post itself left out. The feed carries no reply links (v_social's `Post` has none), so this
 * is the thread a post page shows (D1044).
 */
export function sameSubject(posts: readonly Post[], post: Post, limit: number): Post[] {
  const subjects = post.refs.filter((r) => r.kind !== "Handle");
  if (subjects.length === 0) return [];
  const out: Post[] = [];
  for (const p of posts) {
    if (p.id === post.id) continue;
    if (p.refs.some((r) => subjects.some((s) => sameRef(r, s)))) out.push(p);
  }
  return out.slice(-limit);
}

const HOURS_PER_DAY = 24;

/** "now", "5h", "3d": how long before `now` the post was made; "" when it is not yet. */
export function postAge(now: DateTime, t: DateTime): string {
  const h = now - t;
  if (h < 0) return "";
  if (h < 1) return "now";
  if (h < HOURS_PER_DAY) return `${h}h`;
  return `${Math.floor(h / HOURS_PER_DAY)}d`;
}

/** The count of each rumour status among `posts`. */
export function rumourCounts(posts: readonly Post[]): Record<RumourStatus, number> {
  const c: Record<RumourStatus, number> = { Open: 0, Confirmed: 0, Debunked: 0 };
  for (const p of posts) if (p.rumour !== null) c[p.rumour]++;
  return c;
}
