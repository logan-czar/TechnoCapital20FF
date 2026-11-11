// The debug workspace (pivot 15.3): the tiling-pane workspace the game had before the desktop,
// with its panes, pages, command bar and Pdoomberg, in one large window. It is debug-only (D1050):
// the desktop lists it, and draws its window, only while the Omniscient toggle is on.

import { lazy } from "react";
import type { AppSpec } from "../../os/apps.ts";

export const app: AppSpec = {
  id: "debug",
  title: "Debug workspace",
  icon: "debug",
  Component: lazy(() => import("./DebugWorkspace.tsx")),
  // Large: the workspace was the whole screen. The window manager fits it to a smaller desktop.
  defaultSize: { width: 1560, height: 900 },
  singleton: true,
  debugOnly: true,
};
