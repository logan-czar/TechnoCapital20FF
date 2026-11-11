// A polling firm (pivot 8.4): its polls, newest first. Its house effect is the one number the player
// is not told: it appears only when v_polls carries it (the Omniscient toggle).

import type { PersonRow, PollsView, RaceRow } from "@tc20ff/sim";
import { formatDay, formatMargin } from "../_shared/index.ts";
import { Empty, PollsterPollTable, Section } from "./components.tsx";
import { dayNum } from "./model.ts";

export function PollsterPage({
  id,
  polls,
  races,
  people,
  stateName,
}: {
  id: number;
  polls: PollsView;
  races: RaceRow[] | undefined;
  people: ReadonlyMap<number, PersonRow>;
  stateName: (id: number) => string;
}) {
  const firm = polls.pollsters.find((p) => p.id === id);
  if (firm === undefined) return <Empty testId="pollster-missing">No polling firm has this number.</Empty>;
  const mine = polls.polls.filter((p) => p.pollster === id);
  const raceCount = new Set(mine.map((p) => p.race)).size;
  const days = mine.map((p) => dayNum(p.published));
  const first = mine.find((p) => dayNum(p.published) === Math.min(...days));
  const last = mine.find((p) => dayNum(p.published) === Math.max(...days));
  const meanSample = mine.length === 0 ? 0 : mine.reduce((n, p) => n + p.sample, 0) / mine.length;
  const meanMoe = mine.length === 0 ? 0 : mine.reduce((n, p) => n + p.margin_of_error, 0) / mine.length;
  const title = (raceId: number) => races?.find((r) => r.id === raceId)?.title ?? `Race ${raceId}`;
  return (
    <div className="polls-pollster" data-testid={`pollster-page-${id}`}>
      <header className="polls-racehead">
        <div>
          <h1 data-testid="pollster-name">{firm.name}</h1>
          <p className="polls-dim">Polling firm</p>
        </div>
      </header>
      <Section title="At a glance" testId="pollster-glance">
        <dl className="polls-facts">
          <div>
            <dt>Polls published</dt>
            <dd data-testid="pollster-count">{mine.length}</dd>
          </div>
          <div>
            <dt>Races polled</dt>
            <dd>{raceCount}</dd>
          </div>
          <div>
            <dt>Typical sample</dt>
            <dd>{Math.round(meanSample)}</dd>
          </div>
          <div>
            <dt>Typical margin of error</dt>
            <dd>±{meanMoe.toFixed(1)}</dd>
          </div>
          <div>
            <dt>First poll</dt>
            <dd>{first === undefined ? "-" : formatDay(first.published)}</dd>
          </div>
          <div>
            <dt>Latest poll</dt>
            <dd>{last === undefined ? "-" : formatDay(last.published)}</dd>
          </div>
          {firm.house_effect === null ? null : (
            <div data-testid="house-effect">
              <dt>House effect (hidden from players)</dt>
              <dd>{formatMargin(firm.house_effect)}</dd>
            </div>
          )}
        </dl>
      </Section>
      <Section title="Its polls" testId="pollster-polls">
        {mine.length === 0 ? (
          <Empty testId="pollster-none">This firm has published no poll yet.</Empty>
        ) : (
          <PollsterPollTable
            polls={mine}
            people={people}
            label={(p) => (p.state === null ? title(p.race) : `${title(p.race)}, ${stateName(p.state)}`)}
          />
        )}
      </Section>
    </div>
  );
}
