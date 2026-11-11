// Election results (pivot 9.4, 8.6): the count as the election offices publish it. A number is
// presented as official only once its race (or, for the presidency, its state) has certified; until
// then the page says the count is unofficial. Outlets' calls are not part of the record.

import type { RaceCountyReturns, RaceId, RaceReturns, RaceRow, StateReturns } from "@tc20ff/sim";
import { useMemo, useState } from "react";
import { useSlice, useViewData } from "../../sim/hooks.ts";
import { int } from "../../widgets/cells.ts";
import { EntityLink, formatDay, formatPct, formatWhen, ListTable, partyAdjective } from "../_shared/index.ts";
import {
  type Col,
  Empty,
  Facts,
  Loading,
  NavLink,
  NotOnRecord,
  Page,
  type People,
  Person,
  Section,
  SortTable,
  usePageTitle,
  usePeople,
  useStates,
} from "./common.tsx";
import { leaderIndex, officialElectoralVotes, shareOf } from "./data.ts";

const OFFICES = ["President", "Senate", "House", "Governor"] as const;

function totalOf(votes: readonly { votes: number }[]): number {
  return votes.reduce((s, v) => s + v.votes, 0);
}

/** Where a race's count stands, in the words of the election office. */
export function countStatus(r: RaceReturns): string {
  if (r.certified !== null) return `Certified ${formatDay(r.certified)}`;
  if (r.recount) return "Recount under way";
  if (r.polls_closed === null) return "Polls open";
  if (r.reporting >= 1) return "Counted, awaiting certification";
  return `Reporting, ${formatPct(r.reporting)} counted`;
}

/** The certified winner: the race's recorded winner, else the most votes; null until certified. */
function officialWinner(ret: RaceReturns, race: RaceRow | undefined): number | null {
  if (ret.certified === null) return null;
  if (race?.winner != null) return race.winner;
  const i = leaderIndex(ret.votes);
  return ret.votes[i]?.person ?? null;
}

function Official({ certified }: { certified: boolean }) {
  return certified ? (
    <span className="rec-badge rec-official">Official</span>
  ) : (
    <span className="rec-badge rec-unofficial">Unofficial</span>
  );
}

// --- one cycle --------------------------------------------------------------------------------

interface ResultLine {
  ret: RaceReturns;
  race: RaceRow | undefined;
  title: string;
}

export function ResultsPage({ cycle }: { cycle: number | null }) {
  const returns = useViewData("returns");
  const races = useViewData("races");
  const people = usePeople();
  const [office, setOffice] = useState<RaceRow["office"] | "">("");
  const [find, setFind] = useState("");
  const year = returns?.election?.year ?? null;
  usePageTitle(year === null ? "Election results" : `${year} election results`);
  const lines = useMemo<ResultLine[]>(
    () =>
      (returns?.races ?? []).map((ret) => {
        const race = races?.races.find((r) => r.id === ret.race);
        return { ret, race, title: race?.title ?? `Race ${ret.race}` };
      }),
    [returns, races],
  );
  const shown = lines.filter(
    (l) =>
      (office === "" || l.race?.office === office) &&
      (find.trim() === "" || l.title.toLowerCase().includes(find.trim().toLowerCase())),
  );
  if (returns === undefined) return <Loading what="the results" />;
  if (returns.election === null) {
    return (
      <Page name="results" kicker="Election results" title="Election results">
        <Empty>No general election has been held yet, so there are no results to publish.</Empty>
      </Page>
    );
  }
  if (cycle !== null && cycle !== returns.election.year) {
    return (
      <NotOnRecord
        what={`The ${cycle} general election`}
        hint={`Results are published for the ${returns.election.year} general election.`}
      />
    );
  }
  const president = lines.find((l) => l.race?.office === "President");
  const certified = lines.filter((l) => l.ret.certified !== null).length;
  const ev = president?.ret.states == null ? null : officialElectoralVotes(president.ret.states);
  const cols: Col<ResultLine>[] = [
    {
      id: "race",
      header: "Race",
      sort: (l) => l.title,
      render: (l) => <EntityLink to={{ kind: "Race", id: l.ret.race }}>{l.title}</EntityLink>,
    },
    {
      id: "office",
      header: "Office",
      sort: (l) => l.race?.office ?? null,
      render: (l) => l.race?.office ?? "",
    },
    { id: "status", header: "Count", sort: (l) => countStatus(l.ret), render: (l) => countStatus(l.ret) },
    {
      id: "votes",
      header: "Votes reported",
      num: true,
      sort: (l) => totalOf(l.ret.votes),
      render: (l) => (
        <>
          {int(totalOf(l.ret.votes))} <Official certified={l.ret.certified !== null} />
        </>
      ),
    },
    {
      id: "winner",
      header: "Certified winner",
      sort: (l) => {
        const w = officialWinner(l.ret, l.race);
        return w === null ? null : (people?.get(w)?.name ?? null);
      },
      render: (l) => {
        const w = officialWinner(l.ret, l.race);
        return w === null ? (
          <span className="rec-muted">Not yet certified</span>
        ) : (
          <Person id={w} people={people} />
        );
      },
    },
    {
      id: "open",
      header: "Detail",
      render: (l) => (
        <NavLink to={{ page: "resultsRace", id: l.ret.race }} testId={`nav-results-race-${l.ret.race}`}>
          County returns
        </NavLink>
      ),
    },
  ];
  return (
    <Page
      name="results"
      kicker="Election results"
      title={`${returns.election.year} general election`}
      lede={
        <p>
          Held {formatDay(returns.election)}. Only certified totals are official; all others are unofficial
          counts.
        </p>
      }
    >
      <Facts
        items={[
          ["Election day", formatDay(returns.election)],
          ["Races on the ballot", String(lines.length)],
          ["Certified", `${certified} of ${lines.length}`],
        ]}
      />
      {ev === null || president === undefined ? null : (
        <Section title="Electoral votes, certified states only">
          <ElectoralTable
            ev={ev}
            ballot={president.ret.votes.map((v) => v.person)}
            needed={president.race?.electoral_votes ?? null}
            people={people}
          />
        </Section>
      )}
      <Section title="Races">
        <form className="rec-filters" onSubmit={(e) => e.preventDefault()}>
          <label>
            Search
            <input
              type="search"
              data-testid="results-find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Race"
            />
          </label>
          <label>
            Office
            <select
              data-testid="results-office"
              value={office}
              onChange={(e) => setOffice(OFFICES.find((o) => o === e.target.value) ?? "")}
            >
              <option value="">All</option>
              {OFFICES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </form>
        {shown.length === 0 ? (
          <Empty>No race matches.</Empty>
        ) : (
          <SortTable
            table="results"
            rows={shown}
            cols={cols}
            rowKey={(l) => l.ret.race}
            rowKind="race"
            initial={{ id: "race", desc: false }}
            caption="Race results"
          />
        )}
      </Section>
    </Page>
  );
}

function ElectoralTable({
  ev,
  ballot,
  needed,
  people,
}: {
  ev: Map<number, number>;
  ballot: number[];
  needed: number | null;
  people: People | undefined;
}) {
  return (
    <table className="rec-table rec-mini" data-testid="electoral-votes">
      <thead>
        <tr>
          <th scope="col">Candidate</th>
          <th scope="col" className="num">
            Electoral votes
          </th>
        </tr>
      </thead>
      <tbody>
        {ballot.map((p) => (
          <tr key={p} data-testid={`ev-row-${p}`}>
            <td>
              <Person id={p} people={people} />
            </td>
            <td className="num">{ev.get(p) ?? 0}</td>
          </tr>
        ))}
      </tbody>
      {needed === null ? null : (
        <tfoot>
          <tr>
            <td colSpan={2}>{needed} are needed to win.</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

// --- one race ---------------------------------------------------------------------------------

function StatesTable({
  states,
  ret,
  people,
}: {
  states: StateReturns[];
  ret: RaceReturns;
  people: People | undefined;
}) {
  const names = useStates();
  const cols: Col<StateReturns>[] = [
    {
      id: "state",
      header: "State",
      sort: (s) => names?.name(s.state) ?? null,
      render: (s) => names?.name(s.state) ?? `State ${s.state}`,
    },
    {
      id: "ev",
      header: "Electoral votes",
      num: true,
      sort: (s) => s.electoral_votes,
      render: (s) => String(s.electoral_votes),
    },
    {
      id: "rep",
      header: "Reporting",
      num: true,
      sort: (s) => s.reporting,
      render: (s) => formatPct(s.reporting),
    },
    ...ret.votes.map(
      (c, i): Col<StateReturns> => ({
        id: `c${i}`,
        header: people?.get(c.person)?.name ?? `Candidate ${i + 1}`,
        num: true,
        sort: (s) => s.votes[i]?.votes ?? 0,
        render: (s) => int(s.votes[i]?.votes ?? 0),
      }),
    ),
    {
      id: "official",
      header: "Certified",
      sort: (s) =>
        s.certified === null ? null : s.certified.year * 10_000 + s.certified.month * 100 + s.certified.day,
      render: (s) =>
        s.certified === null ? <span className="rec-muted">Unofficial</span> : formatDay(s.certified),
    },
  ];
  return (
    <SortTable
      table="states"
      rows={states}
      cols={cols}
      rowKey={(s) => s.state}
      rowKind="state"
      initial={{ id: "state", desc: false }}
      caption="The presidency by state"
    />
  );
}

function CountyTable({
  slice,
  ret,
  certified,
  people,
}: {
  slice: RaceCountyReturns;
  ret: RaceReturns;
  certified: boolean;
  people: People | undefined;
}) {
  const map = useViewData("usmap_layers");
  const rows = useMemo(() => slice.counties.map((c, i) => ({ county: c as number, i })), [slice]);
  const columns = useMemo(
    () => [
      {
        id: "county",
        header: "County",
        width: 170,
        cell: (r: { county: number; i: number }) =>
          ({ k: "text", v: map?.counties.name[r.county] ?? `County ${r.county}` }) as const,
      },
      {
        id: "state",
        header: "State",
        width: 130,
        cell: (r: { county: number; i: number }) =>
          ({
            k: "text",
            v: map?.states.find((s) => s.id === map.counties.state[r.county])?.name ?? "",
          }) as const,
      },
      {
        id: "reporting",
        header: "Reporting",
        width: 90,
        cell: (r: { county: number; i: number }) => ({ k: "percent", v: slice.reporting[r.i] ?? 0 }) as const,
      },
      {
        id: "total",
        header: "Total votes",
        width: 100,
        cell: (r: { county: number; i: number }) =>
          ({ k: "int", v: (slice.votes[r.i] ?? []).reduce((s, v) => s + v, 0) }) as const,
      },
      ...ret.votes.map((c, k) => ({
        id: `c${k}`,
        header: people?.get(c.person)?.name ?? `Candidate ${k + 1}`,
        width: 150,
        cell: (r: { county: number; i: number }) => ({ k: "int", v: slice.votes[r.i]?.[k] ?? 0 }) as const,
      })),
      {
        id: "status",
        header: "Status",
        width: 120,
        cell: (r: { county: number; i: number }) =>
          ({
            k: "text",
            v: certified
              ? "Certified"
              : (slice.reporting[r.i] ?? 0) >= 1
                ? "Counted, unofficial"
                : "Reporting, unofficial",
          }) as const,
      },
    ],
    [map, slice, ret, certified, people],
  );
  return (
    <div className="rec-countybox" data-testid="county-table">
      {/* biome-ignore lint/correctness/useUniqueElementIds: the table's settings key, not a DOM id */}
      <ListTable
        id="records.counties"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.county}
        initialSort={{ id: "county", desc: false }}
        version={slice}
      />
    </div>
  );
}

export function ResultsRacePage({ id }: { id: number }) {
  const returns = useViewData("returns");
  const races = useViewData("races");
  const people = usePeople();
  const ret = returns?.races.find((r) => r.race === id);
  const race = races?.races.find((r) => r.id === id);
  const isPresident = ret?.states != null;
  // The presidency has 3,000-odd counties: read them only when asked.
  const [wantCounties, setWantCounties] = useState(false);
  const showCounties = ret !== undefined && (!isPresident || wantCounties);
  const key = useMemo(() => ({ view: "returns", slice: "counties", race: id as RaceId }) as const, [id]);
  const counties = useSlice(showCounties ? key : null);
  usePageTitle(ret === undefined ? null : `Results: ${race?.title ?? `Race ${id}`}`);
  if (returns === undefined) return <Loading what="the results" />;
  if (ret === undefined) return <NotOnRecord what={`The count for race ${id}`} />;
  const certified = ret.certified !== null;
  const total = totalOf(ret.votes);
  const winner = officialWinner(ret, race);
  const ev = ret.states === null ? null : officialElectoralVotes(ret.states);
  const cands = ret.votes.map((v, i) => ({ ...v, i }));
  const cols: Col<(typeof cands)[number]>[] = [
    {
      id: "candidate",
      header: "Candidate",
      sort: (c) => people?.get(c.person)?.name ?? null,
      render: (c) => (
        <>
          <Person id={c.person} people={people} />
          {winner === c.person ? <span className="rec-badge rec-official"> Winner</span> : null}
        </>
      ),
    },
    {
      id: "party",
      header: "Party",
      sort: (c) => people?.get(c.person)?.party ?? "Z",
      render: (c) => partyAdjective(people?.get(c.person)?.party ?? null),
    },
    { id: "votes", header: "Votes", num: true, sort: (c) => c.votes, render: (c) => int(c.votes) },
    {
      id: "share",
      header: "Share",
      num: true,
      sort: (c) => c.votes,
      render: (c) => formatPct(shareOf(c.votes, total)),
    },
    ...(ev === null
      ? []
      : ([
          {
            id: "ev",
            header: "Electoral votes",
            num: true,
            sort: (c) => ev.get(c.person) ?? 0,
            render: (c) => String(ev.get(c.person) ?? 0),
          },
        ] as Col<(typeof cands)[number]>[])),
  ];
  return (
    <Page
      name="resultsrace"
      kicker={
        race === undefined
          ? "Election results"
          : `${race.office}, ${race.special ? "special election" : "general election"}`
      }
      title={race?.title ?? `Race ${id}`}
      lede={
        <p>
          <EntityLink to={{ kind: "Race", id }}>{race?.title ?? `Race ${id}`}</EntityLink> ·{" "}
          <NavLink to={{ page: "financeRace", id }} testId={`nav-finance-race-${id}`}>
            Campaign finance
          </NavLink>
        </p>
      }
    >
      <p
        className={certified ? "rec-banner rec-banner-official" : "rec-banner rec-banner-unofficial"}
        data-testid="count-banner"
      >
        {certified
          ? `Official result, certified ${formatDay(ret.certified as NonNullable<typeof ret.certified>)}.`
          : "Unofficial count. These totals are not final until the result is certified."}
      </p>
      <Facts
        items={[
          ["Polls closed", ret.polls_closed === null ? "Not yet" : formatWhen(ret.polls_closed)],
          ["Counted", formatPct(ret.reporting)],
          ["Votes reported", int(total)],
          ["Recount", ret.recount ? "Under way" : "None"],
        ]}
      />
      <Section title={certified ? "Certified result" : "Count so far"}>
        {ret.votes.length === 0 ? (
          <Empty>No votes have been reported.</Empty>
        ) : (
          <SortTable
            table="candidates"
            rows={cands}
            cols={cols}
            rowKey={(c) => c.person}
            rowKind="candidate"
            initial={{ id: "votes", desc: true }}
            caption="Votes by candidate"
          />
        )}
      </Section>
      {ret.states === null ? null : (
        <Section title="By state">
          <StatesTable states={ret.states} ret={ret} people={people} />
        </Section>
      )}
      <Section title="By county" aside={<Official certified={certified} />}>
        {!showCounties ? (
          <button
            type="button"
            className="rec-button"
            data-testid="counties-show"
            onClick={() => setWantCounties(true)}
          >
            Show county returns
          </button>
        ) : counties === undefined ? (
          <Loading what="the county returns" />
        ) : counties === null ? (
          <Empty>County returns are not published for this race.</Empty>
        ) : (
          <CountyTable slice={counties} ret={ret} certified={certified} people={people} />
        )}
      </Section>
    </Page>
  );
}
