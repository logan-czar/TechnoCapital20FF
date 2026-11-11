// When elections fall (pivot 6.1; D1040): federal generals, governors on each state's four-year
// cycle, primaries per state in the spring and summer, handovers in January, and the dates a race
// is filed, counted and certified. Pure date rules: no draws, no state.

import {
  CONGRESS_HANDOVER_DAY,
  electionDay,
  isElectionYear,
  isPresidentYear,
  PRESIDENT_HANDOVER_DAY,
  PRESIDENT_TERM_YEARS,
  senateClassUp,
} from "../politics/calendar.ts";
import { dateTimeAt, simDateAddDays, simDateWeekday, simDateYmd } from "../time/calendar.ts";
import type { DateTime, SimDate } from "../types/calendar.ts";
import { cmpDate } from "../types/calendar.ts";
import { remEuclid } from "../types/num.ts";
import type { RaceOffice } from "../types/state/elections.ts";

export { electionDay, isElectionYear, isPresidentYear, PRESIDENT_TERM_YEARS, senateClassUp };

/** Years between a governor's generals (pivot 6.1: "Governors serve four years"). */
export const GOVERNOR_TERM_YEARS = 4;
// Who may run again (term limits, retirement, the ladder) is lane C's (politics/careers.ts
// `declareCycle`, `termLimited`; D1052): this file holds only the dates. Lane C's term ends read them.
/** Years in a House, Senate and presidential term (pivot 5.8). */
export const HOUSE_TERM_YEARS = 2;
export const SENATE_TERM_YEARS = 6;
/** A governor takes office on 3 January after the general, as Congress does (D1040, T). */
export const GOVERNOR_HANDOVER_DAY = CONGRESS_HANDOVER_DAY;
export { CONGRESS_HANDOVER_DAY, PRESIDENT_HANDOVER_DAY };

/**
 * The governor general's year modulo 4 of each state with an odd or presidential cycle (pivot 6.1;
 * D1040): the real pattern, taken by name. 1 for New Jersey and Virginia (2021), 3 for Kentucky,
 * Louisiana and Mississippi (2019), 0 for the eleven elected with the president (New Hampshire and
 * Vermont, which really elect every two years, are kept on the four-year rule here). Every other
 * state with a governor votes at the midterm (2), DC has none.
 */
export const GOVERNOR_CYCLE_BY_STATE: Readonly<Record<string, number>> = {
  "New Jersey": 1,
  Virginia: 1,
  Kentucky: 3,
  Louisiana: 3,
  Mississippi: 3,
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
};
/** The midterm remainder every other state takes (pivot 6.1: most governors are chosen at midterms). */
export const GOVERNOR_MIDTERM_CYCLE = 2;
/** The one place without a governor (and without senators): its name in politics-usa.csv. */
export const NO_GOVERNOR_STATE = "District of Columbia";

/** A state's governor cycle by its name (pivot 6.1; D1040): the real pattern, else the midterm. */
export function governorCycleByName(name: string): number {
  return GOVERNOR_CYCLE_BY_STATE[name] ?? GOVERNOR_MIDTERM_CYCLE;
}

/** Each state's governor cycle (`ElectionCalendar.governor_cycle`), by `UsStateId`; null for DC. */
export function governorCycles(stateNames: readonly string[]): (number | null)[] {
  return stateNames.map((name) => (name === NO_GOVERNOR_STATE ? null : governorCycleByName(name)));
}

/** Whether a state of governor cycle `cycle` elects its governor in `year`. */
export function governorUp(cycle: number | null, year: number): boolean {
  return cycle !== null && remEuclid(year, GOVERNOR_TERM_YEARS) === cycle;
}

/** Whether `year` holds any general: every even year, and odd years for the odd-cycle governors. */
export function hasGeneral(year: number, cycles: readonly (number | null)[]): boolean {
  return isElectionYear(year) || cycles.some((c) => governorUp(c, year));
}

/**
 * The state primaries' months (pivot 6.1 "spring and summer", T; D1040): a state's primary falls on
 * the first Tuesday of `PRIMARY_MONTHS[state mod 5]`, spread March to August as the real ones are.
 */
export const PRIMARY_MONTHS: readonly number[] = [3, 5, 6, 8, 8];
/** Both parties' presidential primaries, as one national day: the first Tuesday of March (T). */
export const PRESIDENT_PRIMARY_MONTH = 3;
/** Odd-year (governor-only) primaries: the first Tuesday of this month (T). */
export const ODD_YEAR_PRIMARY_MONTH = 5;
/** Candidates are fixed this many days before their primary (pivot 6.2 "file", T). */
export const FILING_LEAD_DAYS = 30;
/** Days from a general to certification (pivot 9.4, T). */
export const CERTIFY_DAYS = 28;
/** When a state's polls close on general day (pivot 9.1, T): one hour for all until M5's night. */
export const POLLS_CLOSE_HOUR = 20;
/** The presidency's last polls (Alaska and Hawaii) close later (pivot 9.1, T). */
export const PRESIDENT_POLLS_CLOSE_HOUR = 23;
/** A House special election falls on the first Tuesday at least this many days after the vacancy (pivot 6.1, T). */
export const SPECIAL_LEAD_DAYS = 90;
/** A Senate special falls at the next even-year general at least this far off (pivot 6.1, T). */
export const SENATE_SPECIAL_MIN_DAYS = 60;
/** A special's primaries fall this many days before its general (T). */
export const SPECIAL_PRIMARY_LEAD_DAYS = 35;

/** The first Tuesday on or after `d`. */
export function tuesdayOnOrAfter(d: SimDate): SimDate {
  let out = d;
  while (simDateWeekday(out) !== "Tue") out = simDateAddDays(out, 1);
  return out;
}

/** A state's primary day in `year` (pivot 6.1; `ElectionCalendar.primaries`). */
export function statePrimary(state: number, year: number): SimDate {
  const month = isElectionYear(year)
    ? (PRIMARY_MONTHS[state % PRIMARY_MONTHS.length] as number)
    : ODD_YEAR_PRIMARY_MONTH;
  return tuesdayOnOrAfter(simDateYmd(year, month, 1));
}

/** The presidential primaries of `year`. */
export function presidentPrimary(year: number): SimDate {
  return tuesdayOnOrAfter(simDateYmd(year, PRESIDENT_PRIMARY_MONTH, 1));
}

/** When the polls close on `general` (pivot 9.1). */
export function pollsClose(office: RaceOffice, general: SimDate): DateTime {
  return dateTimeAt(general, office === "President" ? PRESIDENT_POLLS_CLOSE_HOUR : POLLS_CLOSE_HOUR);
}

/** When a general is certified (pivot 9.4). */
export function certifyDate(general: SimDate): SimDate {
  return simDateAddDays(general, CERTIFY_DAYS);
}

/** The day an office's winners of a regular general in `year` take office (pivot 6.1 "January"). */
export function handoverDate(office: RaceOffice, year: number): SimDate {
  const day =
    office === "President"
      ? PRESIDENT_HANDOVER_DAY
      : office === "Governor"
        ? GOVERNOR_HANDOVER_DAY
        : CONGRESS_HANDOVER_DAY;
  return simDateYmd(year + 1, 1, day);
}

/** When a term won at a regular general in `year` ends: the handover a full term later. */
export function termEnds(office: RaceOffice, year: number): SimDate {
  const years =
    office === "President"
      ? PRESIDENT_TERM_YEARS
      : office === "Senate"
        ? SENATE_TERM_YEARS
        : office === "House"
          ? HOUSE_TERM_YEARS
          : GOVERNOR_TERM_YEARS;
  return handoverDate(office, year + years);
}

/** The next even-year Senate general for `senateClass` in or after `year`. */
export function senateClassYear(senateClass: number, year: number): number {
  let y = year;
  while (!isElectionYear(y) || senateClassUp(y) !== senateClass) y++;
  return y;
}

/** The first federal general (even year) on or after `date`. */
export function federalGeneralOnOrAfter(date: SimDate): SimDate {
  let y = date.year;
  while (!isElectionYear(y) || cmpDate(electionDay(y), date) < 0) y++;
  return electionDay(y);
}
