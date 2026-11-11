// The Social app's route codec and its pure model.

import type { HandleRow, Post } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import {
  handleIndex,
  pendingCount,
  postAge,
  rumourCounts,
  sameSubject,
  timeline,
} from "../../../src/apps/social/model.ts";
import {
  canonicalRoute,
  formatSocialRoute,
  parseSocialRoute,
  type SocialRoute,
} from "../../../src/apps/social/route.ts";
import { entityRoute } from "../../../src/os/apps.ts";

describe("the route codec", () => {
  const routes: SocialRoute[] = [
    { page: "home" },
    { page: "all" },
    { page: "rumours" },
    { page: "handle", id: 12 },
    { page: "post", id: 0 },
  ];
  it("round-trips every route", () => {
    for (const r of routes) expect(parseSocialRoute(formatSocialRoute(r))).toEqual(r);
  });
  it("reads null, junk and malformed ids as home", () => {
    for (const s of [null, "", "nonsense", "handle/", "handle/x", "post/-1", "handle/1/2"]) {
      expect(parseSocialRoute(s)).toEqual({ page: "home" });
    }
    expect(canonicalRoute(null)).toBe("home");
  });
  it("reads the route an entity link to a handle writes", () => {
    expect(parseSocialRoute(entityRoute({ kind: "Handle", id: 5 }))).toEqual({ page: "handle", id: 5 });
  });
});

const post = (id: number, handle: number, refs: Post["refs"] = [], rumour: Post["rumour"] = null): Post => ({
  id,
  time: 100 + id,
  handle: handle as never,
  text: `p${id}`,
  refs,
  rumour,
});

describe("the model", () => {
  const person = { kind: "Person", id: 3 } as const;
  const posts = [
    post(0, 0, [person]),
    post(1, 1),
    post(2, 0, [person], "Open"),
    post(3, 1, [person, { kind: "Handle", id: 0 }]),
  ];
  it("lists newest first up to the post let in", () => {
    expect(timeline(posts, 3, () => true).map((p) => p.id)).toEqual([3, 2, 1, 0]);
    expect(timeline(posts, 1, () => true).map((p) => p.id)).toEqual([1, 0]);
    expect(timeline(posts, 3, (p) => p.handle === 0).map((p) => p.id)).toEqual([2, 0]);
    expect(timeline([], -1, () => true)).toEqual([]);
  });
  it("counts what waits behind the bar, by the same filter", () => {
    expect(pendingCount(posts, 1, () => true)).toBe(2);
    expect(pendingCount(posts, 1, (p) => p.handle === 0)).toBe(1);
    expect(pendingCount(posts, 3, () => true)).toBe(0);
  });
  it("finds the posts on the same subject, oldest first, not the post itself", () => {
    expect(sameSubject(posts, posts[0] as Post, 10).map((p) => p.id)).toEqual([2, 3]);
    expect(sameSubject(posts, posts[0] as Post, 1).map((p) => p.id)).toEqual([3]);
    expect(sameSubject(posts, posts[1] as Post, 10)).toEqual([]);
  });
  it("writes an age", () => {
    expect(postAge(100, 100)).toBe("now");
    expect(postAge(105, 100)).toBe("5h");
    expect(postAge(100 + 24 * 3 + 5, 100)).toBe("3d");
    expect(postAge(100, 105)).toBe("");
  });
  it("counts rumours by status and indexes handles by id", () => {
    expect(rumourCounts([...posts, post(4, 0, [], "Debunked")])).toEqual({
      Open: 1,
      Confirmed: 0,
      Debunked: 1,
    });
    const h = { id: 7, name: "@x" } as unknown as HandleRow;
    expect(handleIndex([h]).get(7)).toBe(h);
  });
});
