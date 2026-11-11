// @vitest-environment happy-dom
// The M2 contracts on the UI side (D1037): the store keeps the pivot views' append lists from a
// frame's appended and changed rows, `useSlice` reads a slice while mounted, the mock serves the
// pivot slices through `Want`, the shared app helpers map every entity to its app and format
// things one way, an app can retitle and close its window, and the M2 apps are registered.

import type { Article, ContractId, FromSim, RaceId, SliceKey } from "@tc20ff/sim";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ENTITY_APP, entityTarget, parseEntityRoute } from "../src/apps/_shared/entity.ts";
import {
  formatCents,
  formatDay,
  formatMargin,
  formatPct,
  formatUsd,
  formatWhen,
} from "../src/apps/_shared/format.ts";
import { EntityLink, PersonChip } from "../src/apps/_shared/index.ts";
import { partyClass, partyLetter } from "../src/apps/_shared/party.ts";
import { setAppOpener } from "../src/links/nav.ts";
import { appSpecOf, entityRoute } from "../src/os/apps.ts";
import { wmInit, wmReduce } from "../src/os/wm.ts";
import type { SimClient } from "../src/sim/client.ts";
import { SimContext, useSlice } from "../src/sim/hooks.ts";
import { SimHost } from "../src/sim/mock/host.ts";
import type { MockSim } from "../src/sim/mock/mockSim.ts";
import { type Frame, SimStore } from "../src/sim/store.ts";
import { mockWorld } from "./mock/common.ts";

afterEach(cleanup);

const article = (id: number, corrected = false): Article => ({
  id,
  time: id,
  outlet: 0 as never,
  kind: "Report",
  source: null,
  headline: `h${id}`,
  body: "",
  refs: [],
  unconfirmed: false,
  corrected,
});
const frame = (views: object): Frame => ({ kind: "Frame", notices: [], clock: {} as never, views });
const feedView = (version: number) => ({
  data: { outlets: [], articles: [], front_pages: [] },
  version,
  dirty: true,
});

describe("the store's append lists", () => {
  it("keeps the rows held, applies changed rows, then appends; a reset replaces them", () => {
    const store = new SimStore();
    let woke = 0;
    store.subscribe("feed", () => woke++);
    store.applyFrame(
      frame({
        feed: feedView(1),
        appended: [{ view: "feed", field: "articles", reset: true, rows: [article(0), article(1)] }],
      }),
    );
    expect(store.getView("feed")?.data.articles.map((a) => a.id)).toEqual([0, 1]);
    // The view moves without its list: the rows are kept.
    store.applyFrame(frame({ feed: feedView(2) }));
    expect(store.getView("feed")?.data.articles.map((a) => a.id)).toEqual([0, 1]);
    expect(store.getView("feed")?.version).toBe(2);
    store.applyFrame(
      frame({
        feed: feedView(3),
        changed: [{ view: "feed", field: "articles", rows: [{ index: 1, row: article(1, true) }] }],
        appended: [{ view: "feed", field: "articles", reset: false, rows: [article(2)] }],
      }),
    );
    const rows = store.getView("feed")?.data.articles ?? [];
    expect(rows.map((a) => [a.id, a.corrected])).toEqual([
      [0, false],
      [1, true],
      [2, false],
    ]);
    store.applyFrame(
      frame({
        feed: feedView(4),
        appended: [{ view: "feed", field: "articles", reset: true, rows: [article(0)] }],
      }),
    );
    expect(store.getView("feed")?.data.articles.map((a) => a.id)).toEqual([0]);
    expect(woke).toBe(4);
  });

  it("from the mock: the store's lists equal the sim's after a day of frames", () => {
    const host = new SimHost(mockWorld());
    const store = new SimStore();
    const apply = (out: FromSim[]) => {
      for (const m of out) if (m.kind === "Frame") store.applyFrame(m);
    };
    apply(host.handle({ kind: "NewGame", id: 1, seed: 7 }));
    apply(
      host.handle({
        kind: "Want",
        views: ["feed", "social", "notifications", "account", "records"],
        slices: [],
      }),
    );
    const sim = host.sim as MockSim;
    sim.paused = false;
    for (let h = 0; h < 30; h++) {
      sim.step();
      apply(host.tick(0));
    }
    expect(store.getView("feed")?.data.articles).toEqual(sim.views.feed.data.articles);
    expect(store.getView("social")?.data.posts).toEqual(sim.views.social.data.posts);
    expect(store.getView("account")?.data.fills).toEqual(sim.views.account.data.fills);
    expect(store.getView("records")?.data.roll_calls).toEqual(sim.views.records.data.roll_calls);
    expect(store.getView("notifications")?.data.items).toEqual(sim.views.notifications.data.items);
  });
});

describe("slices", () => {
  it("the mock posts a wanted pivot slice, and again when its view moves", () => {
    const host = new SimHost(mockWorld());
    host.handle({ kind: "NewGame", id: 1, seed: 7 });
    const book: SliceKey = { view: "markets", slice: "book", contract: 1 as ContractId };
    const out = host.handle({ kind: "Want", views: ["markets"], slices: [book] });
    const first = out.find((m) => m.kind === "Frame");
    if (first?.kind !== "Frame") throw new Error("no frame");
    expect(first.views.slices?.map((s) => s.key)).toEqual([book]);
    expect(first.views.slices?.[0]?.data).toEqual(host.slice(book));
    const sim = host.sim as MockSim;
    sim.paused = false;
    sim.step();
    const next = host.tick(0).find((m) => m.kind === "Frame");
    expect(next?.kind === "Frame" && next.views.slices?.length).toBe(1);
  });

  it("useSlice reads a slice while mounted and wants it only then", async () => {
    const store = new SimStore();
    const wants: string[][] = [];
    store.onWant = (_views, slices) => wants.push(slices.map((s) => JSON.stringify(s)));
    const client = { store } as unknown as SimClient;
    const key: SliceKey = { view: "returns", slice: "counties", race: 3 as RaceId };
    function Probe() {
      // A new key object each render: the hook keys it by its identity.
      const data = useSlice({ ...key });
      return (
        <p data-testid="probe">
          {data === undefined ? "waiting" : data === null ? "none" : data.counties.length}
        </p>
      );
    }
    const { unmount } = render(
      <SimContext.Provider value={client}>
        <Probe />
      </SimContext.Provider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("waiting");
    await act(async () => {});
    expect(wants.at(-1)).toEqual([JSON.stringify(key)]);
    act(() =>
      store.applyFrame(
        frame({
          slices: [
            { key, version: 5, data: { race: 3, counties: [1, 2], reporting: [1, 1], votes: [[1], [2]] } },
          ],
        }),
      ),
    );
    expect(screen.getByTestId("probe").textContent).toBe("2");
    unmount();
    await act(async () => {});
    expect(wants.at(-1)).toEqual([]);
  });
});

describe("the shared app helpers", () => {
  it("send every entity kind to an app, at its route, and read the route back", () => {
    expect(entityTarget({ kind: "Person", id: 12 })).toEqual({ app: "browser", route: "person/12" });
    expect(entityTarget({ kind: "Race", id: 3 })).toEqual({ app: "polls", route: "race/3" });
    for (const [kind, app] of Object.entries(ENTITY_APP)) {
      const ref = { kind: kind as keyof typeof ENTITY_APP, id: 4 };
      expect(parseEntityRoute(entityRoute(ref))).toEqual(ref);
      // Every home is a registered app, but the exchange (M5).
      if (app !== "exchange") expect(appSpecOf(app), app).toBeDefined();
    }
    expect(parseEntityRoute("nonsense")).toBeNull();
    expect(parseEntityRoute(null)).toBeNull();
  });

  it("an entity link opens its app; a person chip carries the party", () => {
    const opened: [string, string | null][] = [];
    setAppOpener((id, route) => opened.push([id, route]));
    render(
      <>
        <EntityLink to={{ kind: "Bill", id: 2 }}>The bill</EntityLink>
        <PersonChip id={5} name="Ada Vance" party="Republicans" />
      </>,
    );
    fireEvent.click(screen.getByTestId("link-bill-2"));
    fireEvent.click(screen.getByTestId("link-person-5"));
    expect(opened).toEqual([
      ["records", "bill/2"],
      ["browser", "person/5"],
    ]);
    expect(screen.getByText("Ada Vance").closest(".app-person")?.className).toContain("party-b");
    setAppOpener(null);
  });

  it("format dates, money, shares, prices and margins one way", () => {
    expect(formatDay({ year: 2020, month: 11, day: 3 })).toBe("3 Nov 2020");
    expect(formatWhen(24 * 2 + 21)).toBe("3 Jan 2020, 21:00");
    expect(formatUsd(950)).toBe("$950");
    expect(formatUsd(12_400)).toBe("$12.4K");
    expect(formatUsd(-1_234_567)).toBe("-$1.2M");
    expect(formatPct(0.524)).toBe("52.4%");
    expect(formatCents(57)).toBe("57¢");
    expect(formatCents(null)).toBe("-");
    expect(formatMargin(3.24)).toBe("D+3.2");
    expect(formatMargin(-0.4)).toBe("R+0.4");
    expect(formatMargin(0)).toBe("even");
    expect([partyClass("Democrats"), partyClass("Republicans"), partyClass(null)]).toEqual([
      "party-a",
      "party-b",
      "party-none",
    ]);
    expect([partyLetter("Democrats"), partyLetter(null)]).toEqual(["D", "I"]);
  });
});

describe("the desktop's apps (D1037)", () => {
  it("an app sets its window's title, and back to its own with null", () => {
    let s = wmInit();
    s = wmReduce(s, {
      kind: "open",
      app: "news",
      route: null,
      singleton: false,
      size: { width: 400, height: 300 },
    });
    const id = s.windows[0]?.id as string;
    s = wmReduce(s, { kind: "title", id, title: "Ohio Senate - News" });
    expect(s.windows[0]?.title).toBe("Ohio Senate - News");
    s = wmReduce(s, { kind: "title", id, title: null });
    expect(s.windows[0]?.title).toBeNull();
    s = wmReduce(s, { kind: "close", id });
    expect(s.windows).toEqual([]);
  });

  it("registers the seven M2 apps with their phone views where the plan has them", () => {
    for (const id of ["news", "social", "polls", "records", "browser", "usmap", "terminal"]) {
      const spec = appSpecOf(id);
      expect(spec?.id, id).toBe(id);
      expect(spec?.PhoneView !== undefined, id).toBe(id === "news" || id === "social");
    }
  });
});
