// The M2 contracts (pivot spec; D1037): what the M2 lanes build against. Each test holds one promise
// of the contracts change: the new World tables are empty at load, the lanes' slots exist in their
// order and are empty, a notification pauses the game unless its fixed pause is off, the append
// lists and changed rows travel in the frame patch, the pivot slices are named, the instrument and
// district-ref rules round-trip, and the persons table's helpers keep their promises. Not a Rust test.

import { describe, expect, it } from "vitest";
import { geoStateEmpty } from "../src/geo/load.ts";
import { scheduler } from "../src/jobs.ts";
import { simApply, simClock, simNew, simSlice, simStateHash, simViews, simWorld } from "../src/lib.ts";
import { challengerFor } from "../src/politics/careers.ts";
import { HOUSE_RANGES } from "../src/politics/generate.ts";
import {
  officeHolderOf,
  officeLeave,
  officeSeatOrder,
  officeTake,
  personAdd,
  personGet,
  personsStateEmpty,
  seatKey,
} from "../src/politics/people.ts";
import { rngStreamsDraws, rngStreamsNew, rngStreamsNextU32 } from "../src/rng.ts";
import { SAVE_VERSION } from "../src/save.ts";
import { controlsDefault } from "../src/time/control.ts";
import {
  jobCtxDetached,
  jobCtxNew,
  jobCtxNotify,
  jobCtxPauseRequest,
  SLOT_VALUES,
  schedulerJobs,
  slotGroup,
  tickFactsNew,
} from "../src/time/scheduler.ts";
import {
  contractInstrument,
  instrumentTarget,
  instrumentVenue,
  STOCK_INSTRUMENT_BASE,
  stockInstrument,
} from "../src/types/action.ts";
import { STREAM_VALUES } from "../src/types/draws.ts";
import type { CompanyId, ContractId, PersonId, RaceId, UsStateId } from "../src/types/ids.ts";
import { APPEND_LISTS, type SliceKey, sliceId } from "../src/types/protocol.ts";
import type { Person } from "../src/types/state/persons.ts";
import { districtRefId, districtRefParts } from "../src/types/views/districts.ts";
import type { Article } from "../src/types/views/feed.ts";
import type { SimViews } from "../src/types/views/index.ts";
import type { World } from "../src/types/world.ts";
import { type PortedViews, postedViewsNone, viewsPatchSince } from "../src/views/patch.ts";
import { data1995, unwrap } from "./common/index.ts";
import { testSim } from "./test_sim.ts";

describe("M2 contracts: state", () => {
  it("the save version is M2's", () => {
    expect(SAVE_VERSION).toBe(7);
  });

  it("a world loads with empty elections, no player, and empty geo tables (persons: lane C, D1041)", () => {
    const w = simWorld(testSim(1));
    // Lane C's `personsStart` seats every office at load (packages/sim/test/careers/).
    expect(w.persons.offices.length).toBeGreaterThan(0);
    expect(w.elections.races).toEqual([]);
    expect(w.elections.calendar.next_general).toBeNull();
    expect(w.player).toBeNull();
    expect(w.geo).toEqual(geoStateEmpty());
    // The 1995 world's start seats its office holders as persons and opens 1995's races (D1040).
    const h = simWorld(unwrap(simNew(data1995(), 1), "1995 world"));
    expect(h.persons.offices.length).toBeGreaterThan(0);
    expect(h.elections.races.length).toBeGreaterThan(0);
    expect(h.player).toBeNull();
    // Lane G fills the 1995 world's seats and plans at load (D1039); no census or challenge yet.
    expect([h.geo.censuses, h.geo.challenges, h.geo.history]).toEqual([[], [], []]);
  });

  it("the lanes' slots follow DailyPolitics in G, C, E order, the player's are hourly and daily and hold its jobs, the rest are empty", () => {
    const at = (s: (typeof SLOT_VALUES)[number]) => SLOT_VALUES.indexOf(s);
    expect(at("DailyGeo")).toBe(at("DailyPolitics") + 1);
    expect(at("DailyCareers")).toBe(at("DailyGeo") + 1);
    expect(at("DailyElections")).toBe(at("DailyCareers") + 1);
    expect(at("DailyNews")).toBe(at("DailyElections") + 1);
    expect(at("DailyPlayer")).toBe(at("DailyNews") + 1);
    expect(at("HourlyPlayer")).toBe(at("Alerts") - 1);
    expect(slotGroup("HourlyPlayer")).toBe("Hourly");
    const s = scheduler();
    // Lane C's careers job fills `DailyCareers` (D1041), at both fidelities.
    expect(schedulerJobs(s, "DailyCareers").map(([name, , fidelity]) => [name, fidelity])).toEqual([
      ["careers.daily", null],
    ]);
    // DailyGeo holds lane G's job (D1039).
    expect(schedulerJobs(s, "DailyGeo").map(([name]) => name)).toEqual(["geo.calendar"]);
    // Lane E's DailyElections and the head of WeeklyJobs hold its jobs (D1040).
    expect(schedulerJobs(s, "DailyElections").map(([n, , f]) => [n, f])).toEqual([
      ["elections.calendar", null],
    ]);
    expect(schedulerJobs(s, "WeeklyJobs")[0]?.[0]).toBe("elections.coarse_campaigns");
    // Lane P (D1042) filled the player's slots, Full fidelity only.
    expect(schedulerJobs(s, "HourlyPlayer").map(([n, , f]) => [n, f])).toEqual([["player.hourly", "Full"]]);
    expect(schedulerJobs(s, "DailyPlayer").map(([n, , f]) => [n, f])).toEqual([["player.daily", "Full"]]);
  });
});

describe("M2 contracts: notifications and the fixed pauses", () => {
  const facts = tickFactsNew(24);
  const draws = rngStreamsDraws(rngStreamsNew(1));

  it("a notification asking to pause pauses after the tick, first one wins", () => {
    const ctx = jobCtxNew(facts, draws, [], controlsDefault());
    jobCtxNotify(ctx, 4, "OwnFill");
    jobCtxNotify(ctx, 5, null);
    expect(jobCtxPauseRequest(ctx)).toEqual({ kind: "Notification", id: 4 });
  });

  it("does not pause when its fixed pause is off, in a SkipTo, or in a detached run", () => {
    const off = controlsDefault();
    off.fixed_pauses.ElectionDay = false;
    const a = jobCtxNew(facts, draws, [], off);
    jobCtxNotify(a, 1, "ElectionDay");
    expect(jobCtxPauseRequest(a)).toBeNull();
    // A rule's own pause has no switch.
    jobCtxNotify(a, 2, null);
    expect(jobCtxPauseRequest(a)).toEqual({ kind: "Notification", id: 2 });
    const skipping = controlsDefault();
    skipping.skip = { kind: "MonthEnd", target: 100 };
    const b = jobCtxNew(facts, draws, [], skipping);
    jobCtxNotify(b, 1, "OwnFill");
    expect(jobCtxPauseRequest(b)).toBeNull();
    const c = jobCtxDetached(facts, draws, []);
    jobCtxNotify(c, 1, "OwnFill");
    expect(jobCtxPauseRequest(c)).toBeNull();
  });

  it("SetFixedPause switches the switchable ones and refuses the others; v_clock shows them", () => {
    const sim = testSim(1);
    expect(simClock(sim).fixed_pauses).toEqual({
      OwnFill: true,
      MarginCall: true,
      ElectionDay: true,
      Holding: true,
    });
    const before = simStateHash(sim);
    expect(simApply(sim, { kind: "SetFixedPause", pause: "Holding", on: false }).ok).toBe(true);
    expect(simClock(sim).fixed_pauses.Holding).toBe(false);
    expect(simApply(sim, { kind: "SetFixedPause", pause: "OwnFill", on: false })).toEqual({
      ok: false,
      error: { kind: "BadFixedPause", pause: "OwnFill" },
    });
    expect(simApply(sim, { kind: "SetFixedPause", pause: "OwnFill", on: true }).ok).toBe(true);
    // A setting, outside the world (D13).
    expect(simStateHash(sim)).toBe(before);
  });
});

describe("M2 contracts: append lists, changed rows and slices", () => {
  const article = (id: number, corrected = false): Article => ({
    id,
    time: id,
    outlet: 0 as never,
    kind: "Report",
    source: null,
    headline: `h${id}`,
    body: "",
    refs: [],
    unconfirmed: false,
    corrected,
  });
  // Only v_feed has a builder here, so only it moves.
  const ported = (): PortedViews =>
    Object.fromEntries(
      Object.keys(simViews(testSim(1))).map((n) => [n, { build: n === "feed" ? true : null }]),
    ) as unknown as PortedViews;

  it("a frame carries an append list as appended rows and changed rows, the view with it empty", () => {
    const views = structuredClone(simViews(testSim(1))) as SimViews;
    const b = ported();
    const posted = postedViewsNone();
    const rows = [article(0), article(1)];
    views.feed = { data: { outlets: [], articles: rows, front_pages: [] }, version: 5, dirty: true };
    const first = viewsPatchSince(views, posted, b);
    expect(first.feed?.data.articles).toEqual([]);
    expect(first.appended).toEqual([{ view: "feed", field: "articles", reset: true, rows }]);
    expect(first.changed).toBeUndefined();
    // Row 1 corrected (a new object), row 2 added; row 0 the same object.
    const next = [rows[0] as Article, article(1, true), article(2)];
    views.feed = { data: { outlets: [], articles: next, front_pages: [] }, version: 6, dirty: true };
    const second = viewsPatchSince(views, posted, b);
    expect(second.appended).toEqual([{ view: "feed", field: "articles", reset: false, rows: [article(2)] }]);
    expect(second.changed).toEqual([
      { view: "feed", field: "articles", rows: [{ index: 1, row: article(1, true) }] },
    ]);
    // A shorter list (a new game) is sent whole again.
    views.feed = { data: { outlets: [], articles: [article(0)], front_pages: [] }, version: 7, dirty: true };
    expect(viewsPatchSince(views, posted, b).appended).toEqual([
      { view: "feed", field: "articles", reset: true, rows: [article(0)] },
    ]);
    expect(Object.keys(APPEND_LISTS).sort()).toEqual([
      "account",
      "feed",
      "notifications",
      "polls",
      "records",
      "social",
    ]);
  });

  it("names the pivot slices, which a sim with no builder for them answers null", () => {
    const keys: SliceKey[] = [
      { view: "markets", slice: "book", contract: 7 as ContractId },
      { view: "markets", slice: "history", contract: 7 as ContractId },
      { view: "returns", slice: "counties", race: 3 as RaceId },
      { view: "records", slice: "votes", roll_call: 12 },
      { view: "feed", slice: "front_pages", date: { year: 2020, month: 11, day: 4 } },
    ];
    expect(keys.map(sliceId)).toEqual([
      "markets/book/7",
      "markets/history/7",
      "returns/counties/3",
      "records/votes/12",
      "feed/front_pages/2020-11-04",
    ]);
    const sim = testSim(1);
    for (const k of keys) expect(simSlice(sim, k)).toBeNull();
  });
});

describe("M2 contracts: ids and refs", () => {
  it("instruments: a contract is its id, a stock the base plus its company", () => {
    const stock = stockInstrument(42 as CompanyId);
    expect(stock).toBe(STOCK_INSTRUMENT_BASE + 42);
    expect(instrumentTarget(stock)).toEqual({ kind: "Company", id: 42 });
    expect(instrumentVenue(stock)).toBe("Brokerage");
    const c = contractInstrument(9 as ContractId);
    expect(instrumentTarget(c)).toEqual({ kind: "Contract", id: 9 });
    expect(instrumentVenue(c)).toBe("Exchange");
  });

  it("a district's ref id is its state and number", () => {
    const id = districtRefId(43 as UsStateId, 12);
    expect(id).toBe(4312);
    expect(districtRefParts(id)).toEqual({ state: 43, number: 12 });
  });
});

describe("M2 contracts: the persons table", () => {
  const person = (id: PersonId): Person => ({
    id,
    name: `P${id}`,
    born: 1960,
    skills: { finance: 1, operations: 1, persuasion: 1, intrigue: 1, tech: 1, hustle: 1 },
    traits: [],
    integrity: 50,
    ideology: "Liberals",
    party: "Democrats",
    home_state: 0 as UsStateId,
    status: "Bench",
    origin: "Mayor",
    company: null,
    xp: 0,
    level: 0,
    career: [],
    left: null,
  });

  it("adds in id order, finds by id, seats and unseats with a career line and a vacancy", () => {
    const s = personsStateEmpty();
    for (let i = 0; i < 5; i++) personAdd(s, person);
    expect(s.persons_made).toBe(5);
    expect(personGet(s, 3 as PersonId)?.name).toBe("P3");
    expect(personGet(s, 9 as PersonId)).toBeUndefined();
    const senate = { kind: "Senate", state: 2 as UsStateId, senate_class: 1 } as const;
    const house = { kind: "House", state: 1 as UsStateId, district: 4 } as const;
    const date = { year: 2021, month: 1, day: 3 };
    officeTake(s, 1 as PersonId, senate, "Elected", date, { year: 2027, month: 1, day: 3 });
    officeTake(s, 2 as PersonId, house, "Elected", date, null);
    officeTake(s, 0 as PersonId, { kind: "President" }, "Elected", date, null);
    expect(s.offices.map((o) => seatKey(o.seat))).toEqual(["President", "Senate/2/1", "House/1/4"]);
    expect(() => officeTake(s, 3 as PersonId, house, "Elected", date, null)).toThrow();
    expect(officeHolderOf(s, house)?.person).toBe(2);
    expect(officeLeave(s, house, "Died", { year: 2022, month: 5, day: 1 })).toBe(2);
    expect(personGet(s, 2 as PersonId)?.status).toBe("Dead");
    expect(personGet(s, 2 as PersonId)?.career).toEqual([
      { seat: house, how: "Elected", from: date, to: { year: 2022, month: 5, day: 1 }, exit: "Died" },
    ]);
    expect(s.vacancies).toEqual([
      { seat: house, since: { year: 2022, month: 5, day: 1 }, fill: "Special", special: null },
    ]);
    officeTake(s, 3 as PersonId, house, "Special", { year: 2022, month: 9, day: 1 }, null);
    expect(s.vacancies).toEqual([]);
    expect(officeSeatOrder({ kind: "Governor", state: 0 as UsStateId }, house)).toBeGreaterThan(0);
  });

  it("challengerFor draws on the Politics stream only", () => {
    const sim = testSim(2);
    const w = structuredClone(simWorld(sim)) as World;
    const rng = rngStreamsNew(9);
    const before = w.persons.persons.length;
    const p = challengerFor(w, rngStreamsDraws(rng), {
      state: 0 as UsStateId,
      party: "Republicans",
      ranges: HOUSE_RANGES,
      origin: "Challenger",
    });
    expect(p).toMatchObject({ id: before, party: "Republicans", status: "Candidate", origin: "Challenger" });
    expect(w.persons.persons.slice(before)).toEqual([p]);
    const fresh = rngStreamsNew(9);
    for (const s of STREAM_VALUES) {
      if (s === "Politics") continue;
      expect(rngStreamsNextU32(rng, s), s).toBe(rngStreamsNextU32(fresh, s));
    }
  });
});
