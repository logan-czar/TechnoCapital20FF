// The official records site (pivot 8.6): bills, roll calls, executive actions, filings, certified
// results and district maps.
// It reads v_records, v_returns and v_districts. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "records",
  title: "Records",
  icon: "records",
  Component: lazy(() => import("./RecordsApp.tsx")),
  defaultSize: { width: 980, height: 700 },
  singleton: false,
};
