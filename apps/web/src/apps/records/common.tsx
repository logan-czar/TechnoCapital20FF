// What the Records pages share: the navigation context, the data hooks (names of people, states
// and industries), a sortable table, and the loading, empty and not-found states.

import type { PersonRow } from "@tc20ff/sim";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { PersonChip } from "../_shared/index.ts";
import type { LeverNames } from "./data.ts";
import { formatRoute, type RecordsRoute } from "./route.ts";

// --- navigation -------------------------------------------------------------------------------

export interface RecordsNav {
  /** Opens a page, as a new step of the app's history. */
  go(r: RecordsRoute): void;
  /** Changes the page's own state (a filter) without a new history step. */
  replace(r: RecordsRoute): void;
  setTitle(title: string | null): void;
}

export const NavContext = createContext<RecordsNav>({ go: () => {}, replace: () => {}, setTitle: () => {} });

export function useNav(): RecordsNav {
  return useContext(NavContext);
}

/** Names the window after the page ("H.B. 3 - Records"); `null` while it has no name yet. */
export function usePageTitle(title: string | null): void {
  const { setTitle } = useNav();
  useEffect(() => {
    setTitle(title === null ? null : `${title} - Records`);
  }, [title, setTitle]);
}

/** A link to another page of this app (a bill, a roll call, a race's results). */
export function NavLink({
  to,
  children,
  testId,
}: {
  to: RecordsRoute;
  children: ReactNode;
  testId?: string;
}) {
  const { go } = useNav();
  return (
    <button
      type="button"
      className="rec-link"
      data-testid={testId ?? `nav-${formatRoute(to) ?? "home"}`}
      onClick={() => go(to)}
    >
      {children}
    </button>
  );
}

// --- data -------------------------------------------------------------------------------------

export interface People {
  list: PersonRow[];
  get(id: number): PersonRow | undefined;
}

/** The people view with a lookup by id; undefined until the first frame. */
export function usePeople(): People | undefined {
  const view = useViewData("people");
  return useMemo(() => {
    if (view === undefined) return undefined;
    const by = new Map<number, PersonRow>();
    for (const p of view.people) by.set(p.id, p);
    return { list: view.people, get: (id: number) => by.get(id) };
  }, [view]);
}

export interface StateName {
  id: number;
  name: string;
}

/** The states and their names (the USA map's layers); undefined until the first frame. */
export function useStates(): { list: StateName[]; name(id: number): string } | undefined {
  const view = useViewData("usmap_layers");
  return useMemo(() => {
    if (view === undefined) return undefined;
    const list = view.states.map((s) => ({ id: s.id as number, name: s.name }));
    const by = new Map(list.map((s) => [s.id, s.name]));
    return { list, name: (id: number) => by.get(id) ?? `State ${id}` };
  }, [view]);
}

/** Industry and state names for a lever change; read while the views load, so a name may be a placeholder. */
export function useLeverNames(): LeverNames {
  const industries = useViewData("industry_rows");
  const states = useStates();
  return useMemo(
    () => ({
      industry: (id) => industries?.rows.find((r) => r.id === id)?.name ?? `industry ${id}`,
      state: (id) => states?.name(id) ?? `state ${id}`,
    }),
    [industries, states],
  );
}

/** A person as the press names them, or their id while the people view has not arrived. */
export function Person({ id, people }: { id: number; people: People | undefined }) {
  const p = people?.get(id);
  if (p === undefined) return <span className="rec-muted">Person #{id}</span>;
  return <PersonChip id={p.id} name={p.name} party={p.party} />;
}

// --- states of a page -------------------------------------------------------------------------

export function Loading({ what }: { what: string }) {
  return (
    <p className="rec-state" data-testid="rec-loading">
      Retrieving {what}...
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rec-state rec-empty" data-testid="rec-empty">
      {children}
    </p>
  );
}

/** A page for something the record does not hold: always says what was asked and the way home. */
export function NotOnRecord({ what, hint }: { what: string; hint?: string }) {
  return (
    <div className="rec-state rec-missing" data-testid="rec-missing">
      <p className="rec-missing-title">No such record</p>
      <p>{what} is not in the public record.</p>
      {hint === undefined ? null : <p className="rec-muted">{hint}</p>}
      <p>
        <NavLink to={{ page: "home" }} testId="nav-missing-home">
          Return to the front page
        </NavLink>
      </p>
    </div>
  );
}

/** The frame of one page: its heading, an optional lede and its sections. */
export function Page({
  name,
  title,
  kicker,
  lede,
  children,
}: {
  name: string;
  title: string;
  kicker?: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rec-page" data-testid={`page-${name}`}>
      <header className="rec-page-head">
        {kicker === undefined ? null : <p className="rec-kicker">{kicker}</p>}
        <h1 className="rec-title">{title}</h1>
        {lede === undefined ? null : <div className="rec-lede">{lede}</div>}
      </header>
      {children}
    </article>
  );
}

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rec-section">
      <div className="rec-section-head">
        <h2>{title}</h2>
        {aside === undefined ? null : <div className="rec-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** A labelled fact: the dl of a bill's or a race's particulars. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="rec-facts">
      {items.map(([k, v]) => (
        <div key={k} className="rec-fact">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- the sortable table -----------------------------------------------------------------------

export interface Col<R> {
  id: string;
  header: string;
  render(row: R): ReactNode;
  /** What the column sorts by; without it the column is not sortable. Null sorts last. */
  sort?: (row: R) => string | number | null;
  /** Right-aligned figures. */
  num?: boolean;
}

function compare(a: string | number | null, b: string | number | null, desc: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const c = a < b ? -1 : a > b ? 1 : 0;
  return desc ? -c : c;
}

/**
 * A plain sortable table for lists of a few hundred rows (a roll call's 435 votes at most): a click
 * on a header sorts by it, again reverses; ties keep the order given. Rows carry
 * `data-testid="<rowKind>-row-<key>"`.
 */
export function SortTable<R>({
  table: id,
  rows,
  cols,
  rowKey,
  rowKind,
  initial,
  caption,
}: {
  /** Names the table in test ids. */
  table: string;
  rows: readonly R[];
  cols: readonly Col<R>[];
  rowKey: (r: R) => string | number;
  rowKind: string;
  initial?: { id: string; desc: boolean };
  caption?: string;
}) {
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(initial ?? null);
  const sorted = useMemo(() => {
    const col = cols.find((c) => c.id === sort?.id);
    if (sort === null || col?.sort === undefined) return rows;
    const by = col.sort;
    return rows
      .map((r, i) => ({ r, i, k: by(r) }))
      .sort((a, b) => compare(a.k, b.k, sort.desc) || a.i - b.i)
      .map((x) => x.r);
  }, [rows, cols, sort]);
  return (
    <div className="rec-tablewrap">
      <table className="rec-table" data-testid={`table-${id}`}>
        {caption === undefined ? null : <caption className="rec-sr">{caption}</caption>}
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort?.id === c.id;
              return (
                <th
                  key={c.id}
                  scope="col"
                  className={c.num ? "num" : undefined}
                  aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
                >
                  {c.sort === undefined ? (
                    c.header
                  ) : (
                    <button
                      type="button"
                      className="rec-th"
                      data-testid={`sort-${id}-${c.id}`}
                      onClick={() => setSort({ id: c.id, desc: active ? !sort.desc : false })}
                    >
                      {c.header}
                      <span aria-hidden="true">{active ? (sort.desc ? " ▼" : " ▲") : ""}</span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} data-testid={`${rowKind}-row-${rowKey(r)}`}>
              {cols.map((c) => (
                <td key={c.id} className={c.num ? "num" : undefined}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A bar of seats by party, for a chamber's make-up and a tally. */
export function SplitBar({
  parts,
  label,
}: {
  parts: { key: string; cls: string; n: number; title: string }[];
  label: string;
}) {
  const total = parts.reduce((s, p) => s + p.n, 0);
  return (
    <div className="rec-splitbar" role="img" aria-label={label}>
      {parts.map((p) =>
        p.n > 0 ? (
          <span
            key={p.key}
            className={`rec-split ${p.cls}`}
            style={{ flexGrow: p.n / Math.max(1, total) }}
            title={p.title}
          />
        ) : null,
      )}
    </div>
  );
}
