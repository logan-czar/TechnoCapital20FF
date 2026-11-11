// Careers (pivot 5.7 to 5.12; D1037, D1041): the persons at a world's start, benches, on-demand
// challengers, executive crossovers, the ladder of who seeks which office, XP and levels,
// retirement, death and exit, and the appointed offices (the vice president, the Cabinet, the
// courts, the Fed chair; a governor's successor; a governor's Senate appointee). Owned by lane C.
// Every draw comes from the Politics stream (`politicsDraws`), so careers never move a stream the
// economy reads.
//
// The seams other lanes call keep their signatures: `registerCareerJobs` (jobs.ts, the
// `DailyCareers` slot), `personsStart` (lib.ts `START_DEPS`, after the POC's start) and
// `challengerFor` (lane E, when a race lacks a candidate). Lane E also calls `declareCycle` (who
// runs), `candidacyLost` and `personAward`; M3's lanes call `personAward` for bills and debates and
// `personScandalExit` for scandals.
//
// Elections are lane E's: this file never decides a vote. A House vacancy waits for E's special
// election; every other vacancy is filled here, the day it opens.

import { weightedPick } from "../births/weights.ts";
import { deathChance } from "../era/characters.ts";
import { geoDistrict } from "../geo/index.ts";
import { usStateOfProvinces } from "../governing/levers.ts";
import { SKILL_KIND_ALL, SKILL_MAX } from "../people/board.ts";
import { nameBooksGet } from "../people/names.ts";
import { dateTimeDate, simDateYmd } from "../time/calendar.ts";
import type { JobCtx, Scheduler } from "../time/scheduler.ts";
import { schedulerRegister } from "../time/scheduler.ts";
import { cmpDate, type SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import { type CompanyId, ordinal, type PersonId, type PoliticsPostId, type UsStateId } from "../types/ids.ts";
import type { NameBook, SkillKind } from "../types/state/people.ts";
import type {
  CareerRecord,
  OfficeExit,
  OfficeSeat,
  PartyPlatform,
  Person,
  PersonOrigin,
  PersonsState,
} from "../types/state/persons.ts";
import {
  type CourtLevel,
  IDEOLOGY_VALUES,
  PARTY_VALUES,
  type Party,
  type Politician,
  type PoliticsPost,
} from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import { eraBlocs } from "./era.ts";
import {
  BENCH_KINDS,
  type BlocTable,
  blocsForLean,
  CABINET_RANGES,
  type Drawn,
  drawIdeology,
  drawIntegrity,
  drawPerson,
  FED_CHAIR_RANGES,
  GOVERNOR_RANGES,
  HOUSE_RANGES,
  JUDGE_INTEGRITY,
  JUDGE_RANGES,
  type OfficeRanges,
  PARTY_BLOCS,
  PRESIDENT_RANGES,
  partyForLean,
  politicsDraws,
  SENATE_RANGES,
} from "./generate.ts";
import {
  careerLineOf,
  officeHolderOf,
  officeLeave,
  officeSeatOrder,
  officesOf,
  officeTake,
  personAdd,
  personAge,
  personGet,
} from "./people.ts";

// ---------------------------------------------------------------- tuning (T; D1041)

/** Rising figures on each state's bench after its yearly refresh (pivot 5.9 item 1, T). */
export const BENCH_PER_STATE = 6;
/** A bench member this old leaves public life at the yearly refresh (T). */
export const BENCH_MAX_AGE = 75;
/** Chance a year that an executive whose company is in bankruptcy enters a bench (pivot 5.9 item 3, T). */
export const EXEC_CROSSOVER_CHANCE = 0.05;
/** The start's president's party (the 19.22 president's, D987), when the POC has not seated one. */
export const START_PRESIDENT_PARTY: Party = "Democrats";
/** Presidential terms a person may win (22nd amendment): two, so six years served bars a run. */
export const PRESIDENT_TERM_LIMIT = 2;
/** Consecutive governor's terms, one rule for every state (D1041, T). */
export const GOVERNOR_TERM_LIMIT = 2;
/** Years a term lasts. */
export const HOUSE_TERM_YEARS = 2;
export const SENATE_TERM_YEARS = 6;
export const PRESIDENT_TERM_YEARS = 4;
export const GOVERNOR_TERM_YEARS = 4;
/** A Fed chair's term (pivot 5.8; the real four years). */
export const FED_CHAIR_TERM_YEARS = 4;
/** Chance the president keeps a Fed chair whose term ends (T); none past `FED_CHAIR_MAX_AGE`. */
export const FED_REAPPOINT_CHANCE = 0.6;
export const FED_CHAIR_MAX_AGE = 78;
/** The constitutional floors (House 25, Senate 30, President 35) and governors' (30, T). */
export const MIN_AGE: Readonly<Record<"House" | "Senate" | "Governor" | "President", number>> = {
  House: 25,
  Senate: 30,
  Governor: 30,
  President: 35,
};
/** Nobody seeks a new office past this age (T). */
export const SEEK_MAX_AGE = 75;
/** Declared candidates a party fields for one race, at most (T). */
export const MAX_DECLARED_PER_PARTY = 3;
/**
 * Chance at a cycle that someone holding the row office (or on the bench) seeks the column office,
 * before ambition (pivot 5.9 ladder: House or governor, then Senate, then President; T).
 */
export const SEEK_CHANCE: Readonly<
  Record<
    "Bench" | "House" | "Governor" | "Senate" | "VicePresident",
    Partial<Record<"House" | "Governor" | "Senate" | "President", number>>
  >
> = {
  Bench: { House: 0.25, Governor: 0.08, Senate: 0.05 },
  House: { Governor: 0.08, Senate: 0.15 },
  Governor: { Senate: 0.15, President: 0.08 },
  Senate: { President: 0.04 },
  VicePresident: { President: 0.6 },
};
/** Ambition (pivot 5.9: a trait) multiplies the chance to seek; contentment cuts it (T). */
export const AMBITIOUS_SEEK_MULT = 2;
export const CONTENT_SEEK_MULT = 0.3;
/** An open seat draws more seekers than one an incumbent defends (T). */
export const OPEN_SEAT_SEEK_MULT = 2.5;
/** An incumbent's chance to retire at a cycle (T): base, per year of age past 65, per year past 24 in office. */
export const RETIRE_BASE = 0.04;
export const RETIRE_FROM_AGE = 65;
export const RETIRE_PER_AGE_YEAR = 0.04;
export const RETIRE_FROM_TENURE = 24;
export const RETIRE_PER_TENURE_YEAR = 0.02;
export const RETIRE_CONTENT = 0.05;
/** Yearly mid-term exits (T): a judge past 70, 0.08 more each year; a cabinet secretary; anyone elected. */
export const JUDGE_RETIRE_FROM_AGE = 70;
export const JUDGE_RETIRE_PER_YEAR = 0.08;
export const CABINET_RESIGN_CHANCE = 0.08;
export const MIDTERM_RESIGN_CHANCE = 0.005;
/** Appointments (4.7.3 simplified, D984; T): candidates drawn, the appointer's party bonus. */
export const APPOINTMENT_CANDIDATES = 3;
export const SAME_PARTY_BONUS = 5;
/** Chance a judicial or Fed nominee is of the president's party (D984, T). */
export const NOMINEE_SAME_PARTY_CHANCE = 0.85;
export const FED_SAME_PARTY_CHANCE = 0.6;
/** Chance a cabinet seat or the vice presidency goes to a sitting member of Congress (T). */
export const APPOINT_FROM_CONGRESS_CHANCE = 0.25;
/** 4.21.1 confirmation (D984, T), by whether the president's party holds the Senate. */
export const CONFIRM_CHANCE_FRIENDLY = 0.95;
export const CONFIRM_CHANCE_HOSTILE = 0.6;
export const CONFIRM_TRIES = 5;
/** Senate seats that make a majority with the vice president's casting vote (D984). */
export const SENATE_MAJORITY = 50;
/** At the start, judges and the Fed chair were named by several presidents: either party (T). */
export const START_APPOINTEE_SAME_PARTY_CHANCE = 0.5;
/** A state split at the start puts its Democrat in the first class with this chance (1995-rework 7.2, T). */
export const FIRST_CLASS_CHANCE = 0.5;
/** Years already served at the start (T): extra whole terms, at most. */
export const START_EXTRA_TERMS: Readonly<Record<"House" | "Senate" | "Governor", number>> = {
  House: 8,
  Senate: 3,
  Governor: 1,
};
export const START_JUDGE_MAX_YEARS = 20;
/** Chance a start holder held a lower office first, and which (T): a plausible career record. */
export const PRIOR_OFFICE_CHANCE: Readonly<Partial<Record<OfficeSeat["kind"], number>>> = {
  President: 1,
  VicePresident: 0.7,
  Senate: 0.4,
  Governor: 0.25,
  Cabinet: 0.2,
  Judge: 0.5,
};
/** The governors whose cycle is not the midterm's (by `year % 4` of their general; T, real 2020 cycles). */
export const GOVERNOR_CYCLE_EXCEPTIONS: Readonly<Record<string, number>> = {
  Delaware: 0,
  Indiana: 0,
  Missouri: 0,
  Montana: 0,
  "New Hampshire": 0,
  "North Carolina": 0,
  "North Dakota": 0,
  Utah: 0,
  Vermont: 0,
  Washington: 0,
  "West Virginia": 0,
  "New Jersey": 1,
  Virginia: 1,
  Kentucky: 3,
  Louisiana: 3,
  Mississippi: 3,
};
/** The cycle of every other governor: elected at the midterms. */
export const GOVERNOR_CYCLE_DEFAULT = 2;

// ---------------------------------------------------------------- XP and levels (pivot 5.10)

/** What earns experience (pivot 5.10, T). Lane E awards the elections; M3 bills and debates. */
export type Achievement =
  | "ElectionWon"
  | "ReElected"
  | "PrimaryWon"
  | "SpecialWon"
  | "BillPassed"
  | "DebateWon"
  | "Appointed"
  | "Confirmed"
  | "Succeeded";

/** XP per achievement (pivot 5.10, T). */
export const ACHIEVEMENT_XP: Readonly<Record<Achievement, number>> = {
  ElectionWon: 40,
  ReElected: 25,
  PrimaryWon: 15,
  SpecialWon: 35,
  BillPassed: 30,
  DebateWon: 10,
  Appointed: 20,
  Confirmed: 10,
  Succeeded: 30,
};
/** The level curve (pivot 5.10, T): level n needs `LEVEL_XP_STEP × n(n + 1) / 2` XP (50, 150, 300...). */
export const LEVEL_XP_STEP = 50;
/** A skill a level raises never passes this (mvp-spec 3.7.1: 0 to 30). */
export const SKILL_CAP = SKILL_MAX;

/** The XP that `level` needs (pivot 5.10). */
export function levelXp(level: number): number {
  return (LEVEL_XP_STEP * level * (level + 1)) / 2;
}

/**
 * Grants `achievement`'s XP to `person` (pivot 5.10); each level reached raises one skill below
 * `SKILL_CAP`, chosen uniformly in `SKILL_KIND_ALL` order on the Politics stream. Returns the
 * skills raised, one per level (a level with every skill capped raises none).
 */
export function personAward(
  world: World,
  draws: DrawSource,
  person: PersonId,
  achievement: Achievement,
): SkillKind[] {
  const p = personGet(world.persons, person);
  if (p === undefined) throw new Error(`personAward: no person ${person}`);
  const g = politicsDraws(draws);
  p.xp += ACHIEVEMENT_XP[achievement];
  const raised: SkillKind[] = [];
  while (p.xp >= levelXp(p.level + 1)) {
    p.level += 1;
    const open = SKILL_KIND_ALL.filter((k) => p.skills[k] < SKILL_CAP);
    if (open.length === 0) continue;
    const k = open[g.intInclusive("Politics", 0, open.length - 1)] as SkillKind;
    p.skills[k] += 1;
    raised.push(k);
  }
  return raised;
}

// ---------------------------------------------------------------- dates and terms

/** The first `month/day` of a year `y` with `ok(y)` falling after `date`. */
function nextOn(date: SimDate, month: number, day: number, ok: (y: number) => boolean): SimDate {
  for (let y = date.year; ; y++) {
    const d = simDateYmd(y, month, day);
    if (ok(y) && cmpDate(d, date) > 0) return d;
  }
}

/** A House term's end: 3 January of the next odd year (pivot 6.1). */
export function houseTermEnds(date: SimDate): SimDate {
  return nextOn(date, 1, 3, (y) => y % 2 === 1);
}

/** A Senate class's term end: 3 January after its next general (class 1 ended terms in 1995, 2001...). */
export function senateTermEnds(senateClass: number, date: SimDate): SimDate {
  return nextOn(date, 1, 3, (y) => (((y - 1995 - 2 * (senateClass - 1)) % 6) + 6) % 6 === 0);
}

/** The presidency's term end: 20 January after the next presidential general. */
export function presidentTermEnds(date: SimDate): SimDate {
  return nextOn(date, 1, 20, (y) => y % 4 === 1);
}

/** A governor's term end (15 January after their next general, T) on cycle `cycle` (`year % 4`). */
export function governorTermEnds(cycle: number, date: SimDate): SimDate {
  return nextOn(date, 1, 15, (y) => (y - 1) % 4 === cycle);
}

/** The handover after the next November general (3 January of the next odd year after a November). */
export function nextGeneralHandover(date: SimDate): SimDate {
  return nextOn(date, 1, 3, (y) => y % 2 === 1 && cmpDate(simDateYmd(y - 1, 11, 1), date) > 0);
}

/** A state's governor cycle (`year % 4` of its general): lane E's calendar once set, else D1041's table. */
export function governorCycleOf(world: World, state: UsStateId): number | null {
  const s = world.politics.states[state];
  if (s === undefined || s.senate_classes.length === 0) return null;
  const set = world.elections.calendar.governor_cycle[state];
  if (set !== undefined && set !== null) return set;
  return GOVERNOR_CYCLE_EXCEPTIONS[s.name] ?? GOVERNOR_CYCLE_DEFAULT;
}

/** When a seat taken on `date` ends its term (null for a life or pleasure post). */
export function termEndsOf(world: World, seat: OfficeSeat, date: SimDate): SimDate | null {
  switch (seat.kind) {
    case "President":
      return presidentTermEnds(date);
    case "VicePresident": {
      const p = officeHolderOf(world.persons, { kind: "President" });
      return p?.term_ends ?? presidentTermEnds(date);
    }
    case "Senate":
      return senateTermEnds(seat.senate_class, date);
    case "House":
      return houseTermEnds(date);
    case "Governor":
      return governorTermEnds(governorCycleOf(world, seat.state) ?? GOVERNOR_CYCLE_DEFAULT, date);
    case "FedChair":
      return simDateYmd(date.year + FED_CHAIR_TERM_YEARS, date.month, Math.min(date.day, 28));
    case "Cabinet":
    case "Judge":
      return null;
  }
}

function yearsBetween(from: SimDate, to: SimDate): number {
  return (
    to.year - from.year - (to.month < from.month || (to.month === from.month && to.day < from.day) ? 1 : 0)
  );
}

// ---------------------------------------------------------------- the offices (pivot 5.8)

function hasGovernor(world: World, state: number): boolean {
  return (world.politics.states[state]?.senate_classes.length ?? 0) > 0;
}

/** House seats of `state` now (pivot 5.3): lane G's apportionment once set, else the POC's districts, else the data's. */
export function houseSeatsOf(world: World, state: UsStateId): number {
  const g = world.geo.seats;
  if (g.length > 0) return g[state] ?? 0;
  const p = world.politics;
  if (p.districts.length > 0) return p.districts.reduce((n, d) => (d.state === state ? n + 1 : n), 0);
  return p.states[state]?.house_seats ?? 0;
}

/** A district's lean in points toward party A: lane G's plan, else the POC's district, else the state's. */
export function districtLean(world: World, state: UsStateId, number: number): number {
  const d = geoDistrict(world.geo, state, number);
  if (d !== undefined) return d.lean;
  const poc = world.politics.districts.find((x) => x.state === state && x.number === number);
  return poc?.lean_pts ?? world.politics.states[state]?.lean_pts ?? 0;
}

function isCourt(post: PoliticsPost): post is PoliticsPost & { kind: CourtLevel } {
  return post.kind === "Supreme" || post.kind === "Appeals" || post.kind === "Trial";
}

/** Every seat of pivot 5.8 in this world, in `officeSeatOrder`. */
export function officeSeats(world: World): OfficeSeat[] {
  const p = world.politics;
  const out: OfficeSeat[] = [{ kind: "President" }, { kind: "VicePresident" }];
  p.posts.forEach((post, i) => {
    if (post.kind === "Cabinet") out.push({ kind: "Cabinet", post: ordinal<PoliticsPostId>(i) });
  });
  p.states.forEach((s, i) => {
    const state = ordinal<UsStateId>(i);
    for (const c of [...s.senate_classes].sort((a, b) => a - b)) {
      out.push({ kind: "Senate", state, senate_class: c });
    }
  });
  p.states.forEach((_, i) => {
    const state = ordinal<UsStateId>(i);
    const n = houseSeatsOf(world, state);
    for (let d = 1; d <= n; d++) out.push({ kind: "House", state, district: d });
  });
  p.states.forEach((_, i) => {
    if (hasGovernor(world, i)) out.push({ kind: "Governor", state: ordinal<UsStateId>(i) });
  });
  p.posts.forEach((post, i) => {
    if (!isCourt(post)) return;
    for (let seat = 0; seat < post.seats; seat++) {
      out.push({ kind: "Judge", post: ordinal<PoliticsPostId>(i), level: post.kind, seat });
    }
  });
  out.push({ kind: "FedChair" });
  return out;
}

/** The generation ranges and key skill of a seat (D980, D1041). */
export function seatProfile(world: World, seat: OfficeSeat): { ranges: OfficeRanges; key: SkillKind } {
  const post = (id: PoliticsPostId): PoliticsPost => world.politics.posts[id] as PoliticsPost;
  switch (seat.kind) {
    case "President":
      return { ranges: PRESIDENT_RANGES, key: "persuasion" };
    case "VicePresident": {
      const vp = world.politics.posts.find((x) => x.kind === "VicePresident");
      return { ranges: CABINET_RANGES, key: vp?.skill ?? "persuasion" };
    }
    case "Cabinet":
      return { ranges: CABINET_RANGES, key: post(seat.post).skill };
    case "Senate":
      return { ranges: SENATE_RANGES, key: "persuasion" };
    case "House":
      return { ranges: HOUSE_RANGES, key: "persuasion" };
    case "Governor":
      return { ranges: GOVERNOR_RANGES, key: "persuasion" };
    case "Judge":
      return { ranges: JUDGE_RANGES, key: post(seat.post).skill };
    case "FedChair":
      return { ranges: FED_CHAIR_RANGES, key: "finance" };
  }
}

/** A seat's state, or null for a national office. */
function seatState(seat: OfficeSeat): UsStateId | null {
  return seat.kind === "Senate" || seat.kind === "House" || seat.kind === "Governor" ? seat.state : null;
}

/** The lean a seat's voters have, in points toward party A (0 for a national office). */
function seatLean(world: World, seat: OfficeSeat): number {
  if (seat.kind === "House") return districtLean(world, seat.state, seat.district);
  const s = seatState(seat);
  return s === null ? 0 : (world.politics.states[s]?.lean_pts ?? 0);
}

// ---------------------------------------------------------------- drawing people

/** Who can be drawn now: the name book, the blocs, and the names in use in a historical world. */
interface Pool {
  book: NameBook;
  blocs: BlocTable;
  /** A historical world keeps living public figures' names unique (1995-rework 7.2); null leaves draws frozen. */
  taken: Set<string> | null;
}

function poolOf(world: World, year: number): Pool {
  const book = nameBooksGet(world.name_books, world.politics.country);
  if (book === null) throw new Error("no name book for the USA");
  const era = world.era;
  if (era === undefined) return { book, blocs: PARTY_BLOCS, taken: null };
  const taken = new Set<string>();
  for (const p of world.persons.persons) if (p.status !== "Dead") taken.add(p.name);
  for (const c of world.politics.politicians) taken.add(c.name);
  return { book, blocs: eraBlocs(era.politics.ideologies, year), taken };
}

function draw(
  g: DrawSource,
  pool: Pool,
  ranges: OfficeRanges,
  key: SkillKind,
  party: Party,
  lean: number,
): Drawn {
  return drawPerson(
    g,
    { names: pool.book, blocs: blocsForLean(pool.blocs, lean), taken: pool.taken },
    ranges,
    key,
    party,
  );
}

/** A home state drawn by population among the states with a governor (pivot 5.7, T). */
function drawHomeState(world: World, g: DrawSource): UsStateId {
  const w = world.politics.states.map((s, i) => (hasGovernor(world, i) ? s.weight : 0));
  return ordinal<UsStateId>(weightedPick(w, g) ?? 0);
}

interface NewPerson {
  party: Party | null;
  home: UsStateId;
  origin: PersonOrigin;
  status: Person["status"];
  integrity: number;
  company?: CompanyId | null;
}

function addDrawn(world: World, d: Drawn, year: number, n: NewPerson): Person {
  return personAdd(world.persons, (id) => ({
    id,
    name: d.name,
    born: year - d.age,
    skills: d.skills,
    traits: d.traits,
    integrity: n.integrity,
    ideology: d.ideology,
    party: n.party,
    home_state: n.home,
    status: n.status,
    origin: n.origin,
    company: n.company ?? null,
    xp: 0,
    level: 0,
    career: [],
    left: null,
  }));
}

/** What a race needs a candidate for (lane E's request). */
export interface ChallengerRequest {
  state: UsStateId;
  /** Null for an independent. */
  party: Party | null;
  /** The generation ranges of the office sought (politics/generate.ts). */
  ranges: OfficeRanges;
  origin: PersonOrigin;
}

/**
 * A new person to run where a race lacks a candidate (pivot 5.9 item 2): drawn on the Politics
 * stream with an ideology of their party tilted by their state's lean (an independent's ideology is
 * drawn for the party the lean favours), put on no bench, status `Candidate`, and added to
 * `World.persons`. The same world and draws give the same person.
 */
export function challengerFor(world: World, draws: DrawSource, req: ChallengerRequest): Person {
  const g = politicsDraws(draws);
  const year = dateTimeDate(world.clock).year;
  const pool = poolOf(world, year);
  const lean = world.politics.states[req.state]?.lean_pts ?? 0;
  const side = req.party ?? (lean >= 0 ? "Democrats" : "Republicans");
  const d = draw(g, pool, req.ranges, "persuasion", side, lean);
  const integrity = drawIntegrity(g, d.traits);
  return addDrawn(world, d, year, {
    party: req.party,
    home: req.state,
    origin: req.origin,
    status: "Candidate",
    integrity,
  });
}

// ---------------------------------------------------------------- the start (pivot 5.7, 5.8)

/** The POC's office as a pivot seat (`judgeSeats` numbers a court's judges in id order). */
function seatOfPolitician(world: World, c: Politician, judgeSeats: Map<number, number>): OfficeSeat {
  const o = c.office;
  switch (o.kind) {
    case "President":
      return { kind: "President" };
    case "VicePresident":
      return { kind: "VicePresident" };
    case "Cabinet":
      return { kind: "Cabinet", post: o.post };
    case "Senate":
      return { kind: "Senate", state: o.state, senate_class: o.senate_class };
    case "House": {
      const d = world.politics.districts[o.district];
      if (d === undefined) throw new Error(`no POC district ${o.district}`);
      return { kind: "House", state: d.state, district: d.number };
    }
    case "Judge": {
      const seat = judgeSeats.get(o.post) ?? 0;
      judgeSeats.set(o.post, seat + 1);
      return { kind: "Judge", post: o.post, level: o.level, seat };
    }
  }
}

/**
 * The party a seat's start holder has when the POC seated nobody there (1995-rework 7.2 in an era
 * world: the real seats by state and party). `split` keeps each split state's Democratic class.
 */
function startParty(
  world: World,
  g: DrawSource,
  seat: OfficeSeat,
  president: Party,
  split: Map<number, number>,
): Party {
  const era = world.era;
  switch (seat.kind) {
    case "President":
      return START_PRESIDENT_PARTY;
    case "VicePresident":
    case "Cabinet":
      return president;
    case "Senate": {
      if (era !== undefined) {
        const dem = era.politics.states[seat.state]?.start_senate_dem ?? 0;
        if (dem !== 1) return dem >= 2 ? "Democrats" : "Republicans";
        let demClass = split.get(seat.state);
        if (demClass === undefined) {
          const classes = [...(world.politics.states[seat.state]?.senate_classes ?? [])].sort(
            (a, b) => a - b,
          );
          demClass = classes[g.chance("Politics", FIRST_CLASS_CHANCE) ? 0 : 1] ?? seat.senate_class;
          split.set(seat.state, demClass);
        }
        return seat.senate_class === demClass ? "Democrats" : "Republicans";
      }
      return partyForLean(g, seatLean(world, seat));
    }
    case "House": {
      if (era !== undefined) {
        const dem = era.politics.states[seat.state]?.start_house_dem ?? 0;
        const n = houseSeatsOf(world, seat.state);
        const rank = [...Array(n).keys()]
          .map((i) => [districtLean(world, seat.state, i + 1), i + 1] as const)
          .sort((a, b) => b[0] - a[0] || a[1] - b[1])
          .findIndex(([, num]) => num === seat.district);
        return rank < dem ? "Democrats" : "Republicans";
      }
      return partyForLean(g, seatLean(world, seat));
    }
    case "Governor":
      return partyForLean(g, seatLean(world, seat));
    case "Judge":
    case "FedChair":
      return g.chance("Politics", START_APPOINTEE_SAME_PARTY_CHANCE) ? president : otherParty(president);
  }
}

/** The other party. */
export function otherParty(p: Party): Party {
  return p === "Democrats" ? "Republicans" : "Democrats";
}

function yearsBefore(d: SimDate, years: number): SimDate {
  return simDateYmd(d.year - years, d.month, Math.min(d.day, 28));
}

/**
 * When a start holder took their seat (D1041): whole terms back from the term in progress, at most
 * `START_EXTRA_TERMS`, never before they were old enough. Judges and the Fed chair, whole years.
 */
function startFrom(
  world: World,
  g: DrawSource,
  seat: OfficeSeat,
  start: SimDate,
  born: number,
  ends: SimDate | null,
): SimDate {
  const terms = (len: number, max: number, floor: number): SimDate => {
    const end = ends as SimDate;
    const first = end.year - len;
    const room = Math.floor((first - (born + floor)) / len);
    const k = room <= 0 ? 0 : g.intInclusive("Politics", 0, Math.min(max, room));
    return simDateYmd(first - k * len, end.month, end.day);
  };
  switch (seat.kind) {
    case "House":
      return terms(HOUSE_TERM_YEARS, START_EXTRA_TERMS.House, MIN_AGE.House);
    case "Senate":
      return terms(SENATE_TERM_YEARS, START_EXTRA_TERMS.Senate, MIN_AGE.Senate);
    case "Governor":
      return terms(GOVERNOR_TERM_YEARS, START_EXTRA_TERMS.Governor, MIN_AGE.Governor);
    case "President":
      return terms(PRESIDENT_TERM_YEARS, 0, MIN_AGE.President);
    case "VicePresident":
    case "Cabinet": {
      const p = officeHolderOf(world.persons, { kind: "President" });
      return p?.since ?? start;
    }
    case "Judge":
    case "FedChair": {
      const max = seat.kind === "Judge" ? START_JUDGE_MAX_YEARS : FED_CHAIR_TERM_YEARS * 2 - 1;
      const room = start.year - 1 - (born + 35);
      const k = room <= 0 ? 0 : g.intInclusive("Politics", 0, Math.min(max, room));
      return simDateYmd(start.year - 1 - k, 3, 1);
    }
  }
}

/** A prior office for a start holder's record (D1041): the rung below, ending when this one began. */
function priorCareer(
  world: World,
  g: DrawSource,
  seat: OfficeSeat,
  home: UsStateId,
  born: number,
  from: SimDate,
): CareerRecord[] {
  const chance = PRIOR_OFFICE_CHANCE[seat.kind] ?? 0;
  if (chance <= 0 || !g.chance("Politics", chance)) return [];
  const p = world.politics;
  const state = p.states[home];
  const house = (): OfficeSeat => ({
    kind: "House",
    state: home,
    district: g.intInclusive("Politics", 1, Math.max(1, houseSeatsOf(world, home))),
  });
  const senate = (): OfficeSeat | null => {
    const classes = state?.senate_classes ?? [];
    if (classes.length === 0) return null;
    return {
      kind: "Senate",
      state: home,
      senate_class: classes[g.intInclusive("Politics", 0, classes.length - 1)] as number,
    };
  };
  const court = (level: CourtLevel): OfficeSeat | null => {
    const posts = p.posts.map((x, i) => [x, i] as const).filter(([x]) => x.kind === level);
    if (posts.length === 0) return null;
    const [post, i] = posts[g.intInclusive("Politics", 0, posts.length - 1)] as readonly [
      PoliticsPost,
      number,
    ];
    return {
      kind: "Judge",
      post: ordinal<PoliticsPostId>(i),
      level,
      seat: g.intInclusive("Politics", 0, post.seats - 1),
    };
  };
  let prior: OfficeSeat | null = null;
  let years = 0;
  switch (seat.kind) {
    case "President":
      prior =
        hasGovernor(world, home) && g.chance("Politics", 0.5) ? { kind: "Governor", state: home } : senate();
      years = prior?.kind === "Governor" ? 4 * g.intInclusive("Politics", 1, 2) : 6;
      break;
    case "VicePresident":
      prior = senate();
      years = 6 * g.intInclusive("Politics", 1, 2);
      break;
    case "Senate":
    case "Governor":
    case "Cabinet":
      prior = house();
      years = 2 * g.intInclusive("Politics", 1, 4);
      break;
    case "Judge":
      prior = seat.level === "Supreme" ? court("Appeals") : seat.level === "Appeals" ? court("Trial") : null;
      years = 2 * g.intInclusive("Politics", 2, 5);
      break;
    default:
      return [];
  }
  if (prior === null || from.year - years < born + MIN_AGE.House) return [];
  const how = prior.kind === "Judge" ? "Appointed" : "Elected";
  return [{ seat: prior, how, from: yearsBefore(from, years), to: from, exit: "Promoted" }];
}

/** Seats a start holder: the career record, then the office from its backdated start. */
function seatAtStart(world: World, g: DrawSource, person: Person, seat: OfficeSeat, start: SimDate): void {
  const ends = termEndsOf(world, seat, start);
  const from = startFrom(world, g, seat, start, person.born, ends);
  person.career.push(...priorCareer(world, g, seat, person.home_state, person.born, from));
  officeTake(world.persons, person.id, seat, "Start", from, ends);
}

/**
 * The persons and offices at a world's start (pivot 5.7, 5.8), after the POC's `politicsStart`:
 * every POC office holder becomes a person, the same name, age, skills, traits, party and
 * ideology (D1041), in the POC's id order; then every seat of pivot 5.8 the POC left empty (the
 * governors and the Fed chair, or all of them once lane E empties the POC's start) gets a drawn
 * holder; then every state's bench. Politics stream only. A world without US states does nothing.
 */
export function personsStart(world: World, draws: DrawSource): void {
  const p = world.politics;
  if (p.states.length === 0) return;
  const g = politicsDraws(draws);
  const start = dateTimeDate(world.clock);
  const year = start.year;
  const s = world.persons;
  s.benches = p.states.map(() => []);
  // 1. The POC's holders: the same people.
  const judgeSeats = new Map<number, number>();
  const president = p.politicians.find((c) => c.office.kind === "President") ?? null;
  const ordered =
    president === null ? p.politicians : [president, ...p.politicians.filter((c) => c !== president)];
  for (const c of ordered) {
    const seat = seatOfPolitician(world, c, judgeSeats);
    const home = seatState(seat) ?? drawHomeState(world, g);
    const integrity = c.integrity ?? drawIntegrity(g, c.traits);
    const person = personAdd(s, (id) => ({
      id,
      name: c.name,
      born: year - c.age,
      skills: { ...c.skills },
      traits: [...c.traits],
      integrity,
      ideology: c.ideology,
      party: c.party,
      home_state: home,
      status: "Bench",
      origin: "Start",
      company: null,
      xp: 0,
      level: 0,
      career: [],
      left: null,
    }));
    seatAtStart(world, g, person, seat, start);
  }
  // 2. Every seat the POC left empty.
  const pool = poolOf(world, year);
  const split = new Map<number, number>();
  let presidentParty = START_PRESIDENT_PARTY;
  for (const seat of officeSeats(world)) {
    const held = officeHolderOf(s, seat);
    if (seat.kind === "President" && held !== undefined) {
      presidentParty = personGet(s, held.person)?.party ?? presidentParty;
    }
    if (held !== undefined) continue;
    const party = startParty(world, g, seat, presidentParty, split);
    if (seat.kind === "President") presidentParty = party;
    const { ranges, key } = seatProfile(world, seat);
    const d = draw(g, pool, ranges, key, party, seatLean(world, seat));
    const home = seatState(seat) ?? drawHomeState(world, g);
    const integrity = drawIntegrity(g, d.traits, seat.kind === "Judge" ? JUDGE_INTEGRITY : undefined);
    const person = addDrawn(world, d, year, { party, home, origin: "Start", status: "Bench", integrity });
    seatAtStart(world, g, person, seat, start);
  }
  // 3. The benches.
  benchRefresh(world, g, pool, start);
  s.platforms = platformsOf(s);
}

// ---------------------------------------------------------------- benches (pivot 5.9 item 1)

/** A bench member's prospects (T): Persuasion, levels, ambition, less age past 60. Higher stays. */
function benchScore(p: Person, year: number): number {
  const ambition = p.traits.includes("Ambitious") ? 3 : p.traits.includes("Content") ? -3 : 0;
  return p.skills.persuasion + 2 * p.level + ambition - Math.max(0, personAge(p, year) - 60) / 2;
}

/** Draws one rising figure for `state`'s bench (pivot 5.9 item 1). */
function benchDraw(world: World, g: DrawSource, pool: Pool, state: UsStateId, year: number): Person {
  const kind =
    BENCH_KINDS[
      weightedPick(
        BENCH_KINDS.map((k) => k.weight),
        g,
      ) ?? 0
    ] ?? (BENCH_KINDS[0] as (typeof BENCH_KINDS)[number]);
  const lean = world.politics.states[state]?.lean_pts ?? 0;
  const party = partyForLean(g, lean);
  const d = draw(g, pool, kind.ranges, kind.key, party, lean);
  const integrity = drawIntegrity(g, d.traits);
  return addDrawn(world, d, year, { party, home: state, origin: kind.origin, status: "Bench", integrity });
}

/** Each state's bench as the persons table has it: Bench or Candidate, holding nothing, by home state. */
export function benchSync(world: World): void {
  const s = world.persons;
  const benches: PersonId[][] = world.politics.states.map(() => []);
  for (const p of s.persons) {
    if (p.status !== "Bench" && p.status !== "Candidate") continue;
    benches[p.home_state]?.push(p.id);
  }
  s.benches = benches;
}

/**
 * The yearly bench refresh (pivot 5.9 item 1): members past `BENCH_MAX_AGE` leave public life; a
 * state with more than `BENCH_PER_STATE` keeps its best prospects (`benchScore`, ties to the lower
 * id) and the rest retire; then each state is filled up with new rising figures, states in id order.
 * DC has no governor or senators and keeps no bench. Candidates in a race are left alone.
 */
function benchRefresh(world: World, g: DrawSource, pool: Pool, date: SimDate): void {
  const s = world.persons;
  const year = date.year;
  const by: Person[][] = world.politics.states.map(() => []);
  for (const p of s.persons) if (p.status === "Bench") by[p.home_state]?.push(p);
  by.forEach((members, i) => {
    const keep: Person[] = [];
    for (const p of members) {
      if (!hasGovernor(world, i) || personAge(p, year) > BENCH_MAX_AGE) personRetire(world, p.id, date);
      else keep.push(p);
    }
    if (keep.length > BENCH_PER_STATE) {
      const ranked = [...keep].sort((a, b) => benchScore(b, year) - benchScore(a, year) || a.id - b.id);
      for (const p of ranked.slice(BENCH_PER_STATE)) personRetire(world, p.id, date);
    }
  });
  benchSync(world);
  s.benches.forEach((bench, i) => {
    if (!hasGovernor(world, i)) return;
    const benched = bench.filter((id) => personGet(s, id)?.status === "Bench").length;
    for (let n = benched; n < BENCH_PER_STATE; n++) benchDraw(world, g, pool, ordinal<UsStateId>(i), year);
  });
  benchSync(world);
}

// ---------------------------------------------------------------- executive crossovers (pivot 5.9 item 3)

/**
 * Corporate executives who have lost their seat cross into politics (pivot 5.9 item 3): the
 * economy keeps no record of a seat lost (a closed seat is emptied and a removed company's board
 * cleared), so the executives who are losing theirs are read from the boards of US companies in
 * bankruptcy, each of whom joins their headquarters state's bench with `chance` (D1041). They keep
 * their name, age, skills and traits; `company` links the person to the company whose board they
 * sat on. One person per executive: a crossed-over executive is not drawn twice.
 */
export function executiveCrossovers(
  world: World,
  draws: DrawSource,
  date: SimDate,
  chance: number = EXEC_CROSSOVER_CHANCE,
): Person[] {
  const g = politicsDraws(draws);
  const p = world.politics;
  const s = world.persons;
  const states = usStateOfProvinces(world);
  const out: Person[] = [];
  world.companies.forEach((c, i) => {
    if (c.hq_country !== p.country || c.finance.distress.status !== "Bankrupt") return;
    const state = states.get(c.hq_province);
    if (state === undefined || !hasGovernor(world, state)) return;
    const company = ordinal<CompanyId>(i);
    for (const holder of c.board) {
      if (holder === null) continue;
      const ch = holder.seat.character;
      if (s.persons.some((x) => x.origin === "Executive" && x.company === company && x.name === ch.name))
        continue;
      if (!g.chance("Politics", chance)) continue;
      const lean = p.states[state]?.lean_pts ?? 0;
      const party = partyForLean(g, lean);
      const blocs =
        world.era === undefined ? PARTY_BLOCS : eraBlocs(world.era.politics.ideologies, date.year);
      const ideology = drawIdeology(g, blocsForLean(blocs, lean), party);
      const integrity = drawIntegrity(g, ch.traits);
      out.push(
        personAdd(s, (id) => ({
          id,
          name: ch.name,
          born: date.year - ch.age,
          skills: { ...ch.skills },
          traits: [...ch.traits],
          integrity,
          ideology,
          party,
          home_state: state,
          status: "Bench",
          origin: "Executive",
          company,
          xp: 0,
          level: 0,
          career: [],
          left: null,
        })),
      );
    }
  });
  if (out.length > 0) benchSync(world);
  return out;
}

// ---------------------------------------------------------------- exits (pivot 5.9)

/** Takes `person` out of every office they hold with `exit` on `date` (each seat raises its vacancy). */
function leaveAll(world: World, person: PersonId, exit: OfficeExit, date: SimDate): void {
  for (const o of officesOf(world.persons, person)) officeLeave(world.persons, o.seat, exit, date);
}

/** Death (pivot 5.9): out of every office (vacancies raised), then status Dead. */
export function personDie(world: World, person: PersonId, date: SimDate): void {
  const p = personGet(world.persons, person);
  if (p === undefined || p.status === "Dead") return;
  leaveAll(world, person, "Died", date);
  p.status = "Dead";
  p.left ??= date;
}

/** Leaving public life for good, alive (pivot 5.9): out of every office with `exit`, status Retired. */
export function personRetire(
  world: World,
  person: PersonId,
  date: SimDate,
  exit: OfficeExit = "Retired",
): void {
  const p = personGet(world.persons, person);
  if (p === undefined || p.status === "Dead" || p.status === "Retired") return;
  leaveAll(world, person, exit, date);
  p.status = "Retired";
  p.left ??= date;
}

/**
 * The scandal exit hook (pivot 5.9; M3's scandals call it): `person` resigns every office (the
 * vacancies are raised and filled as any other) and leaves public life.
 */
export function personScandalExit(world: World, person: PersonId, date: SimDate): void {
  personRetire(world, person, date, "Resigned");
  benchSync(world);
}

/** A candidate who lost a race and holds no office goes back to their state's bench (lane E calls it). */
export function candidacyLost(world: World, person: PersonId): void {
  const p = personGet(world.persons, person);
  if (p !== undefined && p.status === "Candidate") p.status = "Bench";
}

/** D988 as careers keeps it: a judge's yearly chance of retiring. */
export function judgeRetireChance(age: number): number {
  const over = age - JUDGE_RETIRE_FROM_AGE;
  return over <= 0 ? 0 : Math.min(1, over * JUDGE_RETIRE_PER_YEAR);
}

/** An incumbent's chance to retire rather than run at a cycle (pivot 5.9, T). */
export function retireAtCycleChance(p: Person, seat: OfficeSeat, date: SimDate): number {
  const line = careerLineOf(p, seat);
  const tenure = line === undefined ? 0 : yearsBetween(line.from, date);
  const age = personAge(p, date.year);
  const c =
    RETIRE_BASE +
    Math.max(0, age - RETIRE_FROM_AGE) * RETIRE_PER_AGE_YEAR +
    Math.max(0, tenure - RETIRE_FROM_TENURE) * RETIRE_PER_TENURE_YEAR +
    (p.traits.includes("Content") ? RETIRE_CONTENT : 0);
  return Math.min(1, c);
}

/** The 1 January exits (pivot 5.9): deaths for everyone alive, then the year's mid-term exits. */
function yearlyExits(world: World, g: DrawSource, date: SimDate): void {
  const s = world.persons;
  for (const p of s.persons) {
    if (p.status === "Dead") continue;
    if (g.chance("Politics", deathChance(personAge(p, date.year)))) personDie(world, p.id, date);
  }
  // Mid-term exits, seats in table order (a copy: leaving changes the table).
  for (const o of [...s.offices]) {
    const p = personGet(s, o.person);
    if (p === undefined) continue;
    const age = personAge(p, date.year);
    switch (o.seat.kind) {
      case "Judge":
        if (g.chance("Politics", judgeRetireChance(age))) officeLeave(s, o.seat, "Retired", date);
        break;
      case "Cabinet":
        if (g.chance("Politics", CABINET_RESIGN_CHANCE)) officeLeave(s, o.seat, "Resigned", date);
        break;
      case "Senate":
      case "House":
      case "Governor":
        if (g.chance("Politics", MIDTERM_RESIGN_CHANCE)) officeLeave(s, o.seat, "Resigned", date);
        break;
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------- appointments and successions

/** Who held `seat` last: the person whose closed line for it ended latest (ties to the lower id). */
function lastHolder(s: PersonsState, seat: OfficeSeat): Person | undefined {
  let best: Person | undefined;
  let bestTo: SimDate | null = null;
  for (const p of s.persons) {
    for (const c of p.career) {
      if (c.to === null || officeSeatOrder(c.seat, seat) !== 0) continue;
      if (bestTo === null || cmpDate(c.to, bestTo) > 0) {
        best = p;
        bestTo = c.to;
      }
    }
  }
  return best;
}

function presidentParty(s: PersonsState): Party | null {
  const h = officeHolderOf(s, { kind: "President" });
  return h === undefined ? null : (personGet(s, h.person)?.party ?? null);
}

/** The best of `ids` by `score`, ties to the lower id; undefined for none. */
function bestOf(s: PersonsState, ids: Iterable<PersonId>, score: (p: Person) => number): Person | undefined {
  let best: Person | undefined;
  let bestScore = 0;
  for (const id of ids) {
    const p = personGet(s, id);
    if (p === undefined) continue;
    const sc = score(p);
    if (best === undefined || sc > bestScore || (sc === bestScore && p.id < best.id)) {
      best = p;
      bestScore = sc;
    }
  }
  return best;
}

/** A state's bench members of `party` old enough for `minAge`: the pool a governor or successor draws on. */
function benchOf(
  world: World,
  state: UsStateId,
  party: Party | null,
  minAge: number,
  year: number,
): PersonId[] {
  return (world.persons.benches[state] ?? []).filter((id) => {
    const p = personGet(world.persons, id);
    return p !== undefined && p.status === "Bench" && p.party === party && personAge(p, year) >= minAge;
  });
}

/**
 * The president's pick for an appointed seat (4.7.3 simplified, D984): for the vice presidency or a
 * cabinet seat, with `APPOINT_FROM_CONGRESS_CHANCE` the member of Congress of the president's party
 * best at the post's skill (who leaves their seat, Promoted); otherwise the best of
 * `APPOINTMENT_CANDIDATES` drawn, by skill plus `SAME_PARTY_BONUS`; a judge must then pass the Senate.
 */
function appointee(
  world: World,
  g: DrawSource,
  pool: Pool,
  seat: OfficeSeat,
  appointer: Party,
  date: SimDate,
): Person {
  const s = world.persons;
  const year = date.year;
  const { ranges, key } = seatProfile(world, seat);
  if (
    (seat.kind === "VicePresident" || seat.kind === "Cabinet") &&
    g.chance("Politics", APPOINT_FROM_CONGRESS_CHANCE)
  ) {
    const congress = s.offices
      .filter((o) => o.seat.kind === "House" || o.seat.kind === "Senate")
      .map((o) => o.person)
      .filter((id) => {
        const p = personGet(s, id);
        if (p === undefined || p.party !== appointer) return false;
        const age = personAge(p, year);
        return age >= ranges.age.lo && age <= ranges.age.hi;
      });
    const pick = bestOf(s, congress, (p) => p.skills[key]);
    if (pick !== undefined) {
      leaveAll(world, pick.id, "Promoted", date);
      return pick;
    }
  }
  const same =
    seat.kind === "Judge" ? NOMINEE_SAME_PARTY_CHANCE : seat.kind === "FedChair" ? FED_SAME_PARTY_CHANCE : 1;
  const nominate = (): { d: Drawn; party: Party } => {
    let best: { d: Drawn; party: Party; score: number } | null = null;
    for (let i = 0; i < APPOINTMENT_CANDIDATES; i++) {
      const party = g.chance("Politics", same) ? appointer : otherParty(appointer);
      const d = draw(g, pool, ranges, key, party, 0);
      const score = d.skills[key] + (party === appointer ? SAME_PARTY_BONUS : 0);
      if (best === null || score > best.score) best = { d, party, score };
    }
    return best as { d: Drawn; party: Party };
  };
  let pick = nominate();
  if (seat.kind === "Judge") {
    const senators = s.offices.filter(
      (o) => o.seat.kind === "Senate" && personGet(s, o.person)?.party === appointer,
    );
    const confirm = senators.length >= SENATE_MAJORITY ? CONFIRM_CHANCE_FRIENDLY : CONFIRM_CHANCE_HOSTILE;
    for (let t = 1; t < CONFIRM_TRIES && !g.chance("Politics", confirm); t++) pick = nominate();
  }
  const home = drawHomeState(world, g);
  const integrity = drawIntegrity(g, pick.d.traits, seat.kind === "Judge" ? JUDGE_INTEGRITY : undefined);
  return addDrawn(world, pick.d, year, {
    party: pick.party,
    home,
    origin: "Appointee",
    status: "Bench",
    integrity,
  });
}

/** Someone from `state`'s bench of `party` for a seat there, or a new person drawn for it. */
function fromBench(
  world: World,
  g: DrawSource,
  pool: Pool,
  seat: OfficeSeat,
  state: UsStateId,
  party: Party,
  date: SimDate,
): Person {
  const { ranges, key } = seatProfile(world, seat);
  const pick = bestOf(
    world.persons,
    benchOf(world, state, party, ranges.age.lo, date.year),
    (p) => p.skills.persuasion + 2 * p.level,
  );
  if (pick !== undefined) return pick;
  const lean = world.politics.states[state]?.lean_pts ?? 0;
  const d = draw(g, pool, ranges, key, party, lean);
  const integrity = drawIntegrity(g, d.traits);
  return addDrawn(world, d, date.year, {
    party,
    home: state,
    origin: "Appointee",
    status: "Bench",
    integrity,
  });
}

/**
 * Fills one vacancy that is not a special election's (pivot 6.1 "by office"; D1041). Returns false
 * when it must wait (an appointment with no president to make it).
 */
function fillVacancy(
  world: World,
  g: DrawSource,
  pool: Pool,
  seat: OfficeSeat,
  date: SimDate,
  award: (id: PersonId, a: Achievement) => void,
): boolean {
  const s = world.persons;
  const take = (p: Person, how: "Appointed" | "Succeeded", a: Achievement): void => {
    officeTake(s, p.id, seat, how, date, termEndsOf(world, seat, date));
    award(p.id, a);
  };
  switch (seat.kind) {
    case "President": {
      // The line of succession: the vice president, the Secretary of State, the House's best of the party.
      const party = lastHolder(s, seat)?.party ?? START_PRESIDENT_PARTY;
      const vp = officeHolderOf(s, { kind: "VicePresident" });
      const state = world.politics.posts.findIndex((x) => x.kind === "Cabinet");
      const sec =
        state < 0 ? undefined : officeHolderOf(s, { kind: "Cabinet", post: ordinal<PoliticsPostId>(state) });
      let next = personGet(s, (vp ?? sec)?.person ?? (-1 as PersonId));
      if (next === undefined) {
        const house = s.offices.filter(
          (o) => o.seat.kind === "House" && personGet(s, o.person)?.party === party,
        );
        next = bestOf(
          s,
          house.map((o) => o.person),
          (p) => p.skills.persuasion,
        );
      }
      if (next === undefined) {
        const d = draw(g, pool, PRESIDENT_RANGES, "persuasion", party, 0);
        next = addDrawn(world, d, date.year, {
          party,
          home: drawHomeState(world, g),
          origin: "Appointee",
          status: "Bench",
          integrity: drawIntegrity(g, d.traits),
        });
      }
      leaveAll(world, next.id, "Promoted", date);
      take(next, "Succeeded", "Succeeded");
      return true;
    }
    case "Governor": {
      const party = lastHolder(s, seat)?.party ?? partyForLean(g, seatLean(world, seat));
      take(fromBench(world, g, pool, seat, seat.state, party, date), "Succeeded", "Succeeded");
      return true;
    }
    case "Senate": {
      const gov = officeHolderOf(s, { kind: "Governor", state: seat.state });
      const party =
        (gov === undefined ? null : personGet(s, gov.person)?.party) ??
        partyForLean(g, seatLean(world, seat));
      const p = fromBench(world, g, pool, seat, seat.state, party, date);
      officeTake(s, p.id, seat, "Appointed", date, nextGeneralHandover(date));
      award(p.id, "Appointed");
      return true;
    }
    case "House":
      return false;
    case "VicePresident":
    case "Cabinet":
    case "Judge":
    case "FedChair": {
      const appointer = presidentParty(s);
      if (appointer === null) return false;
      take(appointee(world, g, pool, seat, appointer, date), "Appointed", "Appointed");
      return true;
    }
  }
}

/** Fills every vacancy careers fills (all but a House seat's special election), oldest first. */
function fillVacancies(world: World, g: DrawSource, date: SimDate): void {
  const s = world.persons;
  let pool: Pool | null = null;
  const award = (id: PersonId, a: Achievement): void => {
    personAward(world, g, id, a);
  };
  // A succession raises the successor's own vacancy: a few passes settle the chain.
  for (let pass = 0; pass < 4; pass++) {
    const open = s.vacancies.filter((v) => v.fill !== "Special");
    if (open.length === 0) return;
    let filled = false;
    for (const v of open) {
      if (officeHolderOf(s, v.seat) !== undefined) continue;
      pool ??= poolOf(world, date.year);
      if (fillVacancy(world, g, pool, v.seat, date, award)) filled = true;
    }
    if (!filled) return;
  }
}

/**
 * A newly elected president names a new administration (D1041): every cabinet secretary, and a vice
 * president seated before the president (lane E seats the running mate with the president), leaves
 * at the term's end; `fillVacancies` then appoints. A president by succession keeps the cabinet.
 */
function executiveTurnover(world: World, date: SimDate): void {
  const s = world.persons;
  const ph = officeHolderOf(s, { kind: "President" });
  if (ph === undefined) return;
  const pres = personGet(s, ph.person);
  const line = pres === undefined ? undefined : careerLineOf(pres, ph.seat);
  if (line === undefined || (line.how !== "Elected" && line.how !== "Special")) return;
  for (const o of [...s.offices]) {
    if (o.seat.kind !== "Cabinet" && o.seat.kind !== "VicePresident") continue;
    if (cmpDate(o.since, ph.since) < 0) officeLeave(s, o.seat, "TermEnded", date);
  }
}

/** A Fed chair's term ends (pivot 5.8): the president keeps them with `FED_REAPPOINT_CHANCE` or names another. */
function fedChairTerm(world: World, g: DrawSource, date: SimDate): void {
  const s = world.persons;
  const h = officeHolderOf(s, { kind: "FedChair" });
  if (h === undefined || h.term_ends === null || cmpDate(h.term_ends, date) > 0) return;
  const p = personGet(s, h.person);
  const keep =
    p !== undefined &&
    personAge(p, date.year) < FED_CHAIR_MAX_AGE &&
    g.chance("Politics", FED_REAPPOINT_CHANCE);
  if (keep) h.term_ends = termEndsOf(world, h.seat, h.term_ends);
  else officeLeave(s, h.seat, "TermEnded", date);
}

// ---------------------------------------------------------------- platforms (pivot 5.12)

/** Each party's platform: the seat-weighted mix of its officeholders' ideologies, every seat one. */
export function platformsOf(s: PersonsState): PartyPlatform[] {
  return PARTY_VALUES.map((party) => {
    const mix = IDEOLOGY_VALUES.map(() => 0);
    let n = 0;
    for (const o of s.offices) {
      const p = personGet(s, o.person);
      if (p === undefined || p.party !== party) continue;
      const i = IDEOLOGY_VALUES.indexOf(p.ideology);
      mix[i] = (mix[i] as number) + 1;
      n += 1;
    }
    return { party, mix: n === 0 ? mix : mix.map((x) => x / n) };
  });
}

// ---------------------------------------------------------------- the ladder (pivot 5.9)

/** One declared candidate for a race. */
export interface Declared {
  person: PersonId;
  party: Party | null;
  /** The holder of the seat, running again. */
  incumbent: boolean;
}

/** Why an incumbent is not on the ballot. */
export type IncumbentOut = "TermLimited" | "Retiring" | "SeekingOther";

/** Who runs for one seat (pivot 5.9): what `declareCycle` gives lane E for each race. */
export interface SeatDeclared {
  seat: OfficeSeat;
  /** The holder now, or null for a vacant seat. */
  incumbent: PersonId | null;
  /** Null when the incumbent runs or there is none. A retiring incumbent leaves at the handover, `Retired`. */
  incumbent_out: IncumbentOut | null;
  /** The incumbent first when running, then each party in `PARTY_VALUES` order, best prospect first. */
  candidates: Declared[];
}

type LadderRung = "House" | "Governor" | "Senate" | "President";

function rungOf(seat: OfficeSeat): LadderRung | null {
  return seat.kind === "House" ||
    seat.kind === "Governor" ||
    seat.kind === "Senate" ||
    seat.kind === "President"
    ? seat.kind
    : null;
}

/** The order a cycle's seats are decided in: the top of the ladder first, so seekers leave lower seats. */
const RUNG_ORDER: readonly LadderRung[] = ["President", "Senate", "Governor", "House"];

/** Whether `p`, holding `seat`, may not run for it again (pivot 5.9: the president's two terms; D1041 governors'). */
export function termLimited(p: Person, seat: OfficeSeat, date: SimDate): boolean {
  if (seat.kind === "President") {
    let years = 0;
    for (const c of p.career) {
      if (c.seat.kind === "President") years += yearsBetween(c.from, c.to ?? date);
    }
    return years >= PRESIDENT_TERM_LIMIT * PRESIDENT_TERM_YEARS - 2;
  }
  if (seat.kind === "Governor") {
    const line = careerLineOf(p, seat);
    return (
      line !== undefined && yearsBetween(line.from, date) >= GOVERNOR_TERM_LIMIT * GOVERNOR_TERM_YEARS - 2
    );
  }
  return false;
}

/** The ambition multiplier on seeking (pivot 5.9: ambition is a trait). */
function ambition(p: Person): number {
  return p.traits.includes("Ambitious")
    ? AMBITIOUS_SEEK_MULT
    : p.traits.includes("Content")
      ? CONTENT_SEEK_MULT
      : 1;
}

/**
 * Who declares for each seat of a cycle (pivot 5.9), the function lane E calls when races open.
 * Seats are decided from the top of the ladder down (President, Senate, Governor, House), so a
 * House member who runs for the Senate does not also defend their House seat. An incumbent runs
 * again unless term-limited, already seeking a higher office this cycle, or retiring (chance
 * `retireAtCycleChance`); a party whose incumbent runs fields nobody else (no primary challengers,
 * D1041). Otherwise each party's seekers come from the rung below (the state's bench for the House;
 * House members and the bench for governor; House members, the governor and the bench for the
 * Senate; the vice president, governors and senators for President), each with `SEEK_CHANCE`
 * times ambition (and `OPEN_SEAT_SEEK_MULT` for an open seat), at least the office's minimum age and
 * at most `SEEK_MAX_AGE`; at most `MAX_DECLARED_PER_PARTY` by Persuasion plus two per level (ties to
 * the lower id); a party with none gets a challenger (`challengerFor`). Bench members who declare
 * become Candidates. A seat that is not elected (appointed posts) comes back with its holder only.
 * Results are in the order of `seats`. Politics stream only.
 */
export function declareCycle(
  world: World,
  draws: DrawSource,
  seats: readonly OfficeSeat[],
  date: SimDate,
): SeatDeclared[] {
  const g = politicsDraws(draws);
  const s = world.persons;
  const year = date.year;
  benchSync(world);
  const out: (SeatDeclared | null)[] = seats.map(() => null);
  const used = new Set<PersonId>();
  const order = seats
    .map((seat, i) => [seat, i] as const)
    .sort((a, b) => {
      const ra = rungOf(a[0]);
      const rb = rungOf(b[0]);
      return (
        (ra === null ? 9 : RUNG_ORDER.indexOf(ra)) - (rb === null ? 9 : RUNG_ORDER.indexOf(rb)) || a[1] - b[1]
      );
    });
  const holdersOf = (kind: OfficeSeat["kind"], state: UsStateId | null): PersonId[] =>
    s.offices
      .filter((o) => o.seat.kind === kind && (state === null || seatState(o.seat) === state))
      .map((o) => o.person);
  for (const [seat, i] of order) {
    const holder = officeHolderOf(s, seat);
    const rung = rungOf(seat);
    const decl: SeatDeclared = {
      seat,
      incumbent: holder?.person ?? null,
      incumbent_out: null,
      candidates: [],
    };
    out[i] = decl;
    let runningParty: Party | null | undefined;
    if (holder !== undefined) {
      const p = personGet(s, holder.person) as Person;
      if (rung === null) {
        decl.candidates.push({ person: p.id, party: p.party, incumbent: true });
        continue;
      }
      if (termLimited(p, seat, date)) decl.incumbent_out = "TermLimited";
      else if (used.has(p.id)) decl.incumbent_out = "SeekingOther";
      else if (g.chance("Politics", retireAtCycleChance(p, seat, date))) decl.incumbent_out = "Retiring";
      else {
        decl.candidates.push({ person: p.id, party: p.party, incumbent: true });
        used.add(p.id);
        runningParty = p.party;
      }
    }
    if (rung === null) continue;
    const state = seatState(seat);
    const open = runningParty === undefined;
    // The rungs below this seat, in the order their members are considered.
    const sources: [keyof typeof SEEK_CHANCE, PersonId[]][] = [];
    if (rung === "President") {
      sources.push(["VicePresident", holdersOf("VicePresident", null)]);
      sources.push(["Governor", holdersOf("Governor", null)]);
      sources.push(["Senate", holdersOf("Senate", null)]);
    } else {
      const st = state as UsStateId;
      if (rung === "Senate") {
        sources.push(["House", holdersOf("House", st)]);
        sources.push(["Governor", holdersOf("Governor", st)]);
      } else if (rung === "Governor") {
        sources.push(["House", holdersOf("House", st)]);
      }
      sources.push(["Bench", (s.benches[st] ?? []).filter((id) => personGet(s, id)?.status === "Bench")]);
    }
    const minAge = MIN_AGE[rung];
    for (const party of PARTY_VALUES) {
      if (runningParty === party) continue;
      const seekers: Person[] = [];
      for (const [from, ids] of sources) {
        const base = SEEK_CHANCE[from][rung] ?? 0;
        if (base <= 0) continue;
        for (const id of [...ids].sort((a, b) => a - b)) {
          const p = personGet(s, id);
          if (p === undefined || p.party !== party || used.has(id) || id === holder?.person) continue;
          const age = personAge(p, year);
          if (age < minAge || age > SEEK_MAX_AGE) continue;
          const chance = Math.min(1, base * ambition(p) * (open ? OPEN_SEAT_SEEK_MULT : 1));
          if (g.chance("Politics", chance)) seekers.push(p);
        }
      }
      seekers.sort(
        (a, b) => b.skills.persuasion + 2 * b.level - (a.skills.persuasion + 2 * a.level) || a.id - b.id,
      );
      const picked = seekers.slice(0, MAX_DECLARED_PER_PARTY);
      if (picked.length === 0) {
        const home = state ?? drawHomeState(world, g);
        picked.push(
          challengerFor(world, draws, {
            state: home,
            party,
            ranges: seatProfile(world, seat).ranges,
            origin: "Challenger",
          }),
        );
      }
      for (const p of picked) {
        used.add(p.id);
        if (p.status === "Bench") p.status = "Candidate";
        decl.candidates.push({ person: p.id, party: p.party, incumbent: false });
      }
    }
  }
  return out as SeatDeclared[];
}

// ---------------------------------------------------------------- the year and the day

/**
 * The careers day (pivot 3.3: both fidelities). On 1 January: deaths by the 1995 mortality curve
 * for everyone alive, the year's mid-term exits and the executive crossovers. Every day: a new
 * president's administration, the Fed chair's term, the vacancies careers fills. Then, on
 * 1 January, the bench refresh (after the vacancies, so a bench member taken for a seat is
 * replaced). Last, the benches and the platforms. A world whose persons were never started (no US
 * states, or a hand-built test world) does nothing.
 */
export function careersDay(world: World, draws: DrawSource, date: SimDate): void {
  const s: PersonsState | undefined = world.persons;
  if (s === undefined || s.persons.length === 0) return;
  const g = politicsDraws(draws);
  const newYear = date.month === 1 && date.day === 1;
  if (newYear) {
    yearlyExits(world, g, date);
    executiveCrossovers(world, draws, date);
  }
  executiveTurnover(world, date);
  fedChairTerm(world, g, date);
  fillVacancies(world, g, date);
  if (newYear) benchRefresh(world, g, poolOf(world, date.year), date);
  benchSync(world);
  s.platforms = platformsOf(s);
}

/** The careers job (`DailyCareers`, 00:00 every day). */
export function careersJob(world: World, ctx: JobCtx): void {
  careersDay(world, ctx.draws, ctx.facts.date);
}

/**
 * Lane C's jobs (pivot 3.3: careers, XP and deaths run at both fidelities, so no tag). Registered in
 * the `DailyCareers` slot by jobs.ts.
 */
export function registerCareerJobs(s: Scheduler): void {
  schedulerRegister(s, "DailyCareers", "careers.daily", careersJob);
}
