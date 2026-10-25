// A page pane (crates/game/src/workspace/mod.rs, D450): one dockview panel showing a page, with
// its own back and forward history (history.ts) and a breadcrumb of the pages behind it. Links on
// the page open in this pane (the pane clicked is the focused one); Shift+click and middle click
// open a new pane. The history lives in the panel's params, so a saved layout restores it.
//
// The body is the page kind's registered page (registry.ts), read from the views its spec names;
// a kind with no page yet shows the pending page. A page should draw in under PAGE_BUDGET_MS
// (the plan's 100 ms open budget); in development a slower doc build is logged.

import type { IDockviewPanelProps } from "dockview-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiConfig } from "../config/hooks.ts";
import { type NameIndex, useNameIndex } from "../links/names.ts";
import { NavContext, type OpenTarget, type PageNav } from "../links/nav.ts";
import { useWorkspace } from "../shell/panes.ts";
import { DocView } from "./DocView.tsx";
import {
  type History,
  historyBack,
  historyBackTo,
  historyForward,
  historyFromSaved,
  historyNew,
  historyOpen,
  historyToSaved,
} from "./history.ts";
import { PendingPage } from "./PendingPage.tsx";
import { kindTag, type PageRef, pageId } from "./ref.ts";
import { pageSpecOf } from "./registry.ts";
import type { AnyPageSpec } from "./spec.ts";
import { usePageViews } from "./views.ts";

/** The open budget per page, in ms (ts-migration-plan Step 5: each screen < 100 ms). */
export const PAGE_BUDGET_MS = 100;
/** Pages of the back list the breadcrumb shows. */
export const CRUMBS = 4;

/** The body of a registered page: its views, its doc or component, its sections. */
function RegisteredPage({ spec, page, index }: { spec: AnyPageSpec; page: PageRef; index: NameIndex }) {
  const views = usePageViews(spec.views);
  const config = useUiConfig();
  const doc = useMemo(() => {
    if (!spec.doc) return null;
    const t0 = performance.now();
    const d = spec.doc(page, views, index);
    const ms = performance.now() - t0;
    if (import.meta.env?.DEV && ms > PAGE_BUDGET_MS) {
      console.warn(`page ${page.kind}: doc built in ${ms.toFixed(0)} ms (budget ${PAGE_BUDGET_MS} ms)`);
    }
    return d;
  }, [spec, page, views, index]);
  if (doc)
    return (
      <DocView doc={doc} views={views} sections={spec.sections} {...(spec.tabs ? { tabs: true } : {})} />
    );
  const C = spec.Component;
  return C ? <C page={page} views={views} index={index} config={config} /> : null;
}

/** The page body for `page`: its registered page, or the pending page. */
export function PageBody({ page }: { page: PageRef }) {
  const index = useNameIndex();
  const spec = pageSpecOf(page.kind);
  // Keyed by the page: another page is a fresh body (its table sorts and scroll reset).
  return spec ? (
    <RegisteredPage key={pageId(page)} spec={spec} page={page} index={index} />
  ) : (
    <PendingPage page={page} index={index} />
  );
}

/** The history bar: back, forward, the breadcrumb and the page's tag. */
function HistoryBar({
  history,
  index,
  go,
}: {
  history: History;
  index: NameIndex;
  go: (h: History) => void;
}) {
  const from = Math.max(0, history.back.length - CRUMBS);
  return (
    <div className="toolbar history">
      <button
        type="button"
        disabled={history.back.length === 0}
        title="Back (Alt+Left, Backspace)"
        aria-label="Back"
        onClick={() => go(historyBack(history))}
      >
        {"<"}
      </button>
      <button
        type="button"
        disabled={history.forward.length === 0}
        title="Forward (Alt+Right)"
        aria-label="Forward"
        onClick={() => go(historyForward(history))}
      >
        {">"}
      </button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {from > 0 && <span className="muted">...</span>}
        {history.back.slice(from).map((p, j) => {
          const i = from + j;
          return (
            <span key={`${i}-${pageId(p)}`}>
              <button
                type="button"
                className="linkbtn small"
                title={`Back to ${index.title(p)}`}
                onClick={() => go(historyBackTo(history, i))}
              >
                {index.title(p)}
              </button>
              <span className="muted"> / </span>
            </span>
          );
        })}
        <span className="tag">{kindTag(history.current.kind)}</span>{" "}
        <span>{index.title(history.current)}</span>
      </nav>
    </div>
  );
}

/** Params a page panel carries. */
export interface PagePaneParams {
  history?: unknown;
}

function PagePaneInner({ api, params }: IDockviewPanelProps<PagePaneParams>) {
  const ws = useWorkspace();
  const index = useNameIndex();
  const [history, setHistory] = useState<History>(
    () => historyFromSaved(params.history) ?? historyNew({ kind: "world" }),
  );
  const ref = useRef(history);
  ref.current = history;
  const go = useCallback(
    (h: History) => {
      if (h === ref.current) return;
      ref.current = h;
      setHistory(h);
      api.updateParameters({ history: historyToSaved(h) });
      ws.persist();
    },
    [api, ws],
  );
  // The workspace routes "focused" opens and the history keys to the focused pane through this.
  useEffect(
    () =>
      ws.registerPane(api.id, {
        open: (p) => go(historyOpen(ref.current, p)),
        back: () => go(historyBack(ref.current)),
        forward: () => go(historyForward(ref.current)),
        current: () => ref.current.current,
      }),
    [ws, api, go],
  );
  const title = index.title(history.current);
  useEffect(() => {
    if (api.title !== title) api.setTitle(title);
  }, [api, title]);
  const nav = useMemo<PageNav>(
    () => ({
      open: (p: PageRef, target: OpenTarget) =>
        target === "focused" ? go(historyOpen(ref.current, p)) : ws.openPage(p, "new"),
    }),
    [go, ws],
  );
  return (
    <NavContext.Provider value={nav}>
      <div className="pane page-pane">
        <HistoryBar history={history} index={index} go={go} />
        <div className="scroll page-body">
          <PageBody page={history.current} />
        </div>
      </div>
    </NavContext.Provider>
  );
}

export const PagePane = memo(PagePaneInner);
