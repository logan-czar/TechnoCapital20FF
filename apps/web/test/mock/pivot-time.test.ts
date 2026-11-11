// The mock's pivot world over time: the scripted fortnight before the vote (rumours, a bill, a
// resignation, by-date contracts), election night (returns in waves, calls, a wrong call taken
// back, a recount) and certification, when the contracts resolve and the player is paid.

import type { ContractRow, Notice, RaceReturns } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import { needsRecount } from "../../src/sim/mock/fixtures/races.ts";
import { MOCK_START, SCRIPT } from "../../src/sim/mock/fixtures/script.ts";
import { type Game, newGame } from "./common.ts";
import { checkPivotViews } from "./invariants.ts";

const named = (g: Game, key: string): ContractRow => {
  const id = g.sim.pivot?.markets.named[key];
  return g.views().markets.data.contracts[id as number] as ContractRow;
};
const paused = (notices: Notice[]) => notices.filter((n) => n.kind === "Paused");

describe("the scripted fortnight", () => {
  it("appends articles, posts and polls as the clock runs, and reruns the forecast", () => {
    const g = newGame(7);
    const v0 = g.views();
    const [articles, posts, polls] = [
      v0.feed.data.articles.length,
      v0.social.data.posts.length,
      v0.polls.data.polls.length,
    ];
    const first = v0.feed.data.articles[0];
    g.runTo(MOCK_START + 5 * 24);
    const v = g.views();
    expect(v.feed.data.articles.length).toBeGreaterThan(articles + 10);
    expect(v.social.data.posts.length).toBeGreaterThan(posts + 5);
    expect(v.polls.data.polls.length).toBeGreaterThan(polls + 3);
    // Lists only grow: what was there is still there, in place.
    expect(v.feed.data.articles[0]).toEqual(first);
    expect(v.forecast.data.updated).toEqual({ year: 2020, month: 10, day: 24 });
    // Every outlet's front page is one of the last days'.
    expect(v.feed.data.front_pages.some((p) => p.date.day === 24)).toBe(true);
  });

  it("moves contract prices with the forecast, hour by hour", () => {
    const g = newGame(7);
    const pres = g
      .views()
      .markets.data.contracts.filter((c) => c.kind === "RaceWinner" && c.status === "Open")
      .slice(0, 2);
    const before = g.sim.pivot?.history(pres[0]?.id as never)?.prices.length ?? 0;
    g.runTo(MOCK_START + 48);
    const hist = g.sim.pivot?.history(pres[0]?.id as never);
    expect(hist?.prices.length).toBe(before + 48);
    // A walk, not a jump: no hour moves the presidency's price by more than a few cents.
    const p = hist?.prices ?? [];
    for (let i = 1; i < p.length; i++)
      expect(Math.abs((p[i] as number) - (p[i - 1] as number))).toBeLessThanOrEqual(4);
    // The price follows the forecast site's odds to within a few cents.
    const odds = g.views().forecast.data.races[0]?.odds ?? [];
    const rows = g
      .views()
      .markets.data.contracts.filter(
        (c) =>
          c.subject?.kind === "Race" && c.subject.id === 0 && c.status === "Open" && c.kind === "RaceWinner",
      );
    expect(rows).toHaveLength(2);
    rows.forEach((c, i) => {
      expect(Math.abs((c.last ?? 0) - (odds[i]?.win ?? 0) * 100), c.title).toBeLessThan(12);
    });
  });

  it("confirms one rumour and debunks the other (pivot 8.3)", () => {
    const g = newGame(7);
    const rumours = () => g.views().social.data.posts.filter((p) => p.rumour !== null);
    expect(rumours()).toEqual([]);
    g.runTo(SCRIPT.rumour_true_posted);
    expect(rumours().map((p) => p.rumour)).toEqual(["Open"]);
    const leaves = named(g, "leaves");
    // The price alert the player set on that contract fires as the market moves on the rumour.
    g.runTo(SCRIPT.rumour_true_posted + 12);
    expect(
      g.views().notifications.data.items.some((n) => n.kind === "Alert" && n.refs[0]?.id === leaves.id),
    ).toBe(true);
    expect(named(g, "leaves").last ?? 0).toBeGreaterThan((leaves.last ?? 0) + 10);

    const notices = g.runTo(SCRIPT.rumour_true_confirmed);
    expect(rumours().map((p) => p.rumour)).toEqual(["Confirmed"]);
    // The secretary is out, the contract resolved Yes, and the player, who held it, was told and paused.
    const who = g.sim.pivot?.pol.interior as number;
    expect(g.views().people.data.people[who]).toMatchObject({ status: "Retired", office: null });
    expect(named(g, "leaves")).toMatchObject({ status: "Resolved", outcome: true });
    const notes = g.views().notifications.data.items.filter((n) => n.time === SCRIPT.rumour_true_confirmed);
    expect(notes.map((n) => n.kind)).toEqual(["Holding", "Resolution"]);
    expect(notes.every((n) => n.paused)).toBe(true);
    expect(paused(notices).length).toBeGreaterThan(0);
    expect(
      g.views().account.data.positions.some((p) => p.what.id === leaves.id && p.what.kind === "Contract"),
    ).toBe(false);

    g.runTo(SCRIPT.rumour_false_printed);
    expect(rumours().map((p) => p.rumour)).toEqual(["Confirmed", "Open"]);
    const printed = g.views().feed.data.articles.filter((a) => a.unconfirmed);
    expect(printed).toHaveLength(1);
    expect(printed[0]?.corrected).toBe(false);
    const dropout = named(g, "dropout");
    expect(dropout.status).toBe("Open");
    g.runTo(SCRIPT.rumour_false_debunked + 24);
    expect(rumours().map((p) => p.rumour)).toEqual(["Confirmed", "Debunked"]);
    expect(g.views().feed.data.articles[printed[0]?.id as number]?.corrected).toBe(true);
    expect(named(g, "dropout").last ?? 99).toBeLessThan(15);
    // A by-date contract resolves No at its date (pivot 10.4).
    g.runTo(SCRIPT.dropout_deadline);
    expect(named(g, "dropout")).toMatchObject({ status: "Resolved", outcome: false });
    checkPivotViews(g.views(), false);
  });

  it("advances a bill through the Senate to the President's desk and into law (pivot 7.1)", () => {
    const g = newGame(7);
    const bill = () => g.views().records.data.bills[1];
    expect(bill()?.stage).toBe("SenateFloor");
    const calls = g.views().records.data.roll_calls.length;
    const notices = g.runTo(SCRIPT.bill_senate_vote);
    expect(bill()?.stage).toBe("President");
    const rc = g.views().records.data.roll_calls.slice(calls);
    expect(rc.map((r) => [r.chamber, r.question, r.passed])).toEqual([
      ["Senate", "On cloture", true],
      ["Senate", "On passage", true],
    ]);
    // The tally is the members' votes (the slice), and cloture took three fifths of the 24 senators.
    const votes = g.sim.pivot?.rollCall(rc[0]?.id as number)?.votes ?? [];
    expect(votes).toHaveLength(24);
    expect(votes.filter((x) => x.vote === "Yea")).toHaveLength(rc[0]?.yeas as number);
    expect(rc[0]?.yeas).toBeGreaterThanOrEqual(15);
    // The player holds a contract on the bill: the roll call is a fixed pause (pivot 2.4 item 4).
    expect(
      g
        .views()
        .notifications.data.items.filter((n) => n.kind === "Holding" && n.time === SCRIPT.bill_senate_vote),
    ).toHaveLength(2);
    expect(paused(notices).length).toBeGreaterThan(0);
    // A nominee is named, and the contract on the confirmation is listed, then opens.
    expect(g.views().records.data.actions.at(-1)).toMatchObject({ kind: "Nomination" });
    expect(named(g, "confirm").status).toBe("Listed");
    g.runTo(SCRIPT.confirm_opens + 1);
    expect(named(g, "confirm").status).toBe("Open");

    g.runTo(SCRIPT.bill_signed);
    expect(bill()).toMatchObject({ stage: "Law", effective: { year: 2021, month: 1, day: 1 } });
    expect(named(g, "infra_law")).toMatchObject({ status: "Resolved", outcome: true });
    checkPivotViews(g.views(), false);
  });
});

describe("election night", () => {
  it("pauses at 00:00 on election day (pivot 2.4 item 3)", () => {
    const g = newGame(7);
    g.runTo(SCRIPT.election_day - 1);
    g.sim.paused = false;
    const notices = g.sim.step();
    expect(g.sim.paused).toBe(true);
    // Election day is a fixed pause (pivot 2.4 item 3), paused as its notification (D1037).
    const day = g.views().notifications.data.items.at(-1);
    expect(day).toMatchObject({ kind: "ElectionDay", paused: true, fixed: "ElectionDay" });
    expect(notices).toContainEqual({ kind: "Paused", reason: { kind: "Notification", id: day?.id } });
    // A Step that would run past it stops there too.
    const s = newGame(7);
    s.runTo(SCRIPT.election_day - 10);
    s.control({ kind: "Step", hours: 48 });
    for (let i = 0; i < 10 && !s.sim.paused; i++) s.host.tick(1000);
    expect(s.sim.now).toBe(SCRIPT.election_day);
    expect(s.sim.skip).toBeNull();
  });

  it("reports returns in waves, calls races, takes a wrong call back, and resolves at certification", () => {
    const g = newGame(7);
    const pivot = g.sim.pivot;
    if (!pivot) throw new Error("no pivot");
    g.runTo(SCRIPT.election_day + 18);
    expect(g.views().returns.data.election).toEqual({ year: 2020, month: 11, day: 3 });
    expect(g.views().returns.data.races.every((r) => r.polls_closed === null && r.reporting === 0)).toBe(
      true,
    );
    expect(g.views().races.data.races.every((r) => r.status === "General")).toBe(true);

    // The night, hour by hour: the count only grows, and each county's slice sums to its race's row.
    let prev: RaceReturns[] = g.views().returns.data.races;
    let waves = 0;
    for (let t = SCRIPT.election_day + 19; t <= SCRIPT.election_day + 72; t++) {
      g.runTo(t);
      const now = g.views().returns.data.races;
      now.forEach((r, i) => {
        const before = prev[i] as RaceReturns;
        expect(r.reporting, `race ${i} reporting`).toBeGreaterThanOrEqual(before.reporting);
        r.votes.forEach((x, k) => {
          expect(x.votes).toBeGreaterThanOrEqual(before.votes[k]?.votes as number);
        });
      });
      if (now[0]?.reporting !== prev[0]?.reporting) waves++;
      prev = now;
      if (t === SCRIPT.election_day + 23) {
        checkPivotViews(g.views(), false);
        // Mid-count: some counties in, some not, and the contracts still trade.
        const pres = now[0] as RaceReturns;
        expect(pres.reporting).toBeGreaterThan(0.05);
        expect(pres.reporting).toBeLessThan(0.95);
        const slice = pivot.countyReturns(0 as never);
        expect(slice?.counties.length).toBe(g.views().usmap_layers.data.counties.fips.length);
        pres.votes.forEach((x, k) => {
          expect(slice?.votes.reduce((a, row) => a + (row[k] as number), 0)).toBe(x.votes);
        });
        expect(slice?.reporting.some((s) => s === 0)).toBe(true);
        expect(slice?.reporting.some((s) => s > 0)).toBe(true);
        expect(g.views().races.data.races.filter((r) => r.status === "Counting").length).toBeGreaterThan(20);
        expect(
          g.views().markets.data.contracts.some((c) => c.kind === "RaceWinner" && c.status === "Open"),
        ).toBe(true);
      }
    }
    expect(waves).toBeGreaterThan(6);
    const done = g.views().returns.data.races;
    expect(done.every((r) => r.reporting === 1)).toBe(true);
    // Every race but the recount has a standing call, and the presidency's electoral votes are all called.
    const recountId = pivot.pol.recount_race as number;
    // The forced recount, and any other race that landed inside the margin by chance.
    const recounts = new Set(pivot.pol.races.filter(needsRecount).map((r) => r.id as number));
    expect(recounts.has(recountId)).toBe(true);
    for (const r of done) {
      const standing = r.calls.filter((c) => !c.retracted);
      if (recounts.has(r.race)) {
        expect(standing).toEqual([]);
        expect(r.recount).toBe(true);
        // The careless outlet called the forced one for the loser and took it back (pivot 9.3).
        if (r.race === recountId) expect(r.calls.filter((c) => c.retracted)).toHaveLength(1);
      } else {
        expect(standing.length, `race ${r.race} is called`).toBeGreaterThan(0);
        expect(new Set(standing.map((c) => c.person)).size).toBe(1);
      }
    }
    expect((done[0]?.electoral_votes ?? []).reduce((a, x) => a + x.votes, 0)).toBe(54);
    expect(g.views().races.data.races[recountId]?.status).toBe("Recount");
    expect(g.views().feed.data.articles.some((a) => a.headline.includes("withdraws its call"))).toBe(true);
    // Counted races have stopped trading and wait for certification; nothing has resolved on them yet.
    const raceRows = () =>
      g.views().markets.data.contracts.filter((c) => c.kind === "RaceWinner" && c.listed.month > 1);
    expect(raceRows().filter((c) => c.status === "Closed").length).toBeGreaterThan(90);
    expect(raceRows().some((c) => c.status === "Resolved")).toBe(false);
    expect(g.views().usmap_layers.version).toBe(1);

    // Certification, a few days later (pivot 9.4, 10.4).
    const worth = g.views().account.data.net_worth;
    const notices = g.runTo(SCRIPT.certification);
    expect(notices.filter((n) => n.kind === "Paused").length).toBeGreaterThan(0);
    const races = g.views().races.data.races;
    for (const r of races) {
      if (recounts.has(r.id)) continue;
      expect(r.status).toBe("Certified");
      const ret = g.views().returns.data.races[r.id] as RaceReturns;
      expect(ret.certified).toEqual({ year: 2020, month: 11, day: 9 });
      // The winner is who the calls said and, off the presidency, who has the most votes.
      expect(ret.calls.filter((c) => !c.retracted).every((c) => c.person === r.winner)).toBe(true);
      if (r.office !== "President") {
        const top = ret.votes.reduce((a, b) => (b.votes > a.votes ? b : a));
        expect(top.person).toBe(r.winner);
      }
    }
    const pres = g.views().returns.data.races[0] as RaceReturns;
    const ev = pres.electoral_votes ?? [];
    const evWinner = ev.reduce((a, b) => (b.votes > a.votes ? b : a));
    if (ev[0]?.votes !== ev[1]?.votes) expect(evWinner.person).toBe(races[0]?.winner);
    // Each race's contracts: resolved, one Yes, and it is the winner's.
    for (const c of raceRows()) {
      const race = races[c.subject?.id as number];
      if (recounts.has(race?.id as number)) {
        expect(c.status).toBe("Open");
        continue;
      }
      expect(c.status).toBe("Resolved");
      const winner = g.views().people.data.people[race?.winner as number]?.name as string;
      expect(c.outcome, c.title).toBe(c.title.startsWith(winner));
    }
    // The player held race contracts: paid and told.
    const res = g
      .views()
      .notifications.data.items.filter((n) => n.kind === "Resolution" && n.time === SCRIPT.certification);
    expect(res.length).toBeGreaterThanOrEqual(2);
    expect(g.views().account.data.net_worth).not.toBe(worth);
    // The map now shows this election.
    expect(g.views().usmap_layers.version).toBeGreaterThan(1);
    checkPivotViews(g.views(), false);

    // The recount finishes, and its race and the House contracts settle.
    g.runTo(SCRIPT.recount_done + 1);
    const rec = g.views().returns.data.races[recountId] as RaceReturns;
    expect(rec.recount).toBe(false);
    expect(rec.calls.filter((c) => !c.retracted).length).toBeGreaterThan(0);
    g.runTo(SCRIPT.recount_certification);
    expect(g.views().races.data.races.every((r) => r.status === "Certified")).toBe(true);
    const left = g.views().markets.data.contracts.filter((c) => c.status !== "Resolved");
    // Only the governing and people contracts with later dates are still open.
    expect(left.every((c) => c.kind === "Governing" || c.kind === "Person")).toBe(true);
    expect(left.length).toBeGreaterThanOrEqual(4);
    checkPivotViews(g.views(), false);
    g.runTo(SCRIPT.recount_certification + 72);
    checkPivotViews(g.views(), false);
  });

  it("holds its invariants through election night for other seeds", () => {
    for (const seed of [1, 2020]) {
      const g = newGame(seed);
      for (const t of [
        SCRIPT.election_day + 21,
        SCRIPT.election_day + 30,
        SCRIPT.certification,
        SCRIPT.recount_certification,
      ]) {
        g.runTo(t);
        checkPivotViews(g.views(), false);
      }
      expect(g.views().races.data.races.every((r) => r.status === "Certified")).toBe(true);
      const calls = g.views().returns.data.races.flatMap((r) => r.calls);
      expect(calls.some((c) => c.retracted)).toBe(true);
    }
  });
});
