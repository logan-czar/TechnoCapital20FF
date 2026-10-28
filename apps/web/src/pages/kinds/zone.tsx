// The Zone page (crates/game/src/pages/zone.rs, M9 B1; m9-plan section 1, spec 3.2.1, 5.1.2, 8
// Financial zones): a financial zone's number, base and effective credit spread, investor
// confidence, its exchange and headline index (a link, the level, and a chart), GDP share and
// current effect, and its member countries as a table.
//
// The index chart draws v_exchanges' daily closes from 2020 (D540), so a load shows the whole
// history; the UI keeps no record of its own (D484 and D487 are superseded). The Exchange page
// shares the chart and the member countries table.

import { indexCloseRows, type ZoneId } from "@tc20ff/sim";
import type { NameIndex } from "../../links/names.ts";
import { type Cell, date } from "../../widgets/cells.ts";
import {
  bps,
  type ChartModel,
  emptyDoc,
  field,
  notFound,
  type PageDoc,
  span,
  type TableDoc,
} from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell, provincesTable } from "../tables.ts";
import { byId, byKey, type ViewsData } from "../views.ts";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "economy", title: "Economy" },
  { id: "index", title: "Index" },
  { id: "members", title: "Member countries" },
  { id: "provinces", title: "Member provinces" },
];

/**
 * An exchange's index chart: v_exchanges' daily closes from 2020 as a line (D540), with today's
 * level (v_quotes, when the page reads it) as a reference line.
 */
export function indexChart(z: ZoneId, v: ViewsData, index: NameIndex): ChartModel {
  const name = byId(v.zones?.zones, z)?.index_name ?? index.title({ kind: "exchange", id: z });
  const x = byKey(v.exchanges?.exchanges, (e) => e.zone, z);
  const closes = x ? indexCloseRows(x.closes) : [];
  const level = byKey(v.quotes?.indices, (i) => i.zone, z)?.level ?? null;
  return {
    title: `${name}: daily closes (${closes.length})`,
    labels: closes.map((c) => date(c.date)),
    series: [{ k: "line", name, values: closes.map((c) => c.level), tone: "cyan" }],
    format: "Number",
    reference: level === null ? null : { value: level, tone: "amber" },
  };
}

/** The member countries table (also the Exchange page's). */
export function membersTable(id: string, z: ZoneId, v: ViewsData, index: NameIndex): TableDoc {
  const members = byId(v.zones?.zones, z)?.members ?? [];
  const rows = members.flatMap((cid): Cell[][] => {
    const c = byId(v.countries?.countries, cid);
    if (!c) return [];
    return [
      [
        linkCell(index, { kind: "country", id: c.id }),
        { k: "text", v: c.iso3 },
        { k: "text", v: c.superregion },
        { k: "rating", v: c.sovereign_rating },
        { k: "text", v: bps(c.sovereign_spread) },
        { k: "percent", v: c.corp_tax_rate },
        { k: "money", v: c.gdp_usd },
        { k: "int", v: c.hq_companies.length },
      ],
    ];
  });
  return {
    id,
    columns: [
      { title: "Country", width: 190 },
      { title: "ISO3", width: 50 },
      { title: "Superregion", width: 150 },
      { title: "Sovereign", width: 70, hint: "Sovereign rating (5.1.2)" },
      { title: "Spread", width: 80, hint: "Sovereign spread" },
      { title: "Tax", width: 60, hint: "Corporate tax rate (5.11)" },
      { title: "GDP", width: 90 },
      { title: "HQs", width: 50, hint: "Companies with their HQ here" },
    ],
    rows,
  };
}

/** The whole Zone page as data. */
export function zoneDoc(z: ZoneId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "zone", id: z };
  const doc = emptyDoc(page, index.title(page), kindName("zone"));
  const r = byId(v.zones?.zones, z);
  if (!r) {
    doc.head.push(notFound("zone"));
    return doc;
  }
  const ex: PageRef = { kind: "exchange", id: z };
  doc.head.push({
    k: "fields",
    fields: [
      field.text("Zone", `${r.number} (${r.key})`),
      field.new("Exchange", [span.link(index.title(ex), ex), span.muted(r.exchange_code)]),
      field.cell("Members", { k: "int", v: r.members.length }),
    ],
  });
  doc.sections = [
    {
      id: "economy",
      blocks: [
        {
          k: "fields",
          fields: [
            field.new("Credit spread", [
              span.live({ k: "ZoneSpread", zone: z }),
              span.muted(`effective; base ${bps(r.credit_spread_base)}`),
            ]),
            field.new("Confidence", [
              span.live({ k: "ZoneConfidence", zone: z }),
              span.muted("investor confidence (-100 to +100)"),
            ]),
            field.live("GDP share", { k: "ZoneGdpShare", zone: z }),
            field.new("Effect", [
              span.live({ k: "ZoneEffect", zone: z }),
              span.muted("a year: intensity x g(t - lag) plus own shocks (5.1)"),
            ]),
          ],
        },
      ],
    },
    {
      id: "index",
      blocks: [
        {
          k: "fields",
          fields: [
            field.new("Index", [span.text(r.index_name), span.muted("on"), span.link(index.title(ex), ex)]),
            field.new("Level", [
              span.live({ k: "IndexLevel", zone: z }),
              span.live({ k: "IndexChange", zone: z }),
            ]),
            field.live("Last close", { k: "IndexClose", zone: z }),
          ],
        },
        { k: "chart", chart: indexChart(z, v, index) },
      ],
    },
    { id: "members", blocks: [{ k: "table", table: membersTable("zone.members", z, v, index) }] },
    // The member countries' provinces as links (M8.7, D707).
    {
      id: "provinces",
      blocks: [{ k: "table", table: provincesTable("zone.provinces", r.members, v, index) }],
    },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "zone",
    // zone.rs rebuilt on the monthly views and followed the daily ones with live values and a
    // live chart; here the page lists v_zones and v_exchanges (daily) so the chart follows.
    views: ["countries", "rates", "province_cards", "zones", "exchanges"],
    sections: SECTIONS,
    doc: (page, v, index) => zoneDoc(page.id, v, index),
  }),
];
