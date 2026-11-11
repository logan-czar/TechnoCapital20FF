// The browser (pivot 15.3): an encyclopedia of public facts on the existing pages/ framework.
// It reads v_people, v_races, v_districts and the pre-pivot views. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "browser",
  title: "Browser",
  icon: "browser",
  Component: lazy(() => import("./BrowserApp.tsx")),
  defaultSize: { width: 1000, height: 720 },
  singleton: false,
};
