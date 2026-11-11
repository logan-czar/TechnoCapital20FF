// @vitest-environment happy-dom
// The Social app in the DOM against the mock (pivot 8.3, 14.4): each route renders at the start, a
// scripted rumour shows up and is settled, the "new posts" bar holds the list still, following
// goes through the sim and shows the view's answer, links open the right app, and the phone view.

import type { Post, SocialView } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SocialApp from "../../../src/apps/social/SocialApp.tsx";
import SocialAppPhone from "../../../src/apps/social/SocialAppPhone.tsx";
import { setAppOpener } from "../../../src/links/nav.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SCRIPT } from "../../../src/sim/mock/fixtures/script.ts";
import { Harness, newRig, type Rig } from "./host.tsx";

afterEach(() => {
  cleanup();
  setAppOpener(null);
});

const social = (rig: Rig): SocialView => rig.sim.views.social.data;
const mount = (rig: Rig, start: string | null = null, width?: number, routes?: (string | null)[]) =>
  render(<Harness rig={rig} Body={SocialApp} start={start} width={width} routes={routes} />);
const ids = () =>
  screen.queryAllByTestId(/^post-row-/).map((e) => Number(e.getAttribute("data-testid")?.split("-")[2]));

describe("the routes at the start of a game", () => {
  it("home lists the followed accounts' posts, newest first, and says how many are followed", () => {
    const rig = newRig();
    const v = social(rig);
    const followed = new Set(v.handles.filter((h) => h.followed).map((h) => h.id as number));
    mount(rig, "home");
    expect(screen.getByTestId("app-root-social")).toBeTruthy();
    const want = v.posts
      .filter((p) => followed.has(p.handle))
      .map((p) => p.id)
      .reverse();
    const shown = ids();
    expect(shown).toEqual(want.slice(0, shown.length));
    expect(screen.getByTestId("soc-following-count").textContent).toContain(`Following ${followed.size}`);
  });

  it("everything lists every post, newest first", () => {
    const rig = newRig();
    mount(rig, "all");
    const shown = ids();
    expect(shown.length).toBeGreaterThan(5);
    expect(shown).toEqual([...shown].sort((a, b) => b - a));
    expect(shown[0]).toBe(social(rig).posts.length - 1);
  });

  it("a profile shows who it is, its own posts only, and an owner link", () => {
    const rig = newRig();
    const v = social(rig);
    const h = v.handles.find((x) => x.kind === "Politician");
    if (h === undefined) throw new Error("no politician handle");
    mount(rig, `handle/${h.id}`);
    expect(screen.getByTestId(`handle-page-${h.id}`)).toBeTruthy();
    expect(screen.getByTestId("handle-kind").textContent).toContain("Politician");
    for (const id of ids()) expect(v.posts[id]?.handle).toBe(h.id);
    expect(screen.getByTestId(`link-person-${h.owner?.id}`)).toBeTruthy();
  });

  it("a pundit and an anonymous account have no owner page", () => {
    const rig = newRig();
    const v = social(rig);
    const a = v.handles.find((x) => x.kind === "Anonymous");
    if (a === undefined) throw new Error("no anonymous handle");
    mount(rig, `handle/${a.id}`);
    expect(screen.getByTestId("handle-kind").textContent).toContain("Anonymous");
    expect(screen.queryByTestId(/^link-/)).toBeNull();
  });

  it("a post page shows the post and the others on its subject", () => {
    const rig = newRig();
    const v = social(rig);
    const p = v.posts.find((x) => x.refs.some((r) => r.kind === "Person")) as Post;
    mount(rig, `post/${p.id}`);
    expect(within(screen.getByTestId(`post-page-${p.id}`)).getAllByTestId(`post-row-${p.id}`).length).toBe(1);
    expect(screen.getByTestId("soc-thread")).toBeTruthy();
  });

  it("unknown handles and posts get a designed not-found", () => {
    const rig = newRig();
    mount(rig, "handle/9999");
    expect(screen.getByTestId("soc-not-found").textContent).toContain("Account not found");
    cleanup();
    mount(rig, "post/999999");
    expect(screen.getByTestId("soc-not-found").textContent).toContain("Post not found");
  });

  it("shows a loading state before the first frame", () => {
    const rig = newRig();
    const empty = { ...rig, client: { ...rig.client, store: new (rig.store.constructor as never)() } } as Rig;
    render(
      <SimContext.Provider value={empty.client}>
        <SocialApp route={null} onRoute={() => {}} close={() => {}} setTitle={() => {}} />
      </SimContext.Provider>,
    );
    expect(screen.getByTestId("soc-loading")).toBeTruthy();
  });
});

describe("rumours", () => {
  it("shows an open rumour as unconfirmed, then as confirmed once the view says so", () => {
    const rig = newRig();
    mount(rig, "rumours");
    expect(screen.getByTestId("soc-empty")).toBeTruthy();
    rig.runTo(SCRIPT.rumour_true_posted + 2);
    // It arrives behind the bar, like any new post.
    expect(screen.getByTestId("soc-new-posts").textContent).toBe("1 new post");
    fireEvent.click(screen.getByTestId("soc-new-posts"));
    const rows = screen.getAllByTestId(/^post-row-/);
    expect(rows.length).toBe(1);
    expect(within(rows[0] as HTMLElement).getByTestId("rumour-status").textContent).toBe(
      "Rumour: Unconfirmed",
    );
    // Nothing in the published row says whether it is true, so nothing on screen does.
    rig.runTo(SCRIPT.rumour_true_confirmed + 1);
    expect(screen.getByTestId("rumour-status").textContent).toBe("Rumour: Confirmed");
  });

  it("filters by published status and counts open ones on its tab", () => {
    const rig = newRig();
    rig.runTo(SCRIPT.rumour_false_debunked + 1);
    mount(rig, "rumours");
    expect(ids().length).toBe(2);
    fireEvent.click(screen.getByTestId("lens-debunked"));
    expect(ids().length).toBe(1);
    expect(screen.getByTestId("rumour-status").textContent).toBe("Rumour: Debunked");
    fireEvent.click(screen.getByTestId("lens-open"));
    expect(screen.getByTestId("soc-empty")).toBeTruthy();
    expect(screen.getByTestId("tab-rumours").textContent).toBe("Rumours");
  });

  it("an open rumour is flagged on the Rumours tab", () => {
    const rig = newRig();
    rig.runTo(SCRIPT.rumour_false_posted + 1);
    mount(rig, "all");
    expect(screen.getByTestId("tab-rumours").textContent).toBe("Rumours1");
  });
});

describe("new posts", () => {
  it("wait behind a bar; the list does not move until it is pressed", () => {
    const rig = newRig();
    mount(rig, "all");
    const before = ids();
    expect(screen.queryByTestId("soc-new-posts")).toBeNull();
    rig.runTo(SCRIPT.rumour_true_posted + 2);
    const total = social(rig).posts.length;
    expect(total).toBeGreaterThan(before.length === 0 ? 0 : before[0] + 1);
    expect(ids()).toEqual(before);
    const bar = screen.getByTestId("soc-new-posts");
    expect(bar.textContent).toBe(`${total - (before[0] as number) - 1} new posts`);
    fireEvent.click(bar);
    expect(screen.queryByTestId("soc-new-posts")).toBeNull();
    expect(ids()[0]).toBe(total - 1);
  });

  it("the home bar counts only followed accounts' posts", () => {
    const rig = newRig();
    mount(rig, "home");
    const through = social(rig).posts.length - 1;
    rig.runTo(SCRIPT.rumour_true_confirmed + 1);
    const v = social(rig);
    const followed = new Set(v.handles.filter((h) => h.followed).map((h) => h.id as number));
    const n = v.posts.filter((p) => p.id > through && followed.has(p.handle)).length;
    if (n === 0) expect(screen.queryByTestId("soc-new-posts")).toBeNull();
    else
      expect(screen.getByTestId("soc-new-posts").textContent).toBe(n === 1 ? "1 new post" : `${n} new posts`);
  });
});

describe("following", () => {
  it("sends Follow and shows what the view says, then Unfollow", async () => {
    const rig = newRig();
    const h = social(rig).handles.find((x) => !x.followed);
    if (h === undefined) throw new Error("every handle is followed");
    mount(rig, `handle/${h.id}`);
    const btn = () => screen.getByTestId(`follow-${h.id}`);
    expect(btn().textContent).toBe("Follow");
    await act(async () => {
      fireEvent.click(btn());
    });
    expect(rig.sent).toEqual([{ kind: "Follow", target: { kind: "Handle", id: h.id } }]);
    expect(social(rig).handles[h.id as number]?.followed).toBe(true);
    expect(btn().textContent).toBe("Following");
    await act(async () => {
      fireEvent.click(btn());
    });
    expect(rig.sent[1]).toEqual({ kind: "Unfollow", target: { kind: "Handle", id: h.id } });
    expect(btn().textContent).toBe("Follow");
  });

  it("does not change the button when the sim refuses", async () => {
    const rig = newRig();
    const h = social(rig).handles.find((x) => !x.followed);
    if (h === undefined) throw new Error("every handle is followed");
    mount(rig, `handle/${h.id}`);
    const act0 = rig.client.act;
    rig.client.act = async () => ({ kind: "ActError", error: { kind: "Rejected", message: "no thanks" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`follow-${h.id}`));
    });
    expect(screen.getByTestId(`follow-${h.id}`).textContent).toBe("Follow");
    expect(screen.getByRole("alert").textContent).toBe("no thanks");
    rig.client.act = act0;
  });
});

describe("links and navigation", () => {
  it("a mentioned person opens in the browser; a handle mention stays in the app", () => {
    const rig = newRig();
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    const routes: (string | null)[] = [];
    mount(rig, "all", undefined, routes);
    const withPerson = social(rig).posts.findLast((p) => p.refs.some((r) => r.kind === "Person")) as Post;
    const ref = withPerson.refs.find((r) => r.kind === "Person");
    const row = screen.getByTestId(`post-row-${withPerson.id}`);
    fireEvent.click(within(row).getByTestId(`link-person-${ref?.id}`));
    expect(opened).toEqual([["browser", `person/${ref?.id}`]]);
    // Name and time go to the account and the post inside the app.
    fireEvent.click(within(row).getByTestId(`post-handle-${withPerson.id}`));
    expect(routes.at(-1)).toBe(`handle/${withPerson.handle}`);
    expect(screen.getByTestId(`handle-page-${withPerson.handle}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId("soc-back"));
    expect(screen.getByTestId("soc-timeline")).toBeTruthy();
    expect(screen.queryByTestId(`handle-page-${withPerson.handle}`)).toBeNull();
    fireEvent.click(screen.getByTestId("soc-forward"));
    expect(screen.getByTestId(`handle-page-${withPerson.handle}`)).toBeTruthy();
  });

  it("a campaign account links to its race, a pollster to the pollster", () => {
    const rig = newRig();
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    const c = social(rig).handles.find((x) => x.kind === "Campaign");
    if (c?.owner == null) throw new Error("no campaign handle");
    mount(rig, `handle/${c.id}`);
    fireEvent.click(screen.getByTestId(`link-race-${c.owner.id}`));
    expect(opened).toEqual([["polls", `race/${c.owner.id}`]]);
  });

  it("the tabs navigate", () => {
    const rig = newRig();
    mount(rig);
    fireEvent.click(screen.getByTestId("tab-rumours"));
    expect(screen.getByTestId("tab-rumours").getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByTestId("tab-all"));
    expect(screen.getByTestId("tab-all").getAttribute("aria-selected")).toBe("true");
  });
});

describe("narrow and phone", () => {
  it("renders every route in a 400px window", () => {
    const rig = newRig();
    for (const r of ["home", "all", "rumours", "handle/0", "post/0"]) {
      mount(rig, r, 400);
      expect(screen.getByTestId("app-root-social")).toBeTruthy();
      expect(screen.getByTestId("tab-home")).toBeTruthy();
      cleanup();
    }
  });

  it("the phone view is a compact timeline that opens the full app", () => {
    const rig = newRig();
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    render(
      <SimContext.Provider value={rig.client}>
        <SocialAppPhone route={null} onRoute={() => {}} close={() => {}} setTitle={() => {}} />
      </SimContext.Provider>,
    );
    expect(screen.getByTestId("app-root-social")).toBeTruthy();
    fireEvent.click(screen.getByTestId("phone-tab-all"));
    const first = screen.getAllByTestId(/^post-row-/)[0] as HTMLElement;
    expect(first.className).toContain("soc-post-compact");
    const id = first.getAttribute("data-testid")?.split("-")[2];
    fireEvent.click(within(first).getByTestId(`post-open-${id}`));
    expect(opened).toEqual([["social", `post/${id}`]]);
  });
});
