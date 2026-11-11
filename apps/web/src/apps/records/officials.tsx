// Officeholders and district plans (pivot 5.4, 5.7, 8.6): who sits in each chamber, by state, with
// the chamber's make-up; and each state's House map as drawn. Hidden stats are never shown: a
// district's lean and a plan's strength appear only when the view carries them (Omniscient).

import type { Chamber, ChamberRow, DistrictRow } from "@tc20ff/sim";
import { useMemo, useState } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { int } from "../../widgets/cells.ts";
import { EntityLink, formatDay, formatMargin, partyAdjective, partyClass } from "../_shared/index.ts";
import {
  type Col,
  Empty,
  Facts,
  Loading,
  NavLink,
  NotOnRecord,
  Page,
  Person,
  Section,
  SortTable,
  SplitBar,
  usePageTitle,
  usePeople,
  useStates,
} from "./common.tsx";
import { dayKey, partyPlural, seatOf } from "./data.ts";

// --- chamber make-up ---------------------------------------------------------------------------

/** A chamber's seats by party as a bar and a legend (pivot 5.8; v_people `chambers`). */
export function MakeUpRow({ row }: { row: ChamberRow }) {
  const seats = row.parties.reduce((s, p) => s + p.seats, 0) + row.independents + row.vacant;
  const parts = [
    ...row.parties.map((p) => ({
      key: p.party,
      cls: partyClass(p.party),
      n: p.seats,
      title: `${partyPlural(p.party)}: ${p.seats}`,
    })),
    {
      key: "independent",
      cls: "party-none",
      n: row.independents,
      title: `Independents: ${row.independents}`,
    },
    { key: "vacant", cls: "rec-vacant", n: row.vacant, title: `Vacant: ${row.vacant}` },
  ];
  return (
    <div className="rec-makeup" data-testid={`makeup-${row.chamber.toLowerCase()}`}>
      <p className="rec-makeup-name">{row.chamber === "House" ? "House of Representatives" : "Senate"}</p>
      <SplitBar parts={parts} label={`${row.chamber} make-up`} />
      <ul className="rec-legend">
        {row.parties.map((p) => (
          <li key={p.party} className={partyClass(p.party)}>
            <span className="rec-swatch" /> {partyPlural(p.party)} <b>{p.seats}</b>
          </li>
        ))}
        {row.independents > 0 ? (
          <li className="party-none">
            <span className="rec-swatch" /> Independents <b>{row.independents}</b>
          </li>
        ) : null}
        <li>
          Vacant <b>{row.vacant}</b>
        </li>
        <li>
          of <b>{seats}</b> seats
        </li>
        <li data-testid={`majority-${row.chamber.toLowerCase()}`}>
          {row.majority === null
            ? "No party holds a majority"
            : `${partyPlural(row.majority)} hold the majority`}
        </li>
      </ul>
    </div>
  );
}

// --- officeholders -----------------------------------------------------------------------------

interface Member {
  id: number;
  state: number;
  district: number | null;
  since: number;
}

export function OfficialsPage({ chamber }: { chamber: Chamber }) {
  const people = usePeople();
  const view = useViewData("people");
  const states = useStates();
  const [state, setState] = useState<number | "">("");
  const [find, setFind] = useState("");
  usePageTitle(chamber === "House" ? "House members" : "Senators");
  const members = useMemo<Member[]>(() => {
    if (people === undefined || states === undefined) return [];
    const out: Member[] = [];
    for (const p of people.list) {
      const seat = seatOf(p, states.list);
      if (seat === null || seat.chamber !== chamber) continue;
      const held = [...p.career].reverse().find((c) => c.to === null);
      out.push({
        id: p.id,
        state: seat.state,
        district: seat.district,
        since: held === undefined ? 0 : dayKey(held.from),
      });
    }
    return out;
  }, [people, states, chamber]);
  const makeup = view?.chambers.find((c) => c.chamber === chamber);
  const q = find.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      (state === "" || m.state === state) &&
      (q === "" || (people?.get(m.id)?.name ?? "").toLowerCase().includes(q)),
  );
  const cols: Col<Member>[] = [
    {
      id: "state",
      header: "State",
      sort: (m) => (states?.name(m.state) ?? "") + String(m.district ?? 0).padStart(3, "0"),
      render: (m) => states?.name(m.state) ?? "",
    },
    {
      id: "seat",
      header: chamber === "House" ? "District" : "Seat",
      sort: (m) => m.district ?? 0,
      render: (m) => (m.district === null ? "Senator" : `District ${m.district}`),
    },
    {
      id: "member",
      header: "Member",
      sort: (m) => people?.get(m.id)?.name ?? null,
      render: (m) => <Person id={m.id} people={people} />,
    },
    {
      id: "party",
      header: "Party",
      sort: (m) => people?.get(m.id)?.party ?? "Z",
      render: (m) => partyAdjective(people?.get(m.id)?.party ?? null),
    },
    {
      id: "since",
      header: "In this seat since",
      sort: (m) => m.since,
      render: (m) => {
        const held = people
          ?.get(m.id)
          ?.career.slice()
          .reverse()
          .find((c) => c.to === null);
        return held === undefined ? "" : formatDay(held.from);
      },
    },
  ];
  return (
    <Page
      name="officials"
      kicker="Officeholders"
      title={chamber === "House" ? "House of Representatives" : "Senate"}
      lede={
        <p>
          <NavLink to={{ page: "officials", chamber: "House" }} testId="nav-officials-house">
            House
          </NavLink>{" "}
          ·{" "}
          <NavLink to={{ page: "officials", chamber: "Senate" }} testId="nav-officials-senate">
            Senate
          </NavLink>
        </p>
      }
    >
      <Section title="Make-up">
        {view === undefined ? (
          <Loading what="the chamber" />
        ) : makeup === undefined ? (
          <Empty>No seats have been filled yet.</Empty>
        ) : (
          <MakeUpRow row={makeup} />
        )}
      </Section>
      <Section title="Members" aside={<span data-testid="officials-count">{shown.length} shown</span>}>
        <form className="rec-filters" onSubmit={(e) => e.preventDefault()}>
          <label>
            Search
            <input
              type="search"
              data-testid="officials-find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Name"
            />
          </label>
          <label>
            State
            <select
              data-testid="officials-state"
              value={state}
              onChange={(e) => setState(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">All</option>
              {(states?.list ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </form>
        {people === undefined || states === undefined ? (
          <Loading what="the members" />
        ) : shown.length === 0 ? (
          <Empty>
            {members.length === 0 ? "No member holds a seat in this chamber." : "No member matches."}
          </Empty>
        ) : (
          <SortTable
            table="officials"
            rows={shown}
            cols={cols}
            rowKey={(m) => m.id}
            rowKind="member"
            initial={{ id: "state", desc: false }}
            caption="Members"
          />
        )}
      </Section>
    </Page>
  );
}

// --- district plans ----------------------------------------------------------------------------

export function DistrictsPage({ state }: { state: number | null }) {
  const districts = useViewData("districts");
  const map = useViewData("usmap_layers");
  const people = usePeople();
  const states = useStates();
  const name = state === null ? null : (states?.list.find((s) => s.id === state)?.name ?? null);
  usePageTitle(state === null ? "District plans" : `${name ?? `State ${state}`} districts`);
  const rows = useMemo(
    () => (districts?.districts ?? []).filter((d) => d.state === state),
    [districts, state],
  );
  if (districts === undefined || states === undefined) return <Loading what="the district plans" />;

  if (state === null) {
    type Line = { state: number; seats: number; plan: (typeof districts.plans)[number] | undefined };
    const lines: Line[] = states.list.map((s) => ({
      state: s.id,
      seats: districts.districts.filter((d) => d.state === s.id).length,
      plan: districts.plans.find((p) => p.state === s.id),
    }));
    const cols: Col<Line>[] = [
      {
        id: "state",
        header: "State",
        sort: (l) => states.name(l.state),
        render: (l) => states.name(l.state),
      },
      { id: "seats", header: "Seats", num: true, sort: (l) => l.seats, render: (l) => String(l.seats) },
      {
        id: "census",
        header: "Census",
        num: true,
        sort: (l) => l.plan?.census_year ?? null,
        render: (l) => (l.plan ? String(l.plan.census_year) : "-"),
      },
      {
        id: "by",
        header: "Drawn by",
        sort: (l) => l.plan?.drawn_by ?? null,
        render: (l) =>
          l.plan === undefined ? "-" : l.plan.drawn_by === null ? "No party" : partyPlural(l.plan.drawn_by),
      },
      {
        id: "since",
        header: "In force since",
        sort: (l) => (l.plan ? dayKey(l.plan.since) : null),
        render: (l) => (l.plan ? formatDay(l.plan.since) : "-"),
      },
      {
        id: "status",
        header: "Challenge",
        render: (l) => (l.plan === undefined ? "-" : l.plan.struck ? "Struck down" : "None"),
      },
      {
        id: "open",
        header: "Plan",
        render: (l) => (
          <NavLink to={{ page: "districts", state: l.state }} testId={`nav-districts-${l.state}`}>
            Districts
          </NavLink>
        ),
      },
    ];
    return (
      <Page
        name="districts"
        kicker="District plans"
        title="House district plans"
        lede="The map of each state's House districts: who drew it, when, and whether a court has set it aside."
      >
        {lines.length === 0 ? (
          <Empty>No state has a district plan on record.</Empty>
        ) : (
          <SortTable
            table="district-plans"
            rows={lines}
            cols={cols}
            rowKey={(l) => l.state}
            rowKind="plan"
            initial={{ id: "state", desc: false }}
            caption="District plans by state"
          />
        )}
      </Page>
    );
  }

  if (name === null) return <NotOnRecord what={`State ${state}`} />;
  const plan = districts.plans.find((p) => p.state === state);
  const countyName = (id: number) => map?.counties.name[id] ?? `County ${id}`;
  const showLean = rows.some((d) => d.lean !== null);
  const cols: Col<DistrictRow>[] = [
    {
      id: "district",
      header: "District",
      sort: (d) => d.number,
      render: (d) => <EntityLink to={{ kind: "District", id: d.id }}>{`${name} ${d.number}`}</EntityLink>,
    },
    {
      id: "member",
      header: "Member",
      sort: (d) => (d.member === null ? null : (people?.get(d.member)?.name ?? null)),
      render: (d) =>
        d.member === null ? (
          <span className="rec-muted">Vacant</span>
        ) : (
          <Person id={d.member} people={people} />
        ),
    },
    { id: "pop", header: "People", num: true, sort: (d) => d.population, render: (d) => int(d.population) },
    {
      id: "counties",
      header: "Counties",
      render: (d) => (
        <details className="rec-counties">
          <summary>
            {d.shares.length} {d.shares.length === 1 ? "county" : "counties"}
          </summary>
          <ul data-testid={`district-counties-${d.id}`}>
            {d.shares.map((s) => {
              const part = s.to - s.from;
              return (
                <li key={s.county}>
                  {countyName(s.county)}
                  {part < 0.9995 ? ` (${(part * 100).toFixed(1)}% of the county)` : ""}
                </li>
              );
            })}
          </ul>
        </details>
      ),
    },
    ...(showLean
      ? ([
          {
            id: "lean",
            header: "Lean",
            num: true,
            sort: (d) => d.lean,
            render: (d) => (d.lean === null ? "" : formatMargin(d.lean)),
          },
        ] as Col<DistrictRow>[])
      : []),
  ];
  return (
    <Page
      name="districts"
      kicker="District plan"
      title={`${name} House districts`}
      lede={
        <p>
          <NavLink to={{ page: "districts", state: null }} testId="nav-districts-index">
            All states
          </NavLink>
        </p>
      }
    >
      {plan === undefined ? (
        <Empty>{name} has no district plan on record: it elects its House members without one.</Empty>
      ) : (
        <Facts
          items={[
            ["Drawn on the census of", String(plan.census_year)],
            ["In force since", formatDay(plan.since)],
            ["Drawn by", plan.drawn_by === null ? "No party" : `The ${partyAdjective(plan.drawn_by)} party`],
            ["Challenge", plan.struck ? "Struck down by a court; a redraw is pending" : "Not struck down"],
            ...(plan.strength === null
              ? []
              : ([["Gerrymander strength", plan.strength.toFixed(2)]] as [string, string][])),
          ]}
        />
      )}
      <Section title="Districts">
        {rows.length === 0 ? (
          <Empty>No district is drawn for this state.</Empty>
        ) : (
          <SortTable
            table="districts"
            rows={rows}
            cols={cols}
            rowKey={(d) => d.id}
            rowKind="district"
            initial={{ id: "district", desc: false }}
            caption={`${name} districts`}
          />
        )}
      </Section>
    </Page>
  );
}
