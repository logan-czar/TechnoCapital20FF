// The pane kinds a workspace can hold and how to open one. A fixed pane is identified by its id
// (`kind`), so opening it twice focuses the first. Pages open in page panes (pages/PagePane.tsx),
// each with its own history; `openPage` routes a page to the focused page pane or a new one
// (D450: click opens in the focused pane, Shift+click or middle click in a new pane).

import { createContext, useContext } from "react";
import type { OpenTarget } from "../links/nav.ts";
import type { PageRef } from "../pages/ref.ts";

export type PaneKind =
  | "map"
  | "companies"
  | "chart"
  | "news"
  | "industries"
  | "countries"
  | "alerts"
  | "page";

export interface PaneSpec {
  id: string;
  kind: PaneKind;
  title: string;
  params?: Record<string, unknown>;
}

/** The fixed panes, as the command bar lists them. */
export const FIXED_PANES: readonly PaneSpec[] = [
  { id: "map", kind: "map", title: "Map" },
  { id: "companies", kind: "companies", title: "Companies" },
  { id: "chart", kind: "chart", title: "Price chart" },
  { id: "news", kind: "news", title: "Pdoomberg Wire" },
  { id: "industries", kind: "industries", title: "Industries" },
  { id: "countries", kind: "countries", title: "Countries" },
  { id: "alerts", kind: "alerts", title: "Alerts" },
];

/** What a page pane lets the workspace do to it. */
export interface PaneHandle {
  /** Opens a page in the pane (its history moves on). */
  open: (page: PageRef) => void;
  back: () => void;
  forward: () => void;
  current: () => PageRef;
}

export interface WorkspaceControl {
  /** Opens (or focuses) a fixed pane. */
  open: (spec: PaneSpec) => void;
  /** Opens a page: "focused" in the focused page pane (or one showing it), "new" in a new pane. */
  openPage: (page: PageRef, target: OpenTarget) => void;
  /** A page pane registers itself while mounted; the call returns its unregister. */
  registerPane: (id: string, handle: PaneHandle) => () => void;
  /** Saves the layout soon (a pane's params changed). */
  persist: () => void;
  /** The workspace as dockview serializes it (a saved layout). */
  layout: () => unknown;
  /** Replaces the workspace with a saved layout; false when it does not load. */
  restore: (layout: unknown) => boolean;
}

const NONE: WorkspaceControl = {
  open: () => {},
  openPage: () => {},
  registerPane: () => () => {},
  persist: () => {},
  layout: () => null,
  restore: () => false,
};

export const WorkspaceContext = createContext<WorkspaceControl>(NONE);

export function useWorkspace(): WorkspaceControl {
  return useContext(WorkspaceContext);
}
