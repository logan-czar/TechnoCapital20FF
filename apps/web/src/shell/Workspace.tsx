// The tiling-pane workspace (m9-plan: Logan's choice of a wiki-like workspace; crates/game/src/
// workspace, D450): dockview holds the panes, new panes split beside the active one, and the layout
// persists in localStorage. Fixed panes open by command (`WorkspaceControl.open`); pages open in
// page panes (`openPage`), each with its own history. The history keys act on the focused page
// pane: Alt+Left or Backspace goes back, Alt+Right forward.

import "dockview-react/dist/styles/dockview.css";
import {
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import { type FunctionComponent, lazy, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { HoverCards } from "../links/Link.tsx";
import { NavContext, type PageNav } from "../links/nav.ts";
import { historyFromSaved, historyNew, historyToSaved } from "../pages/history.ts";
import { PagePane } from "../pages/PagePane.tsx";
import { type PageRef, pageEq } from "../pages/ref.ts";
import { AlertsPane } from "../panes/AlertsPane.tsx";
import { CompaniesPane } from "../panes/CompaniesPane.tsx";
import { CountriesPane, IndustriesPane } from "../panes/ListPanes.tsx";
import { NewsPane } from "../panes/NewsPane.tsx";
import {
  FIXED_PANES,
  type PaneHandle,
  type PaneKind,
  type PaneSpec,
  WorkspaceContext,
  type WorkspaceControl,
} from "./panes.ts";

/** v2: the page panes replaced v1's entity panes, so a v1 layout is not read. */
export const LAYOUT_KEY = "tc20ff.layout.v2";
const SAVE_DEBOUNCE_MS = 300;
/** Most panes open at once (workspace/model.rs MAX_PANES, D450): more would be too small to read. */
export const MAX_PANES = 12;

type PaneProps = IDockviewPanelProps;

// The map (deck.gl) and the chart (lightweight-charts) are the heavy panes: their code loads when the
// first one opens, not with the page.
const MapPane = lazy(() => import("../panes/MapPane.tsx").then((m) => ({ default: m.MapPane })));
const ChartPane = lazy(() => import("../panes/ChartPane.tsx").then((m) => ({ default: m.ChartPane })));
const loading = <p className="center">Loading...</p>;

/** Each pane kind as a dockview component. */
const COMPONENTS: Record<PaneKind, FunctionComponent<PaneProps>> = {
  map: () => (
    <Suspense fallback={loading}>
      <MapPane />
    </Suspense>
  ),
  companies: () => <CompaniesPane />,
  chart: ({ params }) => (
    <Suspense fallback={loading}>
      <ChartPane company={typeof params.company === "number" ? params.company : null} />
    </Suspense>
  ),
  news: () => <NewsPane />,
  industries: () => <IndustriesPane />,
  countries: () => <CountriesPane />,
  alerts: () => <AlertsPane />,
  page: (props) => <PagePane {...props} />,
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/**
 * A saved layout we trust to hand to dockview: its panels name known components and a page pane
 * holds a history. Anything else (an old build, a hand-edited value) is dropped for the default.
 */
export function isLayout(x: unknown): x is SerializedDockview {
  if (!isRecord(x) || !isRecord(x.grid) || !isRecord(x.panels)) return false;
  const known = new Set<string>(Object.keys(COMPONENTS));
  return Object.values(x.panels).every((p) => {
    if (!isRecord(p) || typeof p.contentComponent !== "string" || !known.has(p.contentComponent))
      return false;
    if (p.contentComponent !== "page") return true;
    return isRecord(p.params) && historyFromSaved(p.params.history) !== null;
  });
}

function readLayout(): unknown {
  try {
    const s = localStorage.getItem(LAYOUT_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function writeLayout(api: DockviewApi): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON()));
  } catch {
    // Storage can be blocked or full; the workspace works without it.
  }
}

/** Where a new pane goes: beside the active one, alternating right and below so panes tile. */
function position(api: DockviewApi) {
  const ref = api.activePanel;
  const direction = api.panels.length % 2 === 1 ? ("right" as const) : ("below" as const);
  return ref ? { position: { referencePanel: ref, direction } } : {};
}

function openIn(api: DockviewApi, spec: PaneSpec): void {
  const existing = api.getPanel(spec.id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  api.addPanel({
    id: spec.id,
    component: spec.kind,
    title: spec.title,
    params: spec.params ?? {},
    ...(spec.kind === "map" ? { renderer: "always" as const } : {}),
    ...position(api),
  });
}

/** The default layout: the map alone, as before the shell (map-first, 11-ui). */
function defaultLayout(api: DockviewApi): void {
  const map = FIXED_PANES.find((p) => p.kind === "map");
  if (!map) return;
  // Always rendered: hiding the map behind a tab would drop its WebGL context.
  api.addPanel({ id: map.id, component: map.kind, title: map.title, renderer: "always" });
}

/** True while the keyboard is in a text field (the history keys then edit text). */
function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return (
    !!t &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
  );
}

export function Workspace({ onControl }: { onControl: (c: WorkspaceControl) => void }) {
  const apiRef = useRef<DockviewApi | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panes = useRef(new Map<string, PaneHandle>());
  const nextId = useRef(1);

  const persist = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => writeLayout(api), SAVE_DEBOUNCE_MS);
  }, []);

  /** The page pane focused last (the map or a table pane may be active since). */
  const lastPage = useRef<string | null>(null);

  /**
   * The focused page pane: the active panel when it is one, else the page pane focused last
   * (Rust's workspace always had a focused page pane; here the map is a pane too).
   */
  const focusedPane = useCallback((): PaneHandle | undefined => {
    const id = apiRef.current?.activePanel?.id;
    const active = id === undefined ? undefined : panes.current.get(id);
    if (active) return active;
    return lastPage.current === null ? undefined : panes.current.get(lastPage.current);
  }, []);

  const control = useMemo<WorkspaceControl>(() => {
    const addPage = (api: DockviewApi, page: PageRef) => {
      if (api.panels.length >= MAX_PANES) {
        // Full: the focused page pane takes it instead (or nothing, with no page pane focused).
        focusedPane()?.open(page);
        return;
      }
      let id = `page-${nextId.current++}`;
      while (api.getPanel(id)) id = `page-${nextId.current++}`;
      const focused = api.activePanel;
      api.addPanel({
        id,
        component: "page",
        title: page.kind,
        params: { history: historyToSaved(historyNew(page)) },
        ...position(api),
      });
      // A new pane leaves the focus where it was (workspace.rs, D450).
      focused?.api.setActive();
      // With no page pane to focus yet, the new one is where the next "focused" page goes.
      if (!focusedPane()) lastPage.current = id;
    };
    return {
      open: (spec) => {
        if (apiRef.current) openIn(apiRef.current, spec);
      },
      openPage: (page, target) => {
        const api = apiRef.current;
        if (!api) return;
        if (target === "focused") {
          const pane = focusedPane();
          if (pane) {
            pane.open(page);
            return;
          }
          // No page pane focused (the map is): a pane already showing the page, else a new one.
          for (const [id, h] of panes.current) {
            if (pageEq(h.current(), page)) {
              api.getPanel(id)?.api.setActive();
              return;
            }
          }
        }
        addPage(api, page);
      },
      registerPane: (id, handle) => {
        panes.current.set(id, handle);
        return () => {
          if (panes.current.get(id) === handle) panes.current.delete(id);
        };
      },
      persist,
      layout: () => apiRef.current?.toJSON() ?? null,
      restore: (layout) => {
        const api = apiRef.current;
        if (!api || !isLayout(layout)) return false;
        try {
          api.fromJSON(layout);
          return true;
        } catch {
          return false;
        }
      },
    };
  }, [persist, focusedPane]);

  useEffect(() => onControl(control), [control, onControl]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  // Back and forward in the focused pane (workspace.rs SHORTCUTS).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || typing(e) || e.ctrlKey || e.metaKey) return;
      const pane = focusedPane();
      if (!pane) return;
      if ((e.altKey && e.key === "ArrowLeft") || (!e.altKey && !e.shiftKey && e.key === "Backspace")) {
        e.preventDefault();
        pane.back();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        pane.forward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedPane]);

  const onReady = useCallback(
    (e: DockviewReadyEvent) => {
      const api = e.api;
      apiRef.current = api;
      const saved = readLayout();
      let restored = false;
      if (saved) {
        try {
          if (isLayout(saved)) {
            api.fromJSON(saved);
            restored = api.panels.length > 0;
          }
        } catch {
          api.clear();
        }
      }
      if (!restored) defaultLayout(api);
      api.onDidLayoutChange(persist);
      api.onDidActivePanelChange((ev) => {
        const id = ev.panel?.id;
        if (id !== undefined && panes.current.has(id)) lastPage.current = id;
      });
    },
    [persist],
  );

  // Links outside a page pane (the table panes, the map) open through the workspace.
  const nav = useMemo<PageNav>(() => ({ open: control.openPage }), [control]);

  return (
    <WorkspaceContext.Provider value={control}>
      <NavContext.Provider value={nav}>
        <HoverCards>
          <DockviewReact className="dockview-theme-tc" components={COMPONENTS} onReady={onReady} />
        </HoverCards>
      </NavContext.Provider>
    </WorkspaceContext.Provider>
  );
}
