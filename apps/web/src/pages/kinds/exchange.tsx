// The Exchange page (crates/game/src/pages/exchange.rs, M9 B1; spec 5.14, 9.2 `get_exchange`): a
// zone exchange's code, name, zone, hub city and province, headline index (level now and a line
// chart of its daily closes from 2020, D540), listed count and investor confidence, and its
// constituents table, which follows v_exchanges daily with prices from v_quotes at each rebuild.

import type { ZoneId } from "@tc20ff/sim";
import { type NameIndex, place } from "../../links/names.ts";
import type { Cell } from "../../widgets/cells.ts";
import { emptyDoc, field, notFound, type PageDoc, span, type TableDoc } from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell } from "../tables.ts";
import { byId, byKey, type ViewsData } from "../views.ts";
import { indexChart, membersTable } from "./zone.tsx";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "index", title: "Index" },
  { id: "constituents", title: "Constituents" },
  { id: "members", title: "Member countries" },
];

/**
 * The constituents table: each quoted company with its last price, day change, market cap, EFV,
 * industry and rating (v_exchanges, v_quotes, v_company_row).
 */
export function constituentsTable(z: ZoneId, v: ViewsData, index: NameIndex): TableDoc {
  const x = byKey(v.exchanges?.exchanges, (e) => e.zone, z);
  const rows = (x?.constituents ?? []).map((c): Cell[] => {
    const q = byId(v.quotes?.rows, c);
    const row = byId(v.company_rows?.rows, c);
    const unknown: Cell = { k: "unknown" };
    return [
      linkCell(index, { kind: "company", id: c }),
      { k: "text", v: row?.ticker ?? "" },
      row ? linkCell(index, { kind: "industry", id: row.industry }) : unknown,
      q ? { k: "price", v: q.last } : unknown,
      q ? { k: "gain", v: q.change_pct, unit: "percent" } : unknown,
      q ? { k: "money", v: q.market_cap } : unknown,
      q ? { k: "price", v: q.efv } : unknown,
      row ? { k: "rating", v: row.rating } : unknown,
    ];
  });
  return {
    id: "exchange.constituents",
    columns: [
      { title: "Company", width: 220 },
      { title: "Ticker", width: 60 },
      { title: "Industry", width: 170 },
      { title: "Price", width: 80 },
      { title: "Day", width: 70 },
      { title: "Market cap", width: 100, hint: "Last price x shares: the index weight" },
      { title: "EFV", width: 90, hint: "Estimated fair value a share (3.14.2)" },
      { title: "Rating", width: 60 },
    ],
    rows,
  };
}

/** The whole Exchange page as data. */
export function exchangeDoc(z: ZoneId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "exchange", id: z };
  const doc = emptyDoc(page, index.title(page), kindName("exchange"));
  const x = byKey(v.exchanges?.exchanges, (e) => e.zone, z);
  if (!x) {
    doc.head.push(notFound("exchange"));
    return doc;
  }
  const zone: PageRef = { kind: "zone", id: z };
  const hub = place(v, x.hub_province);
  doc.head.push({
    k: "fields",
    fields: [
      field.text("Code", x.code),
      field.new("Zone", [span.link(index.title(zone), zone), span.muted(`zone ${x.zone_number}`)]),
      field.new("Hub", [span.text(x.hub_city), hub ? span.link(hub[0], hub[1]) : span.muted("?")]),
      field.live("Listed", { k: "ListedCount", zone: z }),
      field.new("Confidence", [
        span.live({ k: "ZoneConfidence", zone: z }),
        span.muted("investor confidence (5.1.2)"),
      ]),
    ],
  });
  doc.sections = [
    {
      id: "index",
      blocks: [
        {
          k: "fields",
          fields: [
            field.text("Index", x.index_name),
            field.new("Level", [
              span.live({ k: "IndexLevel", zone: z }),
              span.live({ k: "IndexChange", zone: z }),
            ]),
            field.new("Method", [
              span.muted("market-cap weighted, 1,000 at load, divisor kept on listings (5.14)"),
            ]),
          ],
        },
        { k: "chart", chart: indexChart(z, v, index) },
      ],
    },
    { id: "constituents", blocks: [{ k: "table", table: constituentsTable(z, v, index) }] },
    { id: "members", blocks: [{ k: "table", table: membersTable("exchange.members", z, v, index) }] },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "exchange",
    // exchange.rs rebuilt on v_company_row and v_countries, with a live constituents table and
    // chart on v_exchanges (daily) priced from v_quotes. Here the page lists v_exchanges and
    // v_quotes, so the constituents' prices follow at the page pace (PAGE_REFRESH_MS).
    views: ["company_rows", "countries", "zones", "exchanges", "quotes", "places"],
    sections: SECTIONS,
    doc: (page, v, index) => exchangeDoc(page.id, v, index),
  }),
];
