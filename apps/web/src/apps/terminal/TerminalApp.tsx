// Pdoomberg as a windowed app (pivot 15.3): the amber terminal of pdoomberg/ filling its window,
// with this lane's two additions, the F4 Order ticket and the F8 Account page.
//
// pdoomberg/Pdoomberg.tsx was written as a full-screen overlay: it is pinned to the viewport by
// styles.css, listens for F2 to F10 on `window` whenever it is mounted, and has no command line
// of its own. It is embedded here without editing it (terminal.css un-pins it, and takes out its
// Esc line and close key), and its three assumptions are put right from outside:
//
// - Keys: the window keydown listener below runs first (capture). While this window is not the
//   focused one it stops an F2 to F10 key before Pdoomberg's own listener sees it; while it is
//   focused it handles F8, F4 from the Account page and "/" (the command line). It never touches
//   Space, 1 to 6 or ".", the taskbar's keys.
// - Route: the app's route is `page/<fn>[/<ticker>]` (route.ts); Pdoomberg's `PdoombergRoute` is
//   derived from it, and every change Pdoomberg makes is written back to it.
// - Pages: F4 and F8 are drawn by a portal into Pdoomberg's page area (`.pdb-area`), over its
//   locked F4 page. The smallest edits to pdoomberg/ that would remove this are in the report.

import "./terminal.css";
import type { CompanyId } from "@tc20ff/sim";
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OpenTarget } from "../../links/nav.ts";
import type { AppProps } from "../../os/apps.ts";
import { type PageRef, PDB_FUNCTIONS } from "../../pages/ref.ts";
import type { PdoombergRoute } from "../../pdoomberg/models.ts";
import { Pdoomberg } from "../../pdoomberg/Pdoomberg.tsx";
import { useViewData } from "../../sim/hooks.ts";
import { openEntity } from "../_shared/index.ts";
import { AccountPage } from "./AccountPage.tsx";
import { OrderTicket } from "./OrderTicket.tsx";
import {
  companySegment,
  formatTermRoute,
  HOME_ROUTE,
  parseCommand,
  parseTermRoute,
  pdbPageOf,
  resolveCompany,
  TERM_PAGE_NAME,
  type TermRoute,
} from "./route.ts";

/** True when this app's window is the focused one (os/Window.tsx `data-focused`); true outside a window. */
export function windowFocused(el: Element | null): boolean {
  const w = el?.closest("[data-focused]");
  return w === null || w === undefined ? true : w.getAttribute("data-focused") === "true";
}

function isTyping(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

/** A Pdoomberg function key with no Ctrl, Alt or Meta held: the keys its own listener takes. */
function isPdbKey(e: KeyboardEvent): boolean {
  return (PDB_FUNCTIONS as readonly string[]).includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey;
}

/** Where a link inside the terminal opens: a company or an industry in its home app; the rest nowhere. */
function openPage(page: PageRef, _target: OpenTarget): void {
  if (page.kind === "company") openEntity({ kind: "Company", id: page.id });
  else if (page.kind === "industry") openEntity({ kind: "Industry", id: page.id });
}

/** Back and forward through the routes this window has shown. */
function useRouteHistory(route: string | null, onRoute: (r: string | null) => void) {
  const current = route ?? formatTermRoute(HOME_ROUTE);
  const stack = useRef<string[]>([current]);
  const at = useRef(0);
  const [, bump] = useState(0);
  useEffect(() => {
    if (stack.current[at.current] === current) return;
    // A route nobody here asked for (a link, the taskbar) is a new step.
    stack.current = [...stack.current.slice(0, at.current + 1), current];
    at.current = stack.current.length - 1;
    bump((n) => n + 1);
  }, [current]);
  const step = useCallback(
    (d: -1 | 1) => {
      const to = at.current + d;
      const r = stack.current[to];
      if (r === undefined) return;
      at.current = to;
      bump((n) => n + 1);
      onRoute(r);
    },
    [onRoute],
  );
  return { canBack: at.current > 0, canForward: at.current < stack.current.length - 1, step };
}

export default function TerminalApp({ route, onRoute, setTitle }: AppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rows = useViewData("company_rows")?.rows;
  const parsed: TermRoute = useMemo(() => parseTermRoute(route) ?? HOME_ROUTE, [route]);
  const company: CompanyId | null = resolveCompany(parsed.company, rows);
  const history = useRouteHistory(route, onRoute);
  const [command, setCommand] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [area, setArea] = useState<HTMLElement | null>(null);

  // The newest of what the stable callbacks below read.
  const latest = useRef({ parsed, company, rows });
  latest.current = { parsed, company, rows };

  const go = useCallback(
    (r: TermRoute) => {
      const next = formatTermRoute(r);
      if (next !== formatTermRoute(latest.current.parsed)) onRoute(next);
    },
    [onRoute],
  );

  // What Pdoomberg changed (a function key, a right-click load) goes into the route.
  const onPdbRoute = useCallback(
    (r: PdoombergRoute) => {
      const { parsed: p, company: c, rows: all } = latest.current;
      let seg = p.company;
      if (r.company !== c) {
        const row = r.company === null ? undefined : all?.find((x) => x.id === r.company);
        seg = row === undefined ? null : companySegment(row);
      }
      go({ page: r.function, company: seg });
    },
    [go],
  );

  const pdbRoute: PdoombergRoute = useMemo(
    () => ({ function: pdbPageOf(parsed.page), company }),
    [parsed.page, company],
  );

  const title = `Pdoomberg - ${TERM_PAGE_NAME[parsed.page]}${parsed.company === null ? "" : ` ${parsed.company}`}`;
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);

  // F4 and F8 are drawn into Pdoomberg's page area once it exists for the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page area is rebuilt when the page changes
  useLayoutEffect(() => {
    setArea(rootRef.current?.querySelector<HTMLElement>(".pdb-area") ?? null);
  }, [parsed.page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!windowFocused(rootRef.current)) {
        // Not this window's keys: keep them from Pdoomberg's own listener.
        if (isPdbKey(e)) e.stopImmediatePropagation();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
      const { parsed: p } = latest.current;
      if (e.key === "F8") {
        e.preventDefault();
        go({ page: "F8", company: p.company });
      } else if (e.key === "F4" && p.page === "F8") {
        // Pdoomberg's own F4 handler sees no change (its page is F4 under the Account page).
        e.preventDefault();
        go({ page: "F4", company: p.company });
      } else if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = parseCommand(command, rows, parsed);
    if (!r.ok) {
      setProblem(r.message);
      return;
    }
    setProblem(null);
    setCommand("");
    inputRef.current?.blur();
    go(r.route);
  };

  const onCompany = useCallback(
    (seg: string | null) => go({ page: latest.current.parsed.page, company: seg }),
    [go],
  );

  const portal = area?.isConnected
    ? createPortal(
        parsed.page === "F8" ? (
          <AccountPage />
        ) : parsed.page === "F4" ? (
          <OrderTicket company={company} onCompany={onCompany} />
        ) : null,
        area,
      )
    : null;

  return (
    <div className="term-root" data-testid="app-root-terminal" data-page={parsed.page} ref={rootRef}>
      <div className="term-bar">
        <button
          type="button"
          className="term-btn"
          data-testid="term-back"
          aria-label="Back"
          disabled={!history.canBack}
          onClick={() => history.step(-1)}
        >
          {"<"}
        </button>
        <button
          type="button"
          className="term-btn"
          data-testid="term-forward"
          aria-label="Forward"
          disabled={!history.canForward}
          onClick={() => history.step(1)}
        >
          {">"}
        </button>
        <form className="term-command" onSubmit={submit}>
          <label>
            <span className="term-prompt">CMD</span>
            <input
              ref={inputRef}
              data-testid="term-command"
              value={command}
              placeholder="TICKER Fn  (press / to type)"
              onChange={(e) => {
                setCommand(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") inputRef.current?.blur();
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </form>
        {problem !== null && (
          <span className="term-error" role="alert" data-testid="term-command-error">
            {problem}
          </span>
        )}
        <span className="term-grow" />
        <button
          type="button"
          className={parsed.page === "F8" ? "term-btn on" : "term-btn"}
          data-testid="term-account-tab"
          aria-pressed={parsed.page === "F8"}
          title="F8 Account"
          onClick={() => go({ page: "F8", company: parsed.company })}
        >
          F8 ACCOUNT
        </button>
      </div>
      <Pdoomberg route={pdbRoute} onRoute={onPdbRoute} onOpenPage={openPage} onClose={noop} />
      {portal}
    </div>
  );
}

function noop(): void {}
