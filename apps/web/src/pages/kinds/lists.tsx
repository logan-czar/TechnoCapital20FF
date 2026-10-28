// List pages (crates/game/src/pages/lists.rs, M9 A2): Companies, Characters, Countries, Exchanges
// and Zones, each a header plus an index table of links built from the views. lists.rs also served
// Industries, News and Events; lane B's industries.tsx, news.tsx and events.tsx register those
// (the Rust B2 pages replaced them). Every figure goes through `figureCell` (D461): a company that
// does not publish shows estimate bands, which sort by their midpoint, never by a hidden value.
// Names come from the countries, zones, characters and places views, and every place is a link
// (D462). The table's id is the kind's key, so its sort is kept per list.

import { type ProvinceId, roundHalfAway } from "@tc20ff/sim";
import { listLen } from "../../links/cards.ts";
import { type NameIndex, place, role, roleText } from "../../links/names.ts";
import type { Cell } from "../../widgets/cells.ts";
import { figureCell } from "../../widgets/cells.ts";
import { type PageDoc, span, type TableDoc } from "../doc.ts";
import { kindName, type PageOf, type PageRef } from "../ref.ts";
import { definePage } from "../spec.ts";
import { linkCell } from "../tables.ts";
import { byId, type ViewsData } from "../views.ts";

/** The list kinds this file registers. */
export const LIST_KINDS = ["companies", "characters", "countries", "exchanges", "zones"] as const;
export type ListKind = (typeof LIST_KINDS)[number];

/** A place's link cell ("Edmonton, Canada"), or `fallback` as text. */
function placeCell(v: ViewsData, province: ProvinceId, fallback: string): Cell {
  const p = place(v, province);
  return p ? { k: "link", text: p[0], page: p[1] } : { k: "text", v: fallback };
}

const UNKNOWN: Cell = { k: "unknown" };

/** The index table of a list page, from the views. */
export function listTable(kind: ListKind, v: ViewsData, index: NameIndex): TableDoc {
  const link = (p: PageRef) => linkCell(index, p);
  switch (kind) {
    case "companies": {
      const rows = (v.company_rows?.rows ?? [])
        .filter((r) => r.status !== "Removed")
        .map((r): Cell[] => {
          const q = byId(v.quotes?.rows, r.id);
          const listed = r.public && r.ticker !== "";
          return [
            link({ kind: "company", id: r.id }),
            { k: "text", v: listed ? r.ticker : "-" },
            link({ kind: "industry", id: r.industry }),
            link({ kind: "country", id: r.hq_country }),
            r.exchange === null ? { k: "text", v: "-" } : link({ kind: "exchange", id: r.exchange }),
            q ? { k: "price", v: q.last } : UNKNOWN,
            q ? { k: "gain", v: q.change_pct, unit: "percent" } : UNKNOWN,
            figureCell(r.revenue_ttm, "money"),
            figureCell(r.net_income_ttm, "money"),
            figureCell(r.value, "money"),
            listed ? { k: "rating", v: r.rating } : UNKNOWN,
            { k: "text", v: r.status },
          ];
        });
      return {
        id: kind,
        columns: [
          { title: "Name", width: 230 },
          { title: "Ticker", width: 60 },
          { title: "Industry", width: 170 },
          { title: "HQ", width: 100 },
          { title: "Exchange", width: 170 },
          { title: "Price", width: 80, hint: "Last price, USD a share" },
          { title: "Day", width: 70, hint: "Change since the last close" },
          {
            title: "Revenue TTM",
            width: 130,
            hint: "Trailing four published quarters; a band while not published",
          },
          { title: "Net income", width: 130, hint: "TTM; a band while not published" },
          { title: "Value", width: 130, hint: "Market cap at EFV when listed; a band while not published" },
          { title: "Rating", width: 60, hint: "? for private companies" },
          { title: "Status", width: 80 },
        ],
        rows,
      };
    }
    case "characters": {
      const rows = (v.characters?.full ?? []).flatMap((c): Cell[][] => {
        if (c.id.kind !== "Full") return [];
        const first = c.roles[0];
        let firstRole: Cell = { k: "text", v: "-" };
        if (first) {
          const co = role(first)[1];
          const name = byId(v.company_rows?.rows, co)?.name ?? "?";
          firstRole = { k: "link", text: roleText(first, name), page: { kind: "company", id: co } };
        }
        return [
          [
            { k: "link", text: c.name, page: { kind: "character", id: c.id.id } },
            { k: "int", v: c.age },
            c.home ? placeCell(v, c.home.province, c.home.province_name) : { k: "text", v: "-" },
            { k: "text", v: c.tier },
            firstRole,
            { k: "int", v: c.roles.length },
            { k: "int", v: c.holdings.length },
          ],
        ];
      });
      return {
        id: kind,
        columns: [
          { title: "Name", width: 200 },
          { title: "Age", width: 50 },
          { title: "Home", width: 200 },
          { title: "Tier", width: 80 },
          { title: "First role", width: 260 },
          { title: "Roles", width: 60 },
          { title: "Holdings", width: 70 },
        ],
        rows,
      };
    }
    case "countries": {
      const rows = (v.countries?.countries ?? []).map((c): Cell[] => [
        link({ kind: "country", id: c.id }),
        { k: "text", v: c.iso3 },
        { k: "text", v: c.superregion },
        link({ kind: "zone", id: c.zone }),
        { k: "money", v: c.gdp_usd },
        { k: "percent", v: c.corp_tax_rate },
        { k: "rating", v: c.sovereign_rating },
        { k: "percent", v: c.sovereign_spread },
        { k: "int", v: c.hq_companies.length },
      ]);
      return {
        id: kind,
        columns: [
          { title: "Country", width: 200 },
          { title: "ISO3", width: 50 },
          { title: "Region", width: 140 },
          { title: "Zone", width: 170 },
          { title: "GDP", width: 80 },
          { title: "Corp tax", width: 70 },
          { title: "Sovereign", width: 70 },
          { title: "Spread", width: 70, hint: "Sovereign spread" },
          { title: "HQ companies", width: 100 },
        ],
        rows,
      };
    }
    case "exchanges": {
      const rows = (v.exchanges?.exchanges ?? []).map((x): Cell[] => [
        { k: "text", v: x.code },
        link({ kind: "exchange", id: x.zone }),
        placeCell(v, x.hub_province, x.hub_city),
        { k: "text", v: x.index_name },
        x.level === null ? UNKNOWN : { k: "int", v: roundHalfAway(x.level) },
        { k: "int", v: x.listed_count },
        link({ kind: "zone", id: x.zone }),
      ]);
      return {
        id: kind,
        columns: [
          { title: "Code", width: 60 },
          { title: "Exchange", width: 220 },
          { title: "Hub", width: 200 },
          { title: "Index", width: 160 },
          { title: "Level", width: 70, hint: "The headline index at the last close" },
          { title: "Listed", width: 60 },
          { title: "Zone", width: 170 },
        ],
        rows,
      };
    }
    case "zones": {
      const rows = (v.zones?.zones ?? []).map((z): Cell[] => [
        { k: "int", v: z.number },
        link({ kind: "zone", id: z.id }),
        link({ kind: "exchange", id: z.id }),
        { k: "gain", v: z.effect, unit: "percent" },
        { k: "percent", v: z.credit_spread },
        { k: "int", v: roundHalfAway(z.confidence) },
        z.index_close === null ? UNKNOWN : { k: "int", v: roundHalfAway(z.index_close) },
        { k: "percent", v: z.gdp_share },
        { k: "int", v: z.members.length },
      ]);
      return {
        id: kind,
        columns: [
          { title: "No.", width: 40 },
          { title: "Zone", width: 200 },
          { title: "Exchange", width: 200 },
          { title: "Effect", width: 70 },
          { title: "Spread", width: 70 },
          { title: "Confidence", width: 90 },
          { title: "Index", width: 70, hint: "The headline index at the last close" },
          { title: "GDP share", width: 80 },
          { title: "Countries", width: 80 },
        ],
        rows,
      };
    }
  }
}

/** A list page as data: the kind's name, its entry count, and the index table in the head. */
export function listDoc(page: PageOf<ListKind>, v: ViewsData, index: NameIndex): PageDoc {
  const n = listLen(page, v);
  return {
    page,
    title: kindName(page.kind),
    kind: n === null ? "" : `${n} entries`,
    chips: [span.colored("An index of links; figures follow the views", "amber")],
    head: [{ k: "table", table: listTable(page.kind, v, index) }],
    sections: [],
  };
}

/** The views each list reads (lists.rs; Characters and Companies add the names they show). */
const LIST_VIEWS = {
  companies: ["company_rows", "quotes"],
  characters: ["characters", "places", "company_rows"],
  countries: ["countries"],
  exchanges: ["exchanges", "places"],
  zones: ["zones"],
} as const;

export const pages = LIST_KINDS.map((kind) =>
  definePage({
    kind,
    views: LIST_VIEWS[kind],
    sections: [],
    doc: (page, v, index) => listDoc(page, v, index),
  }),
);
