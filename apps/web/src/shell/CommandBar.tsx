// The command bar (crates/game/src/command: fuzzy.rs, index.rs): cmdk for the dialog, fuse.js for
// the fuzzy match. The index holds the fixed panes and every named thing the views know (the name
// index, links/names.ts: list pages, companies by name and ticker, industries, countries by name
// and iso3, zones, exchanges by code and index name, startup events, characters, provinces by name
// and CSV id, recaps). Enter opens the entry in the focused pane, Shift+Enter in a new pane (D450).
//
// Commands besides names (command/mod.rs `resolve`): `TICKER Fn` (`ARDR F3`) opens full-screen
// Pdoomberg on that company's function page (20.5.2); a bare `F3` opens the page with no company,
// and `PDB` opens Pdoomberg. A word that is not a ticker offers the companies whose name or ticker
// matches best. Not ported: `layout save NAME` (Settings has the layouts).

import { Command } from "cmdk";
import Fuse from "fuse.js";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { type NameIndex, useNameIndex } from "../links/names.ts";
import type { OpenTarget } from "../links/nav.ts";
import { type PageKind, type PageRef, PDB_FUNCTION_NAME, pageId, parsePdbFunction } from "../pages/ref.ts";
import type { PdoombergRoute } from "../pdoomberg/models.ts";
import { FIXED_PANES, type PaneSpec } from "./panes.ts";

/** What an entry opens: a fixed pane, a page, or full-screen Pdoomberg on a route. */
export type EntryTarget =
  | { kind: "pane"; spec: PaneSpec }
  | { kind: "page"; page: PageRef }
  | { kind: "pdoomberg"; route: PdoombergRoute };

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

/** A Pdoomberg command's entry: "ARDR F3 Chart". */
function pdoombergEntry(route: PdoombergRoute, index: NameIndex): Entry {
  let who = "";
  if (route.company !== null) {
    const p: PageRef = { kind: "company", id: route.company };
    who = `${index.entry(p)?.aliases[0] ?? index.title(p)} `;
  }
  return {
    key: `pdb:${route.function}:${route.company ?? ""}`,
    label: `${who}${route.function} ${PDB_FUNCTION_NAME[route.function]}`,
    alias: "",
    detail: "Pdoomberg, full screen",
    group: "Pdoomberg",
    target: { kind: "pdoomberg", route },
  };
}

/** The Pdoomberg commands a query spells (`TICKER Fn`, `Fn`, `PDB`), best first. */
export function pdoombergCommands(fuse: Fuse<Entry>, index: NameIndex, query: string): Entry[] {
  const q = query.trim();
  const words = q.split(/\s+/).filter((w) => w !== "");
  const out: Entry[] = [];
  const last = words[words.length - 1];
  const f = last === undefined ? null : parsePdbFunction(last);
  if (f !== null && words.length === 1) out.push(pdoombergEntry({ function: f, company: null }, index));
  else if (f !== null && words.length === 2) {
    const word = words[0] as string;
    const id = index.companyByTicker(word);
    if (id !== undefined) out.push(pdoombergEntry({ function: f, company: id }, index));
    else {
      // Not a ticker: the companies whose name or ticker matches best.
      for (const r of fuse.search(word, { limit: MAX_RESULTS })) {
        const t = r.item.target;
        if (t.kind === "page" && t.page.kind === "company")
          out.push(pdoombergEntry({ function: f, company: t.page.id }, index));
      }
    }
  }
  if (q.toLowerCase() === "pdb" || q.toLowerCase() === "pdoomberg")
    out.push(pdoombergEntry({ function: "F2", company: null }, index));
  return out;
}

/**
 * The entries for a query: the panes and pages for an empty one, else a Pdoomberg command it
 * spells, then the best fuzzy matches.
 */
export function search(fuse: Fuse<Entry>, entries: Entry[], query: string, index?: NameIndex): Entry[] {
  const q = query.trim();
  if (q === "") return entries.filter((e) => e.group === "Panes" || e.group === "Pages");
  const pdb = index ? pdoombergCommands(fuse, index, q) : [];
  return [...pdb, ...fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item)];
}

export interface CommandBarProps {
  onClose: () => void;
  onOpenPane: (spec: PaneSpec) => void;
  onOpenPage: (page: PageRef, target: OpenTarget) => void;
  /** Opens full-screen Pdoomberg on a route (App.tsx). */
  onPdoomberg?: (route: PdoombergRoute) => void;
}

/**
 * The dialog. It is mounted only while open (App), so the search index is built when the player
 * asks for it; cmdk and fuse.js load on first use too.
 */
export default function CommandBar({ onClose, onOpenPane, onOpenPage, onPdoomberg }: CommandBarProps) {
  const index = useNameIndex();
  const entries = useMemo(() => buildEntries(index), [index]);
  const fuse = useMemo(() => makeFuse(entries), [entries]);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => search(fuse, entries, deferred, index), [fuse, entries, deferred, index]);
  // Shift held at the last key press: Shift+Enter opens in a new pane.
  const shift = useRef(false);

  // cmdk does not re-select when an unfiltered list changes, so the first result is kept active.
  const [active, setActive] = useState("");
  useEffect(() => {
    setActive(results[0]?.key ?? "");
  }, [results]);

  const choose = (e: Entry, newPane: boolean) => {
    if (e.target.kind === "pane") onOpenPane(e.target.spec);
    else if (e.target.kind === "pdoomberg") onPdoomberg?.(e.target.route);
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
        placeholder="Open a pane or page: company, ticker, country, zone, province... or TICKER F3 (Pdoomberg)"
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
