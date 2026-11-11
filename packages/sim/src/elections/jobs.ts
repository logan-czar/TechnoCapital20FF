// Lane E's jobs (pivot 6.1, 6.2, 6.6, 6.7, 9.1, 9.4; D1040): the daily calendar (cycles opened on
// 1 January, filing deadlines, primaries, the count at the first midnight after the polls close,
// certification, the January handovers, special elections) and the weekly Coarse campaign. They act
// only in a world with counties; a world without (the frozen 2020 fixture) keeps the politics POC's
// yearly vote (politics/jobs.ts), so its seats and draws are as they were.

import { isElectionDay } from "../politics/calendar.ts";
import { challengerFor } from "../politics/careers.ts";
import { SENATE_RANGES } from "../politics/generate.ts";
import { eraTide } from "../politics/jobs.ts";
import { officeHolderOf, officeTake, personAdd, personGet } from "../politics/people.ts";
import { CANDIDATE_PERSUASION_BASE, type Contender, type VoteClimate } from "../politics/vote.ts";
import { dateTimeDate, simDateAddDays } from "../time/calendar.ts";
import type { JobCtx } from "../time/scheduler.ts";
import { jobCtxRaiseAlert } from "../time/scheduler.ts";
import type { SimDate } from "../types/calendar.ts";
import { cmpDate, dateEq } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import { type CountyId, ordinal, type PersonId, type UsStateId } from "../types/ids.ts";
import { expF } from "../types/libm.ts";
import type { CountyResult, ElectoralCollege, Race } from "../types/state/elections.ts";
import type { CountyShare } from "../types/state/geo.ts";
import type { OfficeSeat } from "../types/state/persons.ts";
import { PARTY_VALUES, type Party } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import {
  CONGRESS_HANDOVER_DAY,
  federalGeneralOnOrAfter,
  governorCycles,
  governorUp,
  handoverDate,
  isElectionYear,
  isPresidentYear,
  PRESIDENT_HANDOVER_DAY,
  senateClassUp,
  senateClassYear,
} from "./calendar.ts";
import {
  collegeTotals,
  countUnits,
  drawSwings,
  HOUSE_RACE_NOISE_SD,
  MIDTERM_TURNOUT_RATIO,
  PRESIDENT_RACE_NOISE_SD,
  raceNoise,
  raceResultOf,
  STATEWIDE_RACE_NOISE_SD,
  stateTallies,
  sumCount,
} from "./count.ts";
import { countiesByState, districtUnits, electors, houseSeats, shareSize, wholeUnits } from "./geography.ts";
import { mirrorElection, mirrorOffices, mirrorReelected } from "./mirror.ts";
import {
  benchIfIdle,
  campaignWeek,
  dropLostDistricts,
  filingDeadline,
  incumbencyOf,
  liveRaces,
  openCycle,
  presidentParty,
  replaceDeadNominees,
  runPrimaries,
  scheduleSpecials,
  seatWinners,
} from "./races.ts";

/** Whether elections run in this world (pivot 5.1, 6.7): only where there are counties to count. */
export function electionsActive(world: World): boolean {
  return world.geo.counties.length > 0;
}

// ---------------------------------------------------------------- geography of a race

/** A race's units (pivot 6.7): its district's shares, its state's counties or every county. */
export function raceUnits(world: World, race: Race, byState: readonly CountyId[][]): CountyShare[] {
  if (race.office === "President") {
    return world.geo.counties.map((_, i) => ({ county: ordinal<CountyId>(i), from: 0, to: 1 }));
  }
  const state = race.state as UsStateId;
  const counties = byState[state] ?? [];
  if (race.office === "House") {
    return districtUnits(world, state, race.district as number, houseSeats(world, state), counties);
  }
  return wholeUnits(counties);
}

/** A race's expected voters at full turnout (for its primaries' size). */
export function raceElectorate(world: World, race: Race, byState: readonly CountyId[][]): number {
  let n = 0;
  for (const s of raceUnits(world, race, byState)) {
    const c = world.geo.counties[s.county];
    if (c !== undefined) n += shareSize(c, s) * c.turnout;
  }
  return n;
}

// ---------------------------------------------------------------- the count

/** The US zone's cycle effect (pivot 6.7 "the economy"; the POC's 4.6.3 term). */
function usGrowth(world: World): number {
  const country = world.countries[world.politics.country];
  const zone = country === undefined ? undefined : world.zones[country.zone];
  return zone?.effect ?? 0;
}

/** Each party's House seats now (persons), Democrats then Republicans. */
function houseByParty(world: World): [number, number] {
  let dem = 0;
  let rep = 0;
  for (const o of world.persons.offices) {
    if (o.seat.kind !== "House") continue;
    const party = personGet(world.persons, o.person)?.party;
    if (party === "Democrats") dem++;
    else if (party === "Republicans") rep++;
  }
  return [dem, rep];
}

/**
 * The House decides a college with no majority (pivot 6.7; D1040, the simplest rule): the nominee of
 * the party holding more House seats, ties to the sitting president's party.
 */
function houseContingency(world: World, race: Race): number {
  const [dem, rep] = houseByParty(world);
  const party: Party = dem > rep ? "Democrats" : rep > dem ? "Republicans" : presidentParty(world);
  const i = PARTY_VALUES.indexOf(party);
  return i < race.ballot.length ? i : 0;
}

/** The noise sd of a race by office (pivot 6.7). */
function noiseSd(race: Race): number {
  if (race.office === "President") return PRESIDENT_RACE_NOISE_SD;
  return race.office === "House" ? HOUSE_RACE_NOISE_SD : STATEWIDE_RACE_NOISE_SD;
}

/**
 * Counts every race whose polls closed on `general` (pivot 6.7, 9.1): one day's swings, then each
 * race in id order. Results are complete at once (Coarse and M2; election night's batches are M5's).
 * Returns the county columns of the regular races and the college, if the presidency was up.
 */
export function countDay(
  world: World,
  draws: DrawSource,
  races: readonly Race[],
  general: SimDate,
): { county: CountyResult[]; college: ElectoralCollege | null } {
  const party = presidentParty(world);
  const climate: VoteClimate = { incumbent_party: party, growth: usGrowth(world), swing: 0 };
  const swings = drawSwings(world, draws, eraTide(world, party, general));
  const byState = countiesByState(world);
  const presidential = isElectionYear(general.year) && isPresidentYear(general.year);
  const scale = presidential ? 1 : MIDTERM_TURNOUT_RATIO;
  const county: CountyResult[] = [];
  let college: ElectoralCollege | null = null;
  for (const race of races) {
    replaceDeadNominees(world, race, draws);
    const contenders: Contender[] = race.ballot.map((id, i) => {
      const c = race.candidacies.find((k) => k.person === id);
      return {
        party: (c?.party ?? PARTY_VALUES[i]) as Party,
        persuasion: CANDIDATE_PERSUASION_BASE,
        incumbency: c?.incumbent && id === race.incumbent ? incumbencyOf(race.office) : 0,
        strength: c?.strength ?? 0,
      };
    });
    const units = raceUnits(world, race, byState);
    const count = countUnits(
      world,
      units,
      contenders,
      climate,
      swings,
      raceNoise(draws, noiseSd(race)),
      scale,
    );
    const { votes, turnout } = sumCount(count);
    let winner: number | null = null;
    if (race.office === "President") {
      const tallies = stateTallies(
        count,
        (c) => (world.geo.counties[c] as { state: UsStateId }).state,
        race.ballot,
        (s) => electors(world, s, byState[s] ?? []),
        world.politics.states.length,
      );
      const totals = collegeTotals(tallies, race.ballot);
      winner = totals.winner ?? houseContingency(world, race);
      college = {
        race: race.id,
        states: tallies,
        totals: totals.totals,
        winner: totals.winner === null ? null : (race.ballot[totals.winner] as PersonId),
      };
    }
    race.result = raceResultOf(race.ballot, votes, turnout, winner);
    race.status = "Counting";
    for (const c of race.candidacies) {
      if (c.status !== "Nominee") continue;
      c.status = c.person === race.result.winner ? "Won" : "Lost";
      if (c.status === "Lost") benchIfIdle(world, c.person);
    }
    if (!race.special) county.push({ race: race.id, counties: count.counties, votes: count.votes });
  }
  return { county, college };
}

/**
 * Keeps county columns for the latest general and the latest presidential race (pivot 8.6;
 * tools/spikes/coarse/README.md: race-level results for every race, county ones for the latest).
 */
function keepCountyResults(world: World, fresh: CountyResult[], general: SimDate): void {
  const e = world.elections;
  if (fresh.length === 0) return;
  const hasPresident = fresh.some((r) => world.elections.races[r.race]?.office === "President");
  const keep = hasPresident
    ? []
    : e.county_results.filter((r) => world.elections.races[r.race]?.office === "President");
  e.county_results = [...keep, ...fresh].sort((a, b) => a.race - b.race);
  e.latest_general = general;
}

// ---------------------------------------------------------------- the start

/** A started office holder's integrity when the POC had none (pivot 5.11, T): the middle. */
export const START_INTEGRITY = 50;
/** How sharply a state's lean decides its starting governor's party (T): a logistic in lean points. */
export const START_GOVERNOR_LEAN_SCALE = 0.1;

/** The first general for an office on or after `year`, for a started holder's term end. */
function nextRegularYear(seat: OfficeSeat, year: number, cycles: readonly (number | null)[]): number {
  let y = year;
  switch (seat.kind) {
    case "President":
      while (!(isElectionYear(y) && isPresidentYear(y))) y++;
      return y;
    case "Senate":
      return senateClassYear(seat.senate_class, year);
    case "Governor":
      while (!governorUp(cycles[seat.state] ?? null, y)) y++;
      return y;
    default:
      while (!isElectionYear(y)) y++;
      return y;
  }
}

/**
 * Persons from the POC's start (D1040), while lane C's `personsStart` seats nobody: the president,
 * the senators and the members become persons holding their seats ("Start"), and each state's
 * governor is drawn (`challengerFor`, the party by the state's lean on the Campaign stream). Runs
 * only when the offices table is empty, so lane C's start, once it seats people, replaces it.
 */
function bridgeStart(world: World, draws: DrawSource, date: SimDate): void {
  const s = world.persons;
  if (s.offices.length > 0) return;
  const p = world.politics;
  const cycles = world.elections.calendar.governor_cycle;
  const year = date.year;
  for (const c of p.politicians) {
    let seat: OfficeSeat;
    if (c.office.kind === "President") seat = { kind: "President" };
    else if (c.office.kind === "Senate")
      seat = { kind: "Senate", state: c.office.state, senate_class: c.office.senate_class };
    else if (c.office.kind === "House") {
      const d = p.districts[c.office.district];
      if (d === undefined) continue;
      seat = { kind: "House", state: d.state, district: d.number };
    } else continue;
    const person = personAdd(s, (id) => ({
      id,
      name: c.name,
      born: year - c.age,
      skills: { ...c.skills },
      traits: c.traits.slice(),
      integrity: c.integrity ?? START_INTEGRITY,
      ideology: c.ideology,
      party: c.party,
      home_state: seat.kind === "President" ? ordinal<UsStateId>(0) : seat.state,
      status: "InOffice",
      origin: "Start",
      company: null,
      xp: 0,
      level: 0,
      career: [],
      left: null,
    }));
    const office = seat.kind === "President" ? "President" : seat.kind === "Senate" ? "Senate" : "House";
    officeTake(s, person.id, seat, "Start", date, handoverDate(office, nextRegularYear(seat, year, cycles)));
  }
  p.states.forEach((st, i) => {
    if (cycles[i] === null || cycles[i] === undefined) return;
    const state = ordinal<UsStateId>(i);
    const dem = 1 / (1 + expF(-START_GOVERNOR_LEAN_SCALE * st.lean_pts));
    const party: Party = draws.chance("Campaign", dem) ? "Democrats" : "Republicans";
    const person = challengerFor(world, draws, { state, party, ranges: SENATE_RANGES, origin: "Start" });
    const seat: OfficeSeat = { kind: "Governor", state };
    officeTake(
      s,
      person.id,
      seat,
      "Start",
      date,
      handoverDate("Governor", nextRegularYear(seat, year, cycles)),
    );
  });
}

/**
 * The elections at a world's start (pivot 6.1): each state's governor cycle, the bridge from the
 * POC's seats while lane C seats nobody, and the start year's races if its general is still ahead.
 */
export function startElections(world: World, draws: DrawSource): void {
  if (!electionsActive(world)) return;
  const e = world.elections;
  const date = dateTimeDate(world.clock);
  e.calendar.governor_cycle = governorCycles(world.politics.states.map((s) => s.name));
  e.calendar.next_general = federalGeneralOnOrAfter(date);
  bridgeStart(world, draws, date);
  openCycle(world, draws, date.year, date);
}

// ---------------------------------------------------------------- the jobs

/** The daily job (pivot 6.1, 6.2, 6.7, 9.4), in the `DailyElections` slot. */
export function electionsDailyJob(world: World, ctx: JobCtx): void {
  if (!electionsActive(world)) return;
  const date = ctx.facts.date;
  const draws = ctx.draws;
  const e = world.elections;
  if (date.month === 1 && date.day === 1) openCycle(world, draws, date.year, date);
  // A historical world says when the US votes (1995-rework 8.2), as the POC did on the day.
  if (world.era !== undefined && isElectionDay(date)) jobCtxRaiseAlert(ctx, "Election", { kind: "None" });
  const live = liveRaces(world, date.year);
  let byState: CountyId[][] | null = null;
  const states = (): CountyId[][] => {
    byState ??= countiesByState(world);
    return byState;
  };
  // Filing deadlines and primaries.
  for (const r of live) {
    if (r.status === "Filing" && cmpDate(date, filingDeadline(r)) >= 0) r.status = "Primaries";
    const day = r.primaries[0]?.date ?? r.general;
    if ((r.status === "Filing" || r.status === "Primaries") && cmpDate(date, day) >= 0) {
      runPrimaries(world, r, raceElectorate(world, r, states()), draws);
    }
  }
  // The count: every race whose polls closed since the last midnight, by general day.
  const due = live.filter((r) => r.result === null && r.status === "General" && cmpDate(date, r.general) > 0);
  const days: SimDate[] = [];
  for (const r of due) if (!days.some((d) => dateEq(d, r.general))) days.push(r.general);
  days.sort(cmpDate);
  for (const general of days) {
    const races = due.filter((r) => dateEq(r.general, general));
    const { county, college } = countDay(world, draws, races, general);
    keepCountyResults(world, county, general);
    if (college !== null) e.colleges.push(college);
    if (races.some((r) => !r.special) && isElectionYear(general.year)) {
      mirrorElection(world, races, general, senateClassUp(general.year));
    }
    e.calendar.next_general = federalGeneralOnOrAfter(simDateAddDays(date, 1));
  }
  // Certification; a special's winner is seated at once.
  let mirror = false;
  for (const r of live) {
    if (r.status !== "Counting" || cmpDate(date, r.certify) < 0) continue;
    r.status = "Certified";
    if (r.result !== null) r.result.certified = r.certify;
    if (r.special) {
      seatWinners(world, [r], date, "Special");
      mirror = true;
    }
  }
  // The January handovers (pivot 6.1).
  if (date.month === 1 && (date.day === CONGRESS_HANDOVER_DAY || date.day === PRESIDENT_HANDOVER_DAY)) {
    const president = date.day === PRESIDENT_HANDOVER_DAY;
    const batch = live.filter(
      (r) =>
        !r.special &&
        r.status === "Certified" &&
        r.cycle === date.year - 1 &&
        (r.office === "President") === president &&
        dateEq(handoverDate(r.office, r.cycle), date),
    );
    if (batch.length > 0) {
      const before = officeHolderOf(world.persons, { kind: "President" })?.person ?? null;
      seatWinners(world, batch, date, "Elected");
      if (batch.some((r) => r.office === "House")) dropLostDistricts(world, date);
      if (president && batch[0]?.result?.winner === before) mirrorReelected(world);
      mirrorOffices(world, draws, date, president);
      mirror = false;
    }
  }
  if (mirror) mirrorOffices(world, draws, date, false);
  scheduleSpecials(world, draws, date);
}

/** The weekly Coarse campaign (pivot 6.6), first in `WeeklyJobs`, tagged Coarse. */
export function electionsWeeklyJob(world: World, ctx: JobCtx): void {
  if (!electionsActive(world)) return;
  campaignWeek(world, ctx.draws, ctx.facts.date);
}
