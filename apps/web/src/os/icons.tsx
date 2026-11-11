// The desktop's icon set (os/apps.ts `AppSpec.icon` names a glyph here): line drawings on a
// 24-pixel grid, drawn in the current colour. An app that names no known glyph gets the blank
// window. Add a glyph by adding a row; the names are the M2 apps' (pivot 15.3) and the shell's own.

import type { ReactNode } from "react";

const GLYPHS: Readonly<Record<string, ReactNode>> = {
  // A front page: masthead and columns.
  news: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" />
      <path d="M6.5 8.5h11M6.5 12h4.5M6.5 15.5h4.5M14 12h3.5v3.5H14z" />
    </>
  ),
  // The social feed: stacked posts.
  feed: <path d="M4 6.5h3M9.5 6.5H20M4 12h3M9.5 12H17M4 17.5h3M9.5 17.5H19" />,
  // Polls and forecast: bars under a trend.
  polls: <path d="M4.5 19.5v-6M9.5 19.5v-9M14.5 19.5v-4M19.5 19.5V8M3.5 9l5-4 5 4.5 6.5-5.5" />,
  // Official records: a filed sheet with a seal.
  records: (
    <>
      <path d="M6.5 3.5h8l3 3v14h-11zM14.5 3.5v3h3M9 10.5h6M9 13.5h3.5" />
      <circle cx="14.5" cy="16.5" r="1.8" />
    </>
  ),
  // The betting exchange: bid and ask ladders.
  exchange: <path d="M4 7h7M4 11h5M4 15h3M13 9h7M15 13h5M17 17h3M12 4v16" />,
  // The brokerage: a price line with its last tick.
  brokerage: (
    <>
      <path d="M3.5 16l4.5-5 3.5 3 5.5-7.5" />
      <circle cx="18.5" cy="5" r="1.6" />
      <path d="M3.5 19.5h17" />
    </>
  ),
  // The browser: a meridian globe.
  browser: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c-3.2 2.4-3.2 14.6 0 17M12 3.5c3.2 2.4 3.2 14.6 0 17" />
    </>
  ),
  // The map: a folded sheet.
  map: <path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13" />,
  // The Pdoomberg terminal: a prompt.
  terminal: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <path d="M7 10l3 2.5-3 2.5M12.5 15h4.5" />
    </>
  ),
  // The debug workspace: tiled panes.
  debug: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" />
      <path d="M3.5 8h17M11 8v11.5M11 13.5h9.5" />
    </>
  ),
  // The phone.
  phone: (
    <>
      <rect x="7.5" y="3.5" width="9" height="17" rx="1.5" />
      <path d="M10.5 17.5h3" />
    </>
  ),
  // The pause settings (the taskbar's popover of the fixed pauses, pivot 2.4): a bell.
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
      <path d="M10 20.5h4" />
    </>
  ),
  // The launcher: the desktop's own mark, two orbits and a body.
  orrery: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(-28 12 12)" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // The taskbar's clock controls.
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  play: <path d="M8 5.5l10 6.5-10 6.5z" />,
  step: <path d="M6 5.5l8.5 6.5L6 18.5zM17.5 5.5v13" />,
  // A window's buttons.
  minimise: <path d="M6 17.5h12" />,
  maximise: <rect x="6" y="6" width="12" height="12" />,
  restore: <path d="M6 9h9v9H6zM9 9V6h9v9h-3" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  // An app with no glyph of its own: a blank window.
  window: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <path d="M3.5 9h17" />
    </>
  ),
};

/** The names an app may give as its icon. */
export const ICON_NAMES: readonly string[] = Object.keys(GLYPHS);

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg
      className="os-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {GLYPHS[name] ?? GLYPHS.window}
    </svg>
  );
}
