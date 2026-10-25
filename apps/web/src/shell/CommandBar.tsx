// The command bar (crates/game/src/command: fuzzy.rs, index.rs): cmdk for the dialog, fuse.js for
// the fuzzy match. The index holds the fixed panes and every named thing the views know (the name
// index, links/names.ts: list pages, companies by name and ticker, industries, countries by name
// and iso3, zones, exchanges by code and index name, startup events, characters, provinces by name
// and CSV id, recaps). Enter opens the entry in the focused pane, Shift+Enter in a new pane (D450).
//
// Not ported yet: `TICKER Fn` (Pdoomberg routing, 20.5.2) and `layout save NAME`; the Pdoomberg lane
// adds the first (docs/build/ts-pages-guide.md), Settings has the second.

import { Command } from "cmdk";
import Fuse from "fuse.js";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { type NameIndex, useNameIndex } from "../links/names.ts";
import type { OpenTarget } from "../links/nav.ts";
import { type PageKind, type PageRef, pageId } from "../pages/ref.ts";
import { FIXED_PANES, type PaneSpec } from "./panes.ts";

/** What an entry opens: a fixed pane or a page. */
export type EntryTarget = { kind: "pane"; spec: PaneSpec } | { kind: "page"; page: PageRef };

export interface Entry {
  key: string;
  label: string;
  /** Other names that match: a ticker, an iso3, a code. */
  alias: string;
  detail: string;
  group: string;
  target: EntryTarget;
}

/** Results shown. */
export const MAX_RESULTS = 40;

/** The result group of each page kind, in the order groups show (the Rust kind order). */
const GROUPS: Readonly<Record<PageKind, string>> = {
  world: "Pages",
  companies: "Pages",
  industries: "Pages",
  news: "Pages",
  characters: "Pages",
  countries: "Pages",
  exchanges: "Pages",
  zones: "Pages",
  events: "Pages",
  settings: "Pages",
  company: "Companies",
  industry: "Industries",
  character: "Characters",
  country: "Countries",
  province: "Provinces",
  zone: "Financial zones",
  exchange: "Exchanges",
  event: "Startup events",
  recap: "Recaps",
  headline: "Headlines",
};

/** Builds the entries from the name index (a pure function so tests can drive it). */
export function buildEntries(index: NameIndex): Entry[] {
  const out: Entry[] = FIXED_PANES.map((spec) => ({
    key: `pane:${spec.id}`,
    label: spec.title,
    alias: "",
    detail: "Open pane",
    group: "Panes",
    target: { kind: "pane", spec },
  }));
  for (const e of index.entries) {
    if (e.hidden) continue;
    out.push({
      key: pageId(e.page),
      label: e.name,
      alias: e.aliases.join(" "),
      detail: e.detail,
      group: GROUPS[e.page.kind],
      target: { kind: "page", page: e.page },
    });
  }
  return out;
}

export function makeFuse(entries: Entry[]): Fuse<Entry> {
  return new Fuse(entries, {
    keys: [
      { name: "label", weight: 2 },
      { name: "alias", weight: 1.5 },
      { name: "detail", weight: 0.3 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 1,
  });
}

/** The entries for a query: the panes and pages for an empty one, else the best fuzzy matches. */
export function search(fuse: Fuse<Entry>, entries: Entry[], query: string): Entry[] {
  const q = query.trim();
  if (q === "") return entries.filter((e) => e.group === "Panes" || e.group === "Pages");
  return fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item);
}

export interface CommandBarProps {
  onClose: () => void;
  onOpenPane: (spec: PaneSpec) => void;
  onOpenPage: (page: PageRef, target: OpenTarget) => void;
}

/**
 * The dialog. It is mounted only while open (App), so the search index is built when the player
 * asks for it; cmdk and fuse.js load on first use too.
 */
export default function CommandBar({ onClose, onOpenPane, onOpenPage }: CommandBarProps) {
  const index = useNameIndex();
  const entries = useMemo(() => buildEntries(index), [index]);
  const fuse = useMemo(() => makeFuse(entries), [entries]);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => search(fuse, entries, deferred), [fuse, entries, deferred]);
  // Shift held at the last key press: Shift+Enter opens in a new pane.
  const shift = useRef(false);

  // cmdk does not re-select when an unfiltered list changes, so the first result is kept active.
  const [active, setActive] = useState("");
  useEffect(() => {
    setActive(results[0]?.key ?? "");
  }, [results]);

  const choose = (e: Entry, newPane: boolean) => {
    if (e.target.kind === "pane") onOpenPane(e.target.spec);
    else onOpenPage(e.target.page, newPane ? "new" : "focused");
    onClose();
  };

  const groups = [...new Set(results.map((r) => r.group))];
  return (
    <Command.Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      onKeyDown={(e) => {
        shift.current = e.shiftKey;
      }}
      label="Command bar"
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      className="cmdk"
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Open a pane or page: company, ticker, country, zone, province..."
      />
      <Command.List>
        <Command.Empty>No match.</Command.Empty>
        {groups.map((g) => (
          <Command.Group key={g} heading={g}>
            {results
              .filter((r) => r.group === g)
              .map((r) => (
                <Command.Item
                  key={r.key}
                  value={r.key}
                  onSelect={() => choose(r, shift.current)}
                  onPointerDown={(e) => {
                    shift.current = e.shiftKey;
                  }}
                >
                  <span>
                    {r.label}
                    {r.alias && <span className="detail"> {r.alias}</span>}
                  </span>
                  <span className="detail">{r.detail}</span>
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
