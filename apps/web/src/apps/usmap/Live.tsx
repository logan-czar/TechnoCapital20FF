// Live returns (pivot 9.2, 9.3; D1048): the race picker, the race's results strip (candidates,
// votes, share reported, the Electoral College for the presidency, the outlets' calls and
// retractions) and the county colours, from v_returns and its `counties` slice for the one race on
// screen. Only reported votes are in the view (pivot 9.1), so nothing here can show the truth early.

import {
  districtRefId,
  type Party,
  type RaceCountyReturns,
  type RaceReturns,
  type RaceRow,
  type UsMapLayersView,
} from "@tc20ff/sim";
import { useEffect, useMemo } from "react";
import { useSlice, useViewData } from "../../sim/hooks.ts";
import { EntityLink, formatHour, formatPct, formatWhen, PersonChip } from "../_shared/index.ts";
import type { PlanIndex } from "./borders.ts";
import {
  type CountyCount,
  countsByCounty,
  formatInt,
  leaderOf,
  NO_DATA_RGB,
  paintAll,
  paintLive,
} from "./layers.ts";
import { countiesOfState, peopleById, stateRow } from "./names.ts";

/** What the live layer tells the rest of the map. */
export interface LiveInfo {
  race: RaceRow | null;
  counts: (CountyCount | null)[];
  ballotParty: (Party | null)[];
  /** Ballot index to the candidate's name. */
  names: string[];
  /** The counties the race covers; null for the whole map. */
  area: number[] | null;
}

const OFFICE_ORDER = ["President", "Senate", "Governor", "House"] as const;
const OFFICE_GROUP: Record<(typeof OFFICE_ORDER)[number], string> = {
  President: "President",
  Senate: "Senate",
  Governor: "Governor",
  House: "House",
};

/** The race's counties: a state's for Senate and governor, a district's for the House. */
export function raceArea(race: RaceRow, layers: UsMapLayersView, plan: PlanIndex): number[] | null {
  if (race.office === "President" || race.state === null) return null;
  if (race.office === "House" && race.district !== null)
    return plan.counties.get(districtRefId(race.state, race.district)) ?? [];
  return countiesOfState(layers, race.state);
}

export function LiveLayer(props: {
  race: number | null;
  layers: UsMapLayersView;
  plan: PlanIndex;
  colours: Uint8Array;
  onPainted: () => void;
  onInfo: (info: LiveInfo) => void;
  onRace: (race: number) => void;
  onState: (state: number) => void;
}) {
  const { race, layers, plan, colours, onPainted, onInfo } = props;
  const races = useViewData("races");
  const returns = useViewData("returns");
  const people = useViewData("people");
  const feed = useViewData("feed");
  const slice = useSlice(race === null ? null : { view: "returns", slice: "counties", race: race as never });
  const count = layers.counties.fips.length;

  const row = races?.races.find((r) => r.id === race) ?? null;
  const ret = returns?.races.find((r) => r.race === race) ?? null;
  const byId = useMemo(() => peopleById(people), [people]);
  const ballotParty = useMemo(
    () => (row?.ballot ?? []).map((p) => row?.candidates.find((c) => c.person === p)?.party ?? null),
    [row],
  );
  const names = useMemo(
    () => (row?.ballot ?? []).map((p) => byId.get(p)?.name ?? `Candidate ${p}`),
    [row, byId],
  );
  const counts = useMemo(
    () => (slice ? countsByCounty(slice as RaceCountyReturns, count) : new Array(count).fill(null)),
    [slice, count],
  );
  const area = useMemo(() => (row ? raceArea(row, layers, plan) : null), [row, layers, plan]);

  // A wave of returns: one colour pass over the buffer (timed from here to the frame, MapCanvas).
  useEffect(() => {
    try {
      performance.mark("usmap:paint");
    } catch {
      // No user timing: untimed.
    }
    if (slice) paintLive(colours, count, counts, ballotParty);
    else paintAll(colours, count, NO_DATA_RGB, 70);
    onPainted();
  }, [colours, count, counts, ballotParty, slice, onPainted]);

  useEffect(() => {
    onInfo({ race: row, counts, ballotParty, names, area });
  }, [row, counts, ballotParty, names, area, onInfo]);

  const outlets = useMemo(() => new Map((feed?.outlets ?? []).map((o) => [o.id as number, o.name])), [feed]);

  return (
    <section className="um-live" data-testid="usmap-live" aria-label="Live returns">
      <div className="um-live-head">
        <label className="um-field">
          <span>Race</span>
          <select
            data-testid="usmap-race-picker"
            value={race ?? ""}
            onChange={(e) => props.onRace(Number(e.target.value))}
          >
            {race === null && <option value="">Pick a race</option>}
            {OFFICE_ORDER.map((office) => {
              const list = (races?.races ?? []).filter((r) => r.office === office);
              if (list.length === 0) return null;
              return (
                <optgroup key={office} label={OFFICE_GROUP[office]}>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        {row && <EntityLink to={{ kind: "Race", id: row.id }}>Race page</EntityLink>}
      </div>
      {row === null ? (
        <p className="um-empty">{races ? "Pick a race to follow its count." : "Loading the races."}</p>
      ) : ret === null || ret.polls_closed === null ? (
        <p className="um-empty" data-testid="usmap-live-waiting">
          No returns yet. Polls close at {formatWhen(row.polls_close)}.
        </p>
      ) : (
        <Results
          row={row}
          ret={ret}
          names={names}
          byId={byId}
          outlets={outlets}
          layers={layers}
          onState={props.onState}
        />
      )}
    </section>
  );
}

function Results(p: {
  row: RaceRow;
  ret: RaceReturns;
  names: string[];
  byId: ReturnType<typeof peopleById>;
  outlets: Map<number, string>;
  layers: UsMapLayersView;
  onState: (state: number) => void;
}) {
  const { row, ret } = p;
  const total = ret.votes.reduce((s, v) => s + v.votes, 0);
  const lead = leaderOf(ret.votes.map((v) => v.votes));
  const status = ret.certified
    ? "Certified"
    : ret.recount
      ? "Recount under way"
      : ret.reporting >= 1
        ? "Count complete"
        : "Counting";
  return (
    <div className="um-results">
      <div className="um-results-meta">
        <span data-testid="usmap-reporting">
          <b>{formatPct(ret.reporting)}</b> reported
        </span>
        <span>{status}</span>
        <span>Polls closed {formatHour(ret.polls_closed ?? 0)}</span>
      </div>
      <table className="um-cands" data-testid="usmap-candidates">
        <tbody>
          {ret.votes.map((v, k) => {
            const person = p.byId.get(v.person);
            const share = total > 0 ? v.votes / total : 0;
            return (
              <tr key={v.person} className={lead?.lead === k ? "um-leading" : undefined}>
                <td className="um-cand-name">
                  <PersonChip
                    id={v.person}
                    name={person?.name ?? p.names[k] ?? `#${v.person}`}
                    party={person?.party ?? null}
                  />
                </td>
                <td className="um-num">{formatInt(v.votes)}</td>
                <td className="um-num">{formatPct(share)}</td>
                <td className="um-bar-cell">
                  <span className="um-bar" style={{ inlineSize: `${(share * 100).toFixed(1)}%` }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ret.electoral_votes && (
        <ElectoralTally row={row} ret={ret} byId={p.byId} layers={p.layers} onState={p.onState} />
      )}
      <Calls ret={ret} outlets={p.outlets} byId={p.byId} />
    </div>
  );
}

function ElectoralTally(p: {
  row: RaceRow;
  ret: RaceReturns;
  byId: ReturnType<typeof peopleById>;
  layers: UsMapLayersView;
  onState: (state: number) => void;
}) {
  const ev = p.ret.electoral_votes ?? [];
  const all = (p.ret.states ?? []).reduce((s, x) => s + x.electoral_votes, 0);
  const need = p.row.electoral_votes;
  return (
    <div className="um-ec" data-testid="usmap-ec">
      <div className="um-ec-bar" role="img" aria-label="Electoral votes called">
        {ev.map((e) => {
          const party = p.byId.get(e.person)?.party ?? null;
          return (
            <span
              key={e.person}
              className={`um-ec-seg ${party === "Democrats" ? "party-a" : party === null ? "party-none" : "party-b"}`}
              style={{ inlineSize: `${all > 0 ? (e.votes / all) * 100 : 0}%` }}
            />
          );
        })}
        {need !== null && all > 0 && (
          <span className="um-ec-need" style={{ insetInlineStart: `${(need / all) * 100}%` }} />
        )}
      </div>
      <p className="um-ec-text">
        {ev.map((e, k) => (
          <span key={e.person}>
            {k > 0 ? ", " : ""}
            {p.byId.get(e.person)?.name ?? `#${e.person}`} <b>{e.votes}</b>
          </span>
        ))}
        {need !== null ? ` of ${all}; ${need} to win` : ""}
      </p>
      <ul className="um-ec-states">
        {(p.ret.states ?? []).map((s) => {
          const party = s.called === null ? null : (p.byId.get(s.called)?.party ?? null);
          return (
            <li key={s.state}>
              <button
                type="button"
                className={`um-chip ${s.called === null ? "um-chip-open" : party === "Democrats" ? "party-a" : "party-b"}`}
                data-testid={`usmap-ec-state-${s.state}`}
                title={`${stateRow(p.layers, s.state)?.name ?? s.state}: ${formatPct(s.reporting)} reported${s.called === null ? ", not called" : ""}`}
                onClick={() => p.onState(s.state)}
              >
                {stateRow(p.layers, s.state)?.name ?? s.state} <span>{s.electoral_votes}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Calls(p: { ret: RaceReturns; outlets: Map<number, string>; byId: ReturnType<typeof peopleById> }) {
  if (p.ret.calls.length === 0) return <p className="um-calls-none">No outlet has called it.</p>;
  return (
    <ul className="um-calls" data-testid="usmap-calls">
      {p.ret.calls.map((c) => (
        <li key={`${c.outlet}-${c.time}-${c.person}`} className={c.retracted ? "um-retracted" : undefined}>
          <span className="um-call-time">{formatHour(c.time)}</span>{" "}
          <EntityLink to={{ kind: "Outlet", id: c.outlet }}>
            {p.outlets.get(c.outlet) ?? `Outlet ${c.outlet}`}
          </EntityLink>{" "}
          {c.retracted ? "retracted its call for" : "called it for"}{" "}
          {p.byId.get(c.person)?.name ?? `#${c.person}`}
        </li>
      ))}
    </ul>
  );
}
