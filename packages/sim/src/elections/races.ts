// Races (pivot 6.1, 6.2, 6.6; D1040, D1052): a cycle's races opened on 1 January of a general's
// year, their candidates, each party's primary, the Coarse strength number, special elections for
// vacancies, and the January handovers through lane C's `officeLeave` and `officeTake`.
//
// Who runs is lane C's (D1052): `declareCycle` (politics/careers.ts) decides each seat's field, the
// incumbents running again or not (term limits, retirement, seeking a higher office) and the seekers
// from the rung below, on the Politics stream; a candidate who loses goes back to the bench with
// `candidacyLost`; wins earn XP through `personAward`. This file files them, runs the primaries and
// seats the winners. Draws: the Campaign stream for strength and primaries; lane C's Politics
// stream inside `declareCycle`, `challengerFor` and `personAward`.

import {
  candidacyLost,
  challengerFor,
  type Declared,
  declareCycle,
  personAward,
  termLimited,
} from "../politics/careers.ts";
import { HOUSE_RANGES, type OfficeRanges, PRESIDENT_RANGES, SENATE_RANGES } from "../politics/generate.ts";
import {
  officeHolderOf,
  officeLeave,
  officesOf,
  officeTake,
  personGet,
  seatKey,
  vacancyFillOf,
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
  GOVERNOR_TERM_YEARS,
  governorUp,
  handoverDate,
  hasGeneral,
  isElectionYear,
  isPresidentYear,
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

/** The president's party now (the persons table; the first party while the seat is empty). */
export function presidentParty(world: World): Party {
  const holder = officeHolderOf(world.persons, { kind: "President" });
  const p = holder === undefined ? undefined : personGet(world.persons, holder.person);
  return p?.party ?? (PARTY_VALUES[0] as Party);
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

/** A new candidacy of `p` for `party` filed on `date`, with a fresh strength (Campaign). */
function candidacyNew(
  p: Person,
  party: Party,
  date: SimDate,
  incumbent: boolean,
  draws: DrawSource,
): Candidacy {
  return {
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

/** Everyone running in a live race not yet counted, but `races` (a person runs in one race at a time). */
function runningElsewhere(world: World, year: number, races: readonly Race[]): Set<PersonId> {
  const out = new Set<PersonId>();
  for (const r of liveRaces(world, year)) {
    if (r.result !== null || races.includes(r)) continue;
    for (const c of r.candidacies) if (c.status === "Running" || c.status === "Nominee") out.add(c.person);
  }
  return out;
}

/**
 * Files the fields of `races` on `date` (pivot 5.9, 6.2; D1052): lane C's `declareCycle` decides who
 * runs for each seat (the races' seats in their order; it settles the ladder from the President down,
 * so a member who runs higher leaves their seat open), each declared candidate of a party is filed
 * for it, and each party's primary is opened. A candidate already running in another live race is
 * not filed twice; a party left with nobody gets a challenger (`challengerFor`).
 */
function fileFields(world: World, draws: DrawSource, races: readonly Race[], date: SimDate): void {
  if (races.length === 0) return;
  const busy = runningElsewhere(world, date.year, races);
  const declared = declareCycle(world, draws, races.map(raceSeat), date);
  races.forEach((race, i) => {
    const decl = declared[i]?.candidates ?? [];
    const filed = new Set<PersonId>();
    const fileOne = (c: Declared): void => {
      if (c.party === null || filed.has(c.person) || (!c.incumbent && busy.has(c.person))) return;
      const p = personGet(world.persons, c.person);
      if (p === undefined) return;
      race.candidacies.push(candidacyNew(p, c.party, date, c.incumbent && race.incumbent === p.id, draws));
      filed.add(p.id);
      busy.add(p.id);
      if (p.status === "Bench") p.status = "Candidate";
    };
    for (const c of decl) fileOne(c);
    for (const party of PARTY_VALUES) {
      if (race.candidacies.some((c) => c.party === party)) continue;
      const p = challengerFor(world, draws, {
        state: race.state ?? ordinal<UsStateId>(0),
        party,
        ranges: officeRanges(race.office),
        origin: "Challenger",
      });
      fileOne({ person: p.id, party, incumbent: false });
    }
    openPrimaries(race);
  });
}

/** Whether `year`'s regular races are open already. */
function cycleOpened(world: World, year: number): boolean {
  return liveRaces(world, year).some((r) => !r.special && r.cycle === year);
}

/**
 * Opens `year`'s regular races on `date` (pivot 6.1, 6.2): the presidency, then the Senate class up,
 * the House and the governors in state order (that is their id order); their fields are lane C's
 * `declareCycle` (`fileFields`). Sets the calendar's primaries and next federal general.
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
  fileFields(world, draws, made, date);
  e.calendar.primaries = states.map((_, i) =>
    made.some((r) => r.state === i) ? statePrimary(i, year) : null,
  );
  e.calendar.next_general = federalGeneralOnOrAfter(date);
  return made;
}

// ---------------------------------------------------------------- specials

/** The races not yet counted, by their seat's key: built once per day of specials (a lookup only). */
type RaceIndex = Map<string, Race[]>;

function raceIndexOf(world: World, year: number): RaceIndex {
  const out: RaceIndex = new Map();
  for (const r of liveRaces(world, year)) {
    if (r.result === null) raceIndexAdd(out, r);
  }
  return out;
}

function raceIndexAdd(index: RaceIndex, r: Race): void {
  const key = seatKey(raceSeat(r));
  const list = index.get(key);
  if (list === undefined) index.set(key, [r]);
  else list.push(r);
}

/**
 * Whether a race (regular or special) for `seat` will be counted on or after `date`. A race not yet
 * counted is always one of the live races of today's year, so `index` (today's) answers for an
 * earlier `date` too.
 */
function seatRaced(world: World, seat: OfficeSeat, date: SimDate, index?: RaceIndex): Race | undefined {
  const list = (index ?? raceIndexOf(world, date.year)).get(seatKey(seat)) ?? [];
  return list.find((r) => r.result === null && cmpDate(r.general, date) >= 0);
}

/** When a special for `seat`, vacant or held by an appointee since `since`, is voted (pivot 6.1); null for none. */
export function specialDate(
  world: World,
  seat: OfficeSeat,
  since: SimDate,
  index?: RaceIndex,
): SimDate | null {
  if (seat.kind === "House") {
    const day = tuesdayOnOrAfter(simDateAddDays(since, SPECIAL_LEAD_DAYS));
    const regular = seatRaced(world, seat, since, index);
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
  fileFields(world, draws, [race], date);
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
 * Schedules special elections (pivot 6.1): for a vacant House seat (`Special`, lane C's
 * `vacancyFillOf`), and for a Senate seat held by a governor's appointee (lane C appoints the day the
 * seat opens; the appointment lasts until a special). Sets the vacancy's `special` day.
 */
export function scheduleSpecials(world: World, draws: DrawSource, date: SimDate): void {
  const s = world.persons;
  let index: RaceIndex | null = null;
  const races = (): RaceIndex => {
    index ??= raceIndexOf(world, date.year);
    return index;
  };
  const open = (seat: OfficeSeat, day: SimDate): void => {
    raceIndexAdd(races(), openSpecial(world, draws, seat, day, date));
  };
  for (const v of s.vacancies) {
    if (v.special !== null || (v.seat.kind !== "House" && v.seat.kind !== "Senate")) continue;
    // A district a redraw has taken away waits empty for the House handover (`dropLostDistricts`).
    if (lostDistrict(world, v.seat) || seatRaced(world, v.seat, date, races()) !== undefined) continue;
    const day = specialDate(world, v.seat, v.since, races());
    if (day === null || cmpDate(day, date) <= 0) continue;
    v.special = day;
    open(v.seat, day);
  }
  for (const o of s.offices) {
    if (o.seat.kind !== "Senate") continue;
    const p = personGet(s, o.person);
    const line = p?.career.at(-1);
    if (line === undefined || line.how !== "Appointed" || line.to !== null) continue;
    if (seatRaced(world, o.seat, o.since, races()) !== undefined) continue;
    const day = specialDate(world, o.seat, o.since, races());
    if (day === null || cmpDate(day, date) <= 0) continue;
    open(o.seat, day);
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
 * A race's day of primaries (pivot 6.1): each party's is counted, its winner is the nominee (a
 * contested one earns lane C's `PrimaryWon` XP, pivot 5.10), the others lose it (and go back to the
 * bench with `candidacyLost` if they hold nothing); a party with nobody alive gets a new challenger.
 * The general's ballot is the nominees in `PARTY_VALUES` order.
 */
export function runPrimaries(world: World, race: Race, electorate: number, draws: DrawSource): void {
  const ballot: PersonId[] = [];
  for (const party of PARTY_VALUES) {
    const pr = race.primaries.find((p) => p.party === party);
    let nominee: PersonId | null = null;
    if (pr?.ballot.some((id) => personGet(world.persons, id)?.status !== "Dead")) {
      nominee = countPrimary(world, race, pr, electorate, draws);
      if (pr.ballot.length > 1) personAward(world, draws, nominee, "PrimaryWon");
    }
    for (const c of race.candidacies) {
      if (c.party !== party) continue;
      if (c.person === nominee) c.status = "Nominee";
      else {
        c.status = personGet(world.persons, c.person)?.status === "Dead" ? "DroppedOut" : "LostPrimary";
        candidacyLost(world, c.person);
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
        ...candidacyNew(p, party, pr?.date ?? race.general, false, draws),
        status: "Nominee",
      });
      nominee = p.id;
    }
    ballot.push(nominee);
  }
  race.ballot = ballot;
  race.status = "General";
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
    race.candidacies.push({ ...candidacyNew(p, party, race.general, false, draws), status: "Nominee" });
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

/**
 * After a race is counted (pivot 5.9, 5.10): the winner earns lane C's XP (a special `SpecialWon`, a
 * sitting holder `ReElected`, anyone else `ElectionWon`) and every losing nominee goes back to the
 * bench if they hold nothing (`candidacyLost`).
 */
export function raceDecided(world: World, race: Race, draws: DrawSource): void {
  const winner = race.result?.winner;
  if (winner === undefined) return;
  for (const c of race.candidacies) if (c.status === "Lost") candidacyLost(world, c.person);
  if (personGet(world.persons, winner) === undefined) return;
  const achievement = race.special ? "SpecialWon" : race.incumbent === winner ? "ReElected" : "ElectionWon";
  personAward(world, draws, winner, achievement);
}

// ---------------------------------------------------------------- seating

/**
 * How a seat's holder left when someone else won it (pivot 5.9): beaten on the ballot; their term
 * over when they ran for something else or were term-limited (lane C's `termLimited`); otherwise they
 * retired, as `declareCycle` decided (they leave public life).
 */
function exitOf(world: World, race: Race, holder: PersonId, date: SimDate): OfficeExit {
  if (race.candidacies.some((k) => k.person === holder)) return "Defeated";
  const elsewhere = liveRaces(world, race.cycle).some((r) => r.candidacies.some((k) => k.person === holder));
  if (elsewhere) return "TermEnded";
  const p = personGet(world.persons, holder);
  if (p !== undefined && termLimited(p, raceSeat(race), date)) return "TermEnded";
  return "Retired";
}

/**
 * Seats the certified winners of `races` on `date` (pivot 6.1): first every losing or leaving
 * holder steps down, then a winner who still holds another seat leaves it (raising its vacancy,
 * which lane C fills), then each winner takes the seat, or keeps it with the new term's end.
 */
export function seatWinners(world: World, races: readonly Race[], date: SimDate, how: OfficeHow): void {
  const s = world.persons;
  const ready = races.filter((r) => r.result !== null);
  for (const r of ready) {
    const seat = raceSeat(r);
    const holder = officeHolderOf(s, seat);
    const winner = (r.result as RaceResult).winner;
    if (holder !== undefined && holder.person !== winner) {
      officeLeave(s, seat, exitOf(world, r, holder.person, date), date, false);
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
      // The seat stays vacant (once: a holder who died before the handover already raised it).
      if (!s.vacancies.some((v) => seatKey(v.seat) === seatKey(seat))) {
        s.vacancies.push({ seat, since: date, fill: vacancyFillOf(seat), special: null });
      }
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
 * 1995-rework 7.4 "a member whose seat is gone leaves"). Until then a sitting member keeps their
 * district number through a redraw (D1052): the number names the new plan's district of that number.
 */
export function dropLostDistricts(world: World, date: SimDate): void {
  const s = world.persons;
  const gone = s.offices.filter((o) => o.seat.kind === "House" && lostDistrict(world, o.seat));
  for (const o of gone) officeLeave(s, o.seat, "TermEnded", date, false);
  s.vacancies = s.vacancies.filter((v) => !lostDistrict(world, v.seat));
}

/** A House seat whose district the plan in force no longer has (a census took it; pivot 5.3). */
export function lostDistrict(world: World, seat: OfficeSeat): boolean {
  return seat.kind === "House" && seat.district > houseSeats(world, seat.state);
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
