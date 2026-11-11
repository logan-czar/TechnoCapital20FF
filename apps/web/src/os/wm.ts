// The desktop's window manager (pivot 15.2): a pure reducer over the open windows. No DOM, no
// storage and no registry here, so it runs in Node tests; Desktop.tsx feeds it pointer and keyboard
// input, and persist.ts saves what it holds.
//
// - A window keeps its own `rect` (its place when `normal`). Maximised, it is drawn over the whole
//   desktop and the rect waits; `shownRect` gives what to draw.
// - Every rect stays wholly inside the desktop: a move or resize is clamped, and when the desktop
//   itself shrinks (the outer window was resized) every window is fitted again.
// - Focus is not stored: the focused window is the highest `z` that is not minimised.

/** A window's place on the desktop, in CSS pixels from the desktop's top left. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The desktop's size: the screen without the taskbar. */
export interface Size {
  w: number;
  h: number;
}

export type WinState = "normal" | "minimised" | "maximised";

/** The half of the desktop a window snaps to. */
export type SnapSide = "left" | "right";

/** The edge or corner a resize drags. */
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface Win {
  /** The app's id for a singleton ("debug"), else the app's id and a number ("news-3"). */
  id: string;
  /** The app's id in the registry (os/apps.ts). */
  app: string;
  /** Where in the app the window is (AppProps.route). */
  route: string | null;
  /** The title the app set (AppProps.setTitle; D1037); absent or null shows `AppSpec.title`. */
  title?: string | null;
  rect: Rect;
  /** Stacking order: higher is in front. */
  z: number;
  state: WinState;
  /** What a minimised window goes back to. */
  prev: "normal" | "maximised";
  /** The rect from before a snap, which `restore` brings back; null when not snapped. */
  restore: Rect | null;
}

export interface WmState {
  /** In the order they were opened (the taskbar's order). */
  windows: readonly Win[];
  bounds: Size;
  /** The number the next non-singleton window gets. */
  seq: number;
  /** The z the next window in front gets. */
  top: number;
}

/** The smallest a window gets (a smaller desktop wins). */
export const MIN_W = 320;
export const MIN_H = 200;
/** Where the first window opens, and how far each next one steps down and right. */
export const CASCADE_ORIGIN = 24;
export const CASCADE_STEP = 28;
/** The desktop assumed before it is measured (and in tests with no layout). */
export const DEFAULT_BOUNDS: Size = { w: 1280, h: 720 };

export type WmAction =
  /** Opens a window of `app`; a singleton that is open is focused and given the route instead. */
  | {
      kind: "open";
      app: string;
      route: string | null;
      singleton: boolean;
      size: { width: number; height: number };
    }
  | { kind: "focus"; id: string }
  | { kind: "move"; id: string; x: number; y: number }
  | { kind: "resize"; id: string; rect: Rect }
  | { kind: "minimise"; id: string }
  /** Maximises, or puts a maximised window back to its rect. */
  | { kind: "maximise"; id: string }
  /** Brings back a minimised window, un-maximises a maximised one, un-snaps a snapped one. */
  | { kind: "restore"; id: string }
  | { kind: "snap"; id: string; side: SnapSide }
  | { kind: "close"; id: string }
  /** The app navigated inside the window. */
  | { kind: "route"; id: string; route: string | null }
  /** The app set its window's title (AppProps.setTitle; D1037); null is the app's own. */
  | { kind: "title"; id: string; title: string | null }
  /** The taskbar button: restores a minimised window, minimises the focused one, focuses any other. */
  | { kind: "toggle"; id: string }
  /** The desktop was measured or resized. */
  | { kind: "bounds"; size: Size };

export function wmInit(bounds: Size = DEFAULT_BOUNDS): WmState {
  return { windows: [], bounds, seq: 1, top: 1 };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** `rect` brought wholly inside `bounds`, no smaller than the minimum (unless the desktop is). */
export function fitRect(rect: Rect, bounds: Size): Rect {
  const w = clamp(rect.w, Math.min(MIN_W, bounds.w), bounds.w);
  const h = clamp(rect.h, Math.min(MIN_H, bounds.h), bounds.h);
  const x = clamp(rect.x, 0, bounds.w - w);
  const y = clamp(rect.y, 0, bounds.h - h);
  return x === rect.x && y === rect.y && w === rect.w && h === rect.h ? rect : { x, y, w, h };
}

/**
 * `start` with edge `edge` dragged by (dx, dy): the opposite edge stays where it is, the window
 * never gets smaller than the minimum and the dragged edge never leaves the desktop.
 */
export function resizeBy(start: Rect, edge: Edge, dx: number, dy: number, bounds: Size): Rect {
  const minW = Math.min(MIN_W, bounds.w);
  const minH = Math.min(MIN_H, bounds.h);
  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;
  if (edge.includes("w")) left = clamp(left + dx, 0, right - minW);
  if (edge.includes("e")) right = clamp(right + dx, left + minW, bounds.w);
  if (edge.includes("n")) top = clamp(top + dy, 0, bottom - minH);
  if (edge.includes("s")) bottom = clamp(bottom + dy, top + minH, bounds.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** The rect of a window snapped to a half of the desktop. */
export function snapRect(side: SnapSide, bounds: Size): Rect {
  const half = Math.floor(bounds.w / 2);
  return side === "left"
    ? { x: 0, y: 0, w: half, h: bounds.h }
    : { x: half, y: 0, w: bounds.w - half, h: bounds.h };
}

/** Where a new window of `size` opens: each one a step down and right of the last, wrapping. */
export function cascadeRect(count: number, size: { width: number; height: number }, bounds: Size): Rect {
  const w = clamp(size.width, Math.min(MIN_W, bounds.w), bounds.w);
  const h = clamp(size.height, Math.min(MIN_H, bounds.h), bounds.h);
  // How many steps fit before the window would leave the desktop, on the tighter axis.
  const room = Math.min(bounds.w - w, bounds.h - h) - CASCADE_ORIGIN;
  const steps = room <= 0 ? 1 : Math.floor(room / CASCADE_STEP) + 1;
  const offset = CASCADE_ORIGIN + (count % steps) * CASCADE_STEP;
  return fitRect({ x: offset, y: offset, w, h }, bounds);
}

/** What to draw a window at: the whole desktop when maximised. */
export function shownRect(win: Win, bounds: Size): Rect {
  return win.state === "maximised" ? { x: 0, y: 0, w: bounds.w, h: bounds.h } : win.rect;
}

/** The focused window's id: the one in front that is not minimised. */
export function focusedId(s: WmState): string | null {
  let best: Win | null = null;
  for (const w of s.windows) if (w.state !== "minimised" && (best === null || w.z > best.z)) best = w;
  return best?.id ?? null;
}

export function findWin(s: WmState, id: string): Win | undefined {
  return s.windows.find((w) => w.id === id);
}

/** `s` with window `id` replaced by `f(win)`; `s` itself when there is no such window or no change. */
function update(s: WmState, id: string, f: (w: Win) => Win, front = false): WmState {
  const old = findWin(s, id);
  if (!old) return s;
  let next = f(old);
  const raise = front && focusedId(s) !== id;
  if (raise) next = { ...next, z: s.top };
  if (next === old) return s;
  return {
    ...s,
    windows: s.windows.map((w) => (w === old ? next : w)),
    top: raise ? s.top + 1 : s.top,
  };
}

/** A minimised window back as it was; any other window unchanged. */
const shown = (w: Win): Win => (w.state === "minimised" ? { ...w, state: w.prev } : w);

export function wmReduce(s: WmState, a: WmAction): WmState {
  switch (a.kind) {
    case "open": {
      const open = a.singleton ? s.windows.find((w) => w.app === a.app) : undefined;
      if (open) {
        // Opening it again focuses it and sets its route (AppSpec.singleton).
        return update(
          s,
          open.id,
          (w) => (w.route === a.route ? shown(w) : { ...shown(w), route: a.route }),
          true,
        );
      }
      const id = a.singleton ? a.app : `${a.app}-${s.seq}`;
      const live = s.windows.filter((w) => w.state !== "minimised").length;
      const win: Win = {
        id,
        app: a.app,
        route: a.route,
        rect: cascadeRect(live, a.size, s.bounds),
        z: s.top,
        state: "normal",
        prev: "normal",
        restore: null,
      };
      return {
        ...s,
        windows: [...s.windows, win],
        seq: a.singleton ? s.seq : s.seq + 1,
        top: s.top + 1,
      };
    }
    case "focus":
      return update(s, a.id, shown, true);
    case "move":
      return update(s, a.id, (w) => {
        if (w.state !== "normal") return w;
        const rect = fitRect({ ...w.rect, x: a.x, y: a.y }, s.bounds);
        return rect.x === w.rect.x && rect.y === w.rect.y ? w : { ...w, rect };
      });
    case "resize":
      return update(s, a.id, (w) => {
        if (w.state !== "normal") return w;
        const rect = fitRect(a.rect, s.bounds);
        const same = rect.x === w.rect.x && rect.y === w.rect.y && rect.w === w.rect.w && rect.h === w.rect.h;
        // A size the player chose replaces the one a snap would bring back.
        return same ? w : { ...w, rect, restore: null };
      });
    case "minimise":
      return update(s, a.id, (w) =>
        w.state === "minimised" ? w : { ...w, state: "minimised", prev: w.state },
      );
    case "maximise":
      return update(
        s,
        a.id,
        (w) => {
          const v = shown(w);
          return { ...v, state: v.state === "maximised" ? "normal" : "maximised" };
        },
        true,
      );
    case "restore":
      return update(
        s,
        a.id,
        (w) => {
          if (w.state === "minimised") return shown(w);
          if (w.state === "maximised") return { ...w, state: "normal" };
          return w.restore ? { ...w, rect: fitRect(w.restore, s.bounds), restore: null } : w;
        },
        true,
      );
    case "snap":
      return update(
        s,
        a.id,
        (w) => ({
          ...w,
          state: "normal",
          rect: snapRect(a.side, s.bounds),
          restore: w.restore ?? w.rect,
        }),
        true,
      );
    case "close": {
      if (!findWin(s, a.id)) return s;
      return { ...s, windows: s.windows.filter((w) => w.id !== a.id) };
    }
    case "route":
      return update(s, a.id, (w) => (w.route === a.route ? w : { ...w, route: a.route }));
    case "title":
      return update(s, a.id, (w) => ((w.title ?? null) === a.title ? w : { ...w, title: a.title }));
    case "toggle": {
      const w = findWin(s, a.id);
      if (!w) return s;
      if (w.state !== "minimised" && focusedId(s) === a.id)
        return wmReduce(s, { kind: "minimise", id: a.id });
      return wmReduce(s, { kind: "focus", id: a.id });
    }
    case "bounds": {
      if (a.size.w === s.bounds.w && a.size.h === s.bounds.h) return s;
      const windows = s.windows.map((w) => {
        // A snapped window stays a half of the desktop, whatever the desktop's size.
        const snapped =
          w.restore !== null && w.rect.y === 0 && w.rect.h === s.bounds.h
            ? w.rect.x === 0
              ? snapRect("left", a.size)
              : snapRect("right", a.size)
            : null;
        const rect = snapped ?? fitRect(w.rect, a.size);
        return rect === w.rect ? w : { ...w, rect };
      });
      return { ...s, bounds: a.size, windows };
    }
  }
}

// ---------------------------------------------------------------- saved desktops

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function rectOf(x: unknown): Rect | null {
  if (!isRecord(x) || !num(x.x) || !num(x.y) || !num(x.w) || !num(x.h)) return null;
  return { x: x.x, y: x.y, w: x.w, h: x.h };
}

/** What is saved of the windows: everything but the bounds, which are measured. */
export function wmToSaved(s: WmState): unknown {
  return { windows: s.windows, seq: s.seq };
}

/**
 * Any parsed value as a window state (a hand-edited or old document may hold anything): windows
 * that are not well formed, repeat an id or name an app `known` refuses are dropped, rects are
 * fitted to `bounds`, and the stacking order is renumbered from 1.
 */
export function wmFromSaved(x: unknown, bounds: Size, known: (app: string) => boolean): WmState {
  const out = wmInit(bounds);
  if (!isRecord(x) || !Array.isArray(x.windows)) return out;
  const wins: Win[] = [];
  for (const w of x.windows) {
    if (!isRecord(w) || typeof w.id !== "string" || typeof w.app !== "string" || !known(w.app)) continue;
    if (wins.some((o) => o.id === w.id)) continue;
    const rect = rectOf(w.rect);
    if (!rect) continue;
    const state: WinState = w.state === "minimised" || w.state === "maximised" ? w.state : "normal";
    wins.push({
      id: w.id,
      app: w.app,
      route: typeof w.route === "string" ? w.route : null,
      rect: fitRect(rect, bounds),
      z: num(w.z) ? w.z : 0,
      state,
      prev: w.prev === "maximised" ? "maximised" : "normal",
      restore: rectOf(w.restore),
    });
  }
  // Renumber the stacking order from 1, ties to the earlier window.
  const order = wins.map((w, i) => ({ w, i })).sort((a, b) => a.w.z - b.w.z || a.i - b.i);
  order.forEach(({ w }, rank) => {
    w.z = rank + 1;
  });
  const seq = num(x.seq) && x.seq >= 1 ? Math.floor(x.seq) : 1;
  // Past every number in use, so a new window's id is new.
  const used = wins.reduce((m, w) => {
    const n = Number(w.id.slice(w.app.length + 1));
    return w.id.startsWith(`${w.app}-`) && Number.isInteger(n) ? Math.max(m, n + 1) : m;
  }, seq);
  return { windows: wins, bounds, seq: used, top: wins.length + 1 };
}
