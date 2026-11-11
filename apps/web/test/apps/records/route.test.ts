// The Records route grammar: every page's route reads back to what wrote it, and anything the app
// does not know is `unknown` (so a stale link or a saved route never throws).

import { describe, expect, it } from "vitest";
import { formatRoute, NO_FILTER, parseRoute, type RecordsRoute } from "../../../src/apps/records/route.ts";

const CASES: [string | null, RecordsRoute][] = [
  [null, { page: "home" }],
  ["bills", { page: "bills", filter: NO_FILTER }],
  [
    "bills?stage=Law&chamber=House&subject=Tax&q=rate",
    { page: "bills", filter: { stage: "Law", chamber: "House", subject: "Tax", q: "rate" } },
  ],
  ["bill/7", { page: "bill", id: 7 }],
  ["rollcall/0", { page: "rollcall", id: 0 }],
  ["exec", { page: "exec", kind: null }],
  ["exec?kind=Veto", { page: "exec", kind: "Veto" }],
  ["finance", { page: "finance" }],
  ["finance/race/12", { page: "financeRace", id: 12 }],
  ["finance/person/45", { page: "financePerson", id: 45 }],
  ["results", { page: "results", cycle: null }],
  ["results/2020", { page: "results", cycle: 2020 }],
  ["results/race/3", { page: "resultsRace", id: 3 }],
  ["officials/house", { page: "officials", chamber: "House" }],
  ["officials/senate", { page: "officials", chamber: "Senate" }],
  ["districts", { page: "districts", state: null }],
  ["districts/6", { page: "districts", state: 6 }],
];

describe("the records route codec", () => {
  it.each(CASES)("reads %s and writes it back", (text, route) => {
    expect(parseRoute(text)).toEqual(route);
    expect(formatRoute(route)).toBe(text);
  });

  it("reads the entity route a Bill link opens", () => {
    expect(parseRoute("bill/2")).toEqual({ page: "bill", id: 2 });
  });

  it("takes an empty route, 'home' and a trailing slash as the front page or the same page", () => {
    expect(parseRoute("")).toEqual({ page: "home" });
    expect(parseRoute("home")).toEqual({ page: "home" });
    expect(parseRoute("bill/3/")).toEqual({ page: "bill", id: 3 });
    expect(parseRoute("officials")).toEqual({ page: "officials", chamber: "House" });
  });

  it("escapes a search so it survives the route", () => {
    const r: RecordsRoute = { page: "bills", filter: { ...NO_FILTER, q: "tax & trade?" } };
    expect(parseRoute(formatRoute(r))).toEqual(r);
  });

  it("drops filter values it does not know instead of failing", () => {
    expect(parseRoute("bills?stage=Nonsense&chamber=Both")).toEqual({ page: "bills", filter: NO_FILTER });
    expect(parseRoute("exec?kind=Coup")).toEqual({ page: "exec", kind: null });
  });

  it("calls a route it does not know unknown and keeps its text", () => {
    for (const bad of [
      "bill",
      "bill/x",
      "bill/1/2",
      "rollcall/-1",
      "nonsense",
      "finance/race",
      "results/race/x",
      "officials/joint",
      "districts/a",
    ]) {
      expect(parseRoute(bad), bad).toEqual({ page: "unknown", route: bad });
      expect(formatRoute(parseRoute(bad))).toBe(bad);
    }
  });
});
