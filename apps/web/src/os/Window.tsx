// One window of the desktop (pivot 15.2): the title bar with the app's name and address, the
// minimise, maximise and close buttons, eight resize handles and the app's content.
//
// - Dragging and resizing capture the pointer on the handle pressed, so the drag carries on over
//   the app's content, other windows and outside the page. A drag released at the left or right
//   edge of the desktop snaps to that half; at the top edge it maximises.
// - Pressing or focusing anything in a window brings it to the front.
// - With the title bar focused: arrows move, Shift+arrows resize, Ctrl+Left and Ctrl+Right snap,
//   Ctrl+Up maximises or restores, Ctrl+Down minimises. Double-clicking it maximises or restores.
// - A minimised window is not drawn at all (Desktop.tsx), so its app unmounts and its view
//   subscriptions drop; the window manager keeps its route for when it comes back.
// - The window is no dialog: an app's keyboard shortcuts work inside it (the old top bar treated a
//   dialog as a place to type).

import {
  Component,
  type Dispatch,
  type KeyboardEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useRef,
} from "react";
import type { AppSpec } from "./apps.ts";
import { Icon } from "./icons.tsx";
import { formatUrl } from "./url.ts";
import { type Edge, type Rect, resizeBy, type Size, shownRect, type Win, type WmAction } from "./wm.ts";

/** How close to a desktop edge a drag must end to snap or maximise, in pixels. */
export const SNAP_MARGIN = 12;
/** How far an arrow key moves or resizes a window, in pixels. */
export const KEY_STEP = 24;

const EDGES: readonly Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** Keeps a crashed app inside its window: the desktop and the other windows carry on. */
class AppBoundary extends Component<{ title: string; children: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };

  static getDerivedStateFromError(e: unknown): { error: string } {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div className="os-window-fault" role="alert">
        <p>{this.props.title} stopped working.</p>
        <p className="os-dim">{this.state.error}</p>
        <p className="os-dim">Close this window and open the app again.</p>
      </div>
    );
  }
}

/** The app's content, apart from the frame so a drag does not render the app again. */
const AppBody = memo(function AppBody({
  spec,
  id,
  route,
  dispatch,
}: {
  spec: AppSpec;
  id: string;
  route: string | null;
  dispatch: Dispatch<WmAction>;
}) {
  const onRoute = useCallback(
    (r: string | null) => dispatch({ kind: "route", id, route: r }),
    [dispatch, id],
  );
  const close = useCallback(() => dispatch({ kind: "close", id }), [dispatch, id]);
  const setTitle = useCallback(
    (title: string | null) => dispatch({ kind: "title", id, title }),
    [dispatch, id],
  );
  const Body = spec.Component;
  return (
    <AppBoundary title={spec.title}>
      <Suspense fallback={<p className="os-window-loading">Opening {spec.title}...</p>}>
        <Body route={route} onRoute={onRoute} close={close} setTitle={setTitle} />
      </Suspense>
    </AppBoundary>
  );
});

interface Drag {
  pointer: number;
  x: number;
  y: number;
  rect: Rect;
  /** The desktop's top left in the viewport when the drag began. */
  origin: { x: number; y: number };
}

function capture(e: PointerEvent<HTMLElement>): void {
  try {
    e.currentTarget.setPointerCapture?.(e.pointerId);
  } catch {
    // A pointer that is already gone (or a test's made-up one): the drag works while it stays over.
  }
}

function release(e: PointerEvent<HTMLElement>): void {
  try {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  } catch {
    // Not captured.
  }
}

export interface WindowProps {
  win: Win;
  spec: AppSpec;
  focused: boolean;
  bounds: Size;
  dispatch: Dispatch<WmAction>;
}

function WindowInner({ win, spec, focused, bounds, dispatch }: WindowProps) {
  const drag = useRef<Drag | null>(null);
  const { id } = win;
  const rect = shownRect(win, bounds);
  const maximised = win.state === "maximised";

  const begin = (e: PointerEvent<HTMLElement>): Drag | null => {
    if (e.button !== 0) return null;
    const desk = e.currentTarget.closest(".os-desk")?.getBoundingClientRect();
    capture(e);
    return {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      rect: win.rect,
      origin: { x: desk?.left ?? 0, y: desk?.top ?? 0 },
    };
  };

  const onTitleDown = (e: PointerEvent<HTMLElement>) => {
    // The buttons in the title bar are not handles.
    if (e.target instanceof Element && e.target.closest("button")) return;
    if (maximised) return;
    drag.current = begin(e);
  };
  const onTitleMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    dispatch({ kind: "move", id, x: d.rect.x + e.clientX - d.x, y: d.rect.y + e.clientY - d.y });
  };
  const onTitleUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    release(e);
    // Only a real drag snaps: a click on a title bar at the screen's edge does not.
    if (e.clientX === d.x && e.clientY === d.y) return;
    const x = e.clientX - d.origin.x;
    const y = e.clientY - d.origin.y;
    if (y <= SNAP_MARGIN) dispatch({ kind: "maximise", id });
    else if (x <= SNAP_MARGIN) dispatch({ kind: "snap", id, side: "left" });
    else if (x >= bounds.w - SNAP_MARGIN) dispatch({ kind: "snap", id, side: "right" });
  };
  const onTitleCancel = () => {
    drag.current = null;
  };

  const onEdgeDown = (e: PointerEvent<HTMLElement>) => {
    drag.current = begin(e);
  };
  const onEdgeMove = (edge: Edge) => (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    dispatch({ kind: "resize", id, rect: resizeBy(d.rect, edge, e.clientX - d.x, e.clientY - d.y, bounds) });
  };
  const onEdgeUp = (e: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointer !== e.pointerId) return;
    drag.current = null;
    release(e);
  };

  const onTitleKey = (e: KeyboardEvent<HTMLElement>) => {
    // Keys pressed on the buttons belong to the buttons.
    if (e.target !== e.currentTarget || e.altKey || e.metaKey) return;
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (dx === 0 && dy === 0) return;
    e.preventDefault();
    if (e.ctrlKey) {
      if (dx < 0) dispatch({ kind: "snap", id, side: "left" });
      else if (dx > 0) dispatch({ kind: "snap", id, side: "right" });
      else if (dy < 0) dispatch({ kind: maximised || win.restore ? "restore" : "maximise", id });
      else dispatch({ kind: "minimise", id });
    } else if (e.shiftKey) {
      dispatch({ kind: "resize", id, rect: resizeBy(win.rect, "se", dx * KEY_STEP, dy * KEY_STEP, bounds) });
    } else {
      dispatch({ kind: "move", id, x: win.rect.x + dx * KEY_STEP, y: win.rect.y + dy * KEY_STEP });
    }
  };

  const focus = () => {
    if (!focused) dispatch({ kind: "focus", id });
  };

  const address = formatUrl({ app: win.app, route: win.route });
  return (
    <section
      className="os-window"
      data-testid={`win-${id}`}
      data-app={win.app}
      data-focused={focused}
      data-state={win.state}
      aria-label={spec.title}
      onPointerDownCapture={focus}
      onFocusCapture={focus}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: win.z,
        // An app may size things to its window where the old layout used the viewport.
        ["--win-w" as string]: `${rect.w}px`,
        ["--win-h" as string]: `${rect.h}px`,
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the title bar is the window's handle, focusable so the window can be moved from the keyboard */}
      <header
        className="os-titlebar"
        tabIndex={0}
        title="Drag to move. Arrows move, Shift+arrows resize, Ctrl+arrows snap, maximise and minimise."
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleCancel}
        onDoubleClick={(e) => {
          if (e.target instanceof Element && e.target.closest("button")) return;
          dispatch({ kind: maximised || win.restore ? "restore" : "maximise", id });
        }}
        onKeyDown={onTitleKey}
      >
        <Icon name={spec.icon} size={16} />
        <span className="os-title">{win.title ?? spec.title}</span>
        <span className="os-address" data-testid={`win-${id}-address`}>
          {address}
        </span>
        <span className="os-window-buttons">
          <button
            type="button"
            className="os-wb os-wb-min"
            data-testid={`win-${id}-min`}
            aria-label={`Minimise ${spec.title}`}
            title="Minimise"
            onClick={() => dispatch({ kind: "minimise", id })}
          >
            <Icon name="minimise" size={14} />
          </button>
          <button
            type="button"
            className="os-wb os-wb-max"
            data-testid={`win-${id}-max`}
            aria-label={`${maximised ? "Restore" : "Maximise"} ${spec.title}`}
            title={maximised ? "Restore" : "Maximise"}
            onClick={() => dispatch({ kind: "maximise", id })}
          >
            <Icon name={maximised ? "restore" : "maximise"} size={14} />
          </button>
          <button
            type="button"
            className="os-wb os-wb-close"
            data-testid={`win-${id}-close`}
            aria-label={`Close ${spec.title}`}
            title="Close"
            onClick={() => dispatch({ kind: "close", id })}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      </header>
      <div className="os-window-body">
        <AppBody spec={spec} id={id} route={win.route} dispatch={dispatch} />
      </div>
      {!maximised &&
        EDGES.map((edge) => (
          <div
            key={edge}
            className={`os-edge os-edge-${edge}`}
            data-testid={`win-${id}-edge-${edge}`}
            onPointerDown={onEdgeDown}
            onPointerMove={onEdgeMove(edge)}
            onPointerUp={onEdgeUp}
            onPointerCancel={onTitleCancel}
          />
        ))}
    </section>
  );
}

export const Window = memo(WindowInner);
