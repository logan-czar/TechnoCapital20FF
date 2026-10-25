// A page kind's spec (crates/game/src/pages/mod.rs `PageSpec`): what it reads, its sections, and
// how it is drawn. Page files (./kinds/*.tsx) import this file, never registry.ts (which imports
// them), so a test can load one page file alone.

import type { ViewName } from "@tc20ff/sim";
import type { ComponentType } from "react";
import type { UiConfig } from "../config/settings.ts";
import type { NameIndex } from "../links/names.ts";
import type { PageDoc } from "./doc.ts";
import type { PageKind, PageOf } from "./ref.ts";
import type { SectionSpec } from "./sections.ts";
import type { ViewsData } from "./views.ts";

/** What a page component gets. */
export interface PageProps<K extends PageKind = PageKind> {
  page: PageOf<K>;
  /** The views its spec names, as they are now. */
  views: ViewsData;
  index: NameIndex;
  config: UiConfig;
}

/** What a page kind registers. */
export interface PageSpec<K extends PageKind = PageKind> {
  kind: K;
  /**
   * The views the page reads (Rust's ViewKey list): it re-renders when one moves (Rust
   * Refresh::OnViewChange; the settings it reads re-render it too, Refresh::OnConfigChange).
   */
  views: readonly ViewName[];
  /** Its sections in default order (D460); the player reorders, folds and hides them. */
  sections: readonly SectionSpec[];
  /** A tab strip over the sections: one shown at a time (D481). */
  tabs?: boolean;
  /** Builds the page as data (doc.ts); the default renderer draws it. */
  doc?: (page: PageOf<K>, views: ViewsData, index: NameIndex) => PageDoc;
  /** Draws the page itself (when it has no doc). */
  Component?: ComponentType<PageProps<K>>;
}

/** A spec of any kind, as the registry holds it. */
export type AnyPageSpec = PageSpec<PageKind>;

/** Types a spec against its kind, then widens it for the registry. */
export function definePage<K extends PageKind>(spec: PageSpec<K>): AnyPageSpec {
  return spec as unknown as AnyPageSpec;
}
