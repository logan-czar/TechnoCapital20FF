// The window manager's reducer (os/wm.ts, pivot 15.2): opening with singletons and default sizes,
// cascade placement, focus and stacking, move and resize clamped to the desktop, minimise,
// maximise, restore, snapping to halves, closing, the outer window shrinking, and what a saved
// desktop reads back as.

import { describe, expect, it } from "vitest";
import {
  CASCADE_ORIGIN,
  CASCADE_STEP,
  cascadeRect,
  findWin,
  fitRect,
  focusedId,
  MIN_H,
  MIN_W,
  type Rect,
  resizeBy,
  type Size,
  shownRect,
  snapRect,
  type Win,
  type WmAction,
  type WmState,
  wmFromSaved,
  wmInit,
  wmReduce,
  wmToSaved,
} from "../../src/os/wm.ts";

const DESK: Size = { w: 1600, h: 900 };
const open = (app: string, singleton = false, route: string | null = null): WmAction => ({
  kind: "open",
  app,
  route,
  singleton,
  size: { width: 600, height: 400 },
});
const run = (s: WmState, ...actions: WmAction[]): WmState => actions.reduce(wmReduce, s);
const win = (s: WmState, id: string): Win => {
  const w = findWin(s, id);
  if (!w) throw new Error(`no window ${id}`);
  return w;
};
/** True when `r` lies wholly inside `b`. */
const inside = (r: Rect, b: Size): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= b.w && r.y + r.h <= b.h;

describe("open", () => {
  it("opens a window at its default size, focused, at the cascade's first place", () => {
    const s = run(wmInit(DESK), open("news"));
    expect(s.windows).toHaveLength(1);
    const w = win(s, "news-1");
    expect(w).toMatchObject({ app: "news", route: null, state: "normal", restore: null });
    expect(w.rect).toEqual({ x: CASCADE_ORIGIN, y: CASCADE_ORIGIN, w: 600, h: 400 });
    expect(focusedId(s)).toBe("news-1");
  });

  it("gives each window of a multi-window app its own id, and each a step down and right", () => {
    const s = run(wmInit(DESK), open("news"), open("news"), open("polls"));
    expect(s.windows.map((w) => w.id)).toEqual(["news-1", "news-2", "polls-3"]);
    expect(win(s, "news-2").rect.x).toBe(CASCADE_ORIGIN + CASCADE_STEP);
    expect(win(s, "polls-3").rect.y).toBe(CASCADE_ORIGIN + 2 * CASCADE_STEP);
    expect(focusedId(s)).toBe("polls-3");
  });

  it("keeps one window of a singleton: opening it again focuses it and sets its route", () => {
    let s = run(wmInit(DESK), open("debug", true), open("news"));
    expect(focusedId(s)).toBe("news-1");
    s = run(s, open("debug", true, "pane/3"));
    expect(s.windows.map((w) => w.id)).toEqual(["debug", "news-1"]);
    expect(win(s, "debug").route).toBe("pane/3");
    expect(focusedId(s)).toBe("debug");
  });

  it("brings a minimised singleton back when it is opened again", () => {
    const s = run(wmInit(DESK), open("debug", true), { kind: "minimise", id: "debug" }, open("debug", true));
    expect(win(s, "debug").state).toBe("normal");
    expect(focusedId(s)).toBe("debug");
  });

  it("fits a default size larger than the desktop to the desktop", () => {
    const s = wmReduce(wmInit({ w: 1366, h: 722 }), {
      kind: "open",
      app: "debug",
      route: null,
      singleton: true,
      size: { width: 1560, height: 900 },
    });
    expect(win(s, "debug").rect).toEqual({ x: 0, y: 0, w: 1366, h: 722 });
  });
});

describe("cascade placement", () => {
  it("wraps to the first place when the next step would leave the desktop", () => {
    const size = { width: 600, height: 400 };
    const small: Size = { w: 700, h: 500 };
    // Room for (100 - 24) / 28 = 2 steps and the origin: three places, then round again.
    const xs = [0, 1, 2, 3, 4].map((n) => cascadeRect(n, size, small).x);
    expect(xs).toEqual([24, 52, 80, 24, 52]);
    for (let n = 0; n < 12; n++) expect(inside(cascadeRect(n, size, small), small)).toBe(true);
  });

  it("puts a window that fills the desktop at its corner", () => {
    expect(cascadeRect(3, { width: 4000, height: 4000 }, DESK)).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
  });
});

describe("focus and stacking", () => {
  it("raises the focused window above the others and keeps the rest in order", () => {
    let s = run(wmInit(DESK), open("a"), open("b"), open("c"));
    s = run(s, { kind: "focus", id: "a-1" });
    const order = [...s.windows].sort((x, y) => x.z - y.z).map((w) => w.id);
    expect(order).toEqual(["b-2", "c-3", "a-1"]);
    expect(focusedId(s)).toBe("a-1");
  });

  it("returns the same state when the focused window is focused again", () => {
    const s = run(wmInit(DESK), open("a"), open("b"));
    expect(wmReduce(s, { kind: "focus", id: "b-2" })).toBe(s);
  });

  it("ignores an action on a window that is not there", () => {
    const s = run(wmInit(DESK), open("a"));
    for (const kind of ["focus", "minimise", "maximise", "restore", "close", "toggle"] as const) {
      expect(wmReduce(s, { kind, id: "gone" })).toBe(s);
    }
  });
});

describe("move and resize", () => {
  it("moves a window, and stops it at the desktop's edges", () => {
    let s = run(wmInit(DESK), open("a"));
    s = run(s, { kind: "move", id: "a-1", x: 300, y: 200 });
    expect(win(s, "a-1").rect).toEqual({ x: 300, y: 200, w: 600, h: 400 });
    s = run(s, { kind: "move", id: "a-1", x: -50, y: 5000 });
    expect(win(s, "a-1").rect).toEqual({ x: 0, y: 500, w: 600, h: 400 });
    s = run(s, { kind: "move", id: "a-1", x: 5000, y: -9 });
    expect(win(s, "a-1").rect).toEqual({ x: 1000, y: 0, w: 600, h: 400 });
  });

  it("leaves the other windows' objects alone, so they do not render again", () => {
    const s = run(wmInit(DESK), open("a"), open("b"));
    const t = run(s, { kind: "move", id: "b-2", x: 400, y: 300 });
    expect(win(t, "a-1")).toBe(win(s, "a-1"));
  });

  it("does not move or resize a maximised window", () => {
    const s = run(wmInit(DESK), open("a"), { kind: "maximise", id: "a-1" });
    expect(wmReduce(s, { kind: "move", id: "a-1", x: 300, y: 200 })).toBe(s);
    expect(wmReduce(s, { kind: "resize", id: "a-1", rect: { x: 0, y: 0, w: 500, h: 300 } })).toBe(s);
  });

  it("resizes from an edge with the opposite edge fixed", () => {
    const start: Rect = { x: 200, y: 100, w: 600, h: 400 };
    expect(resizeBy(start, "e", 50, 99, DESK)).toEqual({ x: 200, y: 100, w: 650, h: 400 });
    expect(resizeBy(start, "w", 50, 99, DESK)).toEqual({ x: 250, y: 100, w: 550, h: 400 });
    expect(resizeBy(start, "n", 99, -40, DESK)).toEqual({ x: 200, y: 60, w: 600, h: 440 });
    expect(resizeBy(start, "se", 30, 20, DESK)).toEqual({ x: 200, y: 100, w: 630, h: 420 });
    expect(resizeBy(start, "nw", -30, -20, DESK)).toEqual({ x: 170, y: 80, w: 630, h: 420 });
  });

  it("stops a resize at the minimum size and at the desktop's edges", () => {
    const start: Rect = { x: 200, y: 100, w: 600, h: 400 };
    // Dragging the left edge far right: the right edge stays, the width stops at the minimum.
    expect(resizeBy(start, "w", 5000, 0, DESK)).toEqual({ x: 800 - MIN_W, y: 100, w: MIN_W, h: 400 });
    expect(resizeBy(start, "s", 0, -5000, DESK)).toEqual({ x: 200, y: 100, w: 600, h: MIN_H });
    expect(resizeBy(start, "se", 5000, 5000, DESK)).toEqual({ x: 200, y: 100, w: 1400, h: 800 });
    expect(resizeBy(start, "nw", -5000, -5000, DESK)).toEqual({ x: 0, y: 0, w: 800, h: 500 });
  });

  it("applies a resize through the reducer", () => {
    let s = run(wmInit(DESK), open("a"));
    const start = win(s, "a-1").rect;
    s = run(s, { kind: "resize", id: "a-1", rect: resizeBy(start, "se", 100, 50, DESK) });
    expect(win(s, "a-1").rect).toEqual({ ...start, w: 700, h: 450 });
  });
});

describe("minimise, maximise and restore", () => {
  it("passes focus to the next window down when the focused one is minimised", () => {
    let s = run(wmInit(DESK), open("a"), open("b"));
    s = run(s, { kind: "minimise", id: "b-2" });
    expect(win(s, "b-2").state).toBe("minimised");
    expect(focusedId(s)).toBe("a-1");
    s = run(s, { kind: "minimise", id: "a-1" });
    expect(focusedId(s)).toBeNull();
  });

  it("draws a maximised window over the whole desktop and keeps its own rect for later", () => {
    let s = run(wmInit(DESK), open("a"), { kind: "move", id: "a-1", x: 300, y: 200 });
    const before = win(s, "a-1").rect;
    s = run(s, { kind: "maximise", id: "a-1" });
    expect(win(s, "a-1").state).toBe("maximised");
    expect(shownRect(win(s, "a-1"), s.bounds)).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
    s = run(s, { kind: "maximise", id: "a-1" });
    expect(win(s, "a-1").state).toBe("normal");
    expect(shownRect(win(s, "a-1"), s.bounds)).toEqual(before);
  });

  it("brings a minimised window back as it was: maximised stays maximised", () => {
    let s = run(wmInit(DESK), open("a"), { kind: "maximise", id: "a-1" }, { kind: "minimise", id: "a-1" });
    expect(win(s, "a-1")).toMatchObject({ state: "minimised", prev: "maximised" });
    s = run(s, { kind: "restore", id: "a-1" });
    expect(win(s, "a-1").state).toBe("maximised");
    s = run(s, { kind: "restore", id: "a-1" });
    expect(win(s, "a-1").state).toBe("normal");
  });

  it("toggles from the taskbar: minimise the focused, focus another, bring back a minimised", () => {
    let s = run(wmInit(DESK), open("a"), open("b"));
    s = run(s, { kind: "toggle", id: "a-1" });
    expect(focusedId(s)).toBe("a-1");
    s = run(s, { kind: "toggle", id: "a-1" });
    expect(win(s, "a-1").state).toBe("minimised");
    expect(focusedId(s)).toBe("b-2");
    s = run(s, { kind: "toggle", id: "a-1" });
    expect(win(s, "a-1").state).toBe("normal");
    expect(focusedId(s)).toBe("a-1");
  });
});

describe("snap", () => {
  it("snaps to a half of the desktop and restores the rect from before", () => {
    let s = run(wmInit(DESK), open("a"), { kind: "move", id: "a-1", x: 300, y: 200 });
    const before = win(s, "a-1").rect;
    s = run(s, { kind: "snap", id: "a-1", side: "left" });
    expect(win(s, "a-1").rect).toEqual({ x: 0, y: 0, w: 800, h: 900 });
    // Snapping again to the other side keeps the first rect to come back to.
    s = run(s, { kind: "snap", id: "a-1", side: "right" });
    expect(win(s, "a-1").rect).toEqual({ x: 800, y: 0, w: 800, h: 900 });
    s = run(s, { kind: "restore", id: "a-1" });
    expect(win(s, "a-1")).toMatchObject({ rect: before, restore: null });
  });

  it("covers an odd-width desktop with the two halves, neither overlapping", () => {
    const odd: Size = { w: 1367, h: 700 };
    const l = snapRect("left", odd);
    const r = snapRect("right", odd);
    expect(l.x + l.w).toBe(r.x);
    expect(r.x + r.w).toBe(odd.w);
  });

  it("un-maximises a maximised window that is snapped", () => {
    const s = run(
      wmInit(DESK),
      open("a"),
      { kind: "maximise", id: "a-1" },
      { kind: "snap", id: "a-1", side: "left" },
    );
    expect(win(s, "a-1")).toMatchObject({ state: "normal", rect: { x: 0, y: 0, w: 800, h: 900 } });
  });

  it("forgets the rect to restore once the player resizes the snapped window", () => {
    let s = run(wmInit(DESK), open("a"), { kind: "snap", id: "a-1", side: "left" });
    s = run(s, { kind: "resize", id: "a-1", rect: { x: 0, y: 0, w: 700, h: 900 } });
    expect(win(s, "a-1").restore).toBeNull();
  });
});

describe("close", () => {
  it("removes the window and passes focus on", () => {
    let s = run(wmInit(DESK), open("a"), open("b"));
    s = run(s, { kind: "close", id: "b-2" });
    expect(s.windows.map((w) => w.id)).toEqual(["a-1"]);
    expect(focusedId(s)).toBe("a-1");
  });

  it("does not reuse a closed window's number", () => {
    const s = run(wmInit(DESK), open("a"), { kind: "close", id: "a-1" }, open("a"));
    expect(s.windows.map((w) => w.id)).toEqual(["a-2"]);
  });
});

describe("route", () => {
  it("keeps where the app navigated to", () => {
    let s = run(wmInit(DESK), open("a"));
    s = run(s, { kind: "route", id: "a-1", route: "race/12" });
    expect(win(s, "a-1").route).toBe("race/12");
    expect(wmReduce(s, { kind: "route", id: "a-1", route: "race/12" })).toBe(s);
  });
});

describe("the desktop's bounds", () => {
  it("fits every window inside a smaller desktop: moved first, then shrunk", () => {
    let s = run(wmInit({ w: 1920, h: 1034 }), open("a"), open("b"));
    s = run(
      s,
      { kind: "move", id: "a-1", x: 1300, y: 600 },
      { kind: "resize", id: "b-2", rect: { x: 100, y: 50, w: 1700, h: 950 } },
      { kind: "bounds", size: { w: 1366, h: 722 } },
    );
    // a keeps its size and slides in; b is larger than the desktop and is cut to it.
    expect(win(s, "a-1").rect).toEqual({ x: 766, y: 322, w: 600, h: 400 });
    expect(win(s, "b-2").rect).toEqual({ x: 0, y: 0, w: 1366, h: 722 });
    for (const w of s.windows) expect(inside(w.rect, s.bounds)).toBe(true);
  });

  it("keeps a snapped window a half of the new desktop", () => {
    let s = run(wmInit(DESK), open("a"), { kind: "snap", id: "a-1", side: "right" });
    s = run(s, { kind: "bounds", size: { w: 1200, h: 700 } });
    expect(win(s, "a-1").rect).toEqual({ x: 600, y: 0, w: 600, h: 700 });
    s = run(s, { kind: "bounds", size: { w: 2000, h: 1000 } });
    expect(win(s, "a-1").rect).toEqual({ x: 1000, y: 0, w: 1000, h: 1000 });
  });

  it("re-snaps a snapped window through every size change, a tiny desktop and back included (D1050)", () => {
    let s = run(wmInit(DESK), open("a"), open("b"), { kind: "snap", id: "a-1", side: "left" });
    s = run(s, { kind: "snap", id: "b-2", side: "right" });
    const sizes: Size[] = [
      { w: 1300, h: 900 },
      { w: 1300, h: 700 },
      { w: 500, h: 700 },
      { w: 2000, h: 1000 },
      { w: 2001, h: 1000 },
    ];
    for (const size of sizes) {
      s = run(s, { kind: "bounds", size });
      expect(win(s, "a-1").rect).toEqual(snapRect("left", size));
      expect(win(s, "b-2").rect).toEqual(snapRect("right", size));
    }
  });

  it("stops following the desktop once the player moves or resizes a snapped window", () => {
    let s = run(wmInit(DESK), open("a"), open("b"), { kind: "snap", id: "a-1", side: "left" });
    s = run(s, { kind: "snap", id: "b-2", side: "left" });
    s = run(
      s,
      { kind: "move", id: "a-1", x: 100, y: 0 },
      { kind: "resize", id: "b-2", rect: { x: 0, y: 0, w: 700, h: 900 } },
    );
    expect(win(s, "a-1").snap).toBeNull();
    expect(win(s, "b-2").snap).toBeNull();
    s = run(s, { kind: "bounds", size: { w: 1400, h: 900 } });
    expect(win(s, "a-1").rect).toEqual({ x: 100, y: 0, w: 800, h: 900 });
    expect(win(s, "b-2").rect).toEqual({ x: 0, y: 0, w: 700, h: 900 });
  });

  it("puts a snapped window back to its old rect on restore, and ends the snap", () => {
    let s = run(wmInit(DESK), open("a"), { kind: "snap", id: "a-1", side: "right" });
    const before = win(s, "a-1").restore;
    s = run(s, { kind: "restore", id: "a-1" });
    expect(win(s, "a-1")).toMatchObject({ restore: null, snap: null, rect: before });
  });

  it("re-snaps a window saved before windows knew their snap, by the half it fills", () => {
    const doc = {
      seq: 3,
      windows: [
        {
          id: "a-1",
          app: "a",
          rect: { x: 0, y: 0, w: 800, h: 900 },
          restore: { x: 20, y: 20, w: 600, h: 400 },
        },
        {
          id: "a-2",
          app: "a",
          rect: { x: 800, y: 0, w: 800, h: 900 },
          restore: { x: 20, y: 20, w: 600, h: 400 },
        },
        { id: "a-3", app: "a", rect: { x: 0, y: 0, w: 800, h: 900 }, restore: null },
      ],
    };
    let s = wmFromSaved(doc, DESK, () => true);
    s = run(s, { kind: "bounds", size: { w: 1000, h: 600 } });
    expect(win(s, "a-1").rect).toEqual({ x: 0, y: 0, w: 500, h: 600 });
    expect(win(s, "a-2").rect).toEqual({ x: 500, y: 0, w: 500, h: 600 });
    // Not snapped: only fitted.
    expect(win(s, "a-3").rect).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("keeps whole pixels: a fractional pointer, size or desktop never gives a fractional rect (D1050)", () => {
    let s = run(wmInit(DESK), open("a"));
    s = run(s, { kind: "move", id: "a-1", x: 100.4, y: 50.6 });
    expect(win(s, "a-1").rect).toEqual({ x: 100, y: 51, w: 600, h: 400 });
    s = run(s, { kind: "resize", id: "a-1", rect: { x: 10.5, y: 20.25, w: 640.5, h: 410.49 } });
    expect(win(s, "a-1").rect).toEqual({ x: 11, y: 20, w: 641, h: 410 });
    expect(resizeBy({ x: 100, y: 100, w: 400, h: 300 }, "se", 10.4, 20.6, DESK)).toEqual({
      x: 100,
      y: 100,
      w: 410,
      h: 321,
    });
    expect(resizeBy({ x: 100, y: 100, w: 400, h: 300 }, "nw", 10.5, -20.5, DESK)).toEqual({
      x: 111,
      y: 80,
      w: 389,
      h: 320,
    });
    s = run(s, { kind: "bounds", size: { w: 1280.5, h: 700.4 } });
    expect(s.bounds).toEqual({ w: 1281, h: 700 });
    for (const w of s.windows) {
      for (const v of [w.rect.x, w.rect.y, w.rect.w, w.rect.h]) expect(Number.isInteger(v)).toBe(true);
    }
    expect(snapRect("right", { w: 1281.4, h: 700.2 })).toEqual({ x: 640, y: 0, w: 641, h: 700 });
  });

  it("returns the same state for the same bounds", () => {
    const s = run(wmInit(DESK), open("a"));
    expect(wmReduce(s, { kind: "bounds", size: { ...DESK } })).toBe(s);
  });

  it("lets a desktop smaller than the minimum window win", () => {
    expect(fitRect({ x: 50, y: 50, w: 600, h: 400 }, { w: 200, h: 100 })).toEqual({
      x: 0,
      y: 0,
      w: 200,
      h: 100,
    });
  });
});

describe("a saved desktop", () => {
  const known = (app: string) => app !== "gone";

  it("reads back what it wrote", () => {
    let s = run(wmInit(DESK), open("a"), open("debug", true, "x/1"), open("a"));
    s = run(
      s,
      { kind: "maximise", id: "debug" },
      { kind: "minimise", id: "a-1" },
      { kind: "snap", id: "a-2", side: "left" },
    );
    const back = wmFromSaved(JSON.parse(JSON.stringify(wmToSaved(s))), DESK, known);
    expect(back.windows.map((w) => ({ ...w, z: 0 }))).toEqual(s.windows.map((w) => ({ ...w, z: 0 })));
    expect(focusedId(back)).toBe(focusedId(s));
    // A window opened next gets a new id and goes in front.
    const next = run(back, open("a"));
    expect(next.windows.at(-1)?.id).toBe("a-3");
    expect(focusedId(next)).toBe("a-3");
  });

  it("drops windows of unknown apps, repeated ids and malformed rows, and fits the rest", () => {
    const doc = {
      seq: 1,
      windows: [
        { id: "gone-1", app: "gone", rect: { x: 0, y: 0, w: 500, h: 300 } },
        { id: "a-7", app: "a", rect: { x: 5000, y: 5000, w: 500, h: 300 }, z: 9, state: "odd", route: 4 },
        { id: "a-7", app: "a", rect: { x: 0, y: 0, w: 500, h: 300 } },
        { id: "a-8", app: "a", rect: { x: 0, y: "0", w: 500, h: 300 } },
        "nonsense",
        { id: "b", app: "b", rect: { x: 10, y: 10, w: 500, h: 300 }, z: 2, state: "minimised" },
      ],
    };
    const s = wmFromSaved(doc, DESK, known);
    expect(s.windows.map((w) => w.id)).toEqual(["a-7", "b"]);
    expect(win(s, "a-7")).toMatchObject({
      rect: { x: 1100, y: 600, w: 500, h: 300 },
      state: "normal",
      route: null,
    });
    expect(win(s, "b")).toMatchObject({ z: 1, state: "minimised" });
    expect(win(s, "a-7").z).toBe(2);
    // The next window's number is past the one in use, whatever `seq` said.
    expect(run(s, open("a")).windows.at(-1)?.id).toBe("a-8");
  });

  it("gives an empty desktop for anything that is not one", () => {
    for (const x of [null, 7, "text", [], {}, { windows: "no" }]) {
      expect(wmFromSaved(x, DESK, known)).toEqual(wmInit(DESK));
    }
  });
});
