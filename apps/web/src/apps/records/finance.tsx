// Campaign finance (pivot 6.3, 8.6): the reports campaigns file, as published. Receipts and
// spending are for the period a report covers; cash on hand is what it ends with. Totals here are
// the sums of the reports filed, never an estimate.

import type { FilingRow, RaceRow } from "@tc20ff/sim";
import { useMemo } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { EntityLink, formatDay } from "../_shared/index.ts";
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
} from "./common.tsx";
import { dayKey, type FilingTotals, filingsBy, filingTotals, usdFull } from "./data.ts";

function RaceLink({ id, title }: { id: number; title: string | undefined }) {
  return <EntityLink to={{ kind: "Race", id }}>{title ?? `Race ${id}`}</EntityLink>;
}

/** The filings of one campaign period by period, newest first. */
function FilingsTable({
  table,
  rows,
  people,
  withPerson,
}: {
  table: string;
  rows: FilingRow[];
  people: People | undefined;
  withPerson: boolean;
}) {
  const cols: Col<FilingRow>[] = [
    {
      id: "through",
      header: "Period ending",
      sort: (f) => dayKey(f.through),
      render: (f) => formatDay(f.through),
    },
    ...(withPerson
      ? ([
          {
            id: "person",
            header: "Candidate",
            sort: (f) => people?.get(f.person)?.name ?? null,
            render: (f) => <Person id={f.person} people={people} />,
          },
        ] as Col<FilingRow>[])
      : []),
    { id: "raised", header: "Received", num: true, sort: (f) => f.raised, render: (f) => usdFull(f.raised) },
    { id: "spent", header: "Spent", num: true, sort: (f) => f.spent, render: (f) => usdFull(f.spent) },
    { id: "cash", header: "Cash on hand", num: true, sort: (f) => f.cash, render: (f) => usdFull(f.cash) },
  ];
  return (
    <SortTable
      table={table}
      rows={rows}
      cols={cols}
      rowKey={(f) => `${f.race}-${f.person}-${dayKey(f.through)}`}
      rowKind="filing"
      initial={{ id: "through", desc: true }}
      caption="Filings by period"
    />
  );
}

// --- every race ------------------------------------------------------------------------------

interface RaceFinance {
  race: number;
  row: RaceRow | undefined;
  campaigns: number;
  raised: number;
  spent: number;
  cash: number;
  through: FilingTotals["through"];
}

export function FinancePage() {
  const records = useViewData("records");
  const races = useViewData("races");
  usePageTitle("Campaign finance");
  const rows = useMemo<RaceFinance[]>(() => {
    if (records === undefined) return [];
    const out: RaceFinance[] = [];
    for (const [race, list] of filingsBy(records.filings, (f) => f.race as number)) {
      const byPerson = [...filingsBy(list, (f) => f.person as number).values()];
      const totals = byPerson.map((l) => filingTotals(l) as FilingTotals);
      out.push({
        race,
        row: races?.races.find((r) => r.id === race),
        campaigns: totals.length,
        raised: totals.reduce((s, t) => s + t.raised, 0),
        spent: totals.reduce((s, t) => s + t.spent, 0),
        cash: totals.reduce((s, t) => s + t.cash, 0),
        through: totals.reduce(
          (a, t) => (dayKey(t.through) > dayKey(a) ? t.through : a),
          totals[0]?.through as FilingTotals["through"],
        ),
      });
    }
    return out;
  }, [records, races]);
  const cols: Col<RaceFinance>[] = [
    {
      id: "race",
      header: "Race",
      sort: (r) => r.row?.title ?? `~${r.race}`,
      render: (r) => <RaceLink id={r.race} title={r.row?.title} />,
    },
    {
      id: "campaigns",
      header: "Campaigns",
      num: true,
      sort: (r) => r.campaigns,
      render: (r) => String(r.campaigns),
    },
    { id: "raised", header: "Received", num: true, sort: (r) => r.raised, render: (r) => usdFull(r.raised) },
    { id: "spent", header: "Spent", num: true, sort: (r) => r.spent, render: (r) => usdFull(r.spent) },
    { id: "cash", header: "Cash on hand", num: true, sort: (r) => r.cash, render: (r) => usdFull(r.cash) },
    {
      id: "through",
      header: "Latest report",
      sort: (r) => dayKey(r.through),
      render: (r) => formatDay(r.through),
    },
    {
      id: "open",
      header: "Reports",
      render: (r) => (
        <NavLink to={{ page: "financeRace", id: r.race }} testId={`nav-finance-race-${r.race}`}>
          Open
        </NavLink>
      ),
    },
  ];
  return (
    <Page
      name="finance"
      kicker="Campaign finance"
      title="Campaign finance reports"
      lede="Receipts, spending and cash on hand as each campaign has filed them, race by race."
    >
      {records === undefined ? (
        <Loading what="the filings" />
      ) : rows.length === 0 ? (
        <Empty>No campaign has filed a report.</Empty>
      ) : (
        <SortTable
          table="finance-races"
          rows={rows}
          cols={cols}
          rowKey={(r) => r.race}
          rowKind="financerace"
          initial={{ id: "raised", desc: true }}
          caption="Races with filings"
        />
      )}
    </Page>
  );
}

// --- one race ---------------------------------------------------------------------------------

interface CandidateFinance {
  person: number;
  totals: FilingTotals;
}

export function FinanceRacePage({ id }: { id: number }) {
  const records = useViewData("records");
  const races = useViewData("races");
  const people = usePeople();
  const race = races?.races.find((r) => r.id === id);
  usePageTitle(`Finance: ${race?.title ?? `Race ${id}`}`);
  const filings = useMemo(() => (records?.filings ?? []).filter((f) => f.race === id), [records, id]);
  const candidates = useMemo<CandidateFinance[]>(
    () =>
      [...filingsBy(filings, (f) => f.person as number)].map(([person, list]) => ({
        person,
        totals: filingTotals(list) as FilingTotals,
      })),
    [filings],
  );
  if (records === undefined) return <Loading what="the filings" />;
  const cols: Col<CandidateFinance>[] = [
    {
      id: "person",
      header: "Candidate",
      sort: (c) => people?.get(c.person)?.name ?? null,
      render: (c) => <Person id={c.person} people={people} />,
    },
    {
      id: "raised",
      header: "Received",
      num: true,
      sort: (c) => c.totals.raised,
      render: (c) => usdFull(c.totals.raised),
    },
    {
      id: "spent",
      header: "Spent",
      num: true,
      sort: (c) => c.totals.spent,
      render: (c) => usdFull(c.totals.spent),
    },
    {
      id: "cash",
      header: "Cash on hand",
      num: true,
      sort: (c) => c.totals.cash,
      render: (c) => usdFull(c.totals.cash),
    },
    {
      id: "through",
      header: "Latest report",
      sort: (c) => dayKey(c.totals.through),
      render: (c) => formatDay(c.totals.through),
    },
    {
      id: "all",
      header: "Reports",
      render: (c) => (
        <NavLink to={{ page: "financePerson", id: c.person }} testId={`nav-finance-person-${c.person}`}>
          {c.totals.filings} filed
        </NavLink>
      ),
    },
  ];
  if (race === undefined && filings.length === 0) return <NotOnRecord what={`Race ${id}`} />;
  return (
    <Page
      name="financerace"
      kicker="Campaign finance"
      title={race?.title ?? `Race ${id}`}
      lede={
        <p>
          <RaceLink id={id} title={race?.title} /> ·{" "}
          <NavLink to={{ page: "resultsRace", id }} testId={`nav-results-race-${id}`}>
            Election results
          </NavLink>
        </p>
      }
    >
      {filings.length === 0 ? (
        <Empty>No campaign in this race has filed a report yet.</Empty>
      ) : (
        <>
          <Facts
            items={[
              ["Campaigns filing", String(candidates.length)],
              ["Received in all", usdFull(candidates.reduce((s, c) => s + c.totals.raised, 0))],
              ["Spent in all", usdFull(candidates.reduce((s, c) => s + c.totals.spent, 0))],
            ]}
          />
          <Section title="Campaigns">
            <SortTable
              table="finance-candidates"
              rows={candidates}
              cols={cols}
              rowKey={(c) => c.person}
              rowKind="candidate"
              initial={{ id: "raised", desc: true }}
              caption="Campaigns in this race"
            />
          </Section>
          <Section title="Reports by period">
            <FilingsTable table="finance-race-filings" rows={filings} people={people} withPerson />
          </Section>
        </>
      )}
    </Page>
  );
}

// --- one candidate ----------------------------------------------------------------------------

export function FinancePersonPage({ id }: { id: number }) {
  const records = useViewData("records");
  const races = useViewData("races");
  const people = usePeople();
  const person = people?.get(id);
  usePageTitle(person === undefined ? null : `Finance: ${person.name}`);
  const byRace = useMemo(
    () =>
      filingsBy(
        (records?.filings ?? []).filter((f) => f.person === id),
        (f) => f.race as number,
      ),
    [records, id],
  );
  if (records === undefined || people === undefined) return <Loading what="the filings" />;
  if (person === undefined) return <NotOnRecord what={`Person ${id}`} />;
  return (
    <Page
      name="financeperson"
      kicker="Campaign finance"
      title={person.name}
      lede={
        <p>
          <Person id={id} people={people} />
        </p>
      }
    >
      {byRace.size === 0 ? (
        <Empty>This person has not filed a campaign finance report.</Empty>
      ) : (
        [...byRace].map(([race, list]) => {
          const t = filingTotals(list) as FilingTotals;
          const title = races?.races.find((r) => r.id === race)?.title;
          return (
            <Section
              key={race}
              title={title ?? `Race ${race}`}
              aside={
                <>
                  <RaceLink id={race} title="Race page" />{" "}
                  <NavLink to={{ page: "financeRace", id: race }} testId={`nav-finance-race-${race}`}>
                    All campaigns
                  </NavLink>
                </>
              }
            >
              <Facts
                items={[
                  ["Received", usdFull(t.raised)],
                  ["Spent", usdFull(t.spent)],
                  ["Cash on hand", usdFull(t.cash)],
                  ["Latest report", formatDay(t.through)],
                ]}
              />
              <FilingsTable table={`finance-person-${race}`} rows={list} people={people} withPerson={false} />
            </Section>
          );
        })
      )}
    </Page>
  );
}
