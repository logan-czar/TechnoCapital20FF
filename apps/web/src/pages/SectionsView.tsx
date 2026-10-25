// A page's sections on screen (crates/game/src/pages/mod.rs `spawn_sections`, doc.rs `tab_strip`;
// D460, D481): each shown section in the player's order, under a header that folds it ([-] / [+]),
// moves it up (^) or down (v) and hides it (x); a line after them shows the hidden ones again. A
// page with tabs gets a strip of its section titles: a tab shows its section and folds the rest.
// Every choice is a settings change (sections.ts), so it persists and every pane of the kind follows.

import type { ReactNode } from "react";
import { useSettings, useUiConfig } from "../config/hooks.ts";
import type { PageKind } from "./ref.ts";
import {
  applySectionOp,
  arrangeSections,
  currentTab,
  hiddenSections,
  type SectionOp,
  type SectionSpec,
  selectTab,
} from "./sections.ts";

const BUTTONS: readonly (readonly [string, SectionOp, string])[] = [
  ["^", "Up", "Move the section up"],
  ["v", "Down", "Move the section down"],
  ["x", "Hide", "Hide the section (Settings or the line below shows it)"],
];

export interface SectionsProps {
  kind: PageKind;
  sections: readonly SectionSpec[];
  /** A section's body; called only for shown, unfolded sections. */
  render: (id: string) => ReactNode;
}

/** The shown sections of a page with their headers, and the hidden-sections line. */
export function Sections({ kind, sections, render }: SectionsProps) {
  const cfg = useUiConfig();
  const store = useSettings();
  const entry = cfg.sections[kind];
  const op = (id: string, o: SectionOp) => store.update((c) => applySectionOp(c, kind, sections, id, o));
  const hidden = hiddenSections(sections, entry);
  return (
    <>
      {arrangeSections(sections, entry).map(({ section, collapsed }) => (
        <section key={section.id} className="page-section" data-section={section.id}>
          <div className="section-head">
            <button
              type="button"
              className="section-fold"
              aria-expanded={!collapsed}
              onClick={() => op(section.id, "ToggleCollapse")}
            >
              {collapsed ? "[+]" : "[-]"} {section.title}
            </button>
            <span className="grow" />
            {BUTTONS.map(([label, o, hint]) => (
              <button
                type="button"
                key={o}
                className="section-btn"
                title={hint}
                aria-label={`${hint}: ${section.title}`}
                onClick={() => op(section.id, o)}
              >
                {label}
              </button>
            ))}
          </div>
          {!collapsed && <div className="section-body">{render(section.id)}</div>}
        </section>
      ))}
      {hidden.length > 0 && (
        <div className="chip-row">
          <span className="muted">Hidden sections:</span>
          {hidden.map((s) => (
            <button type="button" key={s.id} className="linkbtn small" onClick={() => op(s.id, "Show")}>
              [show {s.title}]
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** The tab strip (D481): one tab per section, and "All" to unfold them all. */
export function TabStrip({ kind, sections }: { kind: PageKind; sections: readonly SectionSpec[] }) {
  const cfg = useUiConfig();
  const store = useSettings();
  const tab = currentTab(cfg, kind, sections);
  const pick = (id: string | null) => store.update((c) => selectTab(c, kind, sections, id));
  return (
    <div className="tabs" role="tablist">
      {sections.map((s) => (
        <button
          type="button"
          role="tab"
          key={s.id}
          aria-selected={tab === s.id}
          className={tab === s.id ? "on" : ""}
          onClick={() => pick(s.id)}
        >
          {s.title}
        </button>
      ))}
      <button
        type="button"
        role="tab"
        aria-selected={tab === null}
        className={tab === null ? "on" : ""}
        onClick={() => pick(null)}
      >
        All
      </button>
    </div>
  );
}
