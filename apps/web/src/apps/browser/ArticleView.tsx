// Draws an Article (articles.ts): the title and kind, the lead, the infobox, the sections with their
// tables and lists, and the links to the same thing in other apps. Every link is a button, so the
// page is reachable from the keyboard; a link to this app navigates inside it, a link to another
// app opens that app (links/nav.ts `openApp`).

import { Fragment, useState } from "react";
import { partyClass } from "../_shared/party.ts";
import type { Article, ArticleBlock, Inline, Ref, TableCell } from "./articles.ts";

/** What a link does: the app and route it names. */
export type Go = (app: string, route: string | null) => void;

/** Rows a table shows before its "Show all" button. */
export const TABLE_ROWS_SHOWN = 100;

function RefLink({ r, go }: { r: Ref; go: Go }) {
  const inApp = r.app === "browser";
  const cls = `br-link${r.party === undefined ? "" : ` ${partyClass(r.party)} br-party`}${inApp ? "" : " br-out"}`;
  return (
    <button
      type="button"
      className={cls}
      title={inApp ? undefined : `Open in ${r.app}`}
      data-testid={`ref-${r.app}-${r.route ?? "home"}`}
      onClick={() => go(r.app, r.route)}
    >
      {r.text}
    </button>
  );
}

export function Inlines({ items, go }: { items: readonly Inline[]; go: Go }) {
  return (
    <>
      {items.map((it, i) =>
        typeof it === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: inlines have no identity but their place
          <Fragment key={i}>{it}</Fragment>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: inlines have no identity but their place
          <RefLink key={i} r={it} go={go} />
        ),
      )}
    </>
  );
}

/** The row's test id: "person-row-12" when its first cell links to that article. */
function rowTestId(row: readonly TableCell[], at: number): string {
  const first = row[0];
  if (
    first !== undefined &&
    typeof first !== "string" &&
    !Array.isArray(first) &&
    first.app === "browser" &&
    first.route !== null
  )
    return first.route.replace("/", "-row-");
  return `row-${at}`;
}

function Table({ block, go }: { block: Extract<ArticleBlock, { k: "table" }>; go: Go }) {
  const [all, setAll] = useState(false);
  const rows = all ? block.rows : block.rows.slice(0, TABLE_ROWS_SHOWN);
  return (
    <div className="br-table-wrap">
      <table className="br-table" data-testid={`table-${block.id}`}>
        <thead>
          <tr>
            {block.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
            <tr key={i} data-testid={rowTestId(row, i)}>
              {row.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity but their place
                <td key={j} data-label={block.columns[j]}>
                  <Inlines items={Array.isArray(cell) ? cell : [cell]} go={go} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!all && block.rows.length > TABLE_ROWS_SHOWN && (
        <button type="button" className="br-more" onClick={() => setAll(true)}>
          Show all {block.rows.length} rows
        </button>
      )}
    </div>
  );
}

function Block({ block, go }: { block: ArticleBlock; go: Go }) {
  switch (block.k) {
    case "text":
      return (
        <p>
          <Inlines items={block.spans} go={go} />
        </p>
      );
    case "muted":
      return <p className="br-muted">{block.text}</p>;
    case "list":
      return (
        <ul className="br-list">
          {block.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity but their place
            <li key={i}>
              <Inlines items={item} go={go} />
            </li>
          ))}
        </ul>
      );
    case "table":
      return <Table block={block} go={go} />;
  }
}

export function ArticleView({ article, go }: { article: Article; go: Go }) {
  return (
    <article className="br-article" data-testid="article" data-route={article.route ?? ""}>
      <header className="br-article-head">
        <h1 className="br-title">{article.title}</h1>
        <span className="br-kind">{article.kind}</span>
      </header>
      <div className="br-body">
        <div className="br-main">
          {article.lead.length > 0 && (
            <p className="br-lead">
              <Inlines items={article.lead} go={go} />
            </p>
          )}
          {article.sections.map((s) => (
            <section key={s.id} className="br-section" data-testid={`section-${s.id}`}>
              <h2>{s.title}</h2>
              {s.blocks.map((b, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no identity but their place
                <Block key={i} block={b} go={go} />
              ))}
            </section>
          ))}
          {article.elsewhere.length > 0 && (
            <p className="br-elsewhere">
              Also in this desktop:{" "}
              {article.elsewhere.map((r, i) => (
                <Fragment key={`${r.app}-${r.route}`}>
                  {i > 0 && " | "}
                  <RefLink r={r} go={go} />
                </Fragment>
              ))}
            </p>
          )}
        </div>
        {article.facts.length > 0 && (
          <aside className="br-infobox" aria-label="Facts" data-testid="infobox">
            <dl>
              {article.facts.map((f) => (
                <div key={f.label} className="br-fact">
                  <dt>{f.label}</dt>
                  <dd>
                    <Inlines items={f.value} go={go} />
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </div>
    </article>
  );
}
