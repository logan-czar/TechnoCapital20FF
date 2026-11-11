// The USA map (pivot 15.3): states, counties and districts with deck.gl, and live returns.
// It reads v_usmap_layers, v_districts and v_returns. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "usmap",
  title: "USA map",
  icon: "map",
  Component: lazy(() => import("./UsMapApp.tsx")),
  defaultSize: { width: 1100, height: 720 },
  singleton: true,
};
