// Page sections (crates/game/src/pages/mod.rs and doc.rs; D460, D481): a page kind registers its
// sections in default order; the player reorders, collapses and hides them from their headers, and
// the choice lives in the settings by page kind, so it persists. A page with tabs shows one section
// at a time by collapsing the others in the same config.

import type { SectionsConfig, UiConfig } from "../config/settings.ts";
import type { PageKind } from "./ref.ts";

/** A page section: its config id and its title. */
export interface SectionSpec {
  id: string;
  title: string;
}

/** What a section header button does. */
export type SectionOp = "ToggleCollapse" | "Up" | "Down" | "Hide" | "Show";

/** A shown section and its collapsed flag. */
export interface Arranged {
  section: SectionSpec;
  collapsed: boolean;
}

/**
 * The sections of a page kind in the player's order, each with its collapsed flag; hidden ones
 * are left out (D460). Sections the config does not name keep their default place after the named
 * ones; config ids the page no longer has are ignored.
 */
export function arrangeSections(
  defaults: readonly SectionSpec[],
  cfg: SectionsConfig | undefined,
): Arranged[] {
  if (!cfg) return defaults.map((section) => ({ section, collapsed: false }));
  const out: SectionSpec[] = [];
  for (const id of cfg.order) {
    const d = defaults.find((s) => s.id === id);
    if (d && !out.includes(d)) out.push(d);
  }
  for (const s of defaults) if (!out.includes(s)) out.push(s);
  return out
    .filter((s) => !cfg.hidden.includes(s.id))
    .map((section) => ({ section, collapsed: cfg.collapsed.includes(section.id) }));
}

/** The hidden sections of a kind, in default order (the "Hidden sections:" line). */
export function hiddenSections(
  defaults: readonly SectionSpec[],
  cfg: SectionsConfig | undefined,
): SectionSpec[] {
  return defaults.filter((s) => cfg?.hidden.includes(s.id));
}

const empty = (): SectionsConfig => ({ order: [], collapsed: [], hidden: [] });

/** The config with the kind's section entry replaced by `f(entry)`. */
function withEntry(cfg: UiConfig, kind: PageKind, f: (e: SectionsConfig) => SectionsConfig): UiConfig {
  return { ...cfg, sections: { ...cfg.sections, [kind]: f(cfg.sections[kind] ?? empty()) } };
}

const addTo = (set: readonly string[], id: string): string[] =>
  set.includes(id) ? [...set] : [...set, id].sort();
const removeFrom = (set: readonly string[], id: string): string[] => set.filter((s) => s !== id);

/**
 * Moves section `id` of a kind up (`delta` -1) or down (+1), starting from the default order when
 * the player has not ordered them yet.
 */
export function moveSection(
  cfg: UiConfig,
  kind: PageKind,
  defaults: readonly SectionSpec[],
  id: string,
  delta: number,
): UiConfig {
  return withEntry(cfg, kind, (entry) => {
    const order = arrangeSections(defaults, entry).map((a) => a.section.id);
    // Hidden sections keep their place at the end of the order.
    for (const d of defaults) if (!order.includes(d.id)) order.push(d.id);
    const i = order.indexOf(id);
    if (i >= 0) {
      const j = Math.min(order.length - 1, Math.max(0, i + delta));
      order.splice(i, 1);
      order.splice(j, 0, id);
    }
    return { ...entry, order };
  });
}

/** Applies a section header button to the config. */
export function applySectionOp(
  cfg: UiConfig,
  kind: PageKind,
  defaults: readonly SectionSpec[],
  id: string,
  op: SectionOp,
): UiConfig {
  switch (op) {
    case "Up":
      return moveSection(cfg, kind, defaults, id, -1);
    case "Down":
      return moveSection(cfg, kind, defaults, id, 1);
    case "ToggleCollapse":
      return withEntry(cfg, kind, (e) => ({
        ...e,
        collapsed: e.collapsed.includes(id) ? removeFrom(e.collapsed, id) : addTo(e.collapsed, id),
      }));
    case "Hide":
      return withEntry(cfg, kind, (e) => ({ ...e, hidden: addTo(e.hidden, id) }));
    case "Show":
      return withEntry(cfg, kind, (e) => ({ ...e, hidden: removeFrom(e.hidden, id) }));
  }
}

/**
 * Shows one tab (D481): section `id` expanded and shown, every other section of the kind
 * collapsed; null expands them all. Kept in the section config, so it persists.
 */
export function selectTab(
  cfg: UiConfig,
  kind: PageKind,
  defaults: readonly SectionSpec[],
  id: string | null,
): UiConfig {
  return withEntry(cfg, kind, (e) => ({
    ...e,
    hidden: id === null ? e.hidden : removeFrom(e.hidden, id),
    collapsed:
      id === null
        ? []
        : defaults
            .map((s) => s.id)
            .filter((s) => s !== id)
            .sort(),
  }));
}

/** The tab shown: the one section of the kind not collapsed, when all others are. */
export function currentTab(cfg: UiConfig, kind: PageKind, defaults: readonly SectionSpec[]): string | null {
  const open = arrangeSections(defaults, cfg.sections[kind]).filter((a) => !a.collapsed);
  return open.length === 1 && defaults.length > 1 ? (open[0]?.section.id ?? null) : null;
}
