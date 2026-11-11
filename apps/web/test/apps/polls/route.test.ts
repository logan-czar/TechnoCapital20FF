// The Polls app's route codec and in-app history (apps/polls/route.ts): every route round-trips, a
// route no page answers to is `unknown`, and back/forward behave as a browser's do.

import { describe, expect, it } from "vitest";
import {
  canBack,
  canForward,
  currentRoute,
  DEFAULT_RACE_FILTERS,
  formatRoute,
  goBack,
  goForward,
  newHistory,
  parseRoute,
  pushRoute,
  raceRoute,
  racesRoute,
} from "../../../src/apps/polls/route.ts";

describe("polls route codec", () => {
  it("reads the overview from null, empty and home", () => {
    for (const r of [null, "", "home"]) expect(parseRoute(r)).toEqual({ kind: "home" });
    expect(formatRoute({ kind: "home" })).toBeNull();
  });

  it("round-trips race, pollster, state and stage routes", () => {
    for (const r of [
      "race/12",
      "race/12/general",
      "race/0/primary-1",
      "pollster/3",
      "state/46",
      "races",
      "races?office=Senate",
    ]) {
      expect(formatRoute(parseRoute(r))).toBe(r);
    }
    expect(parseRoute("race/12/primary-1")).toEqual({ kind: "race", id: 12, stage: "primary-1" });
    expect(parseRoute("race/7")).toEqual({ kind: "race", id: 7, stage: null });
  });

  it("round-trips the races table's filters and sort", () => {
    const route = racesRoute({
      office: "House",
      state: 4,
      rating: "toss-up",
      q: "ohio",
      sort: "polls",
      desc: true,
    });
    expect(route).toBe("races?office=House&state=4&rating=toss-up&q=ohio&sort=polls&dir=desc");
    const parsed = parseRoute(route);
    expect(parsed).toEqual({
      kind: "races",
      filters: { office: "House", state: 4, rating: "toss-up", q: "ohio", sort: "polls", desc: true },
    });
    expect(formatRoute(parsed)).toBe(route);
  });

  it("omits the default filters and ignores bad values", () => {
    expect(racesRoute()).toBe("races");
    expect(parseRoute("races?office=Mayor&state=x&sort=nope&dir=up")).toEqual({
      kind: "races",
      filters: DEFAULT_RACE_FILTERS,
    });
    expect(racesRoute({ desc: true })).toBe("races?dir=desc");
  });

  it("marks a route no page answers to as unknown", () => {
    for (const r of ["race", "race/x", "race/1/nope", "pollster/1/2", "bill/3", "races/1", "state"]) {
      expect(parseRoute(r)).toEqual({ kind: "unknown", route: r });
    }
    expect(raceRoute(5)).toBe("race/5");
    expect(raceRoute(5, "primary-0")).toBe("race/5/primary-0");
  });
});

describe("polls route history", () => {
  it("goes back and forward, and a new visit drops the forward pages", () => {
    let h = newHistory(null);
    expect(canBack(h)).toBe(false);
    h = pushRoute(h, "race/1");
    h = pushRoute(h, "pollster/2");
    expect(currentRoute(h)).toBe("pollster/2");
    h = goBack(h);
    expect(currentRoute(h)).toBe("race/1");
    expect(canForward(h)).toBe(true);
    expect(currentRoute(goForward(h))).toBe("pollster/2");
    h = pushRoute(h, "state/3");
    expect(canForward(h)).toBe(false);
    expect(h.stack).toEqual([null, "race/1", "state/3"]);
  });

  it("does not stack a visit to the page already shown", () => {
    const h = newHistory("race/1");
    expect(pushRoute(h, "race/1")).toBe(h);
    expect(goBack(h)).toBe(h);
    expect(goForward(h)).toBe(h);
  });
});
