// Races (pivot 6.1, 6.2, 6.6; D1040): a cycle's races opened on 1 January of a general's year, their
// candidates (incumbents, the ladder, the people waiting on the bench, lane C's `challengerFor`),
// each party's primary, the Coarse strength number, special elections for vacancies, and the
// January handovers through lane C's `officeLeave` and `officeTake`. Draws: the Campaign stream
// for who runs, primaries and strength; lane C's Politics stream inside `challengerFor`.

import { challengerFor } from "../politics/careers.ts";
import { HOUSE_RANGES, type OfficeRanges, PRESIDENT_RANGES, SENATE_RANGES } from "../politics/generate.ts";
import { PRESIDENT_TERM_LIMIT, retireChance } from "../politics/jobs.ts";
import {
  officeHolderOf,
  officeLeave,
  officesOf,
  officeTake,
  personGet,
  seatKey,
} from "../politics/people.ts";
import { simDateAddDays } from "../time/calendar.ts";
import type { SimDate } from "../types/calendar.ts";
import { cmpDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import { ordinal, type PersonId, type RaceId, type UsStateId } from "../types/ids.ts";
import { expF } from "../types/libm.ts";
import { remEuclid } from "../types/num.ts";
import type { Candidacy, Primary, Race, RaceOffice, RaceResult } from "../types/state/elections.ts";
import type { OfficeExit, OfficeHow, OfficeSeat, Person } from "../types/state/persons.ts";
import { PARTY_VALUES, type Party } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import {
  certifyDate,
  electionDay,
  FILING_LEAD_DAYS,
  federalGeneralOnOrAfter,
  GOVERNOR_TERM_LIMIT,
  GOVERNOR_TERM_YEARS,
  governorUp,
  handoverDate,
  hasGeneral,
  isElectionYear,
  isPresidentYear,
  PRESIDENT_TERM_YEARS,
  pollsClose,
  presidentPrimary,
  SENATE_SPECIAL_MIN_DAYS,
  SPECIAL_LEAD_DAYS,
  SPECIAL_PRIMARY_LEAD_DAYS,
  senateClassUp,
  senateClassYear,
  statePrimary,
  termEnds,
  tuesdayOnOrAfter,
} from "./calendar.ts";
import { houseSeats } from "./geography.ts";

// ---------------------------------------------------------------- tuning (pivot 6.2, 6.6; T)

/** Coarse strength per point of Persuasion above 10 (pivot 6.6, T): 4.6.3's candidate term. */
export const STRENGTH_PER_PERSUASION = 0.03;
/** The money proxy per point of Hustle above 10 (pivot 6.3, 6.6, T): fundraising without a war chest. */
export const MONEY_PER_HUSTLE = 0.01;
/** The money proxy of holding the seat (pivot 6.3 "incumbency", T). */
export const INCUMBENT_MONEY = 0.04;
/** The sd of a candidate's starting strength (pivot 6.6, T). */
export const STRENGTH_SD = 0.05;
/** The sd of the weekly drift of a Coarse campaign's strength (pivot 6.6, T). */
export const STRENGTH_WEEKLY_SD = 0.01;
/** Skill points of persuasion and hustle a strength is measured from (4.6.3's base). */
export const STRENGTH_SKILL_BASE = 10;
/** The incumbency term in the vote by office (pivot 6.7, T): about 6, 4, 4 and 2.5 points of margin. */
export const HOUSE_INCUMBENCY = 0.15;
export const SENATE_INCUMBENCY = 0.08;
export const GOVERNOR_INCUMBENCY = 0.08;
export const PRESIDENT_INCUMBENCY = 0.05;
/** Chance an incumbent draws a primary challenger (pivot 6.2, T). */
export const PRIMARY_CHALLENGE_CHANCE = 0.15;
/** Extra candidates in an open seat's primary: 0 to this many beyond the first (T). */
export const OPEN_PRIMARY_EXTRA = 2;
/** Chance the challenging party's primary has a second candidate (T). */
export const CHALLENGER_PRIMARY_EXTRA_CHANCE = 0.3;
/** Chance an open Senate or governor primary's slot goes to a House member of the party (pivot 5.9 "the usual ladder", T). */
export const LADDER_CHANCE = 0.5;
/** Chance a slot is filled from the people waiting on the bench rather than a new challenger (pivot 5.9, T). */
export const BENCH_CHANCE = 0.6;
/** Nobody older than this files, and a president this old does not run again (T). */
export const MAX_CANDIDATE_AGE = 80;
/** Presidential candidates per party with no incumbent running: 2 to this many (T). */
export const PRESIDENT_FIELD_MAX = 4;
export const PRESIDENT_FIELD_MIN = 2;
/** Score points a presidential hopeful's ambition and the vice presidency add (T). */
export const AMBITION_BONUS = 3;
export const VP_BONUS = 4;
/** A primary's share of the race's expected electorate per party (pivot 6.1, T). */
export const PRIMARY_TURNOUT_SHARE = 0.12;
/** Spread of a primary: noise sd and how sharply strength divides the vote (T). */
export const PRIMARY_NOISE_SD = 0.3;
export const PRIMARY_SHARPNESS = 3;

/** The generation ranges of a race's office (politics/generate.ts). */
export function officeRanges(office: RaceOffice): OfficeRanges {
  switch (office) {
    case "President":
      return PRESIDENT_RANGES;
    case "Senate":
    case "Governor":
      return SENATE_RANGES;
    case "House":
      return HOUSE_RANGES;
  }
}

/** The incumbency term (pivot 6.7) of a candidate holding the seat. */
export function incumbencyOf(office: RaceOffice): number {
  switch (office) {
    case "President":
      return PRESIDENT_INCUMBENCY;
    case "Senate":
      return SENATE_INCUMBENCY;
    case "Governor":
      return GOVERNOR_INCUMBENCY;
    case "House":
      return HOUSE_INCUMBENCY;
  }
}

/** The seat a race fills (pivot 5.8). */
export function raceSeat(r: Race): OfficeSeat {
  switch (r.office) {
    case "President":
      return { kind: "President" };
    case "Senate":
      return { kind: "Senate", state: r.state as UsStateId, senate_class: r.senate_class as number };
    case "Governor":
      return { kind: "Governor", state: r.state as UsStateId };
    case "House":
      return { kind: "House", state: r.state as UsStateId, district: r.district as number };
  }
}

/** A person's age in `year`. */
export function ageIn(p: Person, year: number): number {
  return year - p.born;
}

/** The race with `id` (races are in id order and never removed). */
export function raceGet(world: World, id: RaceId): Race | undefined {
  return world.elections.races[id];
}

/**
 * The races not yet finished with: the tail of the table from the first race of the year before
 * (older ones are all certified and seated). In id order.
 */
export function liveRaces(world: World, year: number): Race[] {
  const races = world.elections.races;
  let i = races.length;
  while (i > 0 && (races[i - 1] as Race).cycle >= year - 1) i--;
  return races.slice(i);
}

/** The president's party now (persons first, the POC's table while lane C has not seated one). */
export function presidentParty(world: World): Party {
  const holder = officeHolderOf(world.persons, { kind: "President" });
  const p = holder === undefined ? undefined : personGet(world.persons, holder.person);
  if (p?.party) return p.party;
  const poc = world.politics.politicians.find((c) => c.office.kind === "President");
  return poc?.party ?? PARTY_VALUES[0];
}

/** Coarse strength (pivot 6.6): skills, the money proxy and incumbency, plus a Campaign draw. */
export function drawStrength(p: Person, incumbent: boolean, draws: DrawSource): number {
  return (
    STRENGTH_PER_PERSUASION * (p.skills.persuasion - STRENGTH_SKILL_BASE) +
    MONEY_PER_HUSTLE * (p.skills.hustle - STRENGTH_SKILL_BASE) +
    (incumbent ? INCUMBENT_MONEY : 0) +
    draws.normal("Campaign") * STRENGTH_SD
  );
}

// ---------------------------------------------------------------- recruiting

/** Who can still be drawn into a race this cycle: the bench by state and party, and who has filed. */
interface Recruiter {
  /** Persons on the bench (status Bench), by `${state}/${party}`, in id order. */
  pool: Map<string, PersonId[]>;
  /** Everyone who filed in a race of this cycle. */
  filed: Set<PersonId>;
}

function recruiterNew(world: World, year: number): Recruiter {
  const pool = new Map<string, PersonId[]>();
  for (const p of world.persons.persons) {
    if (p.status !== "Bench" || p.party === null || ageIn(p, year) > MAX_CANDIDATE_AGE) continue;
    const key = `${p.home_state}/${p.party}`;
    const list = pool.get(key);
    if (list === undefined) pool.set(key, [p.id]);
    else list.push(p.id);
  }
  const filed = new Set<PersonId>();
  for (const r of liveRaces(world, year)) for (const c of r.candidacies) filed.add(c.person);
  return { pool, filed };
}

/**
 * A new candidate for `party` in `state` (pivot 5.9): with `BENCH_CHANCE` someone waiting on the
 * bench (a uniform pick), else lane C's `challengerFor`.
 */
function recruit(
  world: World,
  draws: DrawSource,
  rec: Recruiter,
  state: UsStateId,
  party: Party,
  office: RaceOffice,
): Person {
  const list = rec.pool.get(`${state}/${party}`);
  if (list !== undefined && list.length > 0 && draws.chance("Campaign", BENCH_CHANCE)) {
    const at = draws.intInclusive("Campaign", 0, list.length - 1);
    const id = list.splice(at, 1)[0] as PersonId;
    const p = personGet(world.persons, id) as Person;
    p.status = "Candidate";
    return p;
  }
  return challengerFor(world, draws, { state, party, ranges: officeRanges(office), origin: "Challenger" });
}

/** The best House member of `party` in `state` not yet filed (pivot 5.9 ladder), or null. */
function ladderPick(
  world: World,
  rec: Recruiter,
  state: UsStateId,
  party: Party,
  year: number,
): Person | null {
  let best: Person | null = null;
  let score = Number.NEGATIVE_INFINITY;
  for (const o of world.persons.offices) {
    if (o.seat.kind !== "House" || o.seat.state !== state || rec.filed.has(o.person)) continue;
    const p = personGet(world.persons, o.person);
    if (p === undefined || p.party !== party || ageIn(p, year) > MAX_CANDIDATE_AGE) continue;
    const s = p.skills.persuasion + (p.traits.includes("Ambitious") ? AMBITION_BONUS : 0);
    if (s > score) {
      best = p;
      score = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------- opening a cycle

/** A new race's shell, before its candidates (pivot 6.2). */
function raceNew(
  world: World,
  office: RaceOffice,
  state: UsStateId | null,
  district: number | null,
  senateClass: number | null,
  general: SimDate,
  special: boolean,
): Race {
  const e = world.elections;
  const id = ordinal<RaceId>(e.races_made);
  e.races_made += 1;
  const race: Race = {
    id,
    office,
    state,
    district,
    senate_class: senateClass,
    special,
    cycle: general.year,
    status: "Filing",
    incumbent: null,
    incumbent_party: null,
    primaries: [],
    general,
    polls_close: pollsClose(office, general),
    certify: certifyDate(general),
    candidacies: [],
    ballot: [],
    result: null,
  };
  const holder = officeHolderOf(world.persons, raceSeat(race));
  if (holder !== undefined) {
    race.incumbent = holder.person;
    race.incumbent_party = personGet(world.persons, holder.person)?.party ?? null;
  }
  e.races.push(race);
  return race;
}

/** Files `p` in `race` for `party` on `date` with a fresh strength. */
function file(race: Race, p: Person, party: Party, date: SimDate, draws: DrawSource, rec: Recruiter): void {
  const incumbent = race.incumbent === p.id;
  const c: Candidacy = {
    person: p.id,
    party,
    filed: date,
    status: "Running",
    incumbent,
    strength: drawStrength(p, incumbent, draws),
    raised: 0,
    spent: 0,
    cash: 0,
  };
  race.candidacies.push(c);
  rec.filed.add(p.id);
  if (p.status === "Bench") p.status = "Candidate";
}

/** Terms a holder has served by `year`'s general, the one being served included (from `since`). */
function termsServed(since: SimDate, year: number, termYears: number): number {
  return Math.floor((year - since.year) / termYears) + 1;
}

/**
 * Whether the seat's holder runs again (pivot 5.9): alive, not past `MAX_CANDIDATE_AGE`, not term
 * limited, not filed elsewhere, and not retiring (D988's chance by age, a Campaign draw; a
 * president never retires from a second run).
 */
function holderRuns(world: World, race: Race, draws: DrawSource, rec: Recruiter): Person | null {
  if (race.incumbent === null) return null;
  const p = personGet(world.persons, race.incumbent);
  if (p === undefined || p.status === "Dead" || p.party === null || rec.filed.has(p.id)) return null;
  const year = race.cycle;
  const holder = officeHolderOf(world.persons, raceSeat(race));
  if (race.office === "President") {
    if (holder === undefined || ageIn(p, year) > MAX_CANDIDATE_AGE) return null;
    return termsServed(holder.since, year, PRESIDENT_TERM_YEARS) < PRESIDENT_TERM_LIMIT ? p : null;
  }
  if (race.office === "Governor" && holder !== undefined) {
    if (termsServed(holder.since, year, GOVERNOR_TERM_YEARS) >= GOVERNOR_TERM_LIMIT) return null;
  }
  if (ageIn(p, year) > MAX_CANDIDATE_AGE) return null;
  return draws.chance("Campaign", Math.min(1, retireChance(ageIn(p, year)))) ? null : p;
}

/** The primary day of a race (pivot 6.1). */
function primaryDate(race: Race): SimDate {
  if (race.special) return simDateAddDays(race.general, -SPECIAL_PRIMARY_LEAD_DAYS);
  if (race.office === "President") return presidentPrimary(race.cycle);
  return statePrimary(race.state as number, race.cycle);
}

/** Opens each party's primary from the candidacies (in filing order). */
function openPrimaries(race: Race): void {
  const date = primaryDate(race);
  race.primaries = [];
  for (const party of PARTY_VALUES) {
    const ballot = race.candidacies.filter((c) => c.party === party).map((c) => c.person);
    if (ballot.length > 0) race.primaries.push({ party, date, ballot, result: null });
  }
}

/**
 * A statewide or House race's field (pivot 6.2, 5.9): the holder runs for their party unless they
 * stop; each other party's primary gets one or more candidates, an open Senate or governor seat
 * drawing on the state's House members (the ladder).
 */
function fillField(world: World, race: Race, draws: DrawSource, rec: Recruiter, date: SimDate): void {
  const state = race.state as UsStateId;
  const running = holderRuns(world, race, draws, rec);
  const open = running === null;
  for (const party of PARTY_VALUES) {
    let n: number;
    if (running !== null && running.party === party) {
      file(race, running, party, date, draws, rec);
      n = draws.chance("Campaign", PRIMARY_CHALLENGE_CHANCE) ? 1 : 0;
    } else if (open) {
      n = 1 + draws.intInclusive("Campaign", 0, OPEN_PRIMARY_EXTRA);
    } else {
      n = 1 + (draws.chance("Campaign", CHALLENGER_PRIMARY_EXTRA_CHANCE) ? 1 : 0);
    }
    for (let k = 0; k < n; k++) {
      let p: Person | null = null;
      if (open && race.office !== "House" && draws.chance("Campaign", LADDER_CHANCE)) {
        p = ladderPick(world, rec, state, party, race.cycle);
      }
      file(race, p ?? recruit(world, draws, rec, state, party, race.office), party, date, draws, rec);
    }
  }
  openPrimaries(race);
}

/**
 * The presidency's field (pivot 5.9, 6.2): a sitting president who may run is the party's only
 * candidate unless challenged; otherwise the party's senators and governors not up this year and its
 * vice president, best by persuasion with ambition and the vice presidency counting (ties to the
 * lower id), `PRESIDENT_FIELD_MIN` to `PRESIDENT_FIELD_MAX` of them.
 */
function fillPresidentField(
  world: World,
  race: Race,
  draws: DrawSource,
  rec: Recruiter,
  date: SimDate,
): void {
  const year = race.cycle;
  const running = holderRuns(world, race, draws, rec);
  const cycles = world.elections.calendar.governor_cycle;
  const hopefuls = (party: Party): Person[] => {
    const scored: [number, Person][] = [];
    for (const o of world.persons.offices) {
      const s = o.seat;
      const ok =
        s.kind === "VicePresident" ||
        (s.kind === "Senate" && !(isElectionYear(year) && senateClassUp(year) === s.senate_class)) ||
        (s.kind === "Governor" && !governorUp(cycles[s.state] ?? null, year));
      if (!ok || rec.filed.has(o.person)) continue;
      const p = personGet(world.persons, o.person);
      if (p === undefined || p.party !== party) continue;
      const age = ageIn(p, year);
      if (age < PRESIDENT_RANGES.age.lo || age > MAX_CANDIDATE_AGE) continue;
      const score =
        p.skills.persuasion +
        (p.traits.includes("Ambitious") ? AMBITION_BONUS : 0) +
        (s.kind === "VicePresident" ? VP_BONUS : 0);
      if (!scored.some(([, q]) => q.id === p.id)) scored.push([score, p]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id);
    return scored.map(([, p]) => p);
  };
  for (const party of PARTY_VALUES) {
    const pool = hopefuls(party);
    let want: number;
    if (running !== null && running.party === party) {
      file(race, running, party, date, draws, rec);
      want = draws.chance("Campaign", PRIMARY_CHALLENGE_CHANCE) ? 1 : 0;
    } else {
      want = draws.intInclusive("Campaign", PRESIDENT_FIELD_MIN, PRESIDENT_FIELD_MAX);
    }
    for (let k = 0; k < want; k++) {
      const p = pool.shift();
      if (p !== undefined) {
        file(race, p, party, date, draws, rec);
        continue;
      }
      const states = world.politics.states.length;
      const state = ordinal<UsStateId>(draws.intInclusive("Campaign", 0, states - 1));
      file(race, recruit(world, draws, rec, state, party, "President"), party, date, draws, rec);
    }
  }
  openPrimaries(race);
}

/** Whether `year`'s regular races are open already. */
function cycleOpened(world: World, year: number): boolean {
  return liveRaces(world, year).some((r) => !r.special && r.cycle === year);
}

/**
 * Opens `year`'s regular races on `date` (pivot 6.1, 6.2): the presidency, then the Senate class up,
 * the House and the governors in state order (that is their id order); fields are filled in ladder
 * order (president, Senate, governors, House) so a member who runs higher leaves their seat open.
 * Sets the calendar's primaries and next federal general.
 */
export function openCycle(world: World, draws: DrawSource, year: number, date: SimDate): Race[] {
  const e = world.elections;
  const cycles = e.calendar.governor_cycle;
  if (!hasGeneral(year, cycles) || cycleOpened(world, year)) return [];
  const general = electionDay(year);
  if (cmpDate(date, general) > 0) return [];
  const states = world.politics.states;
  const made: Race[] = [];
  if (isPresidentYear(year)) made.push(raceNew(world, "President", null, null, null, general, false));
  if (isElectionYear(year)) {
    const c = senateClassUp(year);
    states.forEach((s, i) => {
      if (s.senate_classes.includes(c)) {
        made.push(raceNew(world, "Senate", ordinal<UsStateId>(i), null, c, general, false));
      }
    });
    states.forEach((_, i) => {
      const state = ordinal<UsStateId>(i);
      const seats = houseSeats(world, state);
      for (let d = 1; d <= seats; d++) made.push(raceNew(world, "House", state, d, null, general, false));
    });
  }
  states.forEach((_, i) => {
    if (governorUp(cycles[i] ?? null, year)) {
      made.push(raceNew(world, "Governor", ordinal<UsStateId>(i), null, null, general, false));
    }
  });
  const rec = recruiterNew(world, year);
  const order: RaceOffice[] = ["President", "Senate", "Governor", "House"];
  for (const office of order) {
    for (const r of made) {
      if (r.office !== office) continue;
      if (office === "President") fillPresidentField(world, r, draws, rec, date);
      else fillField(world, r, draws, rec, date);
    }
  }
  e.calendar.primaries = states.map((_, i) =>
    made.some((r) => r.state === i) ? statePrimary(i, year) : null,
  );
  e.calendar.next_general = federalGeneralOnOrAfter(date);
  return made;
}

// ---------------------------------------------------------------- specials

/** Whether a race (regular or special) for `seat` will be counted on or after `date`. */
function seatRaced(world: World, seat: OfficeSeat, date: SimDate): Race | undefined {
  const key = seatKey(seat);
  return liveRaces(world, date.year).find(
    (r) => r.result === null && cmpDate(r.general, date) >= 0 && seatKey(raceSeat(r)) === key,
  );
}

/** When a special for `seat`, vacant or held by an appointee since `since`, is voted (pivot 6.1); null for none. */
export function specialDate(world: World, seat: OfficeSeat, since: SimDate): SimDate | null {
  if (seat.kind === "House") {
    const day = tuesdayOnOrAfter(simDateAddDays(since, SPECIAL_LEAD_DAYS));
    const regular = seatRaced(world, seat, since);
    if (regular !== undefined && cmpDate(regular.general, day) <= 0) return null;
    // The next regular general fills it: a special after that day's handover is not needed.
    const next = federalGeneralOnOrAfter(since);
    return cmpDate(day, next) >= 0 ? null : day;
  }
  if (seat.kind === "Senate") {
    const day = federalGeneralOnOrAfter(simDateAddDays(since, SENATE_SPECIAL_MIN_DAYS));
    if (senateClassYear(seat.senate_class, day.year) === day.year) return null;
    return day;
  }
  return null;
}

/** Opens a special race for `seat` on `general` (pivot 6.1), its fields and primaries at once. */
function openSpecial(
  world: World,
  draws: DrawSource,
  seat: OfficeSeat,
  general: SimDate,
  date: SimDate,
): Race {
  const office: RaceOffice = seat.kind === "Senate" ? "Senate" : "House";
  const race = raceNew(
    world,
    office,
    seat.kind === "Senate" || seat.kind === "House" ? seat.state : null,
    seat.kind === "House" ? seat.district : null,
    seat.kind === "Senate" ? seat.senate_class : null,
    general,
    true,
  );
  const rec = recruiterNew(world, general.year);
  rec.filed.delete(race.incumbent ?? (-1 as PersonId));
  fillField(world, race, draws, rec, date);
  if (race.incumbent_party === null) {
    // A vacant seat: the party of whoever held it last.
    const key = seatKey(seat);
    for (let i = world.elections.races.length - 1; i >= 0; i--) {
      const r = world.elections.races[i] as Race;
      if (r.result !== null && seatKey(raceSeat(r)) === key) {
        race.incumbent_party = personGet(world.persons, r.result.winner)?.party ?? null;
        break;
      }
    }
  }
  return race;
}

/**
 * Schedules special elections (pivot 6.1): for a vacant House seat (`Special`), and for a Senate
 * seat vacant or held by an appointee (the governor's appointment lasts until a special). Sets the
 * vacancy's `special` day.
 */
export function scheduleSpecials(world: World, draws: DrawSource, date: SimDate): void {
  const s = world.persons;
  for (const v of s.vacancies) {
    if (v.special !== null || (v.seat.kind !== "House" && v.seat.kind !== "Senate")) continue;
    if (seatRaced(world, v.seat, date) !== undefined) continue;
    const day = specialDate(world, v.seat, v.since);
    if (day === null || cmpDate(day, date) <= 0) continue;
    v.special = day;
    openSpecial(world, draws, v.seat, day, date);
  }
  for (const o of s.offices) {
    if (o.seat.kind !== "Senate") continue;
    const p = personGet(s, o.person);
    const line = p?.career.at(-1);
    if (line === undefined || line.how !== "Appointed" || line.to !== null) continue;
    if (seatRaced(world, o.seat, o.since) !== undefined) continue;
    const day = specialDate(world, o.seat, o.since);
    if (day === null || cmpDate(day, date) <= 0) continue;
    openSpecial(world, draws, o.seat, day, date);
  }
}

// ---------------------------------------------------------------- primaries

/** Expected general turnout of a race, for its primaries' size (whole people, rough). */
export type Electorate = (race: Race) => number;

/** Counts a party's primary (pivot 6.1, 6.2): strength plus Campaign noise splits the vote. */
function countPrimary(
  world: World,
  race: Race,
  pr: Primary,
  electorate: number,
  draws: DrawSource,
): PersonId {
  const alive = pr.ballot.map((id) => personGet(world.persons, id)?.status !== "Dead");
  const strength = pr.ballot.map((id) => race.candidacies.find((c) => c.person === id)?.strength ?? 0);
  const score = strength.map((s) => PRIMARY_SHARPNESS * (s + draws.normal("Campaign") * PRIMARY_NOISE_SD));
  const top = Math.max(...score);
  const e = score.map((x, i) => (alive[i] ? expF(x - top) : 0));
  const sum = e.reduce((a, b) => a + b, 0);
  const turnout = Math.floor(electorate * PRIMARY_TURNOUT_SHARE);
  const votes = e.map((x) => (sum > 0 ? Math.floor((turnout * x) / sum) : 0));
  const cast = votes.reduce((a, b) => a + b, 0);
  let w = 0;
  votes.forEach((v, i) => {
    if (alive[i] && (!alive[w] || v > (votes[w] as number))) w = i;
  });
  const result: RaceResult = {
    votes,
    turnout: cast,
    winner: pr.ballot[w] as PersonId,
    margin: 0,
    recount: false,
    certified: pr.date,
  };
  const sorted = votes.slice().sort((a, b) => b - a);
  result.margin = cast > 0 ? (((sorted[0] as number) - (sorted[1] ?? 0)) * 100) / cast : 0;
  pr.result = result;
  return result.winner;
}

/**
 * A race's day of primaries (pivot 6.1): each party's is counted, its winner is the nominee, the
 * others lose it (and go back to the bench if they hold nothing); a party with nobody alive gets a
 * new challenger. The general's ballot is the nominees in `PARTY_VALUES` order.
 */
export function runPrimaries(world: World, race: Race, electorate: number, draws: DrawSource): void {
  const ballot: PersonId[] = [];
  for (const party of PARTY_VALUES) {
    const pr = race.primaries.find((p) => p.party === party);
    let nominee: PersonId | null = null;
    if (pr?.ballot.some((id) => personGet(world.persons, id)?.status !== "Dead")) {
      nominee = countPrimary(world, race, pr, electorate, draws);
    }
    for (const c of race.candidacies) {
      if (c.party !== party) continue;
      if (c.person === nominee) c.status = "Nominee";
      else {
        c.status = personGet(world.persons, c.person)?.status === "Dead" ? "DroppedOut" : "LostPrimary";
        benchIfIdle(world, c.person);
      }
    }
    if (nominee === null) {
      const p = challengerFor(world, draws, {
        state: race.state ?? ordinal<UsStateId>(0),
        party,
        ranges: officeRanges(race.office),
        origin: "Challenger",
      });
      race.candidacies.push({
        person: p.id,
        party,
        filed: pr?.date ?? race.general,
        status: "Nominee",
        incumbent: false,
        strength: drawStrength(p, false, draws),
        raised: 0,
        spent: 0,
        cash: 0,
      });
      nominee = p.id;
    }
    ballot.push(nominee);
  }
  race.ballot = ballot;
  race.status = "General";
}

/** A candidate who holds no office goes back to the bench (pivot 5.9: they may run again). */
export function benchIfIdle(world: World, id: PersonId): void {
  const p = personGet(world.persons, id);
  if (p === undefined || p.status !== "Candidate") return;
  if (officesOf(world.persons, id).length === 0) p.status = "Bench";
}

/**
 * A nominee who died before the count is replaced by a new challenger of their party (pivot 5.9),
 * with a fresh strength, in the same place on the ballot.
 */
export function replaceDeadNominees(world: World, race: Race, draws: DrawSource): void {
  race.ballot.forEach((id, i) => {
    if (personGet(world.persons, id)?.status !== "Dead") return;
    const party = PARTY_VALUES[i] as Party;
    const c = race.candidacies.find((k) => k.person === id);
    if (c !== undefined) c.status = "DroppedOut";
    const p = challengerFor(world, draws, {
      state: race.state ?? ordinal<UsStateId>(0),
      party,
      ranges: officeRanges(race.office),
      origin: "Challenger",
    });
    race.candidacies.push({
      person: p.id,
      party,
      filed: race.general,
      status: "Nominee",
      incumbent: false,
      strength: drawStrength(p, false, draws),
      raised: 0,
      spent: 0,
      cash: 0,
    });
    race.ballot[i] = p.id;
  });
}

/** The weekly Coarse campaign (pivot 6.6): each running candidate's strength drifts (Campaign). */
export function campaignWeek(world: World, draws: DrawSource, date: SimDate): void {
  for (const r of liveRaces(world, date.year)) {
    if (r.result !== null) continue;
    for (const c of r.candidacies) {
      if (c.status === "Running" || c.status === "Nominee") {
        c.strength += draws.normal("Campaign") * STRENGTH_WEEKLY_SD;
      }
    }
  }
}

// ---------------------------------------------------------------- seating

/** How a seat's holder left when someone else won it (pivot 5.9). */
function exitOf(world: World, race: Race, holder: PersonId): OfficeExit {
  const c = race.candidacies.find((k) => k.person === holder);
  if (c !== undefined) return "Defeated";
  if (race.office === "President" || race.office === "Governor") return "TermEnded";
  const elsewhere = liveRaces(world, race.cycle).some((r) => r.candidacies.some((k) => k.person === holder));
  return elsewhere ? "TermEnded" : "Retired";
}

/**
 * Seats the certified winners of `races` on `date` (pivot 6.1): first every losing or leaving
 * holder steps down, then a winner who still holds another seat leaves it (raising its vacancy),
 * then each winner takes the seat, or keeps it with the new term's end.
 */
export function seatWinners(world: World, races: readonly Race[], date: SimDate, how: OfficeHow): void {
  const s = world.persons;
  const ready = races.filter((r) => r.result !== null);
  for (const r of ready) {
    const seat = raceSeat(r);
    const holder = officeHolderOf(s, seat);
    const winner = (r.result as RaceResult).winner;
    if (holder !== undefined && holder.person !== winner) {
      officeLeave(s, seat, exitOf(world, r, holder.person), date, false);
    }
  }
  for (const r of ready) {
    const winner = (r.result as RaceResult).winner;
    const key = seatKey(raceSeat(r));
    for (const o of officesOf(s, winner)) {
      if (seatKey(o.seat) !== key) officeLeave(s, o.seat, "Promoted", date, true);
    }
  }
  for (const r of ready) {
    const seat = raceSeat(r);
    const winner = (r.result as RaceResult).winner;
    const ends = r.special ? regularTermEnd(seat, r.cycle) : termEnds(r.office, r.cycle);
    const held = officeHolderOf(s, seat);
    if (held !== undefined) {
      held.term_ends = ends;
      continue;
    }
    if (personGet(s, winner)?.status === "Dead") {
      s.vacancies.push({
        seat,
        since: date,
        fill: seat.kind === "House" ? "Special" : "Appointment",
        special: null,
      });
      continue;
    }
    officeTake(s, winner, seat, how, date, ends);
  }
}

/** When the regular term of `seat` won at a special in `year` ends (pivot 6.1). */
function regularTermEnd(seat: OfficeSeat, year: number): SimDate {
  if (seat.kind === "Senate") return handoverDate("Senate", senateClassYear(seat.senate_class, year + 1));
  let y = year;
  while (!isElectionYear(y)) y++;
  return handoverDate("House", y);
}

/**
 * After a House handover: members of districts a census removed leave (pivot 5.3; the POC's
 * 1995-rework 7.4 "a member whose seat is gone leaves").
 */
export function dropLostDistricts(world: World, date: SimDate): void {
  const gone = world.persons.offices.filter(
    (o) => o.seat.kind === "House" && o.seat.district > houseSeats(world, o.seat.state),
  );
  for (const o of gone) officeLeave(world.persons, o.seat, "TermEnded", date, false);
}

/** Whether `year` is a governor year for some state (for tests and the calendar view). */
export function governorsUp(world: World, year: number): UsStateId[] {
  const out: UsStateId[] = [];
  world.elections.calendar.governor_cycle.forEach((c, i) => {
    if (governorUp(c, year)) out.push(ordinal<UsStateId>(i));
  });
  return out;
}

/** The year after `year` with a general (pivot 6.1). */
export function nextGeneralYear(world: World, year: number): number {
  let y = year + 1;
  while (!hasGeneral(y, world.elections.calendar.governor_cycle)) y++;
  return y;
}

/** The filing deadline of a race (pivot 6.2): `FILING_LEAD_DAYS` before its primaries. */
export function filingDeadline(race: Race): SimDate {
  return simDateAddDays(race.primaries[0]?.date ?? race.general, -FILING_LEAD_DAYS);
}

/** Remainder helper for callers (governor cycles are years mod 4). */
export function cycleOf(year: number): number {
  return remEuclid(year, GOVERNOR_TERM_YEARS);
}
