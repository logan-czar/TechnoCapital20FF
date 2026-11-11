// The side panel of a selected county, district or state (pivot 5.1, 5.4, 15.3; D1048): what the
// public record says of it, with links to its encyclopedia page, its districts, its races and its
// officials. Hidden figures (a district's lean, a plan's strength) show only when the view carries
// them (Omniscient, pivot 5.11).

import { type DistrictsView, districtRefParts, type RaceRow, type UsMapLayersView } from "@tc20ff/sim";
import { useMemo } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { EntityLink, formatMargin, formatPct, PersonChip, partyAdjective } from "../_shared/index.ts";
import type { PlanIndex } from "./borders.ts";
import { formatInt } from "./layers.ts";
import { districtTitle, peopleById, stateRow } from "./names.ts";
import type { Selection } from "./route.ts";

export interface PanelProps {
  sel: Selection;
  /** The county a county selection names, or -1. */
  county: number;
  layers: UsMapLayersView;
  districts: DistrictsView | undefined;
  plan: PlanIndex;
  onSelect: (sel: Selection) => void;
  onLive: (race: number) => void;
  onClose: () => void;
  /** Races with returns to follow (v_returns has a row). */
  liveRaces: ReadonlySet<number>;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="um-kv">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RaceList(p: { races: RaceRow[]; onLive: (race: number) => void; live: ReadonlySet<number> }) {
  if (p.races.length === 0) return <p className="um-muted">No race this cycle.</p>;
  return (
    <ul className="um-list">
      {p.races.map((r) => (
        <li key={r.id} data-testid={`race-row-${r.id}`}>
          <EntityLink to={{ kind: "Race", id: r.id }}>{r.title}</EntityLink>
          <span className="um-muted"> {r.status}</span>
          {p.live.has(r.id) && (
            <button
              type="button"
              className="um-mini"
              onClick={() => p.onLive(r.id)}
              data-testid={`usmap-live-${r.id}`}
            >
              Returns
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Panel(p: PanelProps) {
  const races = useViewData("races");
  const people = useViewData("people");
  const byId = useMemo(() => peopleById(people), [people]);
  const c = p.layers.counties;

  let title = "";
  let body: React.ReactNode = null;

  if (p.sel.kind === "county") {
    const i = p.county;
    if (i < 0) {
      title = "Unknown county";
      body = <p className="um-muted">No county has the code {p.sel.key}.</p>;
    } else {
      const st = stateRow(p.layers, c.state[i] as number);
      const pieces = p.plan.pieces[i] ?? [];
      const winner = c.last_winner[i] ?? null;
      const margin = c.last_margin[i] ?? null;
      const lean = c.lean?.[i];
      const stateRaces = (races?.races ?? []).filter(
        (r) =>
          r.office === "President" ||
          (r.state === st?.id &&
            (r.office !== "House" || pieces.some((x) => districtRefParts(x.district).number === r.district))),
      );
      title = `${c.name[i]}`;
      body = (
        <>
          <dl className="um-dl">
            <Row k="State">
              {st ? (
                <button
                  type="button"
                  className="um-inlink"
                  onClick={() => p.onSelect({ kind: "state", id: st.id })}
                >
                  {st.name}
                </button>
              ) : (
                "-"
              )}
            </Row>
            <Row k="FIPS">{c.fips[i]}</Row>
            <Row k="People">{formatInt(c.population[i] ?? 0)}</Row>
            <Row k="Turnout">{formatPct(c.turnout[i] ?? 0)}</Row>
            <Row k="Last president">
              {winner === null || margin === null
                ? "No certified vote yet"
                : `${partyAdjective(winner)}, ${formatMargin(margin)}`}
            </Row>
            {c.last_votes[i] ? <Row k="Votes cast">{formatInt(c.last_votes[i] ?? 0)}</Row> : null}
            {lean !== undefined && lean !== null && (
              <Row k="True lean">
                <span data-testid="usmap-hidden-lean">{formatMargin(lean)}</span>
              </Row>
            )}
          </dl>
          <h4>House</h4>
          {pieces.length === 0 ? (
            <p className="um-muted">No district holds it in the plan in force.</p>
          ) : (
            <ul className="um-list">
              {pieces.map((x) => (
                <li key={x.district}>
                  <button
                    type="button"
                    className="um-inlink"
                    onClick={() => p.onSelect({ kind: "district", id: x.district })}
                  >
                    {districtTitle(p.layers, x.district)}
                  </button>
                  {pieces.length > 1 && <span className="um-muted"> {formatPct(x.share)} of its people</span>}
                </li>
              ))}
            </ul>
          )}
          <h4>Races</h4>
          <RaceList races={stateRaces} onLive={p.onLive} live={p.liveRaces} />
          <p className="um-foot">
            <EntityLink to={{ kind: "County", id: i }}>Encyclopedia</EntityLink>
          </p>
        </>
      );
    }
  } else if (p.sel.kind === "district") {
    const id = p.sel.id;
    const row = p.districts?.districts.find((d) => d.id === id);
    const plan = p.districts?.plans.find((x) => x.state === row?.state);
    const counties = p.plan.counties.get(id) ?? [];
    const member = row?.member ?? null;
    const mp = member === null ? undefined : byId.get(member);
    const { state, number } = districtRefParts(id);
    const dRaces = (races?.races ?? []).filter(
      (r) => r.office === "House" && r.state === state && r.district === number,
    );
    title = districtTitle(p.layers, id);
    body =
      row === undefined ? (
        <p className="um-muted">The plan in force has no such district.</p>
      ) : (
        <>
          <dl className="um-dl">
            <Row k="Member">
              {member === null ? (
                "Vacant"
              ) : (
                <PersonChip id={member} name={mp?.name ?? `#${member}`} party={mp?.party ?? null} />
              )}
            </Row>
            <Row k="People">{formatInt(row.population)}</Row>
            <Row k="Counties">{counties.length}</Row>
            {plan && (
              <Row k="Plan">
                {plan.census_year} census
                {plan.drawn_by ? `, drawn by the ${partyAdjective(plan.drawn_by)}s` : ""}
                {plan.struck ? ", struck down" : ""}
              </Row>
            )}
            {plan?.strength !== null && plan?.strength !== undefined && (
              <Row k="Gerrymander">
                <span data-testid="usmap-hidden-strength">{formatPct(plan.strength)}</span>
              </Row>
            )}
            {row.lean !== null && (
              <Row k="True lean">
                <span data-testid="usmap-hidden-lean">{formatMargin(row.lean)}</span>
              </Row>
            )}
          </dl>
          <h4>Races</h4>
          <RaceList races={dRaces} onLive={p.onLive} live={p.liveRaces} />
          <h4>Counties</h4>
          <ul className="um-list um-cols">
            {counties.map((ci) => {
              const piece = (p.plan.pieces[ci] ?? []).find((x) => x.district === id);
              return (
                <li key={ci} data-testid={`county-row-${c.fips[ci]}`}>
                  <button
                    type="button"
                    className="um-inlink"
                    onClick={() => p.onSelect({ kind: "county", key: c.fips[ci] ?? String(ci) })}
                  >
                    {c.name[ci]}
                  </button>
                  {piece && piece.share < 0.999 && (
                    <span className="um-muted"> {formatPct(piece.share)}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="um-foot">
            <EntityLink to={{ kind: "District", id }}>Encyclopedia</EntityLink>
          </p>
        </>
      );
  } else {
    const id = p.sel.id;
    const st = stateRow(p.layers, id);
    const ds = (p.districts?.districts ?? []).filter((d) => d.state === id);
    const sRaces = (races?.races ?? []).filter((r) => r.state === id || r.office === "President");
    const officials = (people?.people ?? []).filter(
      (x) =>
        x.status === "InOffice" &&
        x.home_state === id &&
        x.office !== null &&
        !x.office.startsWith("Representative"),
    );
    title = st?.name ?? `State ${id}`;
    body =
      st === undefined ? (
        <p className="um-muted">No such state on this map.</p>
      ) : (
        <>
          <dl className="um-dl">
            <Row k="People">{formatInt(st.population)}</Row>
            <Row k="House seats">{st.house_seats}</Row>
            <Row k="Electoral votes">{st.electoral_votes}</Row>
            <Row k="Governor">{st.governor === null ? "-" : partyAdjective(st.governor)}</Row>
            <Row k="Last president">
              {st.last_winner === null || st.last_margin === null
                ? "No certified vote yet"
                : `${partyAdjective(st.last_winner)}, ${formatMargin(st.last_margin)}`}
            </Row>
          </dl>
          {officials.length > 0 && (
            <>
              <h4>Officials</h4>
              <ul className="um-list">
                {officials.map((o) => (
                  <li key={o.id}>
                    <PersonChip id={o.id} name={o.name} party={o.party} />
                    <span className="um-muted"> {o.office}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4>Districts</h4>
          <ul className="um-list um-cols">
            {ds.map((d) => {
              const m = d.member === null ? undefined : byId.get(d.member);
              return (
                <li key={d.id} data-testid={`district-row-${d.id}`}>
                  <button
                    type="button"
                    className="um-inlink"
                    onClick={() => p.onSelect({ kind: "district", id: d.id })}
                  >
                    {st.house_seats === 1 ? "At large" : `District ${d.number}`}
                  </button>
                  {m && (
                    <span
                      className={`um-dot ${m.party === "Democrats" ? "party-a" : m.party === null ? "party-none" : "party-b"}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <h4>Races</h4>
          <RaceList races={sRaces} onLive={p.onLive} live={p.liveRaces} />
          <p className="um-foot">
            <EntityLink to={{ kind: "State", id }}>Encyclopedia</EntityLink>
          </p>
        </>
      );
  }

  return (
    <aside className="um-panel" data-testid="usmap-panel" aria-label={title}>
      <header className="um-panel-head">
        <h3 data-testid="usmap-panel-title">{title}</h3>
        <button
          type="button"
          className="um-close"
          onClick={p.onClose}
          aria-label="Close panel"
          data-testid="usmap-panel-close"
        >
          ×
        </button>
      </header>
      <div className="um-panel-body">{body}</div>
    </aside>
  );
}
