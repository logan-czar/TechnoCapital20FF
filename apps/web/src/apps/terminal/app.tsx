// The Pdoomberg terminal (pivot 15.3) as a windowed app.
// It reads the pre-pivot market views. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "terminal",
  title: "Pdoomberg",
  icon: "terminal",
  Component: lazy(() => import("./TerminalApp.tsx")),
  defaultSize: { width: 1200, height: 760 },
  singleton: true,
};
