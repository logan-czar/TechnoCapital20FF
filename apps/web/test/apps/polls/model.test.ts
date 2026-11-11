// The Polls app's pure model (apps/polls/model.ts): rating buckets from published odds, the poll
// average, the ballot order of a poll's shares and the races table's filter and sort.

import type { Poll, RaceRow } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import {
  AVERAGE_WINDOW_DAYS,
  closestRaces,
  filterRaceRows,
  formatOdds,
  pollAverage,
  pollColumns,
  pollLead,
  type RaceTableRow,
  ratingFor,
  ratingKey,
  ratingLabel,
  ratingOrder,
  shareOf,
  sortRaceRows,
  stageBallot,
  UNRATED,
} from "../../../src/apps/polls/model.ts";
import { DEFAULT_RACE_FILTERS } from "../../../src/apps/polls/route.ts";

const D = (day: number) => ({ year: 2020, month: 10, day });

function poll(id: number, day: number, sample: number, shares: [number, number][]): Poll {
  return {
    id,
    pollster: 0,
    race: 1,
    stage: "General",
    party: null,
    state: null,
    from: D(day - 4),
    to: D(day - 1),
    published: D(day),
    sample,
    shares: shares.map(([person, share]) => ({ person, share })) as Poll["shares"],
    undecided: 0.05,
    margin_of_error: 3,
  } as Poll;
}

describe("ratings", () => {
  it("buckets the leader's odds and names the side", () => {
    expect(ratingLabel(ratingFor(0.97, "D"))).toBe("Safe D");
    expect(ratingLabel(ratingFor(0.8, "R"))).toBe("Likely R");
    expect(ratingLabel(ratingFor(0.65, "D"))).toBe("Lean D");
    expect(ratingLabel(ratingFor(0.55, "R"))).toBe("Toss-up");
    expect(ratingKey(ratingFor(0.8, "R"))).toBe("likely-r");
    expect(ratingKey(ratingFor(0.5, "D"))).toBe("toss-up");
    expect(ratingKey(UNRATED)).toBe("unrated");
  });

  it("orders safe D to toss-up to safe R, with unrated last", () => {
    const order = [
      ratingFor(0.99, "D"),
      ratingFor(0.8, "D"),
      ratingFor(0.65, "D"),
      ratingFor(0.5, "D"),
      ratingFor(0.65, "R"),
      ratingFor(0.8, "R"),
      ratingFor(0.99, "R"),
      UNRATED,
    ].map(ratingOrder);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("never claims certainty", () => {
    expect(formatOdds(0.004)).toBe("<1%");
    expect(formatOdds(0.999)).toBe(">99%");
    expect(formatOdds(0.634)).toBe("63%");
  });
});

describe("polls", () => {
  it("reads shares by person, in the ballot's order", () => {
    const p = poll(0, 10, 1000, [
      [7, 0.4],
      [3, 0.35],
      [9, 0.1],
    ]);
    expect(shareOf(p, 3)).toBe(0.35);
    expect(shareOf(p, 99)).toBeNull();
    expect(pollColumns([p], [7, 3])).toEqual([7, 3, 9]);
    expect(pollColumns([], [7, 3])).toEqual([7, 3]);
    expect(pollLead(p)).toEqual({ leader: 7, points: expect.closeTo(5, 6) });
  });

  it("takes a primary's ballot from the primary, not the general", () => {
    const race = {
      id: 1,
      ballot: [1, 2],
      primaries: [
        { party: "Democrats", ballot: [1, 5, 6], date: D(1), winner: null },
        { party: "Republicans", ballot: [2], date: D(1), winner: null },
      ],
    } as unknown as RaceRow;
    expect(stageBallot(race, "general")).toEqual([1, 2]);
    expect(stageBallot(race, "primary-0")).toEqual([1, 5, 6]);
    expect(stageBallot(race, "primary-1")).toEqual([2]);
    expect(stageBallot(race, "primary-4")).toEqual([]);
  });

  it("averages the polls of the last window, weighted by sample", () => {
    const polls = [
      poll(0, 1, 1000, [
        [1, 0.5],
        [2, 0.4],
      ]),
      poll(1, 3, 3000, [
        [1, 0.4],
        [2, 0.5],
      ]),
      poll(2, 2 + AVERAGE_WINDOW_DAYS, 1000, [
        [1, 0.3],
        [2, 0.6],
      ]),
    ];
    const avg = pollAverage(polls, [1, 2]);
    expect(avg.map((a) => a.shares[0])).toEqual([0.5, expect.closeTo(0.425, 6), expect.closeTo(0.375, 6)]);
    // The first poll is out of the window by the last day of the average.
    expect(avg[2]?.shares[1]).toBeCloseTo((0.5 * 3000 + 0.6 * 1000) / 4000, 6);
    expect(pollAverage(polls, [9])[0]?.shares).toEqual([null]);
  });
});

describe("the races table", () => {
  const row = (
    id: number,
    office: RaceRow["office"],
    state: number | null,
    win: number | null,
    side: "D" | "R" = "D",
  ): RaceTableRow =>
    ({
      race: { id, office, state, title: `Race ${id}`, status: "General", winner: null } as RaceRow,
      forecast: null,
      rating: win === null ? UNRATED : ratingFor(win, side),
      leader: win === null ? null : { person: id, win },
      margin: win === null ? null : win * 10,
      polls: id,
      lastPoll: null,
    }) as RaceTableRow;
  const rows = [
    row(3, "House", 1, 0.55),
    row(1, "Senate", 1, 0.97),
    row(2, "Senate", 2, 0.8, "R"),
    row(4, "Governor", null, null),
  ];
  const names = {
    person: (id: number) => `P${id}`,
    state: (id: number | null) => (id === null ? "" : `S${id}`),
  };

  it("filters by office, state, rating and text", () => {
    const f = DEFAULT_RACE_FILTERS;
    expect(filterRaceRows(rows, { ...f, office: "Senate" }).map((r) => r.race.id)).toEqual([1, 2]);
    expect(filterRaceRows(rows, { ...f, state: 1 }).map((r) => r.race.id)).toEqual([3, 1]);
    expect(filterRaceRows(rows, { ...f, rating: "likely-r" }).map((r) => r.race.id)).toEqual([2]);
    expect(filterRaceRows(rows, { ...f, rating: "unrated" }).map((r) => r.race.id)).toEqual([4]);
    expect(filterRaceRows(rows, { ...f, q: " RACE 3 " }).map((r) => r.race.id)).toEqual([3]);
  });

  it("sorts with the unrated last in both directions and ties to the lower id", () => {
    expect(sortRaceRows(rows, "odds", false, names).map((r) => r.race.id)).toEqual([3, 2, 1, 4]);
    expect(sortRaceRows(rows, "odds", true, names).map((r) => r.race.id)).toEqual([1, 2, 3, 4]);
    expect(sortRaceRows(rows, "office", false, names).map((r) => r.race.id)).toEqual([4, 3, 1, 2]);
    expect(sortRaceRows(rows, "rating", false, names).map((r) => r.race.id)).toEqual([1, 3, 2, 4]);
  });

  it("lists the closest unfinished races first", () => {
    expect(closestRaces(rows, 2).map((r) => r.race.id)).toEqual([3, 2]);
  });
});
