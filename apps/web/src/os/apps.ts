// The desktop's app registry (pivot 15.2, 15.3): each app of the fake operating system registers
// what it is called, how big its window opens and what draws it. One folder per app under
// ../apps/, whose `app.tsx` exports `app` (an AppSpec); every such file is picked up here by Vite's
// glob import, so adding an app touches no shared file (the pattern of pages/registry.ts).
//
// An `app.tsx` holds only the spec: it names its components with `lazy(() => import("./X.tsx"))`,
// so the registry loads with the shell and an app's code loads when its window first opens. It
// imports this file for the types only (`import type`), never for a value, since this file
// imports it.
//
// The M2 contracts change (D1037) put a placeholder app in each M2 app lane's folder (news, social,
// polls, records, browser, usmap, terminal) and the helpers they share in ../apps/_shared/; each
// lane edits only its own folder.

import type { EntityRef } from "@tc20ff/sim";
import type { ComponentType, LazyExoticComponent } from "react";

/** What an app's window (or its phone view) is given. */
export interface AppProps {
  /**
   * Where in the app to open: the app's own path ("race/12", "contract/7"), or null for its home.
   * `entityRoute` writes the path of a thing an `EntityRef` names. A window keeps its route as it
   * is navigated, so the window manager can restore it.
   */
  route: string | null;
  /** Tells the window manager the route changed inside the app. */
  onRoute: (route: string | null) => void;
  /** Closes the app's window (D1037). On the phone it goes back to the phone's home. */
  close: () => void;
  /**
   * Sets the window's title, shown in place of `AppSpec.title` ("Ohio Senate - Polls"); null goes
   * back to the app's own (D1037). The phone shows no title.
   */
  setTitle: (title: string | null) => void;
}

/** A lazily loaded app component. */
export type AppComponent = LazyExoticComponent<ComponentType<AppProps>>;

/** What an app registers. */
export interface AppSpec {
  /** Its name in a saved desktop and in `openApp` ("news", "betting"): lower case, no spaces. */
  id: string;
  /** The window title and the taskbar label. */
  title: string;
  /** Its icon: the name of a glyph in the desktop's icon set (lane U2 owns the set). */
  icon: string;
  /** Draws the window's content. */
  Component: AppComponent;
  /** The size a new window opens at, in CSS pixels. */
  defaultSize: { width: number; height: number };
  /** At most one window: opening it again focuses that window and sets its route. */
  singleton: boolean;
  /** Listed only with the Omniscient debug toggle (pivot 15.3: the debug workspace). */
  debugOnly?: boolean;
  /** Its compact form on the phone (pivot 15.2); an app without one is not on the phone. */
  PhoneView?: AppComponent;
}

/** An app file: ../apps/<id>/app.tsx exports its spec. */
interface AppModule {
  app?: AppSpec;
}

/** Every app's spec file, loaded with the shell (each is a few lines; the components are lazy). */
const MODULES = import.meta.glob<AppModule>("../apps/*/app.tsx", { eager: true });

/** The registry of `modules` (a glob's result), in id order; an id registered twice throws. */
export function buildAppRegistry(modules: Record<string, AppModule>): Map<string, AppSpec> {
  const found: AppSpec[] = [];
  // Sorted by file path so a duplicate is reported the same way every run.
  for (const path of Object.keys(modules).sort()) {
    const spec = modules[path]?.app;
    if (spec === undefined) continue;
    if (found.some((s) => s.id === spec.id)) throw new Error(`app ${spec.id} registered twice (${path})`);
    found.push(spec);
  }
  found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Map(found.map((s) => [s.id, s]));
}

let registry: Map<string, AppSpec> | null = null;

/** The spec an app registered, or undefined when there is no such app. */
export function appSpecOf(id: string): AppSpec | undefined {
  registry ??= buildAppRegistry(MODULES);
  return registry.get(id);
}

/** The apps the desktop lists, in id order: the debug-only ones only when `debug` is set. */
export function registeredApps(debug = false): AppSpec[] {
  registry ??= buildAppRegistry(MODULES);
  return [...registry.values()].filter((s) => debug || s.debugOnly !== true);
}

/** The route of the thing `ref` names, as every app writes and reads it: "person/12", "race/3". */
export function entityRoute(ref: EntityRef): string {
  return `${ref.kind.toLowerCase()}/${ref.id}`;
}
