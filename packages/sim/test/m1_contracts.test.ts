// The M1 contracts (pivot spec; D1029): what the lanes build against. Each test holds one promise
// of the contracts change: the old RNG streams did not move, the new World fields are neutral, the
// Weekly slot and the fidelity tag work and change nothing by themselves, `simRunUntil` is `simStep`
// without views, a Step runs its hours, and a player action is refused without touching the world.
// Not a Rust test.

import type { CountyAdjacencyRow, CountyRow, WorldData } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { geoStateEmpty, geoStateFromData } from "../src/geo/load.ts";
import { leversNeutral } from "../src/governing/levers.ts";
import { simApply, simNew, simRunUntil, simStateHash, simStep, simViews, simWorld } from "../src/lib.ts";
import { rngStreamsNew, rngStreamsNextU32 } from "../src/rng.ts";
import { SAVE_VERSION } from "../src/save.ts";
import { dateTimeDate, dateTimeMidnight, simDateWeekday, simDateYmd } from "../src/time/calendar.ts";
import {
  SLOT_VALUES,
  schedulerJobs,
  schedulerNew,
  schedulerRegister,
  schedulerRunSlots,
  slotGroup,
  slotIsDue,
  tickFactsNew,
} from "../src/time/scheduler.ts";
import { PLAYER_ACTION_KINDS, type PlayerAction } from "../src/types/action.ts";
import { MAX_STEP_HOURS } from "../src/types/control.ts";
import { STREAM_COUNT, STREAM_NUMBER, STREAM_VALUES } from "../src/types/draws.ts";
import type { InstrumentId, OrderId } from "../src/types/ids.ts";
import type { Notice } from "../src/types/notice.ts";
import { VIEW_NAMES } from "../src/types/views/index.ts";
import type { World } from "../src/types/world.ts";
import { VIEW_BUILDERS, viewIsPorted } from "../src/views/index.ts";
import { postedViewsNone, viewsPatchSince } from "../src/views/patch.ts";
import { data1995, unwrap } from "./common/index.ts";
import { data, minimalSim, testSim } from "./test_sim.ts";

const PIVOT_VIEWS = [
  "feed",
  "social",
  "polls",
  "forecast",
  "races",
  "people",
  "records",
  "markets",
  "account",
  "notifications",
  "districts",
  "usmap_layers",
  "returns",
] as const;

describe("M1 contracts: RNG streams and saves", () => {
  it("the five pivot streams come after the eight, whose first draws are as before", () => {
    expect(STREAM_COUNT).toBe(13);
    expect(STREAM_VALUES.slice(8)).toEqual(["Campaign", "Governing", "Media", "Bettors", "Count"]);
    expect(STREAM_VALUES.map((s) => STREAM_NUMBER[s])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Seed 42's first two raw draws per stream, recorded before the pivot streams were added (a
    // stream's state depends only on the seed and its own number, D9).
    const before: [string, number, number][] = [
      ["Cycle", 1610202773, 3798149094],
      ["Growth", 2395497289, 3909231304],
      ["Prices", 3211792438, 4205094533],
      ["Ai", 4100989471, 548733862],
      ["Gen", 3894575859, 1092027226],
      ["Politics", 732589001, 2259185346],
      ["Era", 4221657584, 3862151502],
      ["Events", 1636767341, 3032881659],
    ];
    const r = rngStreamsNew(42);
    const got = STREAM_VALUES.slice(0, 8).map((s) => [s, rngStreamsNextU32(r, s), rngStreamsNextU32(r, s)]);
    expect(got).toEqual(before);
    expect(r.state.length).toBe(13);
  });

  it("the save version moved past the M1 one (7 is M2's, D1037)", () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(6);
  });
});

describe("M1 contracts: World fields", () => {
  it("a 2020 world is Full with neutral levers, no counties and no rest-of-world block", () => {
    const w = simWorld(testSim(1));
    expect(w.fidelity).toBe("Full");
    const usa = w.countries[w.politics.country] as World["countries"][number];
    expect(w.levers).toEqual(leversNeutral(w.industries.length, w.politics.states.length, usa.corp_tax_rate));
    expect(w.levers.corp_tax).toBe(usa.corp_tax_rate);
    for (const k of ["regulation", "subsidy", "antitrust", "tariff"] as const) {
      expect(w.levers[k]).toEqual(w.industries.map(() => 0));
    }
    expect(w.levers.state_growth.length).toBe(w.politics.states.length);
    expect(w.geo).toEqual(geoStateEmpty());
    expect(w.industries.every((i) => i.row_assets === 0)).toBe(true);
  });

  it("a historical world is Coarse", () => {
    const w = simWorld(unwrap(simNew(data1995(), 1), "1995 world"));
    expect(w.fidelity).toBe("Coarse");
    // Lane S1's county data (pivot 5.1): geo_1995.test.ts holds the rest.
    expect(w.geo.counties.length).toBe(3142);
    expect(w.levers.fiscal).toBe(0);
  });

  it("counties load in FIPS order with their neighbours, and a bad reference is named", () => {
    const county = (fips: string, state: string): CountyRow => ({
      fips,
      state,
      name: `County ${fips}`,
      pop_1990: 1000,
      lean_pts: -3.5,
      spread: 2,
      elasticity: 1,
      turnout: 0.5,
      centroid_x: 1,
      centroid_y: 2,
    });
    const pair = (fips: string, neighbour_fips: string): CountyAdjacencyRow => ({ fips, neighbour_fips });
    const input = (counties: CountyRow[], adjacency: CountyAdjacencyRow[]): WorldData =>
      ({
        counties: { file: "counties.csv", rows: counties, lines: [] },
        county_adjacency: { file: "county-adjacency.csv", rows: adjacency, lines: [] },
      }) as unknown as WorldData;
    const rows = [county("02013", "Alaska"), county("01003", "Alabama"), county("01001", "Alabama")];
    const links = [
      pair("01001", "01003"),
      pair("01003", "01001"),
      pair("01003", "02013"),
      pair("02013", "01003"),
    ];
    const geo = unwrap(geoStateFromData(input(rows, links), ["Alabama", "Alaska"]));
    expect(geo.plans).toEqual([]);
    expect(geo.counties.map((c) => [c.fips, c.state, c.neighbours])).toEqual([
      ["01001", 0, [1]],
      ["01003", 0, [0, 2]],
      ["02013", 1, [1]],
    ]);
    expect(geo.counties[0]).toMatchObject({ population: 1000, lean: -3.5, spread: 2, centroid: [1, 2] });
    const noState = geoStateFromData(input([county("01001", "Atlantis")], []), ["Alabama"]);
    expect(noState).toMatchObject({
      ok: false,
      error: { kind: "MissingRef", field: "state", value: "Atlantis" },
    });
    const noCounty = geoStateFromData(input(rows, [pair("01001", "99999")]), ["Alabama", "Alaska"]);
    expect(noCounty).toMatchObject({ ok: false, error: { kind: "MissingRef", field: "neighbour_fips" } });
    const twice = geoStateFromData(input([rows[0] as CountyRow, rows[0] as CountyRow], []), ["Alaska"]);
    expect(twice).toMatchObject({ ok: false, error: { kind: "Duplicate", key: "02013" } });
  });
});

describe("M1 contracts: the scheduler", () => {
  it("the Weekly slot is due at 00:00 on Mondays only, after the daily slots", () => {
    const weekly = SLOT_VALUES.filter((s) => slotGroup(s) === "Weekly");
    expect(weekly).toEqual(["WeeklyJobs"]);
    const at = (s: (typeof SLOT_VALUES)[number]) => SLOT_VALUES.indexOf(s);
    expect(at("WeeklyJobs")).toBe(at("DailyZoneConfidence") + 1);
    expect(at("WeeklyJobs")).toBeLessThan(at("MonthlyAiEvents"));
    let due = 0;
    const start = dateTimeMidnight(simDateYmd(2020, 1, 1));
    for (let t = start; t < start + 24 * 28; t++) {
      const is = slotIsDue("WeeklyJobs", tickFactsNew(t));
      expect(is).toBe(t % 24 === 0 && simDateWeekday(dateTimeDate(t)) === "Mon");
      if (is) due += 1;
    }
    expect(due).toBe(4);
  });

  it("a job tagged with a fidelity runs only in a world that has it", () => {
    const sim = minimalSim(1);
    const ran: string[] = [];
    const s = schedulerNew();
    schedulerRegister(s, "Alerts", "both", () => ran.push("both"));
    schedulerRegister(s, "Alerts", "coarse", () => ran.push("coarse"), { fidelity: "Coarse" });
    schedulerRegister(s, "Alerts", "full", () => ran.push("full"), { fidelity: "Full" });
    expect(schedulerJobs(s, "Alerts").map(([name, , fidelity]) => [name, fidelity])).toEqual([
      ["both", null],
      ["coarse", "Coarse"],
      ["full", "Full"],
    ]);
    const world = simWorld(sim);
    const ctx = { facts: tickFactsNew(world.clock) } as never;
    ran.length = 0;
    world.fidelity = "Coarse";
    schedulerRunSlots(s, ["Alerts"], world, ctx);
    expect(ran).toEqual(["both", "coarse"]);
    ran.length = 0;
    world.fidelity = "Full";
    schedulerRunSlots(s, ["Alerts"], world, ctx);
    expect(ran).toEqual(["both", "full"]);
  });
});

describe("M1 contracts: running the sim", () => {
  it("simRunUntil gives simStep's state, with the views rebuilt once", () => {
    const until = simDateYmd(2020, 2, 15);
    const stepped = testSim(3);
    while (stepped.now() < dateTimeMidnight(until)) simStep(stepped);
    const ran = testSim(3);
    const seen: number[] = [];
    const result = simRunUntil(ran, until, (p) => {
      seen.push(p.done);
      expect(p.total).toBe(45 * 24);
      return undefined;
    });
    expect(result).toEqual({ ticks: 45 * 24, ended: false, cancelled: false });
    expect(seen).toEqual([30 * 24, 45 * 24]);
    expect(simStateHash(ran)).toBe(simStateHash(stepped));
    // The run rebuilt every view at its end, as a load does; so load the stepped game to compare.
    unwrap(stepped.loadBytes(stepped.saveBytes()));
    const a = simViews(ran) as unknown as Record<string, { data: unknown }>;
    const b = simViews(stepped) as unknown as Record<string, { data: unknown }>;
    for (const n of VIEW_NAMES) expect(a[n]?.data, n).toEqual(b[n]?.data);
    // Already there: nothing runs.
    expect(simRunUntil(ran, until).ticks).toBe(0);
  });

  it("simRunUntil stops when its progress callback says so", () => {
    const sim = testSim(3);
    const result = simRunUntil(sim, simDateYmd(2021, 1, 1), () => false);
    expect(result).toEqual({ ticks: 30 * 24, ended: false, cancelled: true });
    expect(sim.now()).toBe(30 * 24);
  });

  it("a Step runs its hours and pauses; an alert set to pause ends it early", () => {
    const sim = minimalSim(1);
    expect(sim.apply({ kind: "Step", hours: 0 })).toEqual({
      ok: false,
      error: { kind: "BadStep", hours: 0 },
    });
    expect(sim.apply({ kind: "Step", hours: MAX_STEP_HOURS + 1 }).ok).toBe(false);
    expect(sim.apply({ kind: "Step", hours: 1.5 }).ok).toBe(false);
    expect(unwrap(sim.apply({ kind: "Step", hours: 3 }))).toEqual([]);
    expect(sim.controls().paused).toBe(false);
    expect(sim.clock().skipping).toBeNull();
    const notices: Notice[][] = [];
    while (!sim.controls().paused) notices.push(sim.step());
    expect(notices).toEqual([
      [{ kind: "TickDone", time: 1 }],
      [{ kind: "TickDone", time: 2 }],
      [
        { kind: "Paused", reason: { kind: "StepDone" } },
        { kind: "TickDone", time: 3 },
      ],
    ]);
    expect(sim.controls().skip).toBeNull();
    // 2020-01-02 00:00 is the release, whose alert pauses by default: a 30-hour step stops there.
    sim.apply({ kind: "Step", hours: 30 });
    while (!sim.controls().paused) sim.step();
    expect(sim.now()).toBe(24);
    expect(sim.controls().skip).toBeNull();
  });

  it("every player action is refused as not available, and the state does not move", () => {
    const sim = testSim(5);
    const before = simStateHash(sim);
    const ref = { kind: "Person" as const, id: 0 };
    const actions: PlayerAction[] = [
      {
        kind: "PlaceOrder",
        venue: "Exchange",
        instrument: 0 as InstrumentId,
        side: "Buy",
        qty: 10,
        limit: 55,
        tif: "Gtc",
      },
      { kind: "CancelOrder", order: 0 as OrderId },
      { kind: "Transfer", from: "Brokerage", to: "Exchange", amount: 100 },
      { kind: "Follow", target: ref },
      { kind: "Unfollow", target: ref },
      { kind: "AlertRuleAdd", rule: { target: ref, when: { kind: "Any" }, pause: true } },
      { kind: "AlertRuleRemove", rule: 0 },
      { kind: "NotificationsRead", through: 0 },
    ];
    expect(actions.map((a) => a.kind)).toEqual([...PLAYER_ACTION_KINDS]);
    for (const action of actions) {
      expect(sim.act(action)).toEqual({ ok: false, error: { kind: "NotAvailable", action: action.kind } });
    }
    expect(simStateHash(sim)).toBe(before);
  });
});

describe("M1 contracts: the pivot views", () => {
  it("are registered after the thirty, unported, empty and never posted", () => {
    expect(VIEW_NAMES.slice(30)).toEqual([...PIVOT_VIEWS]);
    const sim = testSim(1);
    simApply(sim, { kind: "Resume" });
    for (let i = 0; i < 48; i++) simStep(sim);
    const views = simViews(sim);
    // The M2 lanes port theirs: v_people is lane C's (D1041).
    const unported = PIVOT_VIEWS.filter((n) => n !== "people");
    expect(viewIsPorted("people")).toBe(true);
    for (const n of unported) {
      expect(viewIsPorted(n), n).toBe(false);
      expect(views[n].data, n).toEqual(VIEW_BUILDERS[n].empty());
      expect(views[n].version, n).toBe(1);
    }
    const patch = viewsPatchSince(views, postedViewsNone());
    for (const n of unported) expect(n in patch, n).toBe(false);
    expect(data().counties.rows).toEqual([]);
  });
});
