// Executive actions (pivot 7.5, 7.6, 8.6): nominations and confirmations, orders, vetoes,
// shutdowns, impeachments and resignations, newest first.

import type { ExecActionRow } from "@tc20ff/sim";
import { useMemo } from "react";
import { useViewData } from "../../sim/hooks.ts";
import { formatDay } from "../_shared/index.ts";
import {
  type Col,
  Empty,
  Loading,
  Page,
  Person,
  SortTable,
  useLeverNames,
  useNav,
  usePageTitle,
  usePeople,
} from "./common.tsx";
import { dayKey, EXEC_LABEL, leverText } from "./data.ts";
import { EXEC_KINDS } from "./route.ts";

export function ExecPage({ kind }: { kind: ExecActionRow["kind"] | null }) {
  const records = useViewData("records");
  const people = usePeople();
  const names = useLeverNames();
  const { replace } = useNav();
  usePageTitle(kind === null ? "Executive actions" : `${EXEC_LABEL[kind]}s`);
  const rows = useMemo(
    () => (records?.actions ?? []).filter((a) => kind === null || a.kind === kind),
    [records, kind],
  );
  const cols: Col<ExecActionRow>[] = [
    {
      id: "date",
      header: "Date",
      sort: (a) => dayKey(a.date) * 1000 + a.id,
      render: (a) => formatDay(a.date),
    },
    {
      id: "kind",
      header: "Action",
      sort: (a) => EXEC_KINDS.indexOf(a.kind),
      render: (a) => (
        <span className={`rec-badge rec-exec-${a.kind.toLowerCase()}`}>{EXEC_LABEL[a.kind]}</span>
      ),
    },
    {
      id: "actor",
      header: "Taken by",
      sort: (a) => (a.actor === null ? null : (people?.get(a.actor)?.name ?? null)),
      render: (a) =>
        a.actor === null ? (
          <span className="rec-muted">{a.kind === "Confirmation" ? "The Senate" : "-"}</span>
        ) : (
          <Person id={a.actor} people={people} />
        ),
    },
    {
      id: "subject",
      header: "Concerning",
      sort: (a) => (a.subject === null ? null : (people?.get(a.subject)?.name ?? null)),
      render: (a) =>
        a.subject === null ? <span className="rec-muted">-</span> : <Person id={a.subject} people={people} />,
    },
    {
      id: "text",
      header: "Record",
      render: (a) => (
        <>
          <span>{a.text}</span>
          {a.changes.length === 0 ? null : (
            <ul className="rec-changes rec-inline">
              {a.changes.map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: an action's changes are a fixed list
                <li key={i}>{leverText(c, names)}</li>
              ))}
            </ul>
          )}
        </>
      ),
    },
  ];
  return (
    <Page
      name="exec"
      kicker="The executive"
      title="Executive actions"
      lede="Nominations and confirmations, orders, vetoes, shutdowns, impeachments and resignations, as taken."
    >
      <form className="rec-filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Kind
          <select
            data-testid="exec-kind"
            value={kind ?? ""}
            onChange={(e) =>
              replace({ page: "exec", kind: EXEC_KINDS.find((k) => k === e.target.value) ?? null })
            }
          >
            <option value="">All</option>
            {EXEC_KINDS.map((k) => (
              <option key={k} value={k}>
                {EXEC_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </form>
      {records === undefined ? (
        <Loading what="the executive record" />
      ) : rows.length === 0 ? (
        <Empty>No executive action of this kind is on record.</Empty>
      ) : (
        <SortTable
          table="exec"
          rows={rows}
          cols={cols}
          rowKey={(a) => a.id}
          rowKind="exec"
          initial={{ id: "date", desc: true }}
          caption="Executive actions"
        />
      )}
    </Page>
  );
}
