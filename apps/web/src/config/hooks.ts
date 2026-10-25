// React bindings for the settings store: the store comes from a context (the app makes one over
// localStorage; tests make one in memory), and `useUiConfig` re-renders on every change.

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { rowHeight, SettingsStore, type UiConfig } from "./settings.ts";

/** The default store for components rendered outside a provider (a test of one widget): in memory. */
const FALLBACK = new SettingsStore(null);

export const SettingsContext = createContext<SettingsStore>(FALLBACK);

export function useSettings(): SettingsStore {
  return useContext(SettingsContext);
}

export function useUiConfig(): UiConfig {
  const store = useSettings();
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const get = useCallback(() => store.config, [store]);
  return useSyncExternalStore(subscribe, get);
}

/** The table row height the settings ask for. */
export function useRowHeight(): number {
  return rowHeight(useUiConfig());
}

/**
 * Applies density and font scale to the document (CSS variables `--row` and `--font-scale`), and
 * writes pending settings when the page hides (the Rust game flushed on exit).
 */
export function useApplySettings(): void {
  const store = useSettings();
  const cfg = useUiConfig();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--row", `${rowHeight(cfg)}px`);
    root.style.setProperty("--font-scale", String(cfg.font_scale));
    root.dataset.density = cfg.density;
  }, [cfg]);
  useEffect(() => {
    const flush = () => store.flush();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [store]);
}
