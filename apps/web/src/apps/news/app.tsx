// The news app (pivot 8.2, 8.7, 8.8): outlets, articles and each morning's front pages.
// It reads v_feed. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "news",
  title: "News",
  icon: "news",
  Component: lazy(() => import("./NewsApp.tsx")),
  defaultSize: { width: 900, height: 680 },
  singleton: false,
  PhoneView: lazy(() => import("./NewsAppPhone.tsx")),
};
