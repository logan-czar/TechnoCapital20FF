// The overview: the presidential odds and electoral-vote range, each chamber's control odds with its
// seat range, the closest races, the states of the presidency and the latest polls (pivot 8.4, 8.5).
// Every figure is the forecast site's own estimate.

import {
  type ChamberForecast,
  type ForecastView,
  PARTY_VALUES,
  type PersonRow,
  type PollsView,
  type RaceRow,
} from "@tc20ff/sim";
import { useMemo, useState } from "react";
import { formatDay, formatMargin } from "../_shared/index.ts";
import { partyColor, RangeBar } from "./charts.tsx";
import {
  Candidate,
  Empty,
  OddsBars,
  PageLink,
  PollsterPollTable,
  RatingPill,
  Section,
} from "./components.tsx";
import { useChamberSizes } from "./hooks.ts";
import { closestRaces, forecastLeader, formatOdds, type Rating, raceTableRows, ratingFor } from "./model.ts";

/** The states the table lists before "show all". */
const STATES_SHOWN = 10;
/** The closest races listed. */
const CLOSEST_SHOWN = 8;
/** The latest polls listed. */
const LATEST_POLLS = 6;

const partyName = (party: string): string => (party === "Democrats" ? "Democrats" : "Republicans");

function ChamberCard({ c, size }: { c: ChamberForecast; size: number | null }) {
  const mids = c.parties.reduce((n, p) => n + p.seats[1], 0);
  const total = size ?? Math.max(mids, ...c.parties.map((p) => p.seats[2]));
  const majority = Math.floor(total / 2) + 1;
  return (
    <section className="polls-card" data-testid={`chamber-${c.chamber}`}>
      <h3>{c.chamber} control</h3>
      <ul className="polls-odds">
        {c.parties.map((p) => (
          <li key={p.party} className="polls-odds-row" data-testid={`control-${c.chamber}-${p.party}`}>
            <span className="polls-odds-name" style={{ color: partyColor(p.party) }}>
              {partyName(p.party)}
            </span>
            <span className="polls-odds-track" aria-hidden="true">
              <span
                className="polls-odds-fill"
                style={{ width: `${Math.max(p.control * 100, 0.6)}%`, background: partyColor(p.party) }}
              />
            </span>
            <span className="polls-odds-value">{formatOdds(p.control)}</span>
          </li>
        ))}
      </ul>
      <RangeBar
        total={total}
        majority={majority}
        majorityLabel={`${majority} to control`}
        rows={c.parties.map((p) => ({
          key: p.party,
          label: partyName(p.party),
          color: partyColor(p.party),
          range: p.seats,
        }))}
        summary={`${c.chamber} seats the site expects: ${c.parties
          .map((p) => `${partyName(p.party)} ${p.seats[1]}, range ${p.seats[0]} to ${p.seats[2]}`)
          .join("; ")}.`}
        testId={`seats-${c.chamber}`}
      />
      <p className="polls-note">Seats: the middle estimate and the 10th to 90th percentile range.</p>
    </section>
  );
}

export function HomePage({
  forecast,
  races,
  polls,
  people,
  stateNames,
}: {
  forecast: ForecastView | undefined;
  races: RaceRow[] | undefined;
  polls: PollsView | undefined;
  people: ReadonlyMap<number, PersonRow>;
  stateNames: ReadonlyMap<number, { name: string; electoral_votes: number }>;
}) {
  const sizes = useChamberSizes();
  const [allStates, setAllStates] = useState(false);
  const rows = useMemo(
    () => raceTableRows(races ?? [], forecast, polls?.polls ?? []),
    [races, forecast, polls],
  );
  if (forecast === undefined || races === undefined || polls === undefined) {
    return <Empty testId="polls-loading">Loading the forecast...</Empty>;
  }
  if (forecast.updated === null) {
    return (
      <Empty testId="polls-no-run">
        The forecast has not run yet. It runs once a day, from the polls published and the fundamentals.
      </Empty>
    );
  }
  const president = races.find((r) => r.office === "President");
  const presForecast =
    president === undefined ? undefined : forecast.races.find((f) => f.race === president.id);
  const stateRows = forecast.states
    .map((s) => ({ s, leader: forecastLeader(s) }))
    .sort((a, b) => (a.leader?.win ?? 1) - (b.leader?.win ?? 1) || a.s.state - b.s.state);
  const totalEv = forecast.states.reduce((n, s) => n + s.electoral_votes, 0);
  const evNeeded = president?.electoral_votes ?? null;
  const evTotal = totalEv > 0 ? totalEv : evNeeded === null ? 0 : evNeeded * 2 - 1;
  const ev = forecast.electoral_votes;
  const partyOf = (id: number) =>
    president?.candidates.find((c) => c.person === id)?.party ?? people.get(id)?.party ?? null;
  const closest = closestRaces(rows, CLOSEST_SHOWN);
  const latest = polls.polls.slice(-LATEST_POLLS);
  const raceTitle = (id: number) => races.find((r) => r.id === id)?.title ?? `Race ${id}`;
  return (
    <div className="polls-home" data-testid="polls-home">
      {president !== undefined && presForecast !== undefined ? (
        <Section
          title="The presidency"
          note={`Plumbline's estimate, run ${formatDay(forecast.updated)}`}
          testId="home-president"
        >
          <div className="polls-grid2">
            <div className="polls-card">
              <h3>
                Chance to win <PageLink to={`race/${president.id}`}>{president.title}</PageLink>
              </h3>
              <OddsBars
                items={presForecast.odds.map((o) => ({ ...o, party: partyOf(o.person) }))}
                people={people}
              />
              <p className="polls-note" data-testid="president-margin">
                Leader's margin {presForecast.margin[1].toFixed(1)} points, range{" "}
                {presForecast.margin[0].toFixed(1)} to {presForecast.margin[2].toFixed(1)}.
              </p>
            </div>
            {ev !== null && evNeeded !== null && evTotal > 0 ? (
              <div className="polls-card" data-testid="ev-card">
                <h3>Electoral votes</h3>
                <RangeBar
                  total={evTotal}
                  majority={evNeeded}
                  majorityLabel={`${evNeeded} to win`}
                  rows={[
                    {
                      key: PARTY_VALUES[0],
                      label: partyName(PARTY_VALUES[0]),
                      color: partyColor(PARTY_VALUES[0]),
                      range: ev,
                    },
                    {
                      key: PARTY_VALUES[1],
                      label: partyName(PARTY_VALUES[1]),
                      color: partyColor(PARTY_VALUES[1]),
                      range: [evTotal - ev[2], evTotal - ev[1], evTotal - ev[0]],
                    },
                  ]}
                  summary={`Electoral votes the site expects: ${partyName(PARTY_VALUES[0])} ${ev[1]}, range ${ev[0]} to ${ev[2]} of ${evTotal}.`}
                  testId="ev-range"
                />
                <p className="polls-note">Middle estimate and the 10th to 90th percentile range.</p>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section title="Control of Congress" testId="home-chambers">
        {forecast.chambers.length === 0 ? (
          <Empty>No chamber forecast this cycle.</Empty>
        ) : (
          <div className="polls-grid2">
            {forecast.chambers.map((c) => (
              <ChamberCard key={c.chamber} c={c} size={sizes[c.chamber]} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Closest races" note={<PageLink to="races">All races</PageLink>} testId="home-closest">
        {closest.length === 0 ? (
          <Empty>No race has a forecast yet.</Empty>
        ) : (
          <ul className="polls-list">
            {closest.map((r) => (
              <li key={r.race.id} data-testid={`closest-row-${r.race.id}`}>
                <PageLink to={`race/${r.race.id}`}>{r.race.title}</PageLink>
                <RatingPill rating={r.rating} />
                {r.leader === null ? null : (
                  <span className="polls-dim">
                    <Candidate id={r.leader.person} people={people} /> {formatOdds(r.leader.win)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {stateRows.length > 0 ? (
        <Section title="The presidency, state by state" testId="home-states">
          <div className="polls-tablewrap">
            <table className="polls-table">
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col" className="num">
                    EV
                  </th>
                  <th scope="col">Rating</th>
                  <th scope="col">Leader</th>
                  <th scope="col" className="num">
                    Odds
                  </th>
                  <th scope="col" className="num">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody>
                {(allStates ? stateRows : stateRows.slice(0, STATES_SHOWN)).map(({ s, leader }) => {
                  const side =
                    leader === null
                      ? "I"
                      : partyOf(leader.person) === null
                        ? "I"
                        : partyOf(leader.person) === "Democrats"
                          ? "D"
                          : "R";
                  const rating: Rating =
                    leader === null ? { level: "Unrated", side: null } : ratingFor(leader.win, side);
                  return (
                    <tr key={s.state} data-testid={`state-row-${s.state}`}>
                      <td>
                        <PageLink to={`state/${s.state}`}>
                          {stateNames.get(s.state)?.name ?? `State ${s.state}`}
                        </PageLink>
                      </td>
                      <td className="num">{s.electoral_votes}</td>
                      <td>
                        <RatingPill rating={rating} />
                      </td>
                      <td>{leader === null ? "-" : <Candidate id={leader.person} people={people} />}</td>
                      <td className="num">{leader === null ? "-" : formatOdds(leader.win)}</td>
                      <td className="num">
                        {leader === null ? "-" : formatMargin(side === "R" ? -s.margin[1] : s.margin[1])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {stateRows.length > STATES_SHOWN ? (
            <button
              type="button"
              className="polls-btn"
              onClick={() => setAllStates(!allStates)}
              data-testid="states-toggle"
            >
              {allStates ? "Show the closest states" : `Show all ${stateRows.length} states`}
            </button>
          ) : null}
        </Section>
      ) : null}

      <Section title="Latest polls" testId="home-polls">
        {latest.length === 0 ? (
          <Empty>No polls have been published yet.</Empty>
        ) : (
          <PollsterPollTable
            polls={latest}
            people={people}
            label={(p) =>
              p.state === null
                ? raceTitle(p.race)
                : `${raceTitle(p.race)}, ${stateNames.get(p.state)?.name ?? `state ${p.state}`}`
            }
          />
        )}
        <p className="polls-note">
          Polling firms:{" "}
          {polls.pollsters.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? ", " : ""}
              <PageLink to={`pollster/${p.id}`} testId={`firm-${p.id}`}>
                {p.name}
              </PageLink>
            </span>
          ))}
          .
        </p>
      </Section>
    </div>
  );
}
