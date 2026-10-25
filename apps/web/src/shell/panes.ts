// The pane kinds a workspace can hold and how to open one. A pane is identified by its id
// (`kind` or `kind:param`), so opening it twice focuses the first.

import { createContext, useContext } from "react";
import type { PageRef } from "../widgets/cells.ts";

export type PaneKind =
  | "map"
  | "companies"
  | "chart"
  | "news"
  | "industries"
  | "countries"
  | "alerts"
  | "entity";

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

/** The pane of an entity page (a company, country, province or industry). */
export function pageSpec(page: PageRef, name: string): PaneSpec {
  return { id: `entity:${page.kind}:${page.id}`, kind: "entity", title: name, params: { page } };
}

export interface WorkspaceControl {
  open: (spec: PaneSpec) => void;
}

export const WorkspaceContext = createContext<WorkspaceControl>({ open: () => {} });

export function useWorkspace(): WorkspaceControl {
  return useContext(WorkspaceContext);
}
