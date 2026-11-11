// Polls and the forecast site (pivot 8.4, 8.5): every published poll and the forecast by race,
// chamber and state.
// It reads v_polls, v_forecast and v_races. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "polls",
  title: "Polls",
  icon: "polls",
  Component: lazy(() => import("./PollsApp.tsx")),
  defaultSize: { width: 960, height: 680 },
  singleton: false,
};
