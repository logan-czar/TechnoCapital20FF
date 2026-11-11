// Small components several apps share (D1037): a link to anything an `EntityRef` names, a person's
// chip, a list table and the placeholder pane of an app still being built. Frozen after the M2
// contracts change; keep them small.

import type { EntityRef, Party } from "@tc20ff/sim";
import type { ReactNode } from "react";
import { type Column, DataTable } from "../../widgets/DataTable.tsx";
import { entityTarget, openEntity } from "./entity.ts";
import { partyClass, partyLetter } from "./party.ts";
import "./shared.css";

/**
 * A link to what `to` names, opening it in its home app (./entity.ts). A button, so it works from
 * the keyboard; it looks like a link.
 */
export function EntityLink({ to, children }: { to: EntityRef; children: ReactNode }) {
  const t = entityTarget(to);
  return (
    <button
      type="button"
      className="app-link"
      data-testid={`link-${to.kind.toLowerCase()}-${to.id}`}
      title={`Open in ${t.app}`}
      onClick={() => openEntity(to)}
    >
      {children}
    </button>
  );
}

/** A person as the press names them: their name in their party's colour and the party's letter. */
export function PersonChip({ id, name, party }: { id: number; name: string; party: Party | null }) {
  return (
    <span className={`app-person ${partyClass(party)}`}>
      <EntityLink to={{ kind: "Person", id }}>{name}</EntityLink>
      <span className="app-party-letter">({partyLetter(party)})</span>
    </span>
  );
}

/**
 * A long list as a virtualised table (widgets/DataTable.tsx): only the rows in view exist. `id`
 * keeps the sort per app in the settings (it is prefixed with "app."), so one app's tables do not
 * share another's.
 */
export function ListTable<R>(props: {
  id: string;
  rows: R[];
  columns: readonly Column<R>[];
  rowKey: (row: R) => string | number;
  initialSort?: { id: string; desc: boolean };
  version?: unknown;
}) {
  return (
    <div className="app-list">
      <DataTable
        rows={props.rows}
        columns={props.columns}
        rowKey={props.rowKey}
        id={`app.${props.id}`}
        {...(props.initialSort === undefined ? {} : { initialSort: props.initialSort })}
        {...(props.version === undefined ? {} : { version: props.version })}
      />
    </div>
  );
}

/** The pane of an app whose lane has not built it yet. */
export function ComingSoon({ title, route }: { title: string; route: string | null }) {
  return (
    <div className="app-coming-soon" data-testid="coming-soon">
      <p className="app-coming-title">{title}</p>
      <p>Coming soon.</p>
      {route === null ? null : <p className="app-coming-route">{route}</p>}
    </div>
  );
}
