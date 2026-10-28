// The Province page (crates/game/src/pages/province.rs, build-plan M8.7; spec 3.3, 8 Map row
// province card, 9.2 `get_province`; m8-plan 2 "a hover card and a page"; D707): a province's
// country, region, zone, Metro and key city (links), its development tracks and largest track, its
// resource, terrain, coast and contested tag, the companies headquartered there and the business
// units based there as tables with links, and its neighbours. A company that does not publish
// shows bands (D461): the figures are v_company_row's and v_units', never a second path to a
// truth (D631). The provinces table of the Country and Zone pages is tables.ts `provincesTable`.

import type { ProvinceCard, ProvinceId } from "@tc20ff/sim";
import type { NameIndex } from "../../links/names.ts";
import { type Cell, figureCell } from "../../widgets/cells.ts";
import {
  emptyDoc,
  type Field,
  field,
  notFound,
  type PageDoc,
  type Span,
  span,
  type TableDoc,
} from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell, statusText } from "../tables.ts";
import { byId, type ViewsData } from "../views.ts";

/** The Metro's other provinces the header links before it sums the rest. */
export const METRO_LINKS = 6;

export const SECTIONS: readonly SectionSpec[] = [
  { id: "development", title: "Development" },
  { id: "land", title: "Land" },
  { id: "hqs", title: "HQ'd companies" },
  { id: "units", title: "Business units" },
  { id: "neighbors", title: "Neighbours" },
];

/**
 * The companies headquartered in the province (v_province_card's list, rows from v_company_row:
 * bands while a company does not publish).
 */
export function hqTable(c: ProvinceCard, v: ViewsData, index: NameIndex): TableDoc {
  const rows = c.hqs.flatMap((co): Cell[][] => {
    const r = byId(v.company_rows?.rows, co);
    if (!r) return [];
    return [
      [
        linkCell(index, { kind: "company", id: r.id }),
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
    id: "province.hqs",
    columns: [
      { title: "Company", width: 220 },
      { title: "Industry", width: 170 },
      { title: "Exchange", width: 150 },
      { title: "Revenue TTM", width: 130, hint: "A band while not published" },
      { title: "Value", width: 130, hint: "A band while not published" },
      { title: "Rating", width: 60 },
      { title: "Status", width: 80 },
    ],
    rows,
  };
}

/**
 * The business units based in the province (v_province_card's list, rows from v_units: bands while
 * a company does not publish, D420, D436).
 */
export function unitsTable(c: ProvinceCard, v: ViewsData, index: NameIndex): TableDoc {
  const rows = c.units.flatMap((uid): Cell[][] => {
    const u = byId(v.units?.units, uid);
    if (!u) return [];
    return [
      [
        linkCell(index, { kind: "company", id: u.company }),
        linkCell(index, { kind: "industry", id: u.industry }),
        figureCell(u.gross_assets, "money"),
        figureCell(u.asset_book, "money"),
        figureCell(u.revenue_m, "money"),
        figureCell(u.productivity, "number"),
        { k: "percent", v: u.growth_plan },
        { k: "percent", v: u.rd_plan },
      ],
    ];
  });
  return {
    id: "province.units",
    columns: [
      { title: "Company", width: 220 },
      { title: "Industry", width: 170 },
      { title: "Assets", width: 120, hint: "Business assets at cost (3.6)" },
      { title: "Book", width: 120 },
      { title: "Revenue/mo", width: 120, hint: "Last month's revenue" },
      { title: "Productivity", width: 100 },
      { title: "Growth", width: 70, hint: "The locked plan's growth a year" },
      { title: "R&D", width: 60 },
    ],
    rows,
  };
}

/** The province's neighbours (v_map_static, with lane P's map). */
export function neighborsTable(p: ProvinceId, v: ViewsData, index: NameIndex): TableDoc {
  const rows = (v.map_static?.geo?.neighbors[p] ?? []).map((n): Cell[] => {
    const country = v.places?.provinces[n.province]?.country;
    return [
      linkCell(index, { kind: "province", id: n.province }),
      country === undefined ? { k: "unknown" } : linkCell(index, { kind: "country", id: country }),
      { k: "text", v: n.kind === "Land" ? "land" : "sea" },
      { k: "int", v: n.border_px },
    ];
  });
  return {
    id: "province.neighbors",
    columns: [
      { title: "Province", width: 220 },
      { title: "Country", width: 170 },
      { title: "Border", width: 60 },
      { title: "Shared px", width: 90, hint: "The shared edge in map pixels" },
    ],
    rows,
  };
}

/** The whole Province page as data. */
export function provinceDoc(p: ProvinceId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "province", id: p };
  const doc = emptyDoc(page, index.title(page), kindName("province"));
  const c = byId(v.province_cards?.cards, p);
  if (!c) {
    doc.head.push(notFound("province"));
    return doc;
  }
  const country: PageRef = { kind: "country", id: c.country };
  const head: Field[] = [field.text("Id", c.key), field.link("Country", index.title(country), country)];
  // The province's zone is its country's (spec 3.2.1; map_layers.rs `zone_of`).
  const z = byId(v.countries?.countries, c.country)?.zone;
  if (z !== undefined) {
    const zone: PageRef = { kind: "zone", id: z };
    head.push(field.link("Zone", index.title(zone), zone));
  }
  head.push(
    field.text("Region", c.area === c.region || c.area === "" ? c.region : `${c.region} (${c.area})`),
  );
  // The Metro and key city as links to their provinces (D707): the Metro's name, then its other
  // provinces; the key city's name, linking to its first province.
  const statics = v.map_static;
  const row = statics?.provinces[p];
  const metro = row?.metro != null ? statics?.metros[row.metro] : undefined;
  let metroSpans: Span[] = [span.muted("none")];
  if (metro) {
    const others = metro.provinces.filter((q) => q !== p);
    metroSpans = [span.text(metro.name)];
    for (const q of others.slice(0, METRO_LINKS)) {
      const qp: PageRef = { kind: "province", id: q };
      metroSpans.push(span.link(index.title(qp), qp));
    }
    if (others.length > METRO_LINKS) metroSpans.push(span.muted(`and ${others.length - METRO_LINKS} more`));
  }
  head.push(field.new("Metro", metroSpans));
  const key = row?.key_city != null ? statics?.key_cities[row.key_city] : undefined;
  const first = key?.provinces[0];
  head.push(
    field.new(
      "Key city",
      key
        ? [first === undefined ? span.text(key.name) : span.link(key.name, { kind: "province", id: first })]
        : [span.muted("none")],
    ),
  );
  doc.head.push({ k: "fields", fields: head });
  const largest =
    c.largest_track === "Commerce"
      ? "Commerce"
      : c.largest_track === "Industry"
        ? "Industry"
        : "Commerce and Industry (a tie counts for both, 10.3.1)";
  const land: Field[] = [
    field.text("Resource", c.resource),
    field.text("Terrain", c.terrain),
    field.text("Coastal", c.coastal ? "yes" : "no"),
    field.text("City rank", c.city_rank),
  ];
  if (c.contested !== null) land.push(field.text("Contested", c.contested));
  doc.sections = [
    {
      id: "development",
      blocks: [
        {
          k: "fields",
          fields: [
            field.cell("Commerce", { k: "int", v: c.commerce }),
            field.cell("Industry", { k: "int", v: c.industry }),
            field.cell("Population", { k: "int", v: c.population }),
            field.new("Total", [span.text(String(c.total)), span.muted("of 90; each track 1 to 30 (3.3)")]),
            field.text("Largest track", largest),
          ],
        },
      ],
    },
    { id: "land", blocks: [{ k: "fields", fields: land }] },
    { id: "hqs", blocks: [{ k: "table", table: hqTable(c, v, index) }] },
    { id: "units", blocks: [{ k: "table", table: unitsTable(c, v, index) }] },
    { id: "neighbors", blocks: [{ k: "table", table: neighborsTable(p, v, index) }] },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "province",
    // province.rs reads v_map_layers for the zone; the zone is the country's (v_countries).
    views: ["province_cards", "units", "company_rows", "map_static", "countries", "places"],
    sections: SECTIONS,
    doc: (page, v, index) => provinceDoc(page.id, v, index),
  }),
];
