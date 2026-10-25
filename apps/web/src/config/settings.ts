// The UI settings (crates/game/src/config/mod.rs, M9 A2; D452, D458): density, font scale, per-table
// sort, page sections and saved layouts. The Rust game kept them in a RON file; the browser keeps
// them as one JSON document in localStorage (the TS plan: the TOML/RON config becomes JSON
// settings). The workspace's last layout is not here: dockview saves it itself (Workspace.tsx).
//
// - Loaded once at startup; a missing entry gives the defaults, one that does not parse is moved
//   aside to `<key>.corrupt` and the defaults are used (D452).
// - Written when it changes, at most every WRITE_DELAY_MS, and on page hide.
// - Owned by the UI: the sim never sees it (it is no sim state and no control).
//
// Tests run with no storage (`new SettingsStore(null)`), so they never touch the player's settings.

import { roundHalfAway } from "@tc20ff/sim";

/** The document's format version. */
export const CONFIG_VERSION = 1;
/** The localStorage key (the Rust file name was `ui.ron`). */
export const CONFIG_KEY = "tc20ff.ui.v1";
/** Where an unreadable document is moved. */
export const CORRUPT_KEY = `${CONFIG_KEY}.corrupt`;
/** Font scale limits and step (D458). */
export const FONT_SCALE_MIN = 0.75;
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_STEP = 0.05;
/** Milliseconds a change waits before it is written, so a burst of changes writes once. */
export const WRITE_DELAY_MS = 500;

/** Row density (D458): table rows and page lines. */
export type Density = "compact" | "normal";

/** A table row's height at font scale 1. */
export function densityRowHeight(d: Density): number {
  return d === "compact" ? 18 : 22;
}

/** One table's sort, saved by its table id (D456). Column widths are not saved in the TS UI. */
export interface TableConfig {
  sort: { key: string; ascending: boolean } | null;
}

/** One page kind's sections (D460): their order, and which are collapsed or hidden. */
export interface SectionsConfig {
  order: string[];
  /** Sorted, no repeats (a Rust BTreeSet). */
  collapsed: string[];
  hidden: string[];
}

export interface UiConfig {
  version: number;
  density: Density;
  /** Multiplies every font size (and row heights with it). */
  font_scale: number;
  /** By table id. */
  tables: Record<string, TableConfig>;
  /** By page kind key. */
  sections: Record<string, SectionsConfig>;
  /** Named layouts: dockview's serialized workspace, as `api.toJSON()` gives it. */
  layouts: Record<string, unknown>;
}

export function defaultConfig(): UiConfig {
  return { version: CONFIG_VERSION, density: "normal", font_scale: 1, tables: {}, sections: {}, layouts: {} };
}

/** Rounds to the step so repeated steps never drift, then clamps (D458). */
export function clampFontScale(s: number): number {
  if (!Number.isFinite(s)) return 1;
  const stepped = roundHalfAway(s / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  // The product leaves float dust (1.1500000000000001); two decimals is the step's precision.
  const clean = roundHalfAway(stepped * 100) / 100;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, clean));
}

/** A table row's height in pixels. */
export function rowHeight(c: UiConfig): number {
  return roundHalfAway(densityRowHeight(c.density) * c.font_scale);
}

/** The config with its font scale stepped by `steps` of FONT_SCALE_STEP. */
export function stepFont(c: UiConfig, steps: number): UiConfig {
  return { ...c, font_scale: clampFontScale(c.font_scale + steps * FONT_SCALE_STEP) };
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s) => typeof s === "string") : []);
const sortedSet = (x: unknown): string[] => [...new Set(strings(x))].sort();

/**
 * Any parsed value as a config, every field brought into range (a hand-edited document may hold
 * anything): unknown or wrong-typed fields take their defaults, the rest survives.
 */
export function sanitize(x: unknown): UiConfig {
  const out = defaultConfig();
  if (!isRecord(x)) return out;
  if (x.density === "compact" || x.density === "normal") out.density = x.density;
  if (typeof x.font_scale === "number") out.font_scale = clampFontScale(x.font_scale);
  if (isRecord(x.tables)) {
    for (const [id, t] of Object.entries(x.tables)) {
      const s = isRecord(t) && isRecord(t.sort) ? t.sort : null;
      out.tables[id] = {
        sort:
          s && typeof s.key === "string" && typeof s.ascending === "boolean"
            ? { key: s.key, ascending: s.ascending }
            : null,
      };
    }
  }
  if (isRecord(x.sections)) {
    for (const [kind, s] of Object.entries(x.sections)) {
      if (!isRecord(s)) continue;
      out.sections[kind] = {
        order: strings(s.order),
        collapsed: sortedSet(s.collapsed),
        hidden: sortedSet(s.hidden),
      };
    }
  }
  if (isRecord(x.layouts)) {
    for (const [name, l] of Object.entries(x.layouts)) if (isRecord(l)) out.layouts[name] = l;
  }
  return out;
}

/** The document's text: pretty JSON (the Rust file had a comment header; JSON has none). */
export function toText(c: UiConfig): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

/** Parses a document's text. */
export function fromText(text: string): { ok: true; value: UiConfig } | { ok: false; error: string } {
  // An editor may have saved it with a byte-order mark.
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    const parsed: unknown = JSON.parse(t);
    if (!isRecord(parsed)) return { ok: false, error: "not a JSON object" };
    return { ok: true, value: sanitize(parsed) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** How the load went. */
export type LoadOutcome =
  | { kind: "Missing" }
  | { kind: "Loaded" }
  /** It did not parse; it was moved to CORRUPT_KEY (when the move worked). */
  | { kind: "Corrupt"; error: string; backup: boolean };

/** The storage a SettingsStore writes to: localStorage in the game, none in tests. */
export type SettingsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Loads the config from `storage`; never fails (D452). */
export function load(storage: SettingsStorage): { config: UiConfig; outcome: LoadOutcome } {
  let text: string | null;
  try {
    text = storage.getItem(CONFIG_KEY);
  } catch (e) {
    // Blocked storage: leave it alone.
    return { config: defaultConfig(), outcome: { kind: "Corrupt", error: String(e), backup: false } };
  }
  if (text === null) return { config: defaultConfig(), outcome: { kind: "Missing" } };
  const parsed = fromText(text);
  if (parsed.ok) return { config: parsed.value, outcome: { kind: "Loaded" } };
  let backup = false;
  try {
    storage.setItem(CORRUPT_KEY, text);
    storage.removeItem(CONFIG_KEY);
    backup = true;
  } catch {
    // Could not move it aside; the defaults are used either way.
  }
  return { config: defaultConfig(), outcome: { kind: "Corrupt", error: parsed.error, backup } };
}

/**
 * The settings keys (workspace.rs SHORTCUTS): Ctrl+J density, Ctrl+= / Ctrl+- / Ctrl+0 font size,
 * Ctrl+, the Settings page. Returns true when it took the key.
 */
export function settingsKey(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  settings: SettingsStore,
  openSettings: () => void,
): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  switch (e.key) {
    case "j":
    case "J":
      settings.update((c) => ({ ...c, density: c.density === "compact" ? "normal" : "compact" }));
      return true;
    case "=":
    case "+":
      settings.update((c) => stepFont(c, 1));
      return true;
    case "-":
      settings.update((c) => stepFont(c, -1));
      return true;
    case "0":
      settings.update((c) => ({ ...c, font_scale: 1 }));
      return true;
    case ",":
      openSettings();
      return true;
    default:
      return false;
  }
}

type Listener = () => void;

/**
 * The live config: what the pages read (through `useUiConfig`), and where changes go. A change
 * replaces the config object (so React sees it), notifies, and schedules a write.
 */
export class SettingsStore {
  config: UiConfig;
  readonly outcome: LoadOutcome | null;
  private written: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly storage: SettingsStorage | null) {
    if (storage) {
      const { config, outcome } = load(storage);
      this.config = config;
      this.outcome = outcome;
      if (outcome.kind === "Loaded") this.written = toText(config);
    } else {
      this.config = defaultConfig();
      this.outcome = null;
    }
  }

  /** True when the settings live in storage (false in tests and when storage is blocked). */
  get persistent(): boolean {
    return this.storage !== null;
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Replaces the config with `f(config)`; every change restarts the write delay (D452). */
  update(f: (c: UiConfig) => UiConfig): void {
    const next = f(this.config);
    if (next === this.config) return;
    this.config = next;
    for (const cb of this.listeners) cb();
    if (!this.storage) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), WRITE_DELAY_MS);
  }

  /** Writes now if the config differs from what was last written. */
  flush(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.storage) return;
    const text = toText(this.config);
    if (text === this.written) return;
    try {
      this.storage.setItem(CONFIG_KEY, text);
      this.written = text;
    } catch {
      // Full or blocked: the game keeps working with the settings in memory.
    }
  }

  /** Back to the defaults (the Settings page's reset). */
  reset(): void {
    this.update(() => defaultConfig());
  }
}
