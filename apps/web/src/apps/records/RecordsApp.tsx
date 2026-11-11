// The Records app: "Ledger of Record", the republic's official public records (pivot 8.6, 15.3).
// A masthead, a section bar with back and forward, and one page at a time; the page is the app's
// route (route.ts), so a link, a saved desktop or the window manager can open any of them.

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppProps } from "../../os/apps.ts";
import { BillPage, BillsPage, RollCallPage } from "./bills.tsx";
import { NavContext, NotOnRecord, type RecordsNav } from "./common.tsx";
import { ExecPage } from "./exec.tsx";
import { FinancePage, FinancePersonPage, FinanceRacePage } from "./finance.tsx";
import { HomePage } from "./home.tsx";
import { DistrictsPage, OfficialsPage } from "./officials.tsx";
import { ResultsPage, ResultsRacePage } from "./results.tsx";
import { formatRoute, NO_FILTER, parseRoute, type RecordsRoute } from "./route.ts";
import "./records.css";

/** The sections of the bar, and the pages each one holds. */
const SECTIONS: { label: string; to: RecordsRoute; pages: RecordsRoute["page"][] }[] = [
  { label: "Home", to: { page: "home" }, pages: ["home"] },
  { label: "Bills", to: { page: "bills", filter: NO_FILTER }, pages: ["bills", "bill", "rollcall"] },
  { label: "Executive", to: { page: "exec", kind: null }, pages: ["exec"] },
  { label: "Campaign finance", to: { page: "finance" }, pages: ["finance", "financeRace", "financePerson"] },
  { label: "Election results", to: { page: "results", cycle: null }, pages: ["results", "resultsRace"] },
  { label: "Officeholders", to: { page: "officials", chamber: "House" }, pages: ["officials"] },
  { label: "District plans", to: { page: "districts", state: null }, pages: ["districts"] },
];

function norm(route: string | null): string | null {
  return route === null || route === "" || route === "home" ? null : route;
}

interface History {
  stack: (string | null)[];
  at: number;
}

function PageFor({ route }: { route: RecordsRoute }): ReactNode {
  switch (route.page) {
    case "home":
      return <HomePage />;
    case "bills":
      return <BillsPage filter={route.filter} />;
    case "bill":
      return <BillPage id={route.id} />;
    case "rollcall":
      return <RollCallPage id={route.id} />;
    case "exec":
      return <ExecPage kind={route.kind} />;
    case "finance":
      return <FinancePage />;
    case "financeRace":
      return <FinanceRacePage id={route.id} />;
    case "financePerson":
      return <FinancePersonPage id={route.id} />;
    case "results":
      return <ResultsPage cycle={route.cycle} />;
    case "resultsRace":
      return <ResultsRacePage id={route.id} />;
    case "officials":
      return <OfficialsPage chamber={route.chamber} />;
    case "districts":
      return <DistrictsPage state={route.state} />;
    case "unknown":
      return <NotOnRecord what={`The page "${route.route}"`} />;
  }
}

export default function RecordsApp({ route, onRoute, setTitle }: AppProps) {
  const [hist, setHist] = useState<History>(() => ({ stack: [norm(route)], at: 0 }));
  // What this app last wrote to the window manager: a route that differs came from outside.
  const emitted = useRef<string | null>(norm(route));
  useEffect(() => {
    const r = norm(route);
    if (r === emitted.current) return;
    emitted.current = r;
    setHist((h) => ({ stack: [...h.stack.slice(0, h.at + 1), r], at: h.at + 1 }));
  }, [route]);

  const write = useCallback(
    (r: RecordsRoute, replace: boolean) => {
      const s = norm(formatRoute(r));
      if (s === emitted.current) return;
      emitted.current = s;
      setHist((h) =>
        replace
          ? { stack: h.stack.map((x, i) => (i === h.at ? s : x)), at: h.at }
          : { stack: [...h.stack.slice(0, h.at + 1), s], at: h.at + 1 },
      );
      onRoute(s);
    },
    [onRoute],
  );
  const nav = useMemo<RecordsNav>(
    () => ({ go: (r) => write(r, false), replace: (r) => write(r, true), setTitle }),
    [write, setTitle],
  );
  const step = (by: -1 | 1) => {
    const at = hist.at + by;
    if (at < 0 || at >= hist.stack.length) return;
    const target = hist.stack[at] ?? null;
    emitted.current = target;
    setHist({ stack: hist.stack, at });
    onRoute(target);
  };

  const current = hist.stack[hist.at] ?? null;
  const parsed = parseRoute(current);
  const main = useRef<HTMLDivElement>(null);
  // A new page (not a new filter on the same page) starts at its top.
  const pathKey = (current ?? "").split("?")[0];
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pathKey` is the trigger
  useEffect(() => {
    main.current?.scrollTo?.({ top: 0 });
  }, [pathKey]);

  return (
    <div className="rec-root" data-testid="app-root-records">
      <header className="rec-masthead">
        <div className="rec-seal" aria-hidden="true">
          LR
        </div>
        <div className="rec-brand">
          <p className="rec-name">Ledger of Record</p>
          <p className="rec-tag">Official public records of the Republic</p>
        </div>
        <div className="rec-history">
          <button
            type="button"
            className="rec-button"
            data-testid="records-back"
            disabled={hist.at === 0}
            onClick={() => step(-1)}
            aria-label="Back"
          >
            {"←"}
          </button>
          <button
            type="button"
            className="rec-button"
            data-testid="records-forward"
            disabled={hist.at >= hist.stack.length - 1}
            onClick={() => step(1)}
            aria-label="Forward"
          >
            {"→"}
          </button>
        </div>
      </header>
      <nav className="rec-nav" aria-label="Sections">
        {SECTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`rec-tab${s.pages.includes(parsed.page) ? " active" : ""}`}
            aria-current={s.pages.includes(parsed.page) ? "page" : undefined}
            data-testid={`tab-${s.to.page}`}
            onClick={() => nav.go(s.to)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="rec-main" ref={main}>
        <NavContext.Provider value={nav}>
          <PageFor route={parsed} />
        </NavContext.Provider>
      </div>
    </div>
  );
}
