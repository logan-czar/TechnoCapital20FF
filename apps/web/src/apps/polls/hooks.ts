// The Polls app's data hooks and the forecast's history. Each hook reads one view, so a page mounts
// only the views it shows (an app closed or minimised is unmounted and reads nothing).

import type { ForecastView, PeopleView, PersonRow, RaceRow } from "@tc20ff/sim";
import { useMemo } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { dayNum } from "./model.ts";

/** People by id, for the names and parties candidates are shown with (v_people, public fields only). */
export function usePeople(): Map<number, PersonRow> {
  const view: PeopleView | undefined = useViewData("people");
  return useMemo(() => new Map((view?.people ?? []).map((p) => [p.id as number, p])), [view]);
}

/** The seats of each chamber now, vacancies included (v_people `chambers`); null while unknown. */
export function useChamberSizes(): { House: number | null; Senate: number | null } {
  const view: PeopleView | undefined = useViewData("people");
  return useMemo(() => {
    const size = (name: "House" | "Senate"): number | null => {
      const c = view?.chambers.find((x) => x.chamber === name);
      if (c === undefined) return null;
      return c.parties.reduce((n, p) => n + p.seats, 0) + c.independents + c.vacant;
    };
    return { House: size("House"), Senate: size("Senate") };
  }, [view]);
}

/** State names by `UsStateId` (v_usmap_layers). */
export function useStateNames(): Map<number, { name: string; electoral_votes: number }> {
  const view = useViewData("usmap_layers");
  return useMemo(
    () =>
      new Map(
        (view?.states ?? []).map((s) => [
          s.id as number,
          { name: s.name, electoral_votes: s.electoral_votes },
        ]),
      ),
    [view],
  );
}

/** A person's name; "Candidate 12" for someone the people view does not hold yet. */
export function personName(people: ReadonlyMap<number, PersonRow>, id: number): string {
  return people.get(id)?.name ?? `Candidate ${id}`;
}

/** The race behind an id, for pages that hold a list. */
export function raceById(races: readonly RaceRow[] | undefined, id: number): RaceRow | undefined {
  return races?.find((r) => r.id === id);
}

// ---------------------------------------------------------------- forecast history (D1045)

/** One run of the site's model, for one race: the day it ran and each candidate's chance. */
export interface OddsPoint {
  day: number;
  odds: { person: number; win: number }[];
}

/** A day's run kept for each race, oldest first, across the windows of this session. */
const history = new Map<number, OddsPoint[]>();
let lastDay = Number.NEGATIVE_INFINITY;
/** The most runs kept for a race (a year of daily runs). */
export const HISTORY_CAP = 400;

/**
 * Remembers each race's odds from `forecast` (D1045): v_forecast holds only the latest run, so the
 * site's history is what this app has seen. A run on a day already kept replaces it; a run on an
 * earlier day than any kept means a new game or a load, which starts the history over.
 */
export function recordForecast(forecast: ForecastView | undefined): void {
  if (forecast === undefined || forecast.updated === null) return;
  const day = dayNum(forecast.updated);
  if (day < lastDay) history.clear();
  lastDay = day;
  for (const f of forecast.races) {
    const list = history.get(f.race) ?? [];
    const point: OddsPoint = { day, odds: f.odds.map((o) => ({ person: o.person, win: o.win })) };
    const last = list[list.length - 1];
    if (last !== undefined && last.day === day) list[list.length - 1] = point;
    else list.push(point);
    if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP);
    history.set(f.race, list);
  }
}

/** Forgets every run (a test, a new game). */
export function clearForecastHistory(): void {
  history.clear();
  lastDay = Number.NEGATIVE_INFINITY;
}

/** The runs seen for a race, with the forecast on screen as the newest. */
export function oddsHistory(race: number, forecast: ForecastView | undefined): OddsPoint[] {
  const kept = history.get(race) ?? [];
  const f = forecast?.races.find((x) => x.race === race);
  if (forecast === undefined || forecast.updated === null || f === undefined) return kept;
  const day = dayNum(forecast.updated);
  const current: OddsPoint = { day, odds: f.odds.map((o) => ({ person: o.person, win: o.win })) };
  const before = kept.filter((p) => p.day < day);
  // A run kept from a later day belongs to another game: ignore the lot.
  if (kept.some((p) => p.day > day)) return [current];
  return [...before, current];
}
