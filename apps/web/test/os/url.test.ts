// The desktop's fake addresses (os/url.ts, pivot 15.2): an app and a route, there and back.

import { describe, expect, it } from "vitest";
import { entityRoute } from "../../src/os/apps.ts";
import { type AppPlace, formatUrl, parseUrl, URL_SCHEME } from "../../src/os/url.ts";

describe("formatUrl", () => {
  it("writes an app's home and a place inside it", () => {
    expect(formatUrl({ app: "news", route: null })).toBe("orr://news");
    expect(formatUrl({ app: "betting", route: "contract/7" })).toBe("orr://betting/contract/7");
    // An empty route is the app's home.
    expect(formatUrl({ app: "news", route: "" })).toBe("orr://news");
  });

  it("writes the route every app uses for a thing", () => {
    expect(formatUrl({ app: "browser", route: entityRoute({ kind: "Person", id: 12 } as never) })).toBe(
      "orr://browser/person/12",
    );
  });

  it("escapes what an address cannot hold, keeping the slashes between segments", () => {
    expect(formatUrl({ app: "browser", route: "search/new york?/50%" })).toBe(
      "orr://browser/search/new%20york%3F/50%25",
    );
  });
});

describe("parseUrl", () => {
  it("reads back every place formatUrl writes", () => {
    const places: AppPlace[] = [
      { app: "news", route: null },
      { app: "betting", route: "contract/7" },
      { app: "usa-map", route: "state/NY/county/36061" },
      { app: "browser", route: "search/new york?/50%" },
      { app: "browser", route: "q/a%2Fb" },
      { app: "feed", route: "tag/#élection" },
    ];
    for (const p of places) expect(parseUrl(formatUrl(p))).toEqual(p);
  });

  it("forgives a trailing slash, spaces around it and the scheme's and app's case", () => {
    expect(parseUrl("orr://news/")).toEqual({ app: "news", route: null });
    expect(parseUrl("  ORR://News/race/12/ ")).toEqual({ app: "news", route: "race/12" });
  });

  it("refuses what is not an address of the desktop", () => {
    for (const bad of [
      "",
      "news",
      "https://news/race/12",
      `${URL_SCHEME}:news`,
      `${URL_SCHEME}://`,
      `${URL_SCHEME}:///race/12`,
      `${URL_SCHEME}://bad app/x`,
      `${URL_SCHEME}://-news`,
      `${URL_SCHEME}://news/%E0%A4%A`,
    ]) {
      expect(parseUrl(bad), bad).toBeNull();
    }
  });
});
