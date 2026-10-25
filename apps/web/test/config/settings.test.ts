// The UI settings, ported from crates/game/src/config/mod.rs's tests: the round trip through the
// stored text, missing and corrupt entries, repairs of partial and out-of-range documents, a
// byte-order mark, the font steps, and the write that waits for the delay. The RON file is a JSON
// document in localStorage here, so the file-system tests (the config directory variable, a
// rename to .corrupt) became storage tests.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONFIG_KEY,
  CORRUPT_KEY,
  defaultConfig,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  fromText,
  load,
  rowHeight,
  type SettingsStorage,
  SettingsStore,
  stepFont,
  toText,
  type UiConfig,
  WRITE_DELAY_MS,
} from "../../src/config/settings.ts";

/** An in-memory localStorage. */
class MemoryStorage implements SettingsStorage {
  readonly items = new Map<string, string>();
  writes = 0;
  getItem(k: string): string | null {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.writes++;
    this.items.set(k, v);
  }
  removeItem(k: string): void {
    this.items.delete(k);
  }
}

function sample(): UiConfig {
  return {
    ...defaultConfig(),
    density: "compact",
    font_scale: 1.25,
    tables: { companies: { sort: { key: "Name", ascending: false } } },
    sections: { company: { order: ["board", "overview"], collapsed: ["board"], hidden: ["tech"] } },
    layouts: {
      trading: {
        grid: { root: {} },
        panels: { "page-1": { params: { history: { current: "company/3" } } } },
      },
    },
  };
}

describe("settings", () => {
  it("round-trip through the stored text (round_trips_through_the_file)", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.update(() => sample());
    store.flush();
    const text = storage.getItem(CONFIG_KEY) ?? "";
    expect(text).toContain('"company/3"');
    const { config, outcome } = load(storage);
    expect(outcome).toEqual({ kind: "Loaded" });
    expect(config).toEqual(sample());
    // Unchanged: no rewrite.
    const writes = storage.writes;
    store.flush();
    expect(storage.writes, "the same text is not written twice").toBe(writes);
  });

  it("give the defaults for a missing or corrupt entry (missing_and_corrupt_files_give_defaults)", () => {
    const storage = new MemoryStorage();
    expect(load(storage)).toEqual({ config: defaultConfig(), outcome: { kind: "Missing" } });
    storage.setItem(CONFIG_KEY, '{"density": "Sideways", "font_scale": "big"');
    const { config, outcome } = load(storage);
    expect(config).toEqual(defaultConfig());
    expect(outcome.kind).toBe("Corrupt");
    expect(outcome.kind === "Corrupt" && outcome.backup).toBe(true);
    expect(storage.getItem(CONFIG_KEY), "moved aside").toBeNull();
    expect(storage.getItem(CORRUPT_KEY)).toContain("Sideways");
    // Not an object at all.
    storage.setItem(CONFIG_KEY, "[1, 2]");
    expect(load(storage).outcome.kind).toBe("Corrupt");
  });

  it("repair partial and out-of-range documents (partial_and_out_of_range_files_are_repaired)", () => {
    const big = fromText('{"font_scale": 9.0}');
    expect(big.ok && big.value.font_scale).toBe(FONT_SCALE_MAX);
    expect(big.ok && big.value.density).toBe("normal");
    const odd = fromText(
      '{"font_scale": 0.81, "density": "compact", "tables": {"t": {"sort": {"key": 5}}}, "sections": {"x": {"order": ["a", 3], "hidden": ["b", "b"]}}, "layouts": {"bad": 7, "ok": {"grid": {}}}}',
    );
    if (!odd.ok) throw new Error(odd.error);
    expect(odd.value.font_scale).toBeCloseTo(0.8, 6);
    expect(odd.value.density, "the rest of the document survives").toBe("compact");
    expect(odd.value.tables.t).toEqual({ sort: null });
    expect(odd.value.sections.x).toEqual({ order: ["a"], collapsed: [], hidden: ["b"] });
    expect(Object.keys(odd.value.layouts)).toEqual(["ok"]);
  });

  it("skip a byte-order mark (bom_and_non_utf8_files)", () => {
    const r = fromText('﻿{"density": "compact"}');
    expect(r.ok && r.value.density).toBe("compact");
  });

  it("step the font on the grid (font_steps_stay_on_the_grid)", () => {
    let c = defaultConfig();
    for (let i = 0; i < 3; i++) c = stepFont(c, 1);
    expect(c.font_scale).toBeCloseTo(1.15, 6);
    for (let i = 0; i < 40; i++) c = stepFont(c, -1);
    expect(c.font_scale).toBe(FONT_SCALE_MIN);
    c = { ...c, density: "compact" };
    expect(rowHeight(c)).toBe(14);
    expect(rowHeight({ ...defaultConfig(), density: "compact", font_scale: 1.05 })).toBe(19);
  });

  it("keep no state in memory-only mode", () => {
    const store = new SettingsStore(null);
    expect(store.persistent).toBe(false);
    expect(store.outcome).toBeNull();
    store.update((c) => ({ ...c, density: "compact" }));
    expect(store.config.density).toBe("compact");
    store.reset();
    expect(store.config).toEqual(defaultConfig());
    expect(toText(store.config).endsWith("\n")).toBe(true);
  });
});

describe("the settings write", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the delay, restarting on every change (writes_wait_for_the_delay_and_exit)", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    let notified = 0;
    store.subscribe(() => notified++);
    store.update((c) => ({ ...c, density: "compact" }));
    expect(notified).toBe(1);
    expect(storage.getItem(CONFIG_KEY), "waits for the delay").toBeNull();
    vi.advanceTimersByTime(WRITE_DELAY_MS * 0.9);
    expect(storage.getItem(CONFIG_KEY), "still inside the delay").toBeNull();
    // A change that keeps coming keeps restarting the wait.
    for (let i = 0; i < 3; i++) {
      store.update((c) => stepFont(c, 1));
      vi.advanceTimersByTime(WRITE_DELAY_MS * 0.6);
      expect(storage.getItem(CONFIG_KEY), `still changing at step ${i}`).toBeNull();
    }
    vi.advanceTimersByTime(WRITE_DELAY_MS * 0.5);
    expect(load(storage).config.density, "written once it settled").toBe("compact");
    // A flush (the page hiding) writes at once.
    store.update((c) => ({ ...c, font_scale: 1.1 }));
    store.flush();
    expect(load(storage).config.font_scale).toBeCloseTo(1.1, 6);
    // An update that returns the same config is no change.
    const before = notified;
    store.update((c) => c);
    expect(notified).toBe(before);
  });
});
