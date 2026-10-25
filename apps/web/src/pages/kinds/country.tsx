// The Country page (crates/game/src/pages/country.rs, M9 B1; spec 3.2, 9.2 `get_country`): name,
// iso3, superregion, financial zone and its exchange (links), sovereign rating and spread,
// corporate tax rate, GDP, the companies headquartered there as a table, and its provinces. A
// company that does not publish shows bands (D461).

import type { CountryId } from "@tc20ff/sim";
import type { NameIndex } from "../../links/names.ts";
import { type Cell, figureCell } from "../../widgets/cells.ts";
import { bps, emptyDoc, field, notFound, type PageDoc, span, type TableDoc } from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell, provincesTable, statusText } from "../tables.ts";
import { byId, type ViewsData } from "../views.ts";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "economy", title: "Economy" },
  { id: "companies", title: "HQ'd companies" },
  { id: "provinces", title: "Provinces" },
];

/** The HQ'd companies of a country (v_countries' list, rows from v_company_row). */
export function hqTable(c: CountryId, v: ViewsData, index: NameIndex): TableDoc {
  const ids = byId(v.countries?.countries, c)?.hq_companies ?? [];
  const rows = ids.flatMap((co): Cell[][] => {
    const r = byId(v.company_rows?.rows, co);
    if (!r) return [];
    return [
      [
        linkCell(index, { kind: "company", id: r.id }),
        { k: "text", v: r.ticker === "" || !r.public ? "-" : r.ticker },
        linkCell(index, { kind: "industry", id: r.industry }),
        r.exchange === null
          ? { k: "text", v: "private" }
          : linkCell(index, { kind: "exchange", id: r.exchange }),
        figureCell(r.revenue_ttm, "money"),
        figureCell(r.value, "money"),
        { k: "rating", v: r.rating },
        { k: "text", v: statusText(r.status) },
      ],
    ];
  });
  return {
    id: "country.companies",
    columns: [
      { title: "Company", width: 220 },
      { title: "Ticker", width: 60 },
      { title: "Industry", width: 170 },
      { title: "Exchange", width: 170 },
      { title: "Revenue TTM", width: 130, hint: "A band while not published" },
      { title: "Value", width: 130, hint: "A band while not published" },
      { title: "Rating", width: 60 },
      { title: "Status", width: 80 },
    ],
    rows,
  };
}

/** The whole Country page as data. */
export function countryDoc(c: CountryId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "country", id: c };
  const doc = emptyDoc(page, index.title(page), kindName("country"));
  const r = byId(v.countries?.countries, c);
  if (!r) {
    doc.head.push(notFound("country"));
    return doc;
  }
  const zone: PageRef = { kind: "zone", id: r.zone };
  const exchange: PageRef = { kind: "exchange", id: r.zone };
  doc.head.push({
    k: "fields",
    fields: [
      field.text("ISO3", r.iso3),
      field.text("Superregion", r.superregion),
      field.link("Zone", index.title(zone), zone),
      field.link("Exchange", index.title(exchange), exchange),
    ],
  });
  const base = v.rates?.base_rate;
  doc.sections = [
    {
      id: "economy",
      blocks: [
        {
          k: "fields",
          fields: [
            field.cell("Sovereign rating", { k: "rating", v: r.sovereign_rating }),
            field.new("Sovereign spread", [
              span.text(bps(r.sovereign_spread)),
              ...(base === undefined ? [] : [span.muted(`over the base rate ${bps(base)}`)]),
            ]),
            field.cell("Tax rate", { k: "percent", v: r.corp_tax_rate }),
            field.cell("GDP", { k: "money", v: r.gdp_usd }),
            field.cell("HQ'd companies", { k: "int", v: r.hq_companies.length }),
          ],
        },
      ],
    },
    { id: "companies", blocks: [{ k: "table", table: hqTable(c, v, index) }] },
    // Its provinces as links (M8.7, D707).
    { id: "provinces", blocks: [{ k: "table", table: provincesTable("country.provinces", [c], v, index) }] },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "country",
    views: ["countries", "rates", "company_rows", "province_cards"],
    sections: SECTIONS,
    doc: (page, v, index) => countryDoc(page.id, v, index),
  }),
];
