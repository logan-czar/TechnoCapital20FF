// A world that starts before the 2020 epoch (1995-rework 3.1, 7.1; D990): negative hours in the
// calendar and the quarter phases, the politics calendar in both directions, and a real game
// started on 1 January 1995 on the 2020 data, since the 1995 data is not in yet.

import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../src/lib.ts";
import {
  isElectionYear,
  isPresidentYear,
  nextElectionAfter,
  senateClassUp,
} from "../src/politics/calendar.ts";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeFromHours,
  dateTimeHour,
  dateTimeMidnight,
  dateTimeNext,
  formatDateTime,
  simDateWeekday,
  simDateYmd,
} from "../src/time/calendar.ts";
import { nextPhaseStart, phaseAt } from "../src/time/quarter.ts";
import { DATETIME_START } from "../src/types/calendar.ts";
import { data } from "./common/index.ts";

const START_1995 = simDateYmd(1995, 1, 1);
const HOURS_1995_TO_2020 = 219_144;

describe("negative hours", () => {
  it("places 1 January 1995 and round-trips every hour of a day", () => {
    const t = dateTimeMidnight(START_1995);
    expect(t).toBe(-HOURS_1995_TO_2020);
    expect(dateTimeDate(t)).toEqual(START_1995);
    expect(formatDateTime(t)).toBe("1995-01-01 00:00");
    for (let h = 0; h < 24; h++) {
      const at = dateTimeAt(START_1995, h);
      expect(dateTimeDate(at)).toEqual(START_1995);
      expect(dateTimeHour(at)).toBe(h);
      expect(Object.is(dateTimeHour(at), -0)).toBe(false);
    }
  });

  it("knows real weekdays before the epoch", () => {
    expect(simDateWeekday(START_1995)).toBe("Sun");
    expect(simDateWeekday(simDateYmd(1996, 11, 5))).toBe("Tue");
  });

  it("steps across the epoch", () => {
    expect(dateTimeNext(dateTimeFromHours(-1))).toBe(DATETIME_START);
    expect(formatDateTime(-1)).toBe("2019-12-31 23:00");
  });

  it("names the quarter phases before the epoch", () => {
    const t = dateTimeMidnight(START_1995);
    expect(phaseAt(t).next_phase).toBe("Release");
    expect(dateTimeDate(nextPhaseStart(t, "Release"))).toEqual(simDateYmd(1995, 1, 2));
    expect(dateTimeDate(nextPhaseStart(t, "Locked"))).toEqual(simDateYmd(1995, 1, 9));
  });
});

describe("the politics calendar extends back from 2020", () => {
  it("holds votes on the real years", () => {
    expect([1994, 1995, 1996, 1997, 1998].map(isElectionYear)).toEqual([true, false, true, false, true]);
    expect([1992, 1994, 1996, 1998, 2000].map(isPresidentYear)).toEqual([true, false, true, false, true]);
  });

  it("puts up the real Senate classes", () => {
    expect([1994, 1996, 1998, 2000, 2002].map(senateClassUp)).toEqual([1, 2, 3, 1, 2]);
  });

  it("finds the first vote after a 1995 start", () => {
    expect(nextElectionAfter(START_1995)).toEqual(simDateYmd(1996, 11, 5));
  });
});

describe("a game started on 1 January 1995", () => {
  const new1995 = (seed: number) => {
    const made = simNew(structuredClone(data()), seed, { start_date: START_1995 });
    if (!made.ok) throw new Error(JSON.stringify(made.error));
    return made.value;
  };

  it("anchors the start state to the start date", () => {
    const sim = new1995(1);
    const w = simWorld(sim);
    expect(sim.now()).toBe(-HOURS_1995_TO_2020);
    const firstStock = w.market.stocks.find((s) => s.quoted);
    expect(firstStock?.bar.date).toEqual(START_1995);
    expect(w.companies[0]?.finance.archive.quarters.at(-1)?.period).toEqual({
      kind: "Quarter",
      quarter: { year: 1994, q: 4 },
    });
    const votes = w.companies.flatMap((c) => (c.ipo_next_vote ? [c.ipo_next_vote.year] : []));
    expect(votes.length).toBeGreaterThan(0);
    expect(new Set(votes)).toEqual(new Set([1995]));
  });

  it("runs past the first vote, with the 1996 class up and the same result for the same seed", () => {
    const end = dateTimeMidnight(simDateYmd(1997, 2, 1));
    const run = () => {
      const sim = new1995(7);
      while (sim.now() < end) sim.step();
      return sim;
    };
    const a = run();
    const elections = simWorld(a).politics.elections;
    expect(elections.length).toBe(1);
    expect(elections[0]?.date).toEqual(simDateYmd(1996, 11, 5));
    expect(elections[0]?.senate_class).toBe(2);
    expect(run().stateHash()).toBe(a.stateHash());
  }, 300_000);

  it("leaves a default start on the epoch", () => {
    const made = simNew(structuredClone(data()), 1);
    if (!made.ok) throw new Error(JSON.stringify(made.error));
    expect(made.value.now()).toBe(DATETIME_START);
  });
});
