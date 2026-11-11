// The browser's route grammar and history (pivot 15.3; D1047): every page kind round-trips through
// its route text and through the address `orr://browser/<route>`, a route that names nothing is a
// "missing" page and not an error, every route `entityRoute` writes for a kind the shared
// ENTITY_APP map sends here opens a page, and the history keeps the rules of a browser's.

import type { EntityKind } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import { ENTITY_APP } from "../../../src/apps/_shared/entity.ts";
import {
  canBack,
  canForward,
  HISTORY_LIMIT,
  historyBack,
  historyCurrent,
  historyForward,
  historyNew,
  historyPush,
} from "../../../src/apps/browser/history.ts";
import {
  ARTICLE_KINDS,
  type BrowserRoute,
  canonicalRoute,
  FRAMEWORK_KINDS,
  formatRoute,
  INDEX_KINDS,
  parseRoute,
  routeOfPage,
  sameRoute,
} from "../../../src/apps/browser/route.ts";
import { entityRoute } from "../../../src/os/apps.ts";
import { formatUrl, parseUrl } from "../../../src/os/url.ts";
import { PAGE_KINDS, type PageRef } from "../../../src/pages/ref.ts";

/** One route of every kind the grammar has. */
const ROUTES: BrowserRoute[] = [
  { kind: "home" },
  { kind: "search", q: "ohio" },
  { kind: "search", q: "new york / 12 %" },
  { kind: "search", q: "" },
  ...INDEX_KINDS.map((list): BrowserRoute => ({ kind: "index", list })),
  ...ARTICLE_KINDS.map((article): BrowserRoute => ({ kind: "article", article, id: 12 })),
  { kind: "article", article: "district", id: 1202 },
  { kind: "page", page: { kind: "company", id: 5 } as PageRef },
  { kind: "page", page: { kind: "industry", id: 9 } as PageRef },
  { kind: "page", page: { kind: "exchange", id: 0 } as PageRef },
  { kind: "page", page: { kind: "recap", quarter: { year: 2020, q: 3 } } },
  { kind: "page", page: { kind: "companies" } },
  { kind: "page", page: { kind: "industries" } },
  { kind: "page", page: { kind: "exchanges" } },
  { kind: "page", page: { kind: "world-history" } },
  { kind: "missing", route: "nonsense/9" },
];

describe("the route grammar", () => {
  it("round-trips every page kind through its route text", () => {
    for (const r of ROUTES) expect(parseRoute(formatRoute(r)), JSON.stringify(r)).toEqual(r);
  });

  it("round-trips through the address bar's orr:// text", () => {
    for (const r of ROUTES) {
      const url = formatUrl({ app: "browser", route: formatRoute(r) });
      expect(url.startsWith("orr://browser")).toBe(true);
      const place = parseUrl(url);
      expect(place?.app).toBe("browser");
      expect(parseRoute(place?.route ?? null), url).toEqual(r);
    }
  });

  it("covers every article, index and framework kind the grammar names", () => {
    const seen = new Set<string>(
      ROUTES.map((r) =>
        r.kind === "article"
          ? r.article
          : r.kind === "index"
            ? r.list
            : r.kind === "page"
              ? r.page.kind
              : r.kind,
      ),
    );
    for (const k of [...ARTICLE_KINDS, ...INDEX_KINDS, ...FRAMEWORK_KINDS]) expect(seen.has(k), k).toBe(true);
  });

  it("reads null, empty and blank as home, and anything unknown as a missing page", () => {
    expect(parseRoute(null)).toEqual({ kind: "home" });
    expect(parseRoute("")).toEqual({ kind: "home" });
    expect(parseRoute("  ")).toEqual({ kind: "home" });
    for (const bad of [
      "person",
      "person/x",
      "person/-1",
      "person/1/2",
      "people/3",
      "recap/2020",
      "exchange/abc",
      "zone/1",
      "country/3",
      "world",
      "settings",
      "politics",
      "x/y/z",
    ]) {
      expect(parseRoute(bad), bad).toEqual({ kind: "missing", route: bad });
    }
  });

  it("keeps a missing route's text, so the clean page can show what was asked for", () => {
    expect(formatRoute(parseRoute("country/3"))).toBe("country/3");
  });

  it("writes one canonical spelling", () => {
    expect(canonicalRoute("person/012")).toBe("person/12");
    expect(canonicalRoute(" person/12 ")).toBe("person/12");
    expect(canonicalRoute("")).toBeNull();
    expect(sameRoute("state/3", "state/03")).toBe(true);
    expect(sameRoute("state/3", "state/4")).toBe(false);
  });

  it("opens a page for every route entityRoute writes for a kind sent to the browser", () => {
    for (const [kind, app] of Object.entries(ENTITY_APP) as [EntityKind, string][]) {
      const route = entityRoute({ kind, id: 7 });
      const r = parseRoute(route);
      if (app === "browser") expect(r.kind, route).not.toBe("missing");
      // The kinds that go to other apps still resolve here when a link or an address names them.
      if (["Race", "Bill", "Outlet", "Pollster"].includes(kind)) expect(r.kind, route).toBe("article");
      // Handles and contracts are not encyclopedia entries: a clean "no article" page.
      if (["Handle", "Contract"].includes(kind)) expect(r, route).toEqual({ kind: "missing", route });
    }
  });

  it("draws only public pages of a USA-only game: no country, zone, province, map, events or politics", () => {
    const drawn = PAGE_KINDS.filter(
      (k) => routeOfPage({ kind: k, id: 1, quarter: { year: 2020, q: 1 } } as unknown as PageRef) !== null,
    );
    expect(drawn.sort()).toEqual([...FRAMEWORK_KINDS].sort());
  });
});

describe("the history", () => {
  it("pushes, goes back and forward, and drops the forward pages on a new push", () => {
    let h = historyNew(null);
    expect(canBack(h) || canForward(h)).toBe(false);
    h = historyPush(h, "state/3");
    h = historyPush(h, "person/9");
    expect(historyCurrent(h)).toBe("person/9");
    h = historyBack(h);
    expect(historyCurrent(h)).toBe("state/3");
    expect(canForward(h)).toBe(true);
    h = historyForward(h);
    expect(historyCurrent(h)).toBe("person/9");
    h = historyBack(historyBack(h));
    expect(historyCurrent(h)).toBeNull();
    expect(historyBack(h)).toBe(h);
    h = historyPush(h, "races");
    expect(canForward(h)).toBe(false);
    expect(h.stack).toEqual([null, "races"]);
  });

  it("does not push the page already shown, spelled however", () => {
    const h = historyPush(historyNew("person/9"), "person/009");
    expect(h.stack).toEqual(["person/9"]);
  });

  it("keeps a bounded number of pages", () => {
    let h = historyNew(null);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = historyPush(h, `person/${i}`);
    expect(h.stack.length).toBe(HISTORY_LIMIT + 1);
    expect(historyCurrent(h)).toBe(`person/${HISTORY_LIMIT + 20}`);
  });
});
