// The tiling-pane workspace (m9-plan: Logan's choice of a wiki-like workspace): dockview holds the
// panes, new panes split beside the active one, and the layout persists in localStorage. Panes open
// by command (the command bar, links in tables) through `WorkspaceControl.open`.

import "dockview-react/dist/styles/dockview.css";
import {
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";
import { type FunctionComponent, useCallback, useEffect, useMemo, useRef } from "react";
import { AlertsPane } from "../panes/AlertsPane.tsx";
import { ChartPane } from "../panes/ChartPane.tsx";
import { CompaniesPane } from "../panes/CompaniesPane.tsx";
import { EntityPane } from "../panes/EntityPane.tsx";
import { CountriesPane, IndustriesPane } from "../panes/ListPanes.tsx";
import { MapPane } from "../panes/MapPane.tsx";
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

/** Each pane kind as a dockview component. */
const COMPONENTS: Record<PaneKind, FunctionComponent<PaneProps>> = {
  map: () => <MapPane />,
  companies: () => <CompaniesPane />,
  chart: ({ params }) => <ChartPane company={typeof params.company === "number" ? params.company : null} />,
  news: () => <NewsPane />,
  industries: () => <IndustriesPane />,
  countries: () => <CountriesPane />,
  alerts: () => <AlertsPane />,
  entity: ({ params }) => <EntityPane page={params.page as PageRef} />,
};

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
    ...(ref ? { position: { referencePanel: ref, direction } } : {}),
  });
}

/** The default layout: the map alone, as before the shell (map-first, 11-ui). */
function defaultLayout(api: DockviewApi): void {
  const map = FIXED_PANES[0] as PaneSpec;
  api.addPanel({ id: map.id, component: map.kind, title: map.title });
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
        api.fromJSON(saved as Parameters<DockviewApi["fromJSON"]>[0]);
        restored = api.panels.length > 0;
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
