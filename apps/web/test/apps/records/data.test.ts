// What the Records app works out from the views: lever changes in words, roll call thresholds,
// party totals, filing totals, seats, certified electoral votes and bill search.

import type { BillRow, FilingRow, PersonRow, StateReturns } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import {
  billLabel,
  CLOTURE_VOTES,
  filingsBy,
  filingTotals,
  filterBills,
  leaderIndex,
  leverText,
  officialElectoralVotes,
  partyTotals,
  pctText,
  seatOf,
  thresholdOf,
  usdFull,
} from "../../../src/apps/records/data.ts";
import { NO_FILTER } from "../../../src/apps/records/route.ts";

const names = { industry: (i: number) => `Industry ${i}`, state: (i: number) => `State ${i}` };
const d = (month: number, day: number) => ({ year: 2020, month, day });

describe("lever changes in plain words", () => {
  it("says what each lever becomes", () => {
    expect(leverText({ lever: "corp_tax", index: null, to: 0.25 }, names)).toBe(
      "Sets the national corporate tax rate to 25%.",
    );
    expect(leverText({ lever: "subsidy", index: 3, to: 0.02 }, names)).toBe(
      "Sets the subsidy to Industry 3 to 2% of demand.",
    );
    expect(leverText({ lever: "tariff", index: 1, to: 0.1 }, names)).toContain(
      "tariff on imported Industry 1",
    );
    expect(leverText({ lever: "state_growth", index: 5, to: 0.003 }, names)).toBe(
      "Shifts yearly growth in State 5 by +0.3%.",
    );
    expect(leverText({ lever: "regulation", index: 2, to: -0.01 }, names)).toContain("-1%");
    expect(leverText({ lever: "antitrust", index: 2, to: 0.4 }, names)).toContain("0.40");
  });

  it("writes percents without trailing zeros", () => {
    expect([pctText(0.1), pctText(0.025), pctText(0), pctText(-0.000001)]).toEqual([
      "10%",
      "2.5%",
      "0%",
      "0%",
    ]);
  });
});

describe("the threshold a roll call was held under (pivot 7.4, 7.5)", () => {
  it("cloture needs the cloture votes", () => {
    const t = thresholdOf({ question: "On cloture", yeas: 55, nays: 45 });
    expect(t).toMatchObject({ rule: "Cloture", needed: CLOTURE_VOTES });
    expect(CLOTURE_VOTES).toBe(60);
  });
  it("an override needs two thirds", () => {
    const t = thresholdOf({ question: "On overriding the veto", yeas: 250, nays: 180 });
    expect(t.rule).toBe("Override");
    expect(t.text).toContain("two thirds");
  });
  it("anything else needs a majority of those voting", () => {
    expect(thresholdOf({ question: "On passage", yeas: 218, nays: 210 })).toMatchObject({
      rule: "Majority",
      needed: 215,
    });
  });
});

describe("party totals", () => {
  it("counts each party's votes, independents only when one voted", () => {
    const party = (p: number) => (p < 10 ? "Democrats" : p < 20 ? "Republicans" : null);
    const rows = partyTotals(
      [
        { person: 1, vote: "Yea" },
        { person: 2, vote: "Nay" },
        { person: 11, vote: "Nay" },
        { person: 12, vote: "NotVoting" },
      ] as never,
      party,
    );
    expect(rows.map((r) => [r.party, r.Yea, r.Nay, r.NotVoting])).toEqual([
      ["Democrats", 1, 1, 0],
      ["Republicans", 0, 1, 1],
    ]);
    const withInd = partyTotals([{ person: 30, vote: "Yea" }] as never, party);
    expect(withInd.at(-1)).toMatchObject({ party: null, Yea: 1 });
  });
});

describe("campaign finance totals", () => {
  const filing = (person: number, month: number, raised: number, spent: number, cash: number): FilingRow =>
    ({ race: 1, person, through: d(month, 30), raised, spent, cash }) as FilingRow;
  it("sums receipts and spending and takes cash from the latest report", () => {
    const t = filingTotals([filing(1, 9, 100, 40, 60), filing(1, 6, 50, 30, 20), filing(1, 10, 10, 5, 65)]);
    expect(t).toMatchObject({ raised: 160, spent: 75, cash: 65, filings: 3, through: d(10, 30) });
    expect(filingTotals([])).toBeNull();
  });
  it("groups filings oldest first", () => {
    const g = filingsBy(
      [filing(1, 9, 1, 1, 1), filing(2, 7, 1, 1, 1), filing(1, 6, 1, 1, 1)],
      (f) => f.person as number,
    );
    expect([...g.keys()]).toEqual([1, 2]);
    expect(g.get(1)?.map((f) => f.through.month)).toEqual([6, 9]);
  });
  it("prints whole dollars", () => {
    expect([usdFull(1234567.4), usdFull(-50), usdFull(0)]).toEqual(["$1,234,567", "-$50", "$0"]);
  });
});

describe("seats", () => {
  const states = [
    { id: 1, name: "Virginia" },
    { id: 2, name: "West Virginia" },
  ];
  const person = (office: string | null, home = 1, status: PersonRow["status"] = "InOffice"): PersonRow =>
    ({ id: 9, home_state: home, status, office }) as PersonRow;
  it("reads the chamber, state and district from the title", () => {
    expect(seatOf(person("Representative, West Virginia 2"), states)).toEqual({
      chamber: "House",
      state: 2,
      district: 2,
    });
    expect(seatOf(person("Senator, Virginia"), states)).toEqual({
      chamber: "Senate",
      state: 1,
      district: null,
    });
  });
  it("finds no seat for anyone else", () => {
    expect(seatOf(person("Governor of Virginia"), states)).toBeNull();
    expect(seatOf(person("Senator, Virginia", 1, "Retired"), states)).toBeNull();
    expect(seatOf(person(null), states)).toBeNull();
  });
});

describe("what a certified count elects", () => {
  const st = (state: number, ev: number, votes: number[], certified: boolean): StateReturns =>
    ({
      state,
      electoral_votes: ev,
      votes: votes.map((v, i) => ({ person: 10 + i, votes: v })),
      certified: certified ? d(11, 9) : null,
      called: 10,
    }) as StateReturns;
  it("counts only certified states, however an outlet called the rest", () => {
    const ev = officialElectoralVotes([
      st(1, 3, [5, 9], true),
      st(2, 4, [9, 5], true),
      st(3, 10, [9, 5], false),
    ]);
    expect([...ev]).toEqual([
      [11, 3],
      [10, 4],
    ]);
  });
  it("a tie goes to the first candidate", () => {
    expect(leaderIndex([{ votes: 5 }, { votes: 5 }])).toBe(0);
    expect(leaderIndex([])).toBe(-1);
  });
});

describe("bill search", () => {
  const bill = (id: number, title: string, stage: BillRow["stage"], subject: string): BillRow =>
    ({
      id,
      title,
      summary: `About ${title}.`,
      sponsor: id,
      subject,
      stage,
      chamber_of_origin: id % 2 ? "Senate" : "House",
    }) as BillRow;
  const bills = [
    bill(0, "Rail Act", "Law", "Transport"),
    bill(1, "Tax Act", "Committee", "Tax"),
    bill(2, "Port Act", "Law", "Transport"),
  ];
  const sponsor = (id: number) => (id === 2 ? "Dana Reese" : "Other");
  it("filters by stage, chamber and subject", () => {
    expect(filterBills(bills, { ...NO_FILTER, stage: "Law" }, sponsor).map((b) => b.id)).toEqual([0, 2]);
    expect(filterBills(bills, { ...NO_FILTER, chamber: "Senate" }, sponsor).map((b) => b.id)).toEqual([1]);
    expect(filterBills(bills, { ...NO_FILTER, subject: "Tax" }, sponsor).map((b) => b.id)).toEqual([1]);
  });
  it("searches title, sponsor and number", () => {
    expect(filterBills(bills, { ...NO_FILTER, q: "rail" }, sponsor).map((b) => b.id)).toEqual([0]);
    expect(filterBills(bills, { ...NO_FILTER, q: "reese" }, sponsor).map((b) => b.id)).toEqual([2]);
    expect(filterBills(bills, { ...NO_FILTER, q: "s.b. 2" }, sponsor).map((b) => b.id)).toEqual([1]);
    expect(billLabel(bills[0] as BillRow)).toBe("H.B. 1");
  });
});
