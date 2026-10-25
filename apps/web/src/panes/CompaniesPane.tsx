// The table demo: the company list (v_company_row) with live prices joined from v_quotes. The
// "Rows" picker repeats the list to 1,000 or 10,000 rows to show the table scales.

import type { CompanyRow, QuoteRow } from "@tc20ff/sim";
import { memo, useMemo, useRef, useState } from "react";
import { useNames } from "../shell/names.ts";
import { pageSpec, useWorkspace } from "../shell/panes.ts";
import { useViewData, useViewDataThrottled } from "../sim/hooks.ts";
import { type Cell, figureCell, type PageRef } from "../widgets/cells.ts";
import { type Column, DataTable } from "../widgets/DataTable.tsx";

interface Row {
  key: number;
  company: CompanyRow;
}

const rowKey = (r: Row) => r.key;
const SIZES = [0, 1000, 10000] as const;
/** The quotes move every frame; the table reads them this often. */
const QUOTE_MS = 250;

function buildColumns(
  industry: (id: number) => string,
  country: (id: number) => string,
  quoteOf: (id: number) => QuoteRow | undefined,
): Column<Row>[] {
  const unknown: Cell = { k: "unknown" };
  return [
    {
      id: "name",
      header: "Company",
      width: 220,
      cell: (r) => ({ k: "link", text: r.company.name, page: { kind: "company", id: r.company.id } }),
    },
    { id: "ticker", header: "Ticker", width: 70, cell: (r) => ({ k: "text", v: r.company.ticker }) },
    {
      id: "industry",
      header: "Industry",
      width: 200,
      cell: (r) => ({ k: "text", v: industry(r.company.industry) }),
    },
    {
      id: "country",
      header: "HQ",
      width: 140,
      cell: (r) => ({ k: "text", v: country(r.company.hq_country) }),
    },
    { id: "rating", header: "Rating", width: 60, cell: (r) => ({ k: "rating", v: r.company.rating }) },
    {
      id: "revenue",
      header: "Revenue TTM",
      width: 110,
      cell: (r) => figureCell(r.company.revenue_ttm, "money"),
    },
    { id: "value", header: "Value", width: 110, cell: (r) => figureCell(r.company.value, "money") },
    {
      id: "price",
      header: "Price",
      width: 90,
      live: true,
      cell: (r) => {
        const q = quoteOf(r.company.id);
        return q ? { k: "price", v: q.last } : unknown;
      },
    },
    {
      id: "change",
      header: "Day",
      width: 80,
      live: true,
      cell: (r) => {
        const q = quoteOf(r.company.id);
        return q ? { k: "gain", v: q.change_pct, unit: "percent" } : unknown;
      },
    },
  ];
}

function CompaniesPaneInner() {
  const companies = useViewData("company_rows");
  const quotes = useViewDataThrottled("quotes", QUOTE_MS);
  const names = useNames();
  const ws = useWorkspace();
  const [size, setSize] = useState<(typeof SIZES)[number]>(0);

  // The live prices are read through a map at draw time, so a quote update redraws the rows in
  // view without rebuilding the table; only the monthly company rows rebuild it.
  const quoteMap = useMemo(() => new Map<number, QuoteRow>(quotes?.rows.map((q) => [q.id, q])), [quotes]);
  const quoteRef = useRef(quoteMap);
  quoteRef.current = quoteMap;
  const columns = useMemo(
    () => buildColumns(names.industry, names.country, (id) => quoteRef.current.get(id)),
    [names.industry, names.country],
  );
  const rows = useMemo<Row[]>(() => {
    if (!companies) return [];
    const base = companies.rows.map((c, i): Row => ({ key: i, company: c }));
    if (size === 0) return base;
    return Array.from(
      { length: size },
      (_, i): Row => ({ company: base[i % base.length]?.company as CompanyRow, key: i }),
    );
  }, [companies, size]);

  const open = useMemo(
    () => (page: PageRef) => {
      const name = page.kind === "company" ? names.company(page.id) : `${page.kind} ${page.id}`;
      ws.open(pageSpec(page, name));
    },
    [ws, names],
  );
  return (
    <div className="pane">
      <div className="toolbar">
        <span>{rows.length.toLocaleString("en-US")} rows</span>
        <label>
          Rows{" "}
          <select
            value={size}
            onChange={(e) => setSize(SIZES.find((s) => s === Number(e.target.value)) ?? 0)}
          >
            <option value={0}>Real</option>
            <option value={1000}>1,000</option>
            <option value={10000}>10,000</option>
          </select>
        </label>
      </div>
      <div className="fill">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={rowKey}
          onOpen={open}
          version={quoteMap}
          initialSort={{ id: "value", desc: true }}
        />
      </div>
    </div>
  );
}

export const CompaniesPane = memo(CompaniesPaneInner);
