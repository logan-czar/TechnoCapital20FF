// The social feed (pivot 8.3): handles, posts and rumours; the player follows accounts.
// It reads v_social. A placeholder from the M2 contracts change (D1037): the app's lane owns this
// folder and replaces the component; the spec's id stays.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "social",
  title: "Social",
  icon: "feed",
  Component: lazy(() => import("./SocialApp.tsx")),
  defaultSize: { width: 520, height: 720 },
  singleton: false,
  PhoneView: lazy(() => import("./SocialAppPhone.tsx")),
};
