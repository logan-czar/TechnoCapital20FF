// What the Polls app computes from the views (pivot 8.4, 8.5, 6.2): rating buckets from published
// odds, the poll average, the ballot order of a poll's shares, and the races table's rows, filters
// and sort. Pure functions: nothing here reads a hook or the DOM, and nothing reads a hidden field.
//
// The forecast and the polls are the in-world site's estimates (pivot 8.5), so every number here is
// "what Plumbline says", never the sim's truth.

import {
  type ForecastView,
  type Party,
  type Poll,
  type RaceForecast,
  type RaceRow,
  type SimDate,
  simDateDaysSinceEpoch,
} from "@tc20ff/sim";
import { partyLetter } from "../_shared/index.ts";
import type { RaceFilters, RaceSortKey, StageKey } from "./route.ts";
import { stagePrimary } from "./route.ts";

// ---------------------------------------------------------------- ratings (D1045)

/** A leader's win odds at or above which a race is rated Safe (D1045). */
export const RATING_SAFE = 0.95;
/** Likely (D1045). */
export const RATING_LIKELY = 0.75;
/** Lean; below it the race is a toss-up (D1045). */
export const RATING_LEAN = 0.6;

export type RatingLevel = "Safe" | "Likely" | "Lean" | "Toss-up" | "Unrated";
export type RatingSide = "D" | "R" | "I" | null;

export interface Rating {
  level: RatingLevel;
  /** The leader's party letter; null for a toss-up and an unrated race. */
  side: RatingSide;
}

/** The rating of a leader's win odds, from a published forecast (pivot 8.5; D1045). */
export function ratingFor(leaderWin: number, side: Exclude<RatingSide, null>): Rating {
  if (leaderWin >= RATING_SAFE) return { level: "Safe", side };
  if (leaderWin >= RATING_LIKELY) return { level: "Likely", side };
  if (leaderWin >= RATING_LEAN) return { level: "Lean", side };
  return { level: "Toss-up", side: null };
}

export const UNRATED: Rating = { level: "Unrated", side: null };

/** "Likely D", "Toss-up", "Unrated". */
export function ratingLabel(r: Rating): string {
  return r.side === null ? r.level : `${r.level} ${r.side}`;
}

/** The rating's slug in a route: "likely-d", "toss-up", "unrated". */
export function ratingKey(r: Rating): string {
  return ratingLabel(r).toLowerCase().replace(" ", "-");
}

/** Where a rating sorts: safe D first, through the toss-up, to safe R, then independents, then unrated. */
export function ratingOrder(r: Rating): number {
  const level = { Safe: 0, Likely: 1, Lean: 2 } as const;
  if (r.level === "Unrated") return 100;
  if (r.level === "Toss-up") return 3;
  const l = level[r.level];
  if (r.side === "D") return l;
  if (r.side === "R") return 6 - l;
  return 7 + (2 - l);
}

/** The CSS class of a rating's colour. */
export function ratingClass(r: Rating): string {
  if (r.side === "D") return "party-a";
  if (r.side === "R") return "party-b";
  if (r.side === "I") return "party-none";
  return "rating-even";
}

// ---------------------------------------------------------------- dates

/** A day as a number, for ordering and for an axis. */
export const dayNum = (d: SimDate): number => simDateDaysSinceEpoch(d);

// ---------------------------------------------------------------- the race's candidate order

/**
 * The people on a stage's ballot, in the race's candidate order (D1037): the general's
 * `RaceRow.ballot`, or a primary's `PrimaryRow.ballot`. `Poll.shares`, `RaceForecast.odds` and the
 * poll columns follow it.
 */
export function stageBallot(race: RaceRow, stage: StageKey): number[] {
  const p = stagePrimary(stage);
  if (p === null) return race.ballot;
  return race.primaries[p]?.ballot ?? [];
}

/** The stages that have a page: the general once it has a ballot or polls, a primary with a ballot or polls. */
export function raceStages(race: RaceRow, polls: readonly Poll[]): StageKey[] {
  const out: StageKey[] = [];
  const hasGeneral = race.ballot.length > 0 || polls.some((p) => p.stage === "General");
  if (hasGeneral) out.push("general");
  race.primaries.forEach((pr, i) => {
    const hasPolls = polls.some((p) => p.stage === "Primary" && p.party === pr.party);
    if (pr.ballot.length > 1 || hasPolls) out.push(`primary-${i}`);
  });
  return out.length === 0 ? ["general"] : out;
}

/** The stage a race opens on: its general when it has one, else the first primary. */
export function defaultStage(race: RaceRow, polls: readonly Poll[]): StageKey {
  return raceStages(race, polls)[0] ?? "general";
}

/** The polls of one stage of one race, oldest first. A presidential state poll belongs to its state's page. */
export function stagePolls(polls: readonly Poll[], race: RaceRow, stage: StageKey): Poll[] {
  const p = stagePrimary(stage);
  const party: Party | null = p === null ? null : (race.primaries[p]?.party ?? null);
  return polls.filter((x) => {
    if (x.race !== race.id || x.state !== null) return false;
    if (p === null) return x.stage === "General";
    return x.stage === "Primary" && x.party === party;
  });
}

/**
 * The people a table's columns name: the ballot in order, then anyone a poll lists that the ballot
 * does not (a candidate since dropped), in the order first seen.
 */
export function pollColumns(polls: readonly Poll[], ballot: readonly number[]): number[] {
  const seen = new Set<number>(ballot);
  const cols = [...ballot];
  for (const poll of polls) {
    for (const s of poll.shares) {
      if (!seen.has(s.person)) {
        seen.add(s.person);
        cols.push(s.person);
      }
    }
  }
  return cols;
}

/** A poll's share for `person`, 0 to 1; null when the poll did not list them. */
export function shareOf(poll: Poll, person: number): number | null {
  const s = poll.shares.find((x) => x.person === person);
  return s === undefined ? null : s.share;
}

/** The leader's lead in points (first minus second share) and the leader; null for a poll listing no one. */
export function pollLead(poll: Poll): { leader: number; points: number } | null {
  const top = [...poll.shares].sort((a, b) => b.share - a.share || a.person - b.person);
  const first = top[0];
  if (first === undefined) return null;
  const second = top[1];
  return { leader: first.person, points: (first.share - (second?.share ?? 0)) * 100 };
}

// ---------------------------------------------------------------- the poll average

/** The days of polls an average looks back over (D1045). */
export const AVERAGE_WINDOW_DAYS = 14;

export interface AveragePoint {
  /** The day the average is as of (a day a poll was published). */
  day: number;
  /** Each candidate's average share, 0 to 1, in `people` order; null when no poll in the window listed them. */
  shares: (number | null)[];
}

/**
 * The poll average over time (D1045): on each day a poll was published, the sample-weighted mean of
 * every poll published in the window ending that day, per candidate. A plain average of what was
 * published: the house effects are hidden (pivot 8.4), so none is removed.
 */
export function pollAverage(polls: readonly Poll[], people: readonly number[]): AveragePoint[] {
  const days = [...new Set(polls.map((p) => dayNum(p.published)))].sort((a, b) => a - b);
  return days.map((day) => {
    const inWindow = polls.filter((p) => {
      const d = dayNum(p.published);
      return d <= day && d > day - AVERAGE_WINDOW_DAYS;
    });
    return {
      day,
      shares: people.map((person) => {
        let sum = 0;
        let weight = 0;
        for (const p of inWindow) {
          const s = shareOf(p, person);
          if (s === null) continue;
          sum += s * p.sample;
          weight += p.sample;
        }
        return weight === 0 ? null : sum / weight;
      }),
    };
  });
}

// ---------------------------------------------------------------- the forecast of a race

/** The leader of a forecast: the highest win odds; the earlier on the ballot wins a tie. */
export function forecastLeader(f: {
  odds: readonly { person: number; win: number }[];
}): { person: number; win: number } | null {
  let best: { person: number; win: number } | null = null;
  for (const o of f.odds) if (best === null || o.win > best.win) best = o;
  return best;
}

/** A race's rating from the published forecast, with the leader's party read from the race's candidates. */
export function ratingOfRace(race: RaceRow, f: RaceForecast | undefined): Rating {
  if (f === undefined) return UNRATED;
  const leader = forecastLeader(f);
  if (leader === null) return UNRATED;
  const cand = race.candidates.find((c) => c.person === leader.person);
  const side = cand === undefined ? "I" : (partyLetter(cand.party) as "D" | "R" | "I");
  return ratingFor(leader.win, side);
}

// ---------------------------------------------------------------- the races table

export interface RaceTableRow {
  race: RaceRow;
  forecast: RaceForecast | null;
  rating: Rating;
  leader: { person: number; win: number } | null;
  /** The leader's margin, middle estimate, in points. */
  margin: number | null;
  polls: number;
  lastPoll: SimDate | null;
}

/** One row per race, in race id order. */
export function raceTableRows(
  races: readonly RaceRow[],
  forecast: ForecastView | undefined,
  polls: readonly Poll[],
): RaceTableRow[] {
  const byRace = new Map<number, RaceForecast>();
  for (const f of forecast?.races ?? []) byRace.set(f.race, f);
  const count = new Map<number, { n: number; last: SimDate }>();
  for (const p of polls) {
    if (p.state !== null) continue;
    const c = count.get(p.race);
    if (c === undefined) count.set(p.race, { n: 1, last: p.published });
    else {
      c.n += 1;
      if (dayNum(p.published) >= dayNum(c.last)) c.last = p.published;
    }
  }
  return races.map((race) => {
    const f = byRace.get(race.id) ?? null;
    const c = count.get(race.id);
    return {
      race,
      forecast: f,
      rating: ratingOfRace(race, f ?? undefined),
      leader: f === null ? null : forecastLeader(f),
      margin: f === null ? null : f.margin[1],
      polls: c?.n ?? 0,
      lastPoll: c?.last ?? null,
    };
  });
}

/** Keeps the rows the filters allow. */
export function filterRaceRows(rows: readonly RaceTableRow[], f: RaceFilters): RaceTableRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.office !== null && r.race.office !== f.office) return false;
    if (f.state !== null && r.race.state !== f.state) return false;
    if (f.rating !== null && ratingKey(r.rating) !== f.rating) return false;
    if (q !== "" && !r.race.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

const STATUS_ORDER = ["Filing", "Primaries", "General", "Counting", "Recount", "Certified"];

/**
 * Sorts the rows by one column. A cell with no value (no forecast) sorts last in either direction;
 * ties go to the lower race id.
 */
export function sortRaceRows(
  rows: readonly RaceTableRow[],
  key: RaceSortKey,
  desc: boolean,
  names: { person: (id: number) => string; state: (id: number | null) => string },
): RaceTableRow[] {
  const value = (r: RaceTableRow): number | string | null => {
    switch (key) {
      case "title":
        return r.race.title.toLowerCase();
      case "office":
        return r.race.office;
      case "state":
        return names.state(r.race.state).toLowerCase();
      case "status":
        return STATUS_ORDER.indexOf(r.race.status);
      case "rating":
        return r.rating.level === "Unrated" ? null : ratingOrder(r.rating);
      case "leader":
        return r.leader === null ? null : names.person(r.leader.person).toLowerCase();
      case "odds":
        return r.leader === null ? null : r.leader.win;
      case "margin":
        return r.margin;
      case "polls":
        return r.polls;
    }
  };
  const out = rows.map((r) => ({ r, v: value(r) }));
  out.sort((a, b) => {
    if (a.v === null || b.v === null) {
      if (a.v === b.v) return a.r.race.id - b.r.race.id;
      return a.v === null ? 1 : -1;
    }
    const c = a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
    if (c !== 0) return desc ? -c : c;
    return a.r.race.id - b.r.race.id;
  });
  return out.map((x) => x.r);
}

/**
 * The races closest to a coin flip: unfinished races with a forecast, the lowest leader odds first;
 * ties to the lower race id.
 */
export function closestRaces(rows: readonly RaceTableRow[], n: number): RaceTableRow[] {
  return rows
    .filter((r) => r.leader !== null && r.race.status !== "Certified" && r.race.winner === null)
    .sort((a, b) => (a.leader?.win ?? 1) - (b.leader?.win ?? 1) || a.race.id - b.race.id)
    .slice(0, n);
}

/** The distinct ratings the rows hold, in display order (the rating filter's choices). */
export function ratingChoices(rows: readonly RaceTableRow[]): { key: string; label: string }[] {
  const seen = new Map<string, { rating: Rating; label: string }>();
  for (const r of rows) {
    const key = ratingKey(r.rating);
    if (!seen.has(key)) seen.set(key, { rating: r.rating, label: ratingLabel(r.rating) });
  }
  return [...seen.entries()]
    .sort((a, b) => ratingOrder(a[1].rating) - ratingOrder(b[1].rating))
    .map(([key, v]) => ({ key, label: v.label }));
}

// ---------------------------------------------------------------- numbers as the site prints them

/** A probability as a whole percent, never claiming certainty: "<1%", "63%", ">99%". */
export function formatOdds(p: number): string {
  if (p < 0.01) return "<1%";
  if (p > 0.99) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** A poll share, 0 to 1, as a whole percent. */
export function formatShare(s: number | null): string {
  return s === null ? "-" : `${Math.round(s * 100)}`;
}

/** The forecast's margin range: "4.2 (1.1 to 7.3)". */
export function formatRange(r: readonly [number, number, number]): string {
  return `${r[1].toFixed(1)} (${r[0].toFixed(1)} to ${r[2].toFixed(1)})`;
}
