// The page registry (crates/game/src/pages/mod.rs `PageSpec`, `PageRegistry`, `register_page`;
// M9 A2, D451, D460): each page kind registers what it reads and how it is drawn. One file per page
// under ./kinds/ exports `pages` (a list, since a file may serve several kinds, as lists.rs serves
// the eight list pages); every such file is picked up here by Vite's glob import, so adding a page
// touches no shared file.
//
// A page is drawn one of two ways:
// - `doc`: a pure builder from the views to a PageDoc (doc.ts), drawn by DocView. The tests call
//   the builder directly. Most entity pages are this.
// - `Component`: a React component for a page that is mostly widgets (Settings, a big table).
// Kinds with no registered page show the pending page (PendingPage.tsx).

import type { PageKind } from "./ref.ts";
import type { AnyPageSpec } from "./spec.ts";

/** A page file: ./kinds/<name>.tsx exports the specs it registers. */
interface PageModule {
  pages?: readonly AnyPageSpec[];
}

/** Every page file, loaded with the app (they are small; heavy widgets inside load lazily). */
const MODULES = import.meta.glob<PageModule>("./kinds/*.tsx", { eager: true });

function build(): Map<PageKind, AnyPageSpec> {
  const out = new Map<PageKind, AnyPageSpec>();
  // Sorted by file name so a kind registered twice resolves the same way every run.
  for (const path of Object.keys(MODULES).sort()) {
    for (const spec of MODULES[path]?.pages ?? []) {
      if (out.has(spec.kind)) throw new Error(`page kind ${spec.kind} registered twice (${path})`);
      out.set(spec.kind, spec);
    }
  }
  return out;
}

let registry: Map<PageKind, AnyPageSpec> | null = null;

/** The spec a kind registered, or undefined while its page is not ported. */
export function pageSpecOf(kind: PageKind): AnyPageSpec | undefined {
  registry ??= build();
  return registry.get(kind);
}

/** The kinds with a page. */
export function registeredKinds(): PageKind[] {
  registry ??= build();
  return [...registry.keys()];
}
