// Every race, as a sortable and filterable table (pivot 6.2, 8.5): office, state, status, the rating
// bucket derived from the site's published odds (D1045), the leader and their odds. Filters and sort
// live in the route, so a link to a filtered table works and back/forward steps through them.

import type { ForecastView, PersonRow, PollsView, RaceRow } from "@tc20ff/sim";
import { useCallback, useMemo } from "react";
import { formatDay } from "../_shared/index.ts";
import { Candidate, Empty, PageLink, RatingPill } from "./components.tsx";
import { personName } from "./hooks.ts";
import { filterRaceRows, formatOdds, raceTableRows, ratingChoices, sortRaceRows } from "./model.ts";
import { OFFICES, type RaceFilters, type RaceSortKey, racesRoute } from "./route.ts";

const COLUMNS: { key: RaceSortKey; label: string; num?: boolean }[] = [
  { key: "title", label: "Race" },
  { key: "office", label: "Office" },
  { key: "state", label: "State" },
  { key: "status", label: "Status" },
  { key: "rating", label: "Rating" },
  { key: "leader", label: "Leader" },
  { key: "odds", label: "Odds", num: true },
  { key: "margin", label: "Margin", num: true },
  { key: "polls", label: "Polls", num: true },
];

export function RacesPage({
  filters,
  races,
  forecast,
  polls,
  people,
  stateNames,
  go,
}: {
  filters: RaceFilters;
  races: RaceRow[] | undefined;
  forecast: ForecastView | undefined;
  polls: PollsView | undefined;
  people: ReadonlyMap<number, PersonRow>;
  stateNames: ReadonlyMap<number, { name: string; electoral_votes: number }>;
  go: (route: string) => void;
}) {
  const all = useMemo(
    () => raceTableRows(races ?? [], forecast, polls?.polls ?? []),
    [races, forecast, polls],
  );
  const stateName = useCallback(
    (id: number | null): string => (id === null ? "" : (stateNames.get(id)?.name ?? `State ${id}`)),
    [stateNames],
  );
  const rows = useMemo(
    () =>
      sortRaceRows(filterRaceRows(all, filters), filters.sort, filters.desc, {
        person: (id) => personName(people, id),
        state: stateName,
      }),
    [all, filters, people, stateName],
  );
  if (races === undefined) return <Empty testId="polls-loading">Loading the races...</Empty>;
  const choices = ratingChoices(all);
  const states = [...new Set(races.flatMap((r) => (r.state === null ? [] : [r.state as number])))].sort(
    (a, b) => stateName(a).localeCompare(stateName(b)) || a - b,
  );
  const set = (patch: Partial<RaceFilters>) => go(racesRoute({ ...filters, ...patch }));
  const sortBy = (key: RaceSortKey) =>
    set(filters.sort === key ? { desc: !filters.desc } : { sort: key, desc: false });
  const filtered =
    filters.office !== null || filters.state !== null || filters.rating !== null || filters.q !== "";
  return (
    <div className="polls-races" data-testid="races-page">
      <form className="polls-filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter the races">
        <label>
          Office
          <select
            value={filters.office ?? ""}
            data-testid="filter-office"
            onChange={(e) =>
              set({ office: e.target.value === "" ? null : (e.target.value as RaceFilters["office"]) })
            }
          >
            <option value="">All</option>
            {OFFICES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          State
          <select
            value={filters.state === null ? "" : String(filters.state)}
            data-testid="filter-state"
            onChange={(e) => set({ state: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">All</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {stateName(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rating
          <select
            value={filters.rating ?? ""}
            data-testid="filter-rating"
            onChange={(e) => set({ rating: e.target.value === "" ? null : e.target.value })}
          >
            <option value="">All</option>
            {choices.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={filters.q}
            data-testid="filter-q"
            placeholder="Race name"
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
        {filtered ? (
          <button
            type="button"
            className="polls-btn"
            data-testid="filter-clear"
            onClick={() => go(racesRoute({ sort: filters.sort, desc: filters.desc }))}
          >
            Clear filters
          </button>
        ) : null}
        <span className="polls-count" data-testid="races-count" aria-live="polite">
          {rows.length} of {all.length} races
        </span>
      </form>
      {rows.length === 0 ? (
        <Empty testId="races-none">No race matches these filters.</Empty>
      ) : (
        <div className="polls-tablewrap polls-racestable">
          <table className="polls-table" data-testid="races-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const on = filters.sort === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={c.num === true ? "num" : undefined}
                      aria-sort={on ? (filters.desc ? "descending" : "ascending") : "none"}
                    >
                      <button
                        type="button"
                        className="polls-sort"
                        data-testid={`sort-${c.key}`}
                        onClick={() => sortBy(c.key)}
                      >
                        {c.label}
                        {on ? (filters.desc ? " ▼" : " ▲") : ""}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.race.id} className="polls-lazyrow" data-testid={`race-row-${r.race.id}`}>
                  <td>
                    <PageLink to={`race/${r.race.id}`} testId={`race-link-${r.race.id}`}>
                      {r.race.title}
                    </PageLink>
                  </td>
                  <td>{r.race.office}</td>
                  <td>{r.race.state === null ? "-" : stateName(r.race.state)}</td>
                  <td title={`General ${formatDay(r.race.general)}`}>{r.race.status}</td>
                  <td>
                    <RatingPill rating={r.rating} />
                  </td>
                  <td>{r.leader === null ? "-" : <Candidate id={r.leader.person} people={people} />}</td>
                  <td className="num">{r.leader === null ? "-" : formatOdds(r.leader.win)}</td>
                  <td className="num">{r.margin === null ? "-" : r.margin.toFixed(1)}</td>
                  <td className="num">{r.polls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
