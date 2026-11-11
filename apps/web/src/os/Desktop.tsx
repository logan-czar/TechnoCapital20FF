// The desktop (pivot 15.2): the whole screen as one invented operating system. The wallpaper, an
// icon per app in the registry (os/apps.ts), the open windows, the taskbar and the phone. It holds
// the window manager's state (os/wm.ts), saves it for the viewer (os/persist.ts) and is what
// `openApp` (links/nav.ts) reaches.
//
// A debug-only app (pivot 15.3) is listed, and its windows drawn, only while the Omniscient toggle
// is on (the clock view's `omniscient`, set by the `SetOmniscient` control).

import "./os.css";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SettingsStorage } from "../config/settings.ts";
import { setAppOpener } from "../links/nav.ts";
import { useSim } from "../sim/hooks.ts";
import { type AppSpec, registeredApps } from "./apps.ts";
import { Icon } from "./icons.tsx";
import { DESKTOP_WRITE_DELAY_MS, loadDesktop, safeLocalStorage, saveDesktop } from "./persist.ts";
import { Phone } from "./phone/Phone.tsx";
import { Taskbar } from "./Taskbar.tsx";
import { Wallpaper } from "./Wallpaper.tsx";
import { Window } from "./Window.tsx";
import { DEFAULT_BOUNDS, focusedId, type Size, wmReduce } from "./wm.ts";

/** The taskbar's height in CSS pixels; os.css `--os-taskbar-h` is the same number. */
export const TASKBAR_H = 46;

/** True while the Omniscient toggle is on. Re-renders only when it flips, not on every tick. */
function useOmniscient(): boolean {
  const { store } = useSim();
  const subscribe = useCallback((cb: () => void) => store.subscribe("clock", cb), [store]);
  const get = useCallback(() => store.getView("clock")?.data.omniscient ?? false, [store]);
  return useSyncExternalStore(subscribe, get);
}

/** The desktop's size before it is measured: the page without the taskbar. */
function guessBounds(): Size {
  const w = typeof window === "undefined" ? 0 : window.innerWidth;
  const h = typeof window === "undefined" ? 0 : window.innerHeight - TASKBAR_H;
  return w > 0 && h > 0 ? { w, h } : DEFAULT_BOUNDS;
}

export interface DesktopProps {
  /**
   * Where the desktop is kept between visits: localStorage by default, null for none (tests, and
   * a game whose settings are not kept either).
   */
  storage?: SettingsStorage | null | undefined;
  /** The apps to list, debug-only ones included when asked: the registry, unless a test names its own. */
  apps?: (debug: boolean) => AppSpec[];
  /**
   * The app to open when the desktop starts with no window (the first run, D1050); null for none.
   * The app root names the news app; a test's desktop opens nothing by itself.
   */
  firstApp?: string | null | undefined;
  /** Drawn over the windows (the toasts). */
  children?: ReactNode;
}

export function Desktop({ storage, apps = registeredApps, firstApp = null, children }: DesktopProps) {
  const omniscient = useOmniscient();
  const store = useMemo(() => (storage === undefined ? safeLocalStorage() : storage), [storage]);
  const all = useMemo(() => apps(true), [apps]);
  const listed = useMemo(() => apps(omniscient), [apps, omniscient]);
  const specOf = useCallback((id: string) => listed.find((s) => s.id === id), [listed]);

  // Read once: the saved desktop, with windows of apps that no longer exist dropped.
  const [saved] = useState(() => loadDesktop(store, guessBounds(), (id) => all.some((s) => s.id === id)));
  const [wm, dispatch] = useReducer(wmReduce, saved.wm);
  const [phoneOpen, setPhoneOpen] = useState(saved.phoneOpen);
  // The notification the taskbar's pause note jumped to (v_notifications row id).
  const [jumpTo, setJumpTo] = useState<number | null>(null);

  // The desktop's size follows the page (and so the outer window).
  const desk = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = desk.current;
    if (!el) return;
    const measure = () => {
      // No layout (a test's DOM) measures as nothing: keep the guess.
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        dispatch({ kind: "bounds", size: { w: el.clientWidth, h: el.clientHeight } });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Saved a moment after it changes, and at once when the page hides or the desktop goes.
  const latest = useRef({ wm, phoneOpen });
  latest.current = { wm, phoneOpen };
  const dirty = useRef(false);
  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    saveDesktop(store, latest.current);
  }, [store]);
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the windows and the phone are what is saved; a change to either schedules the write
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    const t = setTimeout(flush, DESKTOP_WRITE_DELAY_MS);
    return () => clearTimeout(t);
  }, [wm.windows, phoneOpen, flush]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  // `openApp` (links/nav.ts) opens or focuses a window; an app the desktop does not list is ignored.
  const open = useCallback(
    (id: string, route: string | null = null) => {
      const spec = specOf(id);
      if (!spec) return;
      dispatch({ kind: "open", app: id, route, singleton: spec.singleton, size: spec.defaultSize });
    },
    [specOf],
  );
  useEffect(() => {
    setAppOpener(open);
    return () => setAppOpener(null);
  }, [open]);

  // A game that starts on an empty desktop opens `firstApp`, so the player has something to read
  // (D1050). Once: windows the player closes afterwards stay closed.
  const opened = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, with the desktop as first read
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (firstApp !== null && !wm.windows.some((w) => specOf(w.app) !== undefined)) open(firstApp);
  }, []);

  const togglePhone = useCallback(() => {
    setJumpTo(null);
    setPhoneOpen((o) => !o);
  }, []);
  const showNotification = useCallback((id: number) => {
    setJumpTo(id);
    setPhoneOpen(true);
  }, []);

  // A window of an app that is not listed now (a debug app with Omniscient off) waits unseen.
  const windows = useMemo(() => wm.windows.filter((w) => specOf(w.app) !== undefined), [wm.windows, specOf]);
  const focused = useMemo(() => focusedId({ ...wm, windows }), [wm, windows]);

  return (
    <div className="os" data-testid="desktop">
      <div className="os-desk" ref={desk}>
        <Wallpaper />
        <ul className="os-icons" aria-label="Apps">
          {listed.map((spec) => (
            <li key={spec.id}>
              <button
                type="button"
                className="os-app-icon"
                data-testid={`app-${spec.id}`}
                title={`Open ${spec.title} (double-click)`}
                onDoubleClick={() => open(spec.id)}
                onClick={(e) => {
                  // Enter or Space on the focused icon (a click with no pointer) opens it too.
                  if (e.detail === 0) open(spec.id);
                }}
              >
                <Icon name={spec.icon} size={34} />
                <span>{spec.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="os-windows">
          {windows.map((w) => {
            const spec = specOf(w.app);
            if (!spec || w.state === "minimised") return null;
            return (
              <Window
                key={w.id}
                win={w}
                spec={spec}
                focused={focused === w.id}
                bounds={wm.bounds}
                dispatch={dispatch}
              />
            );
          })}
        </div>
        <Phone open={phoneOpen} onToggle={togglePhone} apps={listed} jumpTo={jumpTo} />
        {children}
      </div>
      <Taskbar
        apps={listed}
        windows={windows}
        specOf={specOf}
        focused={focused}
        dispatch={dispatch}
        onOpenApp={open}
        phoneOpen={phoneOpen}
        onTogglePhone={togglePhone}
        onShowNotification={showNotification}
      />
    </div>
  );
}
