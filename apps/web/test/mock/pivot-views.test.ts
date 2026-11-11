// The mock's pivot world at a new game: what the 13 pivot views hold, that they are consistent
// with each other, that hidden fields are hidden, that the same seed gives the same frames, and
// how big the frames are.

import type { FromSim, ViewName } from "@tc20ff/sim";
import { dateTimeDate, VIEW_NAMES } from "@tc20ff/sim";
import { describe, expect, it } from "vitest";
import { MOCK_HISTORY_START, MOCK_START, SCRIPT } from "../../src/sim/mock/fixtures/script.ts";
import { SimHost } from "../../src/sim/mock/host.ts";
import { MOCK_PIVOT } from "../../src/sim/mock/mockSim.ts";
import { PIVOT_VIEWS } from "../../src/sim/mock/pivot.ts";
import { bytes, mockWorld, newGame } from "./common.ts";
import { checkPivotViews } from "./invariants.ts";

/**
 * The most the pivot views may weigh as JSON in a new game's first frame and in one hour's frame.
 * The pre-pivot views (price bars, company rows, places, quotes) weigh several times more and are
 * not this lane's to shrink; the test prints both.
 */
const PIVOT_INITIAL_BUDGET = 600_000;
const PIVOT_HOUR_BUDGET = 300_000;

describe("the mock's pivot world at a new game", () => {
  it("starts on 2020-10-20, paused, with every pivot view filled", () => {
    const g = newGame();
    const v = g.views();
    expect(g.sim.now).toBe(MOCK_START);
    expect(dateTimeDate(g.sim.now)).toEqual({ year: 2020, month: 10, day: 20 });
    expect(g.sim.paused).toBe(true);
    const first = g.log[0];
    if (first?.kind !== "Frame") throw new Error("no frame");
    for (const name of PIVOT_VIEWS) expect(first.views[name], name).toBeDefined();

    const races = v.races.data.races;
    const count = (office: string) => races.filter((r) => r.office === office).length;
    expect([count("President"), count("Senate"), count("House"), count("Governor")]).toEqual([1, 12, 30, 5]);
    expect(v.races.data.cycle).toBe(2020);
    expect(v.usmap_layers.data.states).toHaveLength(12);
    expect(v.usmap_layers.data.counties.fips.length).toBeGreaterThan(100);
    expect(v.districts.data.districts).toHaveLength(30);
    expect(v.people.data.people.length).toBeGreaterThan(100);
    // The presidency: an incumbent and a challenger field of five with its primary behind it.
    const pres = races[0];
    expect(pres?.candidates.map((c) => c.status).sort()).toEqual(
      ["DroppedOut", "DroppedOut", "LostPrimary", "LostPrimary", "Nominee", "Nominee"].sort(),
    );
    expect(v.polls.data.polls.some((p) => p.stage === "Primary")).toBe(true);

    const feed = v.feed.data;
    expect(feed.outlets.filter((o) => o.kind === "Wire")).toHaveLength(1);
    expect(feed.outlets.filter((o) => o.kind === "Regional")).toHaveLength(12);
    expect(feed.articles.length).toBeGreaterThan(40);
    expect(feed.front_pages.length).toBeGreaterThan(5);
    expect(v.polls.data.pollsters).toHaveLength(6);
    expect(v.polls.data.polls.length).toBeGreaterThan(40);
    expect(v.forecast.data.updated).toEqual({ year: 2020, month: 10, day: 19 });
    expect(v.forecast.data.races).toHaveLength(48);
    expect(v.social.data.posts.length).toBeGreaterThan(20);
    for (const kind of ["Politician", "Campaign", "Pundit", "Pollster", "Outlet", "Anonymous"]) {
      expect(
        v.social.data.handles.some((h) => h.kind === kind),
        kind,
      ).toBe(true);
    }

    // Bills at different stages, with roll calls, executive actions and filings.
    const stages = new Set(v.records.data.bills.map((b) => b.stage));
    for (const s of ["Drafted", "Committee", "HouseFloor", "SenateFloor", "Law", "Dead"]) {
      expect(stages.has(s as never), s).toBe(true);
    }
    expect(v.records.data.roll_calls.length).toBeGreaterThanOrEqual(8);
    expect(new Set(v.records.data.actions.map((a) => a.kind))).toEqual(
      new Set(["Nomination", "Confirmation", "Order", "Veto"]),
    );
    expect(v.records.data.filings.length).toBeGreaterThan(150);

    // Contracts of every kind of pivot 10.2, some already resolved.
    const kinds = new Set(v.markets.data.contracts.map((c) => c.kind));
    expect(kinds).toEqual(new Set(["RaceWinner", "Chamber", "Bracket", "Governing", "Person"]));
    expect(v.markets.data.contracts.some((c) => c.status === "Resolved")).toBe(true);
    expect(v.markets.data.contracts.filter((c) => c.status === "Open").length).toBeGreaterThan(100);

    // The player: cash at both venues, positions on both, open and closed orders, fills, notices.
    const a = v.account.data;
    expect(a.open).toBe(true);
    expect(a.cash.every((c) => c.cash > 1000)).toBe(true);
    expect(new Set(a.positions.map((p) => p.venue))).toEqual(new Set(["Brokerage", "Exchange"]));
    expect(
      a.positions.some((p) => p.qty < 0),
      "a No side",
    ).toBe(true);
    expect(new Set(a.orders.map((o) => o.status))).toEqual(
      new Set(["Open", "Filled", "Cancelled", "Expired"]),
    );
    expect(a.fills.length).toBeGreaterThanOrEqual(6);
    expect(a.follows.length).toBe(6);
    expect(a.alert_rules.length).toBe(3);
    expect(a.net_worth).toBeGreaterThan(40_000);
    expect(a.net_worth).toBeLessThan(60_000);
    expect(v.notifications.data.items.some((n) => n.kind === "Fill")).toBe(true);
    expect(v.notifications.data.items.some((n) => n.kind === "Resolution")).toBe(false);
    // Nothing is counted before election day.
    expect(v.returns.data).toEqual({ election: null, races: [] });
  });

  it("holds its invariants for several seeds, and through a week of ticks", () => {
    for (const seed of [1, 2, 3, 20201103]) {
      const g = newGame(seed);
      checkPivotViews(g.views(), false);
    }
    const g = newGame(11);
    for (let day = 1; day <= 7; day++) {
      g.runTo(MOCK_START + day * 24);
      checkPivotViews(g.views(), false);
    }
  });

  it("shows hidden stats only with Omniscient, which only a debug mock allows (pivot 5.11)", () => {
    const release = newGame(5);
    expect(release.control({ kind: "SetOmniscient", on: true })).toEqual({
      kind: "SimError",
      error: { kind: "DebugOnly" },
    });
    checkPivotViews(release.views(), false);

    const debug = newGame(5, { debug: true });
    const before = debug.views().people.version;
    expect(debug.control({ kind: "SetOmniscient", on: true }).kind).toBe("Ok");
    const v = debug.views();
    expect(v.omniscient).toBe(true);
    expect(v.clock.data.omniscient).toBe(true);
    expect(v.people.version).toBeGreaterThan(before);
    checkPivotViews(v, true);
    const p = v.people.data.people[0];
    expect(p?.skills?.persuasion).toBeGreaterThanOrEqual(0);
    expect(v.usmap_layers.data.counties.lean?.length).toBe(v.usmap_layers.data.counties.fips.length);
    // The frame after the control carried the views with hidden fields, and only those.
    const frame = debug.log[debug.log.length - 2];
    if (frame?.kind !== "Frame") throw new Error("no frame");
    expect(frame.views.people).toBeDefined();
    expect(frame.views.markets).toBeUndefined();
    expect(debug.control({ kind: "SetOmniscient", on: false }).kind).toBe("Ok");
    checkPivotViews(debug.views(), false);
  });

  it("is deterministic: the same seed and controls give the same frames", () => {
    const run = (seed: number): string[] => {
      const host = new SimHost(mockWorld(), MOCK_PIVOT);
      const out: FromSim[] = [];
      out.push(...host.handle({ kind: "NewGame", id: 1, seed }));
      out.push(...host.handle({ kind: "Control", id: 2, control: { kind: "Step", hours: 72 } }));
      for (let i = 0; i < 400 && host.sim?.paused === false; i++) out.push(...host.tick(1000));
      out.push(
        ...host.handle({
          kind: "Act",
          id: 3,
          action: { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 500 },
        }),
      );
      out.push(...host.handle({ kind: "Control", id: 4, control: { kind: "Step", hours: 30 } }));
      for (let i = 0; i < 400 && host.sim?.paused === false; i++) out.push(...host.tick(1000));
      return out.map((m) => JSON.stringify(m));
    };
    const a = run(42);
    const b = run(42);
    expect(a.length).toBeGreaterThan(6);
    expect(a).toEqual(b);
    const c = run(43);
    expect(c[0]).not.toEqual(a[0]);
  });

  it("can start from the first day of its own history", () => {
    const g = newGame(3, { start: MOCK_HISTORY_START });
    expect(g.sim.now).toBe(MOCK_HISTORY_START);
    const v = g.views();
    checkPivotViews(v, false);
    // The player has opened an account and done nothing with it yet.
    expect(v.account.data.cash).toEqual([
      { venue: "Brokerage", cash: 50_000 },
      { venue: "Exchange", cash: 0 },
    ]);
    expect(v.account.data.positions).toEqual([]);
    expect(v.feed.data.articles).toEqual([]);
    g.runTo(SCRIPT.infra_house);
    checkPivotViews(g.views(), false);
    expect(g.views().records.data.bills[1]?.stage).toBe("SenateFloor");
  });

  it("without the pivot option is the pre-pivot mock: empty views, no actions", () => {
    const host = new SimHost(mockWorld());
    host.handle({ kind: "NewGame", id: 1, seed: 7 });
    expect(host.sim?.now).toBe(0);
    expect(host.sim?.pivot).toBeNull();
    expect(host.sim?.views.markets.data.contracts).toEqual([]);
    expect(host.slice({ view: "markets", contract: 0 as never })).toBeNull();
  });
});

describe("the mock's frame sizes", () => {
  it("keeps the first frame and an hour's frame inside their budgets", () => {
    const g = newGame(7);
    const first = g.log[0];
    if (first?.kind !== "Frame") throw new Error("no frame");
    const initial = bytes(first);
    const perView = (frame: FromSim) => {
      if (frame.kind !== "Frame") return {};
      const out: Record<string, number> = {};
      for (const [k, x] of Object.entries(frame.views)) out[k] = bytes(x);
      return out;
    };
    const initialViews = perView(first);
    const pivotInitial = PIVOT_VIEWS.reduce((a, n) => a + (initialViews[n] ?? 0), 0);

    // A day of single-hour frames, before any Want: every moved view, whole.
    g.sim.paused = false;
    const hours: number[] = [];
    const pivotHours: number[] = [];
    const seen: Record<string, number> = {};
    for (let h = 0; h < 24; h++) {
      g.sim.step();
      const f = g.host.tick(0)[0];
      if (f?.kind !== "Frame") throw new Error("no frame");
      hours.push(bytes(f));
      const sizes = perView(f);
      pivotHours.push(PIVOT_VIEWS.reduce((a, n) => a + (sizes[n] ?? 0), 0));
      for (const [k, n] of Object.entries(sizes)) seen[k] = Math.max(seen[k] ?? 0, n);
    }
    const sorted = [...hours].sort((a, b) => a - b);
    const median = sorted[12] as number;
    const pivotMedian = [...pivotHours].sort((a, b) => a - b)[12] as number;

    // With a Want for two views, as an app with one window open sends.
    const w = newGame(7);
    w.host.handle({ kind: "Want", views: ["clock", "markets"] as ViewName[], slices: [] });
    w.sim.paused = false;
    const wanted: number[] = [];
    for (let h = 0; h < 24; h++) {
      w.sim.step();
      const f = w.host.tick(0)[0];
      if (f?.kind !== "Frame") throw new Error("no frame");
      expect(Object.keys(f.views).every((k) => ["refresh", "clock", "markets"].includes(k))).toBe(true);
      wanted.push(bytes(f));
    }
    const wantedMedian = [...wanted].sort((a, b) => a - b)[12] as number;
    console.log(
      `mock frame sizes (JSON bytes): first frame ${initial} (pivot views ${pivotInitial}); ` +
        `hourly frame median ${median}, max ${sorted[23]} (pivot views median ${pivotMedian}, max ${Math.max(...pivotHours)}); ` +
        `hourly frame wanting clock+markets median ${wantedMedian}\n` +
        `first frame by view: ${JSON.stringify(initialViews)}\nlargest hourly by view: ${JSON.stringify(seen)}`,
    );
    expect(pivotInitial).toBeLessThan(PIVOT_INITIAL_BUDGET);
    expect(Math.max(...pivotHours)).toBeLessThan(PIVOT_HOUR_BUDGET);
    expect(wantedMedian).toBeLessThan(median);
    // A view that was not wanted goes out, whole, when it is.
    const late = w.host.handle({
      kind: "Want",
      views: ["clock", "markets", "feed"] as ViewName[],
      slices: [],
    })[0];
    expect(late?.kind === "Frame" && late.views.feed !== undefined).toBe(true);
    expect(VIEW_NAMES).toContain("feed");
  });
});
