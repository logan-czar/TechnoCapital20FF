// The Settings page (crates/game/src/pages/settings.rs; D452, D453, D458): density, font size,
// saved layouts, the settings document and the keyboard shortcuts. It re-renders whenever the
// settings change (Rust Refresh::OnConfigChange). The RON file became a JSON document in
// localStorage (config/settings.ts), so the "Config file" section offers it as a download and an
// upload instead of a path.

import { useRef, useState } from "react";
import { useSettings } from "../../config/hooks.ts";
import {
  CONFIG_KEY,
  type Density,
  densityRowHeight,
  fromText,
  type LoadOutcome,
  stepFont,
  toText,
  type UiConfig,
} from "../../config/settings.ts";
import { useWorkspace } from "../../shell/panes.ts";
import { fixed } from "../../widgets/cells.ts";
import { ChipRow, Note, PageHeader } from "../parts.tsx";
import { Sections } from "../SectionsView.tsx";
import type { SectionSpec } from "../sections.ts";
import { definePage, type PageProps } from "../spec.ts";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "display", title: "Display" },
  { id: "layouts", title: "Layouts" },
  { id: "keys", title: "Keyboard" },
  { id: "file", title: "Settings file" },
];

/** The keyboard shortcuts of the TS workspace (workspace.rs SHORTCUTS, as far as they apply). */
export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ["Ctrl+K", "Command bar: names, tickers, codes"],
  ["Enter / Shift+Enter", "Command bar: open in the focused pane / a new pane"],
  ["Click / Shift+click, middle", "A link: open in the focused pane / a new pane"],
  ["Alt+Left, Backspace", "Back in the focused pane"],
  ["Alt+Right", "Forward in the focused pane"],
  ["Drag a tab", "Move, split or stack a pane"],
  ["Ctrl+= / Ctrl+- / Ctrl+0", "Font larger / smaller / reset"],
  ["Ctrl+J", "Density compact or normal"],
  ["Ctrl+,", "This page"],
  ["Space, 1 to 5", "Pause, speed"],
];

const DENSITIES: readonly Density[] = ["compact", "normal"];

/** The first free "Layout N" name. */
export function nextLayoutName(cfg: UiConfig): string {
  for (let i = 1; ; i++) if (!(`Layout ${i}` in cfg.layouts)) return `Layout ${i}`;
}

/** How many panes a saved dockview layout holds. */
export function layoutPanes(l: unknown): number {
  const panels = typeof l === "object" && l !== null ? (l as { panels?: unknown }).panels : null;
  return typeof panels === "object" && panels !== null ? Object.keys(panels).length : 0;
}

/** The load outcome as a line, or "" (in-memory settings). */
export function outcomeText(o: LoadOutcome | null): string {
  if (!o) return "";
  switch (o.kind) {
    case "Loaded":
      return "loaded at startup";
    case "Missing":
      return "not found at startup: defaults";
    case "Corrupt":
      return `unreadable at startup${o.backup ? `, moved aside to ${CONFIG_KEY}.corrupt` : ""}: ${o.error}`;
  }
}

function Display({ cfg }: { cfg: UiConfig }) {
  const store = useSettings();
  return (
    <>
      <ChipRow>
        <span className="muted">Density (Ctrl+J):</span>
        {DENSITIES.map((d) => (
          <button
            type="button"
            key={d}
            className={cfg.density === d ? "on" : ""}
            aria-pressed={cfg.density === d}
            title={`${densityRowHeight(d)} px table rows`}
            onClick={() => store.update((c) => ({ ...c, density: d }))}
          >
            {d}
          </button>
        ))}
      </ChipRow>
      <ChipRow>
        <span className="muted">Font size {fixed(cfg.font_scale * 100, 0)}% (Ctrl+= / Ctrl+- / Ctrl+0):</span>
        <button type="button" title="Smaller" onClick={() => store.update((c) => stepFont(c, -1))}>
          -
        </button>
        <button type="button" title="Larger" onClick={() => store.update((c) => stepFont(c, 1))}>
          +
        </button>
        <button type="button" title="100%" onClick={() => store.update((c) => ({ ...c, font_scale: 1 }))}>
          reset
        </button>
      </ChipRow>
    </>
  );
}

function Layouts({ cfg }: { cfg: UiConfig }) {
  const store = useSettings();
  const ws = useWorkspace();
  const next = nextLayoutName(cfg);
  const names = Object.keys(cfg.layouts).sort();
  return (
    <>
      <ChipRow>
        <button
          type="button"
          title="Saves the panes and their pages"
          onClick={() => {
            const l = ws.layout();
            if (l) store.update((c) => ({ ...c, layouts: { ...c.layouts, [next]: l } }));
          }}
        >
          Save the workspace as "{next}"
        </button>
      </ChipRow>
      {names.length === 0 && <Note>No saved layouts.</Note>}
      {names.map((name) => (
        <ChipRow key={name}>
          <span>
            {name} ({layoutPanes(cfg.layouts[name])} panes)
          </span>
          <button
            type="button"
            title="Replace the workspace with this layout"
            onClick={() => ws.restore(cfg.layouts[name])}
          >
            load
          </button>
          <button
            type="button"
            title="Delete this layout"
            onClick={() =>
              store.update((c) => {
                const { [name]: _gone, ...rest } = c.layouts;
                return { ...c, layouts: rest };
              })
            }
          >
            delete
          </button>
        </ChipRow>
      ))}
    </>
  );
}

function Keys() {
  return (
    <dl className="keys">
      {SHORTCUTS.map(([k, what]) => (
        <div key={k} className="key-row">
          <dt className="tone-cyan small">{k}</dt>
          <dd className="small">{what}</dd>
        </div>
      ))}
    </dl>
  );
}

function SettingsFile() {
  const store = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const download = () => {
    const url = URL.createObjectURL(new Blob([toText(store.config)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "technocapital20ff-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    const parsed = fromText(await f.text());
    if (parsed.ok) {
      store.update(() => parsed.value);
      setMessage(`Loaded ${f.name}.`);
    } else setMessage(`${f.name} is not a settings file: ${parsed.error}`);
  };
  const outcome = outcomeText(store.outcome);
  return (
    <>
      <Note>
        {store.persistent
          ? `Stored in this browser (localStorage, ${CONFIG_KEY}).`
          : "None: this run keeps its settings in memory."}
      </Note>
      {outcome && <Note>The settings were {outcome}.</Note>}
      <ChipRow>
        <button type="button" onClick={download}>
          Download as JSON
        </button>
        <button type="button" onClick={() => input.current?.click()}>
          Load a JSON file
        </button>
        <button
          type="button"
          title="Density, font, sections, table sorts and layouts"
          onClick={() => store.reset()}
        >
          Reset to defaults
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </ChipRow>
      {message && <Note>{message}</Note>}
    </>
  );
}

function SettingsPage({ config }: PageProps<"settings">) {
  return (
    <div className="doc">
      <PageHeader title="Settings" kind="UI settings" />
      <Sections
        kind="settings"
        sections={SECTIONS}
        render={(id) => {
          switch (id) {
            case "display":
              return <Display cfg={config} />;
            case "layouts":
              return <Layouts cfg={config} />;
            case "keys":
              return <Keys />;
            case "file":
              return <SettingsFile />;
            default:
              return null;
          }
        }}
      />
    </div>
  );
}

export const pages = [
  definePage({ kind: "settings", views: [], sections: SECTIONS, Component: SettingsPage }),
];
