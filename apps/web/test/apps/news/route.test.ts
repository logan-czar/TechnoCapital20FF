// The news app's route grammar and pure model (apps/news/route.ts, model.ts).

import type { Article, EntityRef } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import {
  correctionsOf,
  dekOf,
  filterArticles,
  isFollowed,
  paragraphs,
  relatedStories,
  splitCorrection,
} from "../../../src/apps/news/model.ts";
import {
  addDays,
  formatRoute,
  latestRoute,
  NO_FILTER,
  outletRoute,
  parseIsoDate,
  parseRoute,
} from "../../../src/apps/news/route.ts";

const art = (id: number, over: Partial<Article> = {}): Article => ({
  id,
  time: id,
  outlet: 0 as never,
  kind: "Report",
  source: null,
  headline: `Headline ${id}`,
  body: "",
  refs: [],
  unconfirmed: false,
  corrected: false,
  ...over,
});

describe("the route codec", () => {
  it("reads and writes every route, canonically", () => {
    const cases: [string | null, string | null][] = [
      [null, null],
      ["", null],
      ["home", null],
      ["outlet/3", "outlet/3"],
      ["outlet/3/2020-11-04", "outlet/3/2020-11-04"],
      ["article/17", "article/17"],
      ["latest", "latest"],
      [
        "latest?outlet=2&kind=Opinion&followed=1&q=tax%20bill",
        "latest?outlet=2&kind=Opinion&followed=1&q=tax%20bill",
      ],
      // Parameters are written in a fixed order whatever the order read.
      ["latest?q=a&followed=1&outlet=4", "latest?outlet=4&followed=1&q=a"],
    ];
    for (const [input, out] of cases) expect(formatRoute(parseRoute(input)), String(input)).toBe(out);
    expect(parseRoute("outlet/3/2020-11-04")).toEqual({
      kind: "outlet",
      id: 3,
      date: { year: 2020, month: 11, day: 4 },
    });
    expect(parseRoute("latest?kind=Call&followed=1")).toEqual({
      kind: "latest",
      filter: { outlet: null, kind: "Call", followed: true, q: "" },
    });
  });

  it("treats anything unreadable as the home and never throws", () => {
    for (const bad of [
      "outlet",
      "outlet/x",
      "outlet/3/2020-02-30",
      "outlet/3/soon",
      "outlet/3/2020-11-04/extra",
      "article",
      "article/-1",
      "polls/3",
      "latest/2",
      "%%%",
    ]) {
      expect(parseRoute(bad), bad).toEqual({ kind: "home" });
    }
    // A bad filter value is dropped, a bad escape kept as written.
    expect(parseRoute("latest?kind=Gossip&outlet=abc")).toEqual(latestRoute());
    expect(parseRoute("latest?q=100%")).toEqual(latestRoute({ q: "100%" }));
  });

  it("builds routes with the helpers", () => {
    expect(formatRoute(outletRoute(5))).toBe("outlet/5");
    expect(formatRoute(outletRoute(5, { year: 2020, month: 1, day: 9 }))).toBe("outlet/5/2020-01-09");
    expect(formatRoute(latestRoute(NO_FILTER))).toBe("latest");
  });

  it("does day arithmetic across month and year ends", () => {
    expect(addDays({ year: 2020, month: 10, day: 31 }, 1)).toEqual({ year: 2020, month: 11, day: 1 });
    expect(addDays({ year: 2021, month: 1, day: 1 }, -1)).toEqual({ year: 2020, month: 12, day: 31 });
    expect(parseIsoDate("2020-02-29")).not.toBeNull();
    expect(parseIsoDate("2021-02-29")).toBeNull();
  });
});

describe("the model", () => {
  const follows: EntityRef[] = [{ kind: "Person", id: 9 }];
  const list = [
    art(0, { headline: "Tax bill passes", refs: [{ kind: "Bill", id: 1 }] }),
    art(1, { headline: "Rally in Reno", outlet: 2 as never, refs: [{ kind: "Person", id: 9 }] }),
    art(2, {
      headline: "Senate Tax vote",
      kind: "Opinion",
      refs: [
        { kind: "Bill", id: 1 },
        { kind: "Outlet", id: 0 },
      ],
    }),
    art(3, { headline: "Retraction", kind: "Correction", source: { kind: "Article", id: 0 } }),
  ];

  it("filters newest first by outlet, kind, follows and headline text", () => {
    expect(filterArticles(list, NO_FILTER, []).map((a) => a.id)).toEqual([3, 2, 1, 0]);
    expect(filterArticles(list, { ...NO_FILTER, outlet: 2 }, []).map((a) => a.id)).toEqual([1]);
    expect(filterArticles(list, { ...NO_FILTER, kind: "Opinion" }, []).map((a) => a.id)).toEqual([2]);
    expect(filterArticles(list, { ...NO_FILTER, followed: true }, follows).map((a) => a.id)).toEqual([1]);
    expect(filterArticles(list, { ...NO_FILTER, followed: true }, []).length).toBe(0);
    expect(filterArticles(list, { ...NO_FILTER, q: " TAX " }, []).map((a) => a.id)).toEqual([2, 0]);
    expect(isFollowed(art(5), [{ kind: "Outlet", id: 0 }])).toBe(true);
  });

  it("finds related stories by shared refs, not by a shared outlet, and a correction chain", () => {
    expect(relatedStories(list[0] as Article, list).map((a) => a.id)).toEqual([2]);
    // An outlet ref alone relates nothing.
    expect(relatedStories(art(8, { refs: [{ kind: "Outlet", id: 0 }] }), list)).toEqual([]);
    expect(correctionsOf(0, list).map((a) => a.id)).toEqual([3]);
  });

  it("reads the standfirst and the correction note from the rendered text", () => {
    expect(splitCorrection("It rained. Correction: it did not.")).toEqual({
      text: "It rained.",
      note: "it did not.",
    });
    expect(splitCorrection("It rained.")).toEqual({ text: "It rained.", note: null });
    expect(dekOf("First sentence here. And then more of the story.")).toBe("First sentence here.");
    // One sentence is all there is: no standfirst, nothing invented.
    expect(dekOf("Only one sentence.")).toBeNull();
    expect(dekOf("")).toBeNull();
    expect(paragraphs("One.\n\n\nTwo.\n")).toEqual(["One.", "Two."]);
  });
});
