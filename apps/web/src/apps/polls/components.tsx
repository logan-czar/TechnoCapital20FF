// Pieces the Polls pages share: the in-app link, a candidate's name, the odds bars, a rating pill and
// the two poll tables. Everything reads what its page hands it; nothing here reads a view.

import type { PersonRow, Poll, PollsterRow } from "@tc20ff/sim";
import { createContext, type ReactNode, useContext } from "react";
import { formatDay, formatUsd, PersonChip } from "../_shared/index.ts";
import { seriesColors } from "./charts.tsx";
import { personName } from "./hooks.ts";
import { formatOdds, formatShare, pollLead, type Rating, ratingClass, ratingLabel } from "./model.ts";

/** Opens a page of this app (a route string; null is the overview). */
export const PollsNav = createContext<(route: string | null) => void>(() => {});

/** A link to another page of the Polls app. */
export function PageLink({
  to,
  children,
  testId,
}: {
  to: string | null;
  children: ReactNode;
  testId?: string;
}) {
  const go = useContext(PollsNav);
  return (
    <button
      type="button"
      className="app-link polls-pagelink"
      data-testid={testId ?? `polls-link-${to ?? "home"}`}
      onClick={() => go(to)}
    >
      {children}
    </button>
  );
}

/** A candidate: their name in their party's colour, linking to their page in the encyclopedia. */
export function Candidate({
  id,
  people,
  party,
}: {
  id: number;
  people: ReadonlyMap<number, PersonRow>;
  party?: PersonRow["party"];
}) {
  const p = people.get(id);
  return (
    <PersonChip
      id={id}
      name={personName(people, id)}
      party={party === undefined ? (p?.party ?? null) : party}
    />
  );
}

/** A rating as the site words it: "Likely D", in the leader's party colour. */
export function RatingPill({ rating }: { rating: Rating }) {
  return (
    <span className={`polls-rating ${ratingClass(rating)}`} data-testid="rating-pill">
      {ratingLabel(rating)}
    </span>
  );
}

export interface OddsItem {
  person: number;
  win: number;
  party: PersonRow["party"];
}

/** Each candidate's chance to win, as bars: the site's estimate, never a certainty. */
export function OddsBars({ items, people }: { items: OddsItem[]; people: ReadonlyMap<number, PersonRow> }) {
  const colors = seriesColors(items.map((i) => i.party));
  return (
    <ul className="polls-odds" data-testid="odds-bars">
      {items.map((it, i) => (
        <li key={it.person} className="polls-odds-row" data-testid={`odds-row-${it.person}`}>
          <span className="polls-odds-name">
            <Candidate id={it.person} people={people} party={it.party} />
          </span>
          <span className="polls-odds-track" aria-hidden="true">
            <span
              className="polls-odds-fill"
              style={{ width: `${Math.max(it.win * 100, 0.6)}%`, background: colors[i] }}
            />
          </span>
          <span className="polls-odds-value">{formatOdds(it.win)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A shared heading with an optional side note. */
export function Section({
  title,
  note,
  children,
  testId,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="polls-section" data-testid={testId}>
      <header className="polls-section-head">
        <h2>{title}</h2>
        {note === undefined ? null : <p className="polls-note">{note}</p>}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="polls-empty" data-testid={testId ?? "polls-empty"}>
      {children}
    </p>
  );
}

const dayRange = (p: Poll): string => {
  const a = formatDay(p.from);
  const b = formatDay(p.to);
  return `${a.replace(/ \d{4}$/, "")} - ${b.replace(/ \d{4}$/, "")}`;
};

/** 1,200: a whole number with thousands separators, in no locale. */
const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const pollsterName = (pollsters: readonly PollsterRow[], id: number): string =>
  pollsters.find((x) => x.id === id)?.name ?? `Pollster ${id}`;

/**
 * The polls of one stage of a race, newest first: pollster, dates, sample, margin of error and each
 * candidate's share, a column per person of `columns` (the ballot order, D1037).
 */
export function RacePollTable({
  polls,
  columns,
  people,
  pollsters,
  highlight,
}: {
  polls: readonly Poll[];
  columns: readonly number[];
  people: ReadonlyMap<number, PersonRow>;
  pollsters: readonly PollsterRow[];
  highlight?: boolean;
}) {
  const rows = [...polls].sort((a, b) => b.id - a.id);
  return (
    <div className="polls-tablewrap">
      <table className="polls-table" data-testid="poll-table">
        <thead>
          <tr>
            <th scope="col">Published</th>
            <th scope="col">Pollster</th>
            <th scope="col">Field dates</th>
            <th scope="col" className="num">
              Sample
            </th>
            <th scope="col" className="num">
              MoE
            </th>
            {columns.map((c) => (
              <th key={c} scope="col" className="num">
                <Candidate id={c} people={people} />
              </th>
            ))}
            <th scope="col" className="num">
              Undec.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const lead = highlight === false ? null : pollLead(p);
            return (
              <tr key={p.id} data-testid={`poll-row-${p.id}`}>
                <td>{formatDay(p.published)}</td>
                <td>
                  <PageLink to={`pollster/${p.pollster}`} testId={`poll-pollster-${p.id}`}>
                    {pollsterName(pollsters, p.pollster)}
                  </PageLink>
                </td>
                <td className="polls-dim">{dayRange(p)}</td>
                <td className="num">{fmtInt(p.sample)}</td>
                <td className="num">±{p.margin_of_error.toFixed(1)}</td>
                {columns.map((c) => {
                  const s = p.shares.find((x) => x.person === c);
                  return (
                    <td key={c} className={`num${lead !== null && lead.leader === c ? " polls-lead" : ""}`}>
                      {formatShare(s === undefined ? null : s.share)}
                    </td>
                  );
                })}
                <td className="num polls-dim">{formatShare(p.undecided)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A firm's polls, newest first, each naming its race and the top of its field. */
export function PollsterPollTable({
  polls,
  label,
  people,
}: {
  polls: readonly Poll[];
  /** What a poll's race link reads: its race's title, with the state for a state poll. */
  label: (poll: Poll) => string;
  people: ReadonlyMap<number, PersonRow>;
}) {
  const rows = [...polls].sort((a, b) => b.id - a.id);
  return (
    <div className="polls-tablewrap">
      <table className="polls-table" data-testid="pollster-poll-table">
        <thead>
          <tr>
            <th scope="col">Published</th>
            <th scope="col">Race</th>
            <th scope="col">Vote</th>
            <th scope="col" className="num">
              Sample
            </th>
            <th scope="col" className="num">
              MoE
            </th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const top = [...p.shares].sort((a, b) => b.share - a.share || a.person - b.person).slice(0, 2);
            return (
              <tr key={p.id} data-testid={`poll-row-${p.id}`}>
                <td>{formatDay(p.published)}</td>
                <td>
                  <PageLink
                    to={p.state === null ? `race/${p.race}` : `state/${p.state}`}
                    testId={`poll-race-${p.id}`}
                  >
                    {label(p)}
                  </PageLink>
                </td>
                <td className="polls-dim">
                  {p.stage === "Primary"
                    ? `${p.party ?? ""} primary`.trim()
                    : p.state === null
                      ? "General"
                      : "General, one state"}
                </td>
                <td className="num">{fmtInt(p.sample)}</td>
                <td className="num">±{p.margin_of_error.toFixed(1)}</td>
                <td>
                  {top.map((s, i) => (
                    <span key={s.person}>
                      {i > 0 ? ", " : ""}
                      {personName(people, s.person)} {formatShare(s.share)}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A candidate's money as last filed (public, pivot 6.3): "$1.2M raised, $300K on hand"; dashes before a filing. */
export function Money({ raised, cash }: { raised: number | null; cash: number | null }) {
  if (raised === null || cash === null) return <span className="polls-dim">no filing yet</span>;
  return (
    <span>
      {formatUsd(raised)} raised, {formatUsd(cash)} on hand
    </span>
  );
}
