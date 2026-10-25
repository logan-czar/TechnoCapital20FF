// Small layout helpers the pages share (crates/game/src/pages/placeholder.rs `chip_row`,
// `link_group`, `page_header`, and market.rs `fact`, `figure_color`, `note`, `table_box`).

import type { Figure } from "@tc20ff/sim";
import type { ReactNode } from "react";
import { useRowHeight } from "../config/hooks.ts";
import { Link } from "../links/Link.tsx";
import { HEADER_HEIGHT } from "../widgets/DataTable.tsx";
import type { Tone } from "./doc.ts";
import type { PageRef } from "./ref.ts";
import { pageId } from "./ref.ts";

/** A wrapping row of chips. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="chip-row">{children}</div>;
}

/** A page header: the title, the kind, and a note. */
export function PageHeader({ title, kind, note }: { title: string; kind: string; note?: string }) {
  return (
    <ChipRow>
      <h2 className="page-title">{title}</h2>
      <span className="muted small">{kind}</span>
      {note ? <span className="tone-amber small">{note}</span> : null}
    </ChipRow>
  );
}

/** A labelled group of links: "Industry: Oil". Nothing when there are none. */
export function LinkGroup({
  label,
  links,
}: {
  label: string;
  links: readonly (readonly [string, PageRef])[];
}) {
  if (links.length === 0) return null;
  return (
    <ChipRow>
      <span className="muted small">{label}:</span>
      {links.map(([text, page]) => (
        <Link key={pageId(page)} page={page}>
          {text}
        </Link>
      ))}
    </ChipRow>
  );
}

/** A labelled figure for a page's fact row: "Demand $1.20T". */
export function Fact({ label, value, tone = "text" }: { label: string; value: string; tone?: Tone }) {
  return (
    <span className="fact">
      <span className="muted small">{label}</span> <span className={`tone-${tone}`}>{value}</span>
    </span>
  );
}

/** The tone a figure's text takes: amber for a band (D461), else `exact`. */
export function figureTone(f: Figure, exact: Tone = "text"): Tone {
  return f.kind === "Band" ? "band" : exact;
}

/** A plain note line. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="muted note">{children}</p>;
}

/** Most table rows a section box shows before the table scrolls (market.rs BOX_ROWS_MAX). */
export const BOX_ROWS_MAX = 14;
/** Most rows a section table shows before it scrolls inside itself (doc.rs TABLE_ROWS_SHOWN). */
export const TABLE_ROWS_SHOWN = 40;

/**
 * A box of fixed height for a table inside a page section (a section does not grow, so a table
 * there needs a height): room for `rows` rows (1 to `max`) and the header.
 */
export function TableBox({
  rows,
  max = TABLE_ROWS_SHOWN,
  children,
}: {
  rows: number;
  max?: number;
  children: ReactNode;
}) {
  const row = useRowHeight();
  const shown = Math.min(Math.max(rows, 1), max);
  return (
    <div className="table-box" style={{ height: shown * row + HEADER_HEIGHT + 2 }}>
      {children}
    </div>
  );
}
