// @vitest-environment happy-dom
// The news app against the mock world (pivot 8.2, 8.7, 8.8): each route renders at the start, a scripted
// event shows after the mock steps to it, links open the right app, hidden values appear only when the
// view carries them, unread marks survive a broken storage, and the phone view fits a narrow column.

import type { Article, FromSim, SimDate, SliceKey } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewsApp from "../../../src/apps/news/NewsApp.tsx";
import NewsAppPhone from "../../../src/apps/news/NewsAppPhone.tsx";
import { isRead, READ_KEY, reloadRead, resetRead } from "../../../src/apps/news/unread.ts";
import { setAppOpener } from "../../../src/links/nav.ts";
import type { AppProps } from "../../../src/os/apps.ts";
import type { SimClient } from "../../../src/sim/client.ts";
import { SimContext } from "../../../src/sim/hooks.ts";
import { SimHost } from "../../../src/sim/mock/host.ts";
import { MOCK_PIVOT, type MockSim } from "../../../src/sim/mock/mockSim.ts";
import { SimStore } from "../../../src/sim/store.ts";
import { mockWorld } from "../../mock/common.ts";

// Hours since 2020-01-01 00:00 at the start of each month of 2020.
const MONTH_START = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const at = (month: number, day: number, hour = 0) => ((MONTH_START[month - 1] ?? 0) + day - 1) * 24 + hour;

const VIEWS = ["feed", "account", "people", "races", "records", "social"] as const;

interface World {
  host: SimHost;
  sim: MockSim;
  store: SimStore;
  client: SimClient;
  /** Steps the mock to tick `t`, applying every frame to the store inside act(). */
  stepTo(t: number): void;
  feed(): { articles: Article[] };
}

/** A mock pivot game whose frames feed a store; `slices` are wanted from the first frame. */
function world(opts: { debug?: boolean; slices?: SliceKey[] } = {}): World {
  const host = new SimHost(mockWorld(), { ...MOCK_PIVOT, ...(opts.debug ? { debug: true } : {}) });
  const store = new SimStore();
  const apply = (out: FromSim[]) => {
    for (const m of out) if (m.kind === "Frame") store.applyFrame(m);
  };
  apply(host.handle({ kind: "NewGame", id: 1, seed: 7 }));
  apply(host.handle({ kind: "Want", views: [...VIEWS], slices: opts.slices ?? [] }));
  const sim = host.sim as MockSim;
  return {
    host,
    sim,
    store,
    client: { store } as unknown as SimClient,
    stepTo(t) {
      act(() => {
        while (sim.now < t) {
          sim.paused = false;
          sim.step();
          apply(host.tick(0));
        }
      });
    },
    feed: () => sim.views.feed.data,
  };
}

function mount(w: World, route: string | null, extra: Partial<AppProps> = {}) {
  const props: AppProps = { route, onRoute: () => {}, close: () => {}, setTitle: () => {}, ...extra };
  return render(
    <SimContext.Provider value={w.client}>
      <NewsApp {...props} />
    </SimContext.Provider>,
  );
}

beforeEach(() => resetRead());
afterEach(() => {
  cleanup();
  setAppOpener(null);
  vi.unstubAllGlobals();
});

describe("the home", () => {
  it("shows every outlet's front page with its name, kind and lead", () => {
    const w = world();
    mount(w, null);
    const feed = w.sim.views.feed.data;
    expect(screen.getByTestId("news-home")).toBeTruthy();
    for (const o of feed.outlets) {
      const card = screen.getByTestId(`front-${o.id}`);
      expect(within(card).getByTestId(`outlet-link-${o.id}`).textContent).toBe(o.name);
      expect(card.textContent).toContain(o.kind);
      const page = feed.front_pages.find((p) => p.outlet === o.id);
      const lead = feed.articles.find((a) => a.id === page?.articles[0]);
      if (lead !== undefined)
        expect(within(card).getByTestId(`story-${lead.id}`).textContent).toContain(lead.headline);
    }
    expect(screen.getByTestId("group-wire")).toBeTruthy();
    expect(screen.getByTestId("group-regional")).toBeTruthy();
  });

  it("opens an article from a story and goes back", () => {
    const w = world();
    mount(w, null);
    const feed = w.feed();
    const page = w.sim.views.feed.data.front_pages[0];
    const id = page?.articles[0] as number;
    fireEvent.click(screen.getAllByTestId(`story-${id}`)[0] as HTMLElement);
    expect(screen.getByTestId(`article-${id}`)).toBeTruthy();
    expect(screen.getByTestId("article-headline").textContent).toBe(
      feed.articles.find((a) => a.id === id)?.headline,
    );
    fireEvent.click(screen.getByTestId("news-back"));
    expect(screen.getByTestId("news-home")).toBeTruthy();
    fireEvent.click(screen.getByTestId("news-forward"));
    expect(screen.getByTestId(`article-${id}`)).toBeTruthy();
  });
});

describe("an outlet page", () => {
  it("shows its latest front page and archive, and no hidden values", () => {
    const w = world();
    mount(w, "outlet/0");
    const feed = w.feed();
    expect(screen.getByTestId("news-outlet-0")).toBeTruthy();
    expect(screen.getByTestId("outlet-front").textContent).toContain(
      feed.articles.find((a) => a.id === w.sim.views.feed.data.front_pages[0]?.articles[0])?.headline,
    );
    expect(screen.getByTestId("outlet-archive")).toBeTruthy();
    // Slant and reliability are null in the view: nothing about them is shown or guessed.
    expect(w.sim.views.feed.data.outlets[0]?.slant).toBeNull();
    expect(screen.queryByTestId("outlet-hidden")).toBeNull();
    expect(screen.queryByText(/slant/i)).toBeNull();
  });

  it("browses an earlier day through the front_pages slice", () => {
    const day: SimDate = { year: 2020, month: 10, day: 19 };
    const key: SliceKey = { view: "feed", slice: "front_pages", date: day };
    const w = world({ slices: [key] });
    const slice = w.host.slice(key) as { outlet: number; articles: number[] }[];
    const page = slice.find((p) => p.outlet === 0);
    expect(page).toBeDefined();
    mount(w, "outlet/0/2020-10-19");
    const lead = w.feed().articles.find((a) => a.id === page?.articles[0]);
    expect(screen.getByTestId("outlet-front").textContent).toContain(lead?.headline);
    expect((screen.getByTestId("date-input") as HTMLInputElement).value).toBe("2020-10-19");
    // "Later" steps toward the newest page; "Latest" returns to it.
    expect((screen.getByTestId("date-latest") as HTMLButtonElement).disabled).toBe(false);
  });

  it("says so for a day with no page, and for an unknown outlet", () => {
    const key: SliceKey = { view: "feed", slice: "front_pages", date: { year: 2019, month: 1, day: 2 } };
    const w = world({ slices: [key] });
    mount(w, "outlet/0/2019-01-02");
    expect(screen.getByTestId("front-none").textContent).toContain("No front page");
    cleanup();
    mount(w, "outlet/999");
    expect(screen.getByTestId("news-notfound")).toBeTruthy();
  });

  it("shows slant and reliability when Omniscient puts them in the view", () => {
    const w = world({ debug: true });
    act(() => {
      for (const m of w.host.handle({
        kind: "Control",
        id: 9,
        control: { kind: "SetOmniscient", on: true },
      })) {
        if (m.kind === "Frame") w.store.applyFrame(m);
      }
    });
    const o = w.sim.views.feed.data.outlets[0];
    expect(o?.slant).not.toBeNull();
    mount(w, "outlet/1");
    expect(screen.getByTestId("outlet-hidden")).toBeTruthy();
    expect(screen.getByTestId("outlet-slant").textContent).not.toBe("hidden");
    expect(screen.getByTestId("outlet-reliability").textContent).toMatch(/%$/);
  });
});

describe("an article", () => {
  it("shows its outlet and time, links what it names to their apps, and lists related stories", () => {
    const w = world();
    const feed = w.feed();
    const a = feed.articles.find((x) => x.refs.some((r) => r.kind === "Person")) as Article;
    expect(a).toBeDefined();
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    mount(w, `article/${a.id}`);
    expect(screen.getByTestId("article-byline").textContent).toContain(
      feed.outlets.find((o) => o.id === a.outlet)?.name as string,
    );
    const person = a.refs.find((r) => r.kind === "Person") as { kind: "Person"; id: number };
    fireEvent.click(
      within(screen.getByTestId("article-mentions")).getAllByTestId(
        `link-person-${person.id}`,
      )[0] as HTMLElement,
    );
    expect(opened).toEqual([["browser", `person/${person.id}`]]);
    expect(screen.getByTestId("article-related")).toBeTruthy();
    // Opening it marks it read.
    expect(isRead(a.id)).toBe(true);
  });

  it("opens a race and a bill in their apps", () => {
    const w = world();
    const feed = w.feed();
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    const race = feed.articles.find((x) => x.refs.some((r) => r.kind === "Race"));
    const ref = race?.refs.find((r) => r.kind === "Race");
    expect(race && ref).toBeTruthy();
    mount(w, `article/${race?.id}`);
    fireEvent.click(
      within(screen.getByTestId("article-mentions")).getAllByTestId(`link-race-${ref?.id}`)[0] as HTMLElement,
    );
    expect(opened.at(-1)).toEqual(["polls", `race/${ref?.id}`]);
  });

  it("says so for an article that does not exist", () => {
    mount(world(), "article/99999999");
    expect(screen.getByTestId("news-notfound").textContent).toContain("not been published");
  });
});

describe("a scripted event: the false rumour is printed, then corrected (10-24, 10-26)", () => {
  it("shows the unconfirmed claim, then the correction notice and the correction itself", () => {
    const w = world();
    w.stepTo(at(10, 24, 17));
    const claim = w.feed().articles.find((a) => a.unconfirmed) as Article;
    expect(claim, "Neon Tribune's unconfirmed claim").toBeDefined();
    mount(w, `article/${claim.id}`);
    expect(screen.getByTestId("article-headline").textContent).toBe(claim.headline);
    expect(screen.getByText("Unconfirmed claim")).toBeTruthy();
    expect(screen.queryByTestId("correction-notice")).toBeNull();

    // The debunking: the outlet's article is corrected in place, a changed row in the frame.
    w.stepTo(at(10, 26, 12));
    const now = w.feed().articles.find((a) => a.id === claim.id) as Article;
    expect(now.corrected).toBe(true);
    const notice = screen.getByTestId("correction-notice");
    expect(notice.textContent).toContain("Corrected");
    const note = now.body.split("Correction:")[1]?.trim() ?? "";
    expect(note.length).toBeGreaterThan(0);
    expect(notice.textContent).toContain(note.slice(0, 20));
    // The body above the notice no longer carries the note's text.
    expect(screen.getByTestId("article-body").textContent).not.toContain("Correction:");
  });

  it("a retraction is marked as one, even without the article it withdraws (the mock sets no source)", () => {
    const w = world();
    w.stepTo(at(11, 6, 0));
    const retraction = w.feed().articles.find((a) => a.kind === "Correction") as Article;
    expect(retraction, "the wrong call is retracted by 11-05").toBeDefined();
    mount(w, `article/${retraction.id}`);
    expect(screen.getByTestId("is-correction").textContent).toContain("This is a correction");
  });

  it("an article and its correction link to each other", () => {
    const w = world();
    const base = {
      time: 0,
      outlet: 0,
      source: null,
      body: "Rain fell. Then it stopped.",
      refs: [],
      unconfirmed: false,
    };
    const original = { ...base, id: 90001, kind: "Report", headline: "Rain falls", corrected: true };
    const fix = {
      ...base,
      id: 90002,
      kind: "Correction",
      headline: "Rain did not fall",
      source: { kind: "Article", id: 90001 },
      corrected: false,
    };
    act(() =>
      w.store.applyFrame({
        kind: "Frame",
        notices: [],
        clock: {} as never,
        views: { appended: [{ view: "feed", field: "articles", reset: false, rows: [original, fix] }] },
      } as never),
    );
    mount(w, "article/90002");
    const isFix = screen.getByTestId("is-correction");
    fireEvent.click(within(isFix).getByTestId("story-90001"));
    const notice = screen.getByTestId("correction-notice");
    expect(notice.textContent).toContain("See the correction: Rain did not fall");
    fireEvent.click(within(notice).getByTestId("story-90002"));
    expect(screen.getByTestId("article-headline").textContent).toBe("Rain did not fall");
  });

  it("the latest stream shows the new stories and filters by outlet, section, search and follows", () => {
    const w = world();
    mount(w, "latest");
    const before = w.feed().articles.length;
    expect(screen.getByTestId("latest-count").textContent).toContain(`${before} stories`);
    w.stepTo(at(10, 26, 12));
    const after = w.feed().articles;
    expect(after.length).toBeGreaterThan(before);
    expect(screen.getByTestId("latest-count").textContent).toContain(`${after.length} stor`);

    const fresh = after.at(-1) as Article;
    expect(screen.getByTestId(`latest-row-${fresh.id}`)).toBeTruthy();

    // By outlet.
    fireEvent.change(screen.getByTestId("latest-outlet"), { target: { value: "0" } });
    const wire = after.filter((a) => a.outlet === 0).length;
    expect(screen.getByTestId("latest-count").textContent).toContain(`${wire} stor`);
    fireEvent.change(screen.getByTestId("latest-outlet"), { target: { value: "" } });

    // By section.
    fireEvent.change(screen.getByTestId("latest-kind"), { target: { value: "Opinion" } });
    const opinions = after.filter((a) => a.kind === "Opinion");
    expect(screen.getByTestId("latest-count").textContent).toContain(`${opinions.length} stor`);
    fireEvent.change(screen.getByTestId("latest-kind"), { target: { value: "Report" } });
    const reports = after.filter((a) => a.kind === "Report");
    expect(reports.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^latest-row-/).length).toBe(Math.min(reports.length, 100));
    fireEvent.change(screen.getByTestId("latest-kind"), { target: { value: "" } });

    // By headline text.
    const word = (after[0]?.headline.split(" ").find((s) => s.length > 5) ?? "").toLowerCase();
    fireEvent.change(screen.getByTestId("latest-search"), { target: { value: word } });
    const hits = after.filter((a) => a.headline.toLowerCase().includes(word)).length;
    expect(screen.getByTestId("latest-count").textContent).toContain(`${hits} stor`);
    fireEvent.change(screen.getByTestId("latest-search"), { target: { value: "zzzz-no-such-headline" } });
    expect(screen.getByTestId("latest-empty")).toBeTruthy();
    fireEvent.click(screen.getByTestId("latest-clear"));

    // By what the player follows (the account view's follows).
    const follows = w.sim.views.account.data.follows;
    expect(follows.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("latest-followed"));
    const followed = after.filter((a) =>
      follows.some(
        (f) =>
          (f.kind === "Outlet" && f.id === a.outlet) ||
          a.refs.some((r) => r.kind === f.kind && r.id === f.id),
      ),
    ).length;
    expect(screen.getByTestId("latest-count").textContent).toContain(`${followed} stor`);
  });

  it("restores its filters from the route and sets the window's title", () => {
    const w = world();
    const titles: (string | null)[] = [];
    mount(w, "latest?kind=Report&q=a", { setTitle: (t) => titles.push(t) });
    expect((screen.getByTestId("latest-kind") as HTMLSelectElement).value).toBe("Report");
    expect((screen.getByTestId("latest-search") as HTMLInputElement).value).toBe("a");
    expect(titles.at(-1)).toBe("Latest - News");
  });

  it("the quick search box opens the stream with the text", () => {
    const routes: (string | null)[] = [];
    const w = world();
    mount(w, null, { onRoute: (r) => routes.push(r) });
    fireEvent.change(screen.getByTestId("news-quick-search"), { target: { value: "tax" } });
    fireEvent.submit(screen.getByTestId("news-quick-search").closest("form") as HTMLFormElement);
    expect(routes.at(-1)).toBe("latest?q=tax");
    expect((screen.getByTestId("latest-search") as HTMLInputElement).value).toBe("tax");
  });
});

describe("unread marks", () => {
  it("show a dot until the article is opened, and persist in storage", () => {
    const w = world();
    mount(w, null);
    const id = w.sim.views.feed.data.front_pages[0]?.articles[0] as number;
    expect(screen.getAllByTestId(`story-${id}`)[0]?.getAttribute("data-read")).toBe("0");
    fireEvent.click(screen.getAllByTestId(`story-${id}`)[0] as HTMLElement);
    fireEvent.click(screen.getByTestId("news-back"));
    expect(screen.getAllByTestId(`story-${id}`)[0]?.getAttribute("data-read")).toBe("1");
    expect(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")).toContain(id);
    reloadRead();
    expect(isRead(id)).toBe(true);
  });

  it("never throw when storage is blocked", () => {
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("localStorage", blocked);
    reloadRead();
    const w = world();
    mount(w, `article/${w.feed().articles[0]?.id}`);
    expect(screen.getByTestId("article-headline")).toBeTruthy();
    expect(isRead(w.feed().articles[0]?.id as number)).toBe(true);
  });
});

describe("the phone view", () => {
  it("fits a narrow column and opens the full app on a tap", () => {
    const w = world();
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    render(
      <SimContext.Provider value={w.client}>
        <div style={{ width: 360, height: 640 }}>
          <NewsAppPhone route={null} onRoute={() => {}} close={() => {}} setTitle={() => {}} />
        </div>
      </SimContext.Provider>,
    );
    const feed = w.feed();
    expect(screen.getByTestId("phone-front")).toBeTruthy();
    expect(screen.getByTestId("phone-front-0")).toBeTruthy();
    const lead = feed.front_pages[0]?.articles[0] as number;
    fireEvent.click(screen.getByTestId(`phone-story-${lead}`));
    expect(opened.at(-1)).toEqual(["news", `article/${lead}`]);
    fireEvent.click(screen.getByTestId("phone-tab-latest"));
    expect(screen.getByTestId("phone-latest")).toBeTruthy();
    fireEvent.click(screen.getByTestId("phone-all-latest"));
    expect(opened.at(-1)).toEqual(["news", "latest"]);
    fireEvent.click(screen.getByTestId("phone-tab-front"));
    fireEvent.click(
      within(screen.getByTestId("phone-front-0")).getByRole("button", {
        name: feed.outlets[0]?.name as string,
      }),
    );
    expect(opened.at(-1)).toEqual(["news", "outlet/0"]);
  });

  it("shows a designed empty state before the first frame", () => {
    const store = new SimStore();
    render(
      <SimContext.Provider value={{ store } as unknown as SimClient}>
        <NewsAppPhone route={null} onRoute={() => {}} close={() => {}} setTitle={() => {}} />
      </SimContext.Provider>,
    );
    expect(screen.getByTestId("news-loading")).toBeTruthy();
  });
});
