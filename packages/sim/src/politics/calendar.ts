// The US political calendar (4-politics 4.6.1 with real US terms; D982, D985): pure date rules.

import { simDateWeekday, simDateYmd } from "../time/calendar.ts";
import type { SimDate } from "../types/calendar.ts";
import { cmpDate, dateEq } from "../types/calendar.ts";

/** The first November vote after the 1 January 2020 start (19-history 19.22). */
export const FIRST_ELECTION_YEAR = 2020;
/** House term (4.2.4), and so every November election's spacing. */
export const ELECTION_EVERY_YEARS = 2;
/** Head of state term (4.2.4). */
export const PRESIDENT_TERM_YEARS = 4;
/** Senate classes up in the 2020, 2022 and 2024 votes; then the cycle repeats (D982). */
export const SENATE_CLASS_CYCLE: readonly number[] = [2, 3, 1];
/** New Congress: 3 January (D985). */
export const CONGRESS_HANDOVER_DAY = 3;
/** New president: 20 January (D985). */
export const PRESIDENT_HANDOVER_DAY = 20;

const NOVEMBER = 11;

/** Election Day in `year`: the first Tuesday after the first Monday in November (D985). */
export function electionDay(year: number): SimDate {
  // The 2nd to the 8th: a Tuesday there always follows a Monday in November.
  for (let day = 2; day <= 8; day++) {
    const d = simDateYmd(year, NOVEMBER, day);
    if (simDateWeekday(d) === "Tue") return d;
  }
  throw new Error("no Tuesday in a week");
}

/** Whether `year` holds a November vote. */
export function isElectionYear(year: number): boolean {
  return year >= FIRST_ELECTION_YEAR && (year - FIRST_ELECTION_YEAR) % ELECTION_EVERY_YEARS === 0;
}

/** Whether `year`'s vote includes the president (direct national vote; 4.6.2). */
export function isPresidentYear(year: number): boolean {
  return year >= FIRST_ELECTION_YEAR && (year - FIRST_ELECTION_YEAR) % PRESIDENT_TERM_YEARS === 0;
}

/** The Senate class up in election year `year` (D982). */
export function senateClassUp(year: number): number {
  const i = (year - FIRST_ELECTION_YEAR) / ELECTION_EVERY_YEARS;
  return SENATE_CLASS_CYCLE[i % SENATE_CLASS_CYCLE.length] as number;
}

/** The first election date strictly after `date`. */
export function nextElectionAfter(date: SimDate): SimDate {
  let year = Math.max(date.year, FIRST_ELECTION_YEAR);
  while (!isElectionYear(year) || cmpDate(electionDay(year), date) <= 0) year++;
  return electionDay(year);
}

/** Whether `d` is an Election Day. */
export function isElectionDay(d: SimDate): boolean {
  return d.month === NOVEMBER && isElectionYear(d.year) && dateEq(d, electionDay(d.year));
}

/** A day the politics job changes who holds what, so the politics view must rebuild. */
export function isPoliticsDay(d: SimDate): boolean {
  if (d.month === 1)
    return d.day === 1 || d.day === CONGRESS_HANDOVER_DAY || d.day === PRESIDENT_HANDOVER_DAY;
  return isElectionDay(d);
}
