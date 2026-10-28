// Full-screen Pdoomberg (crates/game/src/pdoomberg/mod.rs, build-plan M9.4; spec 8 Pdoomberg;
// 20-ui 20.5.2; 3-markets 3.13.1): the amber-on-black terminal over the workspace. It is not a
// workspace page (D451): B opens it, Esc closes it (App.tsx), and the game clock keeps running.
//
// - A one-line status bar: the Pdoomberg name, the "Accurate: published data" badge, the date
//   and hour, the speed and the alert count (20.5.2 (A)).
// - The command line shows the route (`ARDR F3 <GO>`); the command bar (Ctrl+K, `TICKER Fn`)
//   sets it.
// - The security line of the loaded company: ticker, name, industry, last, change, EFV band,
//   rating, next earnings.
// - The function page: F2 Quotes, F3 Chart, F4 Order (the lock only), F5 Filings, F6 Ratings,
//   F7 Bonds, F9 Industries, F10 Screener (models.ts). The function keys work only while the
//   terminal is open (D453, design fix 442; D517), and the key row at the bottom is clickable.
// - A row click on F2 watches or unwatches the company (M7.8); a right-click on F2, F5, F6 or
//   F10 loads it (the security line and F3) and keeps the page. A link click opens its page in
//   the workspace and leaves the terminal (D517).
// - The terminal is mounted only while open, so nothing of it runs while it is closed (D520);
//   each page keeps its filters while only the company changes (a right-click load).

import { type CompanyId, VIEW_SPECS, type ViewName } from "@tc20ff/sim";
import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import { type NameIndex, useNameIndex } from "../links/names.ts";
import { NavContext, type OpenTarget, type PageNav } from "../links/nav.ts";
import type { ChartModel, TableDoc } from "../pages/doc.ts";
import { industriesTable } from "../pages/kinds/industries.tsx";
import { type Filter, filterGet, industryOptions } from "../pages/kinds/news.tsx";
import { type Pick, Picker } from "../pages/Picker.tsx";
import { type PageRef, PDB_FUNCTION_NAME, PDB_FUNCTIONS, type PdbFunction } from "../pages/ref.ts";
import { usePageViews, type ViewsData } from "../pages/views.ts";
import { useClock, useNotices, useSim } from "../sim/hooks.ts";
import type { Cell } from "../widgets/cells.ts";
import { type Column, DataTable } from "../widgets/DataTable.tsx";
import {
  bondsNote,
  chartNote,
  commandLine,
  countryOptions,
  dailyChart,
  FUNCTION_VIEWS,
  filingsNote,
  filingsTable,
  NO_COMPANY,
  type PdoombergRoute,
  QUOTES_REFRESH_MS,
  quotesTable,
  READ_ONLY_LOCK,
  ratingSpreadsTable,
  ratingsStrip,
  ratingsTable,
  rowAction,
  screenerPickers,
  screenerTable,
  securityText,
  sovereignsTable,
  statusLine,
  weeklyChart,
  zoneSpreadsTable,
} from "./models.ts";

const ChartBlock = lazy(() => import("../pages/ChartBlock.tsx").then((m) => ({ default: m.ChartBlock })));

/** The views the terminal's footer lists (each line shows its version and cadence). */
export const FOOTER_VIEWS: readonly ViewName[] = [
  "quotes",
  "price_bars",
  "filings",
  "ratings",
  "rates",
  "company_rows",
];

/** The keyboard key of a function page ("F3" is the key "F3"). */
export function functionOfKey(key: string): PdbFunction | null {
  return (PDB_FUNCTIONS as readonly string[]).includes(key) ? (key as PdbFunction) : null;
}

interface Row {
  i: number;
  cells: Cell[];
}

/** A terminal table: a doc table that fills the page area, with row clicks. */
function TerminalTable({
  table,
  onRow,
}: {
  table: TableDoc;
  onRow?: (cells: Cell[], button: number) => void;
}) {
  const columns = useMemo<Column<Row>[]>(
    () =>
      table.columns.map((c, i) => ({
        id: String(i),
        header: c.title,
        width: c.width,
        ...(c.hint ? { hint: c.hint } : {}),
        cell: (r) => r.cells[i] ?? { k: "unknown" },
      })),
    [table.columns],
  );
  const rows = useMemo(() => table.rows.map((cells, i): Row => ({ i, cells })), [table.rows]);
  return (
    <div className="pdb-table" data-table={table.id}>
      <DataTable
        id={table.id}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.i}
        {...(onRow ? { onRowClick: (r: Row, b: number) => onRow(r.cells, b) } : {})}
      />
    </div>
  );
}

function Charts({ charts }: { charts: ChartModel[] }) {
  return (
    <div className="pdb-charts">
      {charts.map((c) => (
        <Suspense key={c.title} fallback={<div className="chart-box muted">Loading the chart...</div>}>
          <ChartBlock chart={c} />
        </Suspense>
      ))}
    </div>
  );
}

type Pickers = readonly (readonly [string, string, [string, Pick][]])[];

function FilterRow({
  pickers,
  filter,
  setFilter,
  hint,
}: {
  pickers: Pickers;
  filter: Filter;
  setFilter: (f: Filter) => void;
  hint: string;
}) {
  return (
    <div className="chip-row pdb-filters">
      {pickers.map(([label, key, options]) => (
        <Picker
          key={key}
          label={label}
          options={options}
          value={filterGet(filter, key)}
          onChange={(p) => setFilter({ ...filter, [key]: p })}
        />
      ))}
      <span className="pdb-dim small">{hint}</span>
    </div>
  );
}

interface PageArgs {
  route: PdoombergRoute;
  v: ViewsData;
  index: NameIndex;
  filter: Filter;
  setFilter: (f: Filter) => void;
  onRow: (cells: Cell[], button: number) => void;
}

/** Builds `route`'s function page (pages.rs `build`). */
function FunctionPage({ route, v, index, filter, setFilter, onRow }: PageArgs) {
  switch (route.function) {
    case "F2": {
      const pickers: Pickers = [
        ["Watchlist", "list", [["My watchlist", 1]]],
        ["Industry", "industry", industryOptions(v)],
        ["Country", "country", countryOptions(v)],
      ];
      return (
        <>
          <FilterRow
            pickers={pickers}
            filter={filter}
            setFilter={setFilter}
            hint="Click a row: watch or unwatch. Right-click: load it (F3 chart)."
          />
          <TerminalTable table={quotesTable(v, index, filter)} onRow={onRow} />
        </>
      );
    }
    case "F3": {
      const id = route.company;
      if (id === null) return <p className="pdb-text">{NO_COMPANY}</p>;
      const charts = [dailyChart(v, id), weeklyChart(v, id)].filter((c): c is ChartModel => c !== null);
      return (
        <>
          <p className="pdb-dim small">{chartNote(v, id)}</p>
          {charts.length > 0 && <Charts charts={charts} />}
        </>
      );
    }
    case "F4":
      return <p className="pdb-lock">{READ_ONLY_LOCK}</p>;
    case "F5":
      return (
        <>
          <p className="pdb-dim small">{filingsNote(v)}</p>
          <TerminalTable table={filingsTable(v, index)} onRow={onRow} />
        </>
      );
    case "F6":
      return (
        <>
          <p className="pdb-dim small">{ratingsStrip(v)}</p>
          <TerminalTable table={ratingsTable(v, index)} onRow={onRow} />
        </>
      );
    case "F7":
      return (
        <>
          <p className="pdb-text">{bondsNote(v)}</p>
          <div className="pdb-columns">
            {(
              [
                ["Zone credit spreads", zoneSpreadsTable(v, index)],
                ["Sovereign spreads", sovereignsTable(v, index)],
                ["Corporate spread by rating", ratingSpreadsTable(v)],
              ] as const
            ).map(([title, t]) => (
              <div key={t.id} className="pdb-column">
                <p className="pdb-text">{title}</p>
                <TerminalTable table={t} />
              </div>
            ))}
          </div>
        </>
      );
    case "F9":
      return <TerminalTable table={industriesTable(v, index, "pdb.f9")} onRow={onRow} />;
    case "F10":
      return (
        <>
          <FilterRow
            pickers={screenerPickers(v, index, industryOptions(v))}
            filter={filter}
            setFilter={setFilter}
            hint="Read-only filters. Right-click a row: load it."
          />
          <TerminalTable table={screenerTable(v, index, filter)} onRow={onRow} />
        </>
      );
  }
}

/** The function page with its own views and filter: a new function starts a new filter. */
function PageArea({
  route,
  index,
  onLoad,
}: {
  route: PdoombergRoute;
  index: NameIndex;
  onLoad: (id: CompanyId) => void;
}) {
  const sim = useSim();
  const v = usePageViews(FUNCTION_VIEWS[route.function], QUOTES_REFRESH_MS);
  const [filter, setFilter] = useState<Filter>({});
  const onRow = (cells: Cell[], button: number) => {
    const a = rowAction(route, cells, button, v.clock?.watchlist ?? []);
    if (!a) return;
    if (a.k === "load") onLoad(a.company);
    else void sim.control({ kind: a.add ? "WatchlistAdd" : "WatchlistRemove", company: a.company });
  };
  return (
    <div className="pdb-area">
      <FunctionPage route={route} v={v} index={index} filter={filter} setFilter={setFilter} onRow={onRow} />
    </div>
  );
}

/** The security line, on its own subscription (it moves every tick, paced). */
function SecurityLine({ company, index }: { company: CompanyId | null; index: NameIndex }) {
  const v = usePageViews(["quotes", "company_rows", "clock"], QUOTES_REFRESH_MS);
  if (company === null) return <div className="pdb-security" />;
  return <div className="pdb-security pdb-strong">{securityText(v, index, company)}</div>;
}

/** The status bar's clock and alert count. */
function Status() {
  const c = useClock();
  const notices = useNotices();
  const alerts = notices.filter((e) => e.notice.kind === "Alert" && e.notice.level !== "Log").length;
  return <span className="pdb-text small">{c ? statusLine(c, alerts) : ""}</span>;
}

/** The footer: each view's version and cadence. */
function Footer() {
  const { store } = useSim();
  // Re-read with the quotes (every tick, paced): the versions are plain numbers.
  usePageViews(["quotes"], QUOTES_REFRESH_MS);
  return (
    <div className="chip-row pdb-footer">
      {FOOTER_VIEWS.map((n) => {
        const view = store.getView(n);
        return (
          <span key={n} className="pdb-dim small">
            {view ? `${n}: version ${view.version} (${VIEW_SPECS[n].cadence})` : `${n}: not in the sim yet`}
          </span>
        );
      })}
    </div>
  );
}

export interface PdoombergProps {
  route: PdoombergRoute;
  onRoute: (r: PdoombergRoute) => void;
  /** Opens a page in the workspace; the terminal closes first (D517). */
  onOpenPage: (page: PageRef, target: OpenTarget) => void;
  onClose: () => void;
}

/** True when the keyboard belongs to a text field (the command bar). */
function typing(): boolean {
  const a = document.activeElement;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
}

function PdoombergInner({ route, onRoute, onOpenPage, onClose }: PdoombergProps) {
  const index = useNameIndex();
  // F2 to F10 open their pages, only while the terminal is open (D517) and not while the command
  // bar has the keyboard or a Ctrl, Alt or Meta chord is held. The browser's own F-key actions
  // (F5 reload, F3 find) are suppressed here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const f = functionOfKey(e.key);
      if (!f || e.ctrlKey || e.altKey || e.metaKey || typing()) return;
      e.preventDefault();
      if (f !== route.function) onRoute({ ...route, function: f });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route, onRoute]);
  const nav = useMemo<PageNav>(
    () => ({
      open: (page, target) => {
        onClose();
        onOpenPage(page, target);
      },
    }),
    [onClose, onOpenPage],
  );
  const load = (company: CompanyId) => onRoute({ ...route, company });
  return (
    <NavContext.Provider value={nav}>
      <div className="pdoomberg" role="dialog" aria-label="Pdoomberg">
        <div className="pdb-head">
          <span className="pdb-title">PDOOMBERG PROFESSIONAL</span>
          <span className="tone-green small">Accurate: published data</span>
          <span className="grow" />
          <Status />
        </div>
        <div className="pdb-rule" />
        <div className="pdb-head">
          <span className="pdb-text pdb-command">{commandLine(route, index)}</span>
          <span className="pdb-dim small">
            Ctrl+K: TICKER Fn (ARDR F3) | F2-F10 pages | Esc: back to the workspace
          </span>
        </div>
        <SecurityLine company={route.company} index={index} />
        <div className="pdb-rule" />
        {/* Keyed by the function: a new function is a new page (its filter resets); a new company
            keeps the page, except F3, which draws the company (mod.rs draw_page). */}
        <PageArea
          key={route.function === "F3" ? `F3/${route.company}` : route.function}
          route={route}
          index={index}
          onLoad={load}
        />
        <div className="pdb-rule" />
        <Footer />
        <div className="chip-row pdb-keys">
          {PDB_FUNCTIONS.map((f) => (
            <button
              type="button"
              key={f}
              className={f === route.function ? "pdb-key on" : "pdb-key"}
              aria-pressed={f === route.function}
              title={`${f} ${PDB_FUNCTION_NAME[f]} (${f})`}
              onClick={() => {
                if (f !== route.function) onRoute({ ...route, function: f });
              }}
            >
              {f} {PDB_FUNCTION_NAME[f].toUpperCase()}
            </button>
          ))}
          <button type="button" className="pdb-key" onClick={onClose}>
            ESC MAP
          </button>
        </div>
      </div>
    </NavContext.Provider>
  );
}

export const Pdoomberg = memo(PdoombergInner);
