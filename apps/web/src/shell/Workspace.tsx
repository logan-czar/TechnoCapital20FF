// The tiling-pane workspace (m9-plan: Logan's choice of a wiki-like workspace): dockview holds the
// panes, new panes split beside the active one, and the layout persists in localStorage. Panes open
// by command (the command bar, links in tables) through `WorkspaceControl.open`.

import "dockview-react/dist/styles/dockview.css";
import {
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import { type FunctionComponent, lazy, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { AlertsPane } from "../panes/AlertsPane.tsx";
import { CompaniesPane } from "../panes/CompaniesPane.tsx";
import { EntityPane } from "../panes/EntityPane.tsx";
import { CountriesPane, IndustriesPane } from "../panes/ListPanes.tsx";
import { NewsPane } from "../panes/NewsPane.tsx";
import type { PageRef } from "../widgets/cells.ts";
import {
  FIXED_PANES,
  type PaneKind,
  type PaneSpec,
  WorkspaceContext,
  type WorkspaceControl,
} from "./panes.ts";

export const LAYOUT_KEY = "tc20ff.layout.v1";
const SAVE_DEBOUNCE_MS = 300;

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
  entity: ({ params }) =>
    isPageRef(params.page) ? <EntityPane page={params.page} /> : <p className="center">No such page.</p>,
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

function isPageRef(x: unknown): x is PageRef {
  return (
    isRecord(x) &&
    typeof x.id === "number" &&
    (x.kind === "company" || x.kind === "country" || x.kind === "province" || x.kind === "industry")
  );
}

/**
 * A saved layout we trust to hand to dockview: its panels name known components and an entity pane
 * names a real page. Anything else (an old build, a hand-edited value) is dropped for the default.
 */
function isLayout(x: unknown): x is SerializedDockview {
  if (!isRecord(x) || !isRecord(x.grid) || !isRecord(x.panels)) return false;
  const known = new Set<string>(Object.keys(COMPONENTS));
  return Object.values(x.panels).every((p) => {
    if (!isRecord(p) || typeof p.contentComponent !== "string" || !known.has(p.contentComponent))
      return false;
    if (p.contentComponent !== "entity") return true;
    return isRecord(p.params) && isPageRef(p.params.page);
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

function openIn(api: DockviewApi, spec: PaneSpec): void {
  const existing = api.getPanel(spec.id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const ref = api.activePanel;
  // Alternate right and below so panes tile instead of piling into tabs.
  const direction = api.panels.length % 2 === 1 ? "right" : "below";
  api.addPanel({
    id: spec.id,
    component: spec.kind,
    title: spec.title,
    params: spec.params ?? {},
    ...(spec.kind === "map" ? { renderer: "always" as const } : {}),
    ...(ref ? { position: { referencePanel: ref, direction } } : {}),
  });
}

/** The default layout: the map alone, as before the shell (map-first, 11-ui). */
function defaultLayout(api: DockviewApi): void {
  const map = FIXED_PANES.find((p) => p.kind === "map");
  if (!map) return;
  // Always rendered: hiding the map behind a tab would drop its WebGL context.
  api.addPanel({ id: map.id, component: map.kind, title: map.title, renderer: "always" });
}

export function Workspace({ onControl }: { onControl: (c: WorkspaceControl) => void }) {
  const apiRef = useRef<DockviewApi | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const control = useMemo<WorkspaceControl>(
    () => ({
      open: (spec) => {
        if (apiRef.current) openIn(apiRef.current, spec);
      },
    }),
    [],
  );
  useEffect(() => onControl(control), [control, onControl]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const onReady = useCallback((e: DockviewReadyEvent) => {
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
    api.onDidLayoutChange(() => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => writeLayout(api), SAVE_DEBOUNCE_MS);
    });
  }, []);

  return (
    <WorkspaceContext.Provider value={control}>
      <DockviewReact className="dockview-theme-tc" components={COMPONENTS} onReady={onReady} />
    </WorkspaceContext.Provider>
  );
}
