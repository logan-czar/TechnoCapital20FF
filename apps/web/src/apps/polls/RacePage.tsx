// A race (pivot 6.2, 8.4, 8.5): its candidates, the site's odds, the polls of the stage on show
// (the general, or one party's primary) with the average over time, the odds' history and the race's
// market. A race with a primary and a general has a tab for each; their ballots differ, and every
// table and chart lists people in that stage's ballot order (D1037).

import type { ContractRow, ForecastView, PersonRow, PollsView, RaceRow } from "@tc20ff/sim";
import { useMemo } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { EntityLink, formatCents, formatDay, formatUsd, partyAdjective } from "../_shared/index.ts";
import { OddsHistory, PollTrend } from "./blocks.tsx";
import {
  Candidate,
  Empty,
  Money,
  OddsBars,
  PageLink,
  RacePollTable,
  RatingPill,
  Section,
} from "./components.tsx";
import { oddsHistory, personName } from "./hooks.ts";
import {
  dayNum,
  defaultStage,
  forecastLeader,
  formatOdds,
  formatRange,
  pollAverage,
  pollColumns,
  raceStages,
  ratingOfRace,
  stageBallot,
  stagePolls,
} from "./model.ts";
import { raceRoute, type StageKey, stagePrimary } from "./route.ts";

/** The tab's words: "General", "Democratic primary". */
function stageLabel(race: RaceRow, stage: StageKey): string {
  const p = stagePrimary(stage);
  if (p === null) return "General";
  const party = race.primaries[p]?.party ?? null;
  return `${partyAdjective(party)} primary`;
}

/** The exchange's contracts on this race: who wins it, with the last price (v_markets). */
function RaceMarket({ race }: { race: RaceRow }) {
  const markets = useViewData("markets");
  const contracts = useMemo<ContractRow[]>(
    () =>
      (markets?.contracts ?? []).filter(
        (c) =>
          c.kind === "RaceWinner" &&
          c.subject !== null &&
          c.subject.kind === "Race" &&
          c.subject.id === race.id,
      ),
    [markets, race.id],
  );
  if (contracts.length === 0)
    return <Empty testId="market-empty">No contract on this race is listed on the exchange.</Empty>;
  return (
    <ul className="polls-list" data-testid="race-market">
      {contracts.map((c) => (
        <li key={c.id} data-testid={`market-row-${c.id}`}>
          <EntityLink to={{ kind: "Contract", id: c.id }}>{c.title}</EntityLink>
          <span className="polls-dim">
            {c.status === "Resolved"
              ? c.outcome === true
                ? "resolved Yes"
                : "resolved No"
              : `last ${formatCents(c.last)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RacePage({
  race,
  stage: stageIn,
  polls,
  forecast,
  people,
  stateName,
  go,
}: {
  race: RaceRow;
  stage: StageKey | null;
  polls: PollsView;
  forecast: ForecastView | undefined;
  people: ReadonlyMap<number, PersonRow>;
  stateName: string | null;
  go: (route: string | null) => void;
}) {
  const racePolls = useMemo(() => polls.polls.filter((p) => p.race === race.id), [polls, race.id]);
  const stages = raceStages(race, racePolls);
  const stage: StageKey =
    stageIn !== null && stages.includes(stageIn) ? stageIn : defaultStage(race, racePolls);
  const isGeneral = stage === "general";
  const ballot = stageBallot(race, stage);
  const stageList = useMemo(() => stagePolls(racePolls, race, stage), [racePolls, race, stage]);
  const columns = useMemo(() => pollColumns(stageList, ballot), [stageList, ballot]);
  const partyOf = (id: number) =>
    race.candidates.find((c) => c.person === id)?.party ?? people.get(id)?.party ?? null;
  const f = isGeneral ? forecast?.races.find((x) => x.race === race.id) : undefined;
  const rating = ratingOfRace(race, f);
  const leader = f === undefined ? null : forecastLeader(f);
  const avg = useMemo(() => pollAverage(stageList, columns), [stageList, columns]);
  const lastAvg = avg[avg.length - 1];
  const stateCount = race.office === "President" ? racePolls.filter((p) => p.state !== null).length : 0;
  const people_on = (ballot.length > 0 ? ballot : race.candidates.map((c) => c.person)).map((id) =>
    race.candidates.find((c) => c.person === id),
  );
  const primaryIdx = stagePrimary(stage);
  const stageDate = primaryIdx === null ? race.general : (race.primaries[primaryIdx]?.date ?? race.general);
  const history = isGeneral ? oddsHistory(race.id, forecast) : [];
  const winner = race.winner === null ? null : race.winner;
  return (
    <div className="polls-race" data-testid={`race-page-${race.id}`}>
      <header className="polls-racehead">
        <div>
          <h1 data-testid="race-title">{race.title}</h1>
          <p className="polls-dim">
            {race.office}
            {stateName === null ? "" : ` in ${stateName}`}
            {race.special ? ", special election" : ""} - {race.status} - general election{" "}
            {formatDay(race.general)}
          </p>
        </div>
        <div className="polls-racehead-side">
          {isGeneral ? <RatingPill rating={rating} /> : null}
          {winner === null ? null : (
            <span data-testid="race-winner">
              Winner <Candidate id={winner} people={people} party={partyOf(winner)} />
            </span>
          )}
        </div>
      </header>

      {stages.length > 1 ? (
        <div className="polls-tabs" role="tablist" aria-label="Vote">
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === stage}
              className={`polls-tab${s === stage ? " on" : ""}`}
              data-testid={`stage-${s}`}
              onClick={() => go(raceRoute(race.id, s))}
            >
              {stageLabel(race, s)}
            </button>
          ))}
        </div>
      ) : null}

      <Section
        title={isGeneral ? "Candidates" : `Candidates, ${stageLabel(race, stage).toLowerCase()}`}
        testId="race-candidates"
      >
        {people_on.length === 0 ? (
          <Empty>No candidate has filed yet.</Empty>
        ) : (
          <div className="polls-tablewrap">
            <table className="polls-table" data-testid="candidate-table">
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">Status</th>
                  <th scope="col">Money, as last filed</th>
                  {isGeneral && f !== undefined ? (
                    <th scope="col" className="num">
                      Win odds
                    </th>
                  ) : null}
                  <th scope="col" className="num">
                    Poll avg
                  </th>
                  {race.candidates.some((c) => c.strength !== null) ? (
                    <th scope="col" className="num">
                      Strength
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {(ballot.length > 0 ? ballot : race.candidates.map((c) => c.person)).map((id) => {
                  const c = race.candidates.find((x) => x.person === id);
                  const i = columns.indexOf(id);
                  const a = i < 0 ? null : (lastAvg?.shares[i] ?? null);
                  const odds = f?.odds.find((o) => o.person === id);
                  return (
                    <tr key={id} data-testid={`candidate-row-${id}`}>
                      <td>
                        <Candidate id={id} people={people} party={c?.party ?? partyOf(id)} />
                        {c?.incumbent === true ? <span className="polls-tag">incumbent</span> : null}
                      </td>
                      <td>{c?.status ?? "-"}</td>
                      <td>{c === undefined ? "-" : <Money raised={c.raised} cash={c.cash} />}</td>
                      {isGeneral && f !== undefined ? (
                        <td className="num">{odds === undefined ? "-" : formatOdds(odds.win)}</td>
                      ) : null}
                      <td className="num">{a === null ? "-" : `${Math.round(a * 100)}%`}</td>
                      {race.candidates.some((x) => x.strength !== null) ? (
                        <td className="num" data-testid={`strength-${id}`}>
                          {c?.strength === null || c === undefined ? "-" : c.strength.toFixed(2)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {isGeneral ? (
        <Section
          title="The forecast"
          note={
            forecast?.updated == null
              ? "Not run yet"
              : `Plumbline's estimate, run ${formatDay(forecast.updated)}`
          }
          testId="race-forecast"
        >
          {f === undefined ? (
            <Empty testId="forecast-none">The site has no forecast for this race.</Empty>
          ) : (
            <div className="polls-grid2">
              <div className="polls-card">
                <h3>Chance to win</h3>
                <OddsBars items={f.odds.map((o) => ({ ...o, party: partyOf(o.person) }))} people={people} />
                <p className="polls-note" data-testid="race-margin">
                  {leader === null
                    ? ""
                    : `${personName(people, leader.person)} leads by ${formatRange(f.margin)} points (middle estimate, 10th to 90th percentile).`}
                </p>
              </div>
              <div className="polls-card">
                <h3>Odds over time</h3>
                <OddsHistory
                  history={history}
                  columns={f.odds.map((o) => o.person)}
                  parties={f.odds.map((o) => partyOf(o.person))}
                  people={people}
                />
              </div>
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Polls" note={`${stageList.length} polls`} testId="race-polls">
        <PollTrend
          polls={stageList}
          columns={columns}
          parties={columns.map(partyOf)}
          people={people}
          rule={{ day: dayNum(stageDate), label: isGeneral ? "Election day" : "Primary" }}
        />
        {stageList.length === 0 ? (
          <Empty testId="polls-none">No polls of this vote have been published yet.</Empty>
        ) : (
          <RacePollTable polls={stageList} columns={columns} people={people} pollsters={polls.pollsters} />
        )}
        {stateCount > 0 ? (
          <p className="polls-note" data-testid="state-polls-note">
            {stateCount} polls of single states are on the state pages.{" "}
            <PageLink to={null}>See the states</PageLink>.
          </p>
        ) : null}
      </Section>

      <Section title="On the exchange" testId="race-exchange">
        <RaceMarket race={race} />
        <p className="polls-note">
          Campaign money above is as filed with the government (pivot 8.6); the contract prices are the
          market's own view, not Plumbline's.
          {race.candidates.some((c) => c.raised !== null)
            ? ` Raised so far by the field: ${formatUsd(race.candidates.reduce((n, c) => n + (c.raised ?? 0), 0))}.`
            : ""}
        </p>
      </Section>
    </div>
  );
}
