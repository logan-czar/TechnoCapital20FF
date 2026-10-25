// Links and hover name cards (crates/game/src/links/mod.rs, M9 A2; D454; 20-ui 20.3.3): anything
// with a name is a link to its page. Click opens it in the focused pane, Shift+click or a middle
// click in a new pane (nav.ts). Hovering a link for HOVER_DELAY_MS shows a compact name card with a
// few facts and links (cards.ts), read from the views only (spec 9); it stays HOVER_GRACE_MS after
// the pointer leaves, so the pointer can reach the card and follow its links.

import {
  createContext,
  type MouseEvent,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PageRef } from "../pages/ref.ts";
import { usePageViews } from "../pages/views.ts";
import { CARD_VIEWS, card, lineShown } from "./cards.ts";
import { useNameIndex } from "./names.ts";
import { BUTTON_MIDDLE, clickTarget, useNav } from "./nav.ts";

/** Milliseconds a link is hovered before its card shows (20-ui 20.3.3 (T)). */
export const HOVER_DELAY_MS = 300;
/** Milliseconds a card stays after the pointer leaves the link. */
export const HOVER_GRACE_MS = 250;
/** The card's width in pixels. */
export const CARD_WIDTH = 320;

interface HoverApi {
  enter: (page: PageRef, x: number, y: number) => void;
  leave: () => void;
  /** Hides the card now (a click, or the hovered link went away). */
  hide: () => void;
}

const HoverContext = createContext<HoverApi | null>(null);

export interface LinkProps {
  page: PageRef;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** A link to a page. */
function LinkInner({ page, children, className, title }: LinkProps) {
  const nav = useNav();
  const hover = useContext(HoverContext);
  const hovered = useRef(false);
  // A link that goes away under the pointer (its page changed) takes its card with it.
  useEffect(
    () => () => {
      if (hovered.current) hover?.hide();
    },
    [hover],
  );
  const open = (e: MouseEvent) => {
    const target = clickTarget(e.button, e.shiftKey);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    hover?.hide();
    nav.open(page, target);
  };
  return (
    <button
      type="button"
      className={`linkbtn${className ? ` ${className}` : ""}`}
      title={title}
      onClick={open}
      onAuxClick={(e) => {
        if (e.button === BUTTON_MIDDLE) open(e);
      }}
      onMouseDown={(e) => {
        // A middle press would start the browser's autoscroll.
        if (e.button === BUTTON_MIDDLE) e.preventDefault();
      }}
      onMouseEnter={(e) => {
        hovered.current = true;
        hover?.enter(page, e.clientX, e.clientY);
      }}
      onMouseLeave={() => {
        hovered.current = false;
        hover?.leave();
      }}
    >
      {children}
    </button>
  );
}

export const Link = memo(LinkInner);

/** The card itself, with the views it reads. */
function NameCard({ page }: { page: PageRef }) {
  const v = usePageViews(CARD_VIEWS);
  const index = useNameIndex();
  const c = card(page, v, index);
  return (
    <>
      <div className="card-head">
        <Link page={page} className="card-title">
          {c.title}
        </Link>
        <span className="muted small">{c.kind}</span>
      </div>
      {c.lines.map((l, i) => {
        const shown = lineShown(l);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: card lines have no identity but their place
          <div key={i} className="card-line">
            <span className="card-label muted">{l.label}</span>
            {l.link ? (
              <Link page={l.link}>{l.value}</Link>
            ) : (
              <span className={`tone-${shown.tone}`}>{shown.text}</span>
            )}
          </div>
        );
      })}
      <div className="muted small">Click: open | Shift+click or middle: new pane</div>
    </>
  );
}

interface Shown {
  page: PageRef;
  x: number;
  y: number;
}

type Timer = RefObject<ReturnType<typeof setTimeout> | null>;

function clear(t: Timer): void {
  if (t.current !== null) clearTimeout(t.current);
  t.current = null;
}

/**
 * Holds the hover card for every link under it (one card at a time, as in Rust). Mounted once
 * around the workspace.
 */
export function HoverCards({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = useCallback((page: PageRef, x: number, y: number) => {
    clear(hideTimer);
    clear(showTimer);
    showTimer.current = setTimeout(() => setShown({ page, x, y }), HOVER_DELAY_MS);
  }, []);
  const leave = useCallback(() => {
    clear(showTimer);
    clear(hideTimer);
    hideTimer.current = setTimeout(() => setShown(null), HOVER_GRACE_MS);
  }, []);
  useEffect(
    () => () => {
      clear(showTimer);
      clear(hideTimer);
    },
    [],
  );
  const hide = useCallback(() => {
    clear(showTimer);
    clear(hideTimer);
    setShown(null);
  }, []);
  const api = useRef<HoverApi>({ enter, leave, hide });
  // Next to the cursor and inside the window.
  const w = typeof window === "undefined" ? 1920 : window.innerWidth;
  const h = typeof window === "undefined" ? 1080 : window.innerHeight;
  const left = shown
    ? shown.x + 16 + CARD_WIDTH > w
      ? Math.max(0, shown.x - 16 - CARD_WIDTH)
      : shown.x + 16
    : 0;
  const top = shown ? Math.min(shown.y + 18, Math.max(0, h - 180)) : 0;
  return (
    <HoverContext.Provider value={api.current}>
      {children}
      {shown && (
        <div
          className="hover-card"
          role="tooltip"
          style={{ left, top, width: CARD_WIDTH }}
          onMouseEnter={() => clear(hideTimer)}
          onMouseLeave={leave}
        >
          <NameCard page={shown.page} />
        </div>
      )}
    </HoverContext.Provider>
  );
}
