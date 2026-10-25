// The command bar (crates/game/src/command: fuzzy.rs, index.rs): cmdk for the dialog, fuse.js for
// the fuzzy match. The index holds the panes and every named thing the views know (companies by
// name and ticker, countries by name and iso3, provinces, industries), rebuilt when a source view
// moves. Selecting an entry opens its pane.

import { Command } from "cmdk";
import Fuse from "fuse.js";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useViewData } from "../sim/hooks.ts";
import type { PageRef } from "../widgets/cells.ts";
import { FIXED_PANES, type PaneSpec, pageSpec } from "./panes.ts";

export interface Entry {
  key: string;
  label: string;
  /** Another name that matches: a ticker or an iso3. */
  alias: string;
  detail: string;
  group: "Panes" | "Companies" | "Industries" | "Countries" | "Provinces";
  spec: PaneSpec;
}

/** Results shown. */
export const MAX_RESULTS = 40;

const page = (p: PageRef, label: string): PaneSpec => pageSpec(p, label);

/** Builds the index from the views (a pure function so tests can drive it). */
export function buildEntries(
  companies: readonly { id: number; name: string; ticker: string; public: boolean }[],
  industries: readonly { id: number; name: string; sector: string }[],
  countries: readonly { id: number; name: string; iso3: string }[],
  provinces: readonly { id: number; name: string; country: number }[],
): Entry[] {
  const countryName = new Map(countries.map((c) => [c.id, c.name]));
  const out: Entry[] = FIXED_PANES.map((spec) => ({
    key: spec.id,
    label: spec.title,
    alias: "",
    detail: "Open pane",
    group: "Panes",
    spec,
  }));
  for (const c of companies) {
    out.push({
      key: `co${c.id}`,
      label: c.name,
      alias: c.ticker,
      detail: c.public ? `Listed, ${c.ticker}` : "Private",
      group: "Companies",
      spec: page({ kind: "company", id: c.id }, c.name),
    });
  }
  for (const i of industries) {
    out.push({
      key: `in${i.id}`,
      label: i.name,
      alias: "",
      detail: i.sector,
      group: "Industries",
      spec: page({ kind: "industry", id: i.id }, i.name),
    });
  }
  for (const c of countries) {
    out.push({
      key: `ct${c.id}`,
      label: c.name,
      alias: c.iso3,
      detail: "Country",
      group: "Countries",
      spec: page({ kind: "country", id: c.id }, c.name),
    });
  }
  for (const p of provinces) {
    out.push({
      key: `pr${p.id}`,
      label: p.name,
      alias: "",
      detail: countryName.get(p.country) ?? "Province",
      group: "Provinces",
      spec: page({ kind: "province", id: p.id }, p.name),
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

/** The entries for a query: the panes for an empty one, else the best fuzzy matches. */
export function search(fuse: Fuse<Entry>, entries: Entry[], query: string): Entry[] {
  const q = query.trim();
  if (q === "") return entries.filter((e) => e.group === "Panes");
  return fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item);
}

export interface CommandBarProps {
  onClose: () => void;
  onOpenPane: (spec: PaneSpec) => void;
}

/**
 * The dialog. It is mounted only while open (App), so the index of every named thing is built when
 * the player asks for it, not on every view change; cmdk and fuse.js load on first use too.
 */
export default function CommandBar({ onClose, onOpenPane }: CommandBarProps) {
  const companies = useViewData("company_rows");
  const industries = useViewData("industry_rows");
  const countries = useViewData("countries");
  const places = useViewData("places");
  const entries = useMemo(
    () =>
      buildEntries(
        companies?.rows ?? [],
        industries?.rows ?? [],
        countries?.countries ?? [],
        places?.provinces ?? [],
      ),
    [companies, industries, countries, places],
  );
  const fuse = useMemo(() => makeFuse(entries), [entries]);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => search(fuse, entries, deferred), [fuse, entries, deferred]);

  // cmdk does not re-select when an unfiltered list changes, so the first result is kept active.
  const [active, setActive] = useState("");
  useEffect(() => {
    setActive(results[0]?.key ?? "");
  }, [results]);

  const groups = [...new Set(results.map((r) => r.group))];
  return (
    <Command.Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
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
        placeholder="Open a pane, company, country, industry..."
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
                  onSelect={() => {
                    onOpenPane(r.spec);
                    onClose();
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
