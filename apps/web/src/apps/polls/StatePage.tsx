// The presidency in one state (pivot 8.4, 8.5): the site's odds there, the state's polls with their
// average, and the state's other races.

import type { ForecastView, PersonRow, PollsView, RaceRow } from "@tc20ff/sim";
import { useMemo } from "react";
import { EntityLink, formatMargin } from "../_shared/index.ts";
import { PollTrend } from "./blocks.tsx";
import { Empty, OddsBars, PageLink, RacePollTable, RatingPill, Section } from "./components.tsx";
import {
  dayNum,
  forecastLeader,
  formatRange,
  pollColumns,
  ratingFor,
  ratingOfRace,
  stageBallot,
} from "./model.ts";

export function StatePage({
  id,
  name,
  races,
  polls,
  forecast,
  people,
}: {
  id: number;
  /** The state's name; null when v_usmap_layers does not know the id. */
  name: string | null;
  races: RaceRow[];
  polls: PollsView;
  forecast: ForecastView | undefined;
  people: ReadonlyMap<number, PersonRow>;
}) {
  const president = races.find((r) => r.office === "President");
  const state = forecast?.states.find((s) => s.state === id);
  const statePolls = useMemo(() => polls.polls.filter((p) => p.state === id), [polls, id]);
  const ballot = president === undefined ? [] : stageBallot(president, "general");
  const columns = useMemo(() => pollColumns(statePolls, ballot), [statePolls, ballot]);
  const partyOf = (person: number) =>
    president?.candidates.find((c) => c.person === person)?.party ?? people.get(person)?.party ?? null;
  const here = races.filter((r) => r.state === id);
  const leader = state === undefined ? null : forecastLeader(state);
  const side = leader === null ? null : partyOf(leader.person);
  const letter = side === null ? "I" : side === "Democrats" ? "D" : "R";
  if (name === null && state === undefined && statePolls.length === 0 && here.length === 0) {
    return <Empty testId="state-missing">No state has this number.</Empty>;
  }
  return (
    <div className="polls-state" data-testid={`state-page-${id}`}>
      <header className="polls-racehead">
        <div>
          <h1 data-testid="state-title">{name ?? `State ${id}`}</h1>
          <p className="polls-dim">
            The presidency{state === undefined ? "" : `, ${state.electoral_votes} electoral votes`} -{" "}
            <EntityLink to={{ kind: "State", id }}>About {name ?? "the state"}</EntityLink>
          </p>
        </div>
        <div className="polls-racehead-side">
          {leader === null ? null : <RatingPill rating={ratingFor(leader.win, letter)} />}
        </div>
      </header>

      <Section title="The forecast" testId="state-forecast">
        {state === undefined ? (
          <Empty testId="state-no-forecast">The site has no forecast for this state.</Empty>
        ) : (
          <div className="polls-card">
            <h3>Chance to carry it</h3>
            <OddsBars items={state.odds.map((o) => ({ ...o, party: partyOf(o.person) }))} people={people} />
            <p className="polls-note" data-testid="state-margin">
              Leader's margin {formatRange(state.margin)} points
              {leader === null
                ? ""
                : ` (${formatMargin(letter === "R" ? -state.margin[1] : state.margin[1])} middle estimate)`}
              .
            </p>
          </div>
        )}
      </Section>

      <Section title="State polls" note={`${statePolls.length} polls`} testId="state-polls">
        <PollTrend
          polls={statePolls}
          columns={columns}
          parties={columns.map(partyOf)}
          people={people}
          {...(president === undefined
            ? {}
            : { rule: { day: dayNum(president.general), label: "Election day" } })}
          testId="state-trend"
        />
        {statePolls.length === 0 ? null : (
          <RacePollTable polls={statePolls} columns={columns} people={people} pollsters={polls.pollsters} />
        )}
      </Section>

      <Section title="Other races here" testId="state-races">
        {here.length === 0 ? (
          <Empty>No other race in this state this cycle.</Empty>
        ) : (
          <ul className="polls-list">
            {here.map((r) => (
              <li key={r.id} data-testid={`state-race-${r.id}`}>
                <PageLink to={`race/${r.id}`}>{r.title}</PageLink>
                <RatingPill
                  rating={ratingOfRace(
                    r,
                    forecast?.races.find((f) => f.race === r.id),
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
