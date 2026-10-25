// The World page (crates/game/src/pages/world.rs): the map's place and the workspace's home. It
// links to every list page, the current quarter's recap and Settings, and holds the province
// table: every province of v_places in id order with its CSV id, name (a link to the province's
// page, M8.7) and country (a link to the country's page), read from v_places (D426, D570).

import type { NameIndex } from "../../links/names.ts";
import type { Cell } from "../../widgets/cells.ts";
import { type Block, type PageDoc, span, type TableDoc } from "../doc.ts";
import type { PageRef } from "../ref.ts";
import { definePage } from "../spec.ts";
import type { ViewsData } from "../views.ts";

/** The pages the World page links to, before the recap (world.rs). */
export const WORLD_LINKS: readonly PageRef[] = [
  { kind: "companies" },
  { kind: "industries" },
  { kind: "exchanges" },
  { kind: "zones" },
  { kind: "countries" },
  { kind: "characters" },
  { kind: "events" },
  { kind: "news" },
];

/** The province table (D570): every province of v_places in id order. */
export function provinceTable(v: ViewsData): TableDoc {
  const places = v.places;
  const rows = (places?.provinces ?? []).map((p): Cell[] => {
    const c = places?.countries[p.country];
    return [
      { k: "text", v: p.key },
      { k: "link", text: p.name, page: { kind: "province", id: p.id } },
      c ? { k: "text", v: c.iso3 } : { k: "unknown" },
      c ? { k: "link", text: c.name, page: { kind: "country", id: p.country } } : { k: "unknown" },
    ];
  });
  return {
    id: "provinces",
    columns: [
      { title: "Id", width: 90 },
      { title: "Name", width: 240 },
      { title: "ISO3", width: 60 },
      { title: "Country", width: 200 },
    ],
    rows,
  };
}

/** The whole World page as data. */
export function worldDoc(v: ViewsData, index: NameIndex): PageDoc {
  const recap = index.latestRecap();
  const pages: PageRef[] = [...WORLD_LINKS, ...(recap ? [recap] : []), { kind: "settings" }];
  const links: Block = {
    k: "line",
    spans: [span.muted("Pages:"), ...pages.map((p) => span.link(index.title(p), p))],
  };
  const hint: Block = {
    k: "line",
    spans: [span.muted("Ctrl+K searches every name. Shift+click a link opens it in a new pane.")],
  };
  return {
    page: { kind: "world" },
    title: "World",
    kind: "Home",
    chips: [span.colored("Every province of the world: the map shows them in its pane", "amber")],
    head: [links, hint, { k: "table", table: provinceTable(v) }],
    sections: [],
  };
}

export const pages = [
  definePage({
    kind: "world",
    // world.rs reads v_map_static, v_map_layers, v_province_card and v_places; the page itself
    // draws only from v_places (the map pane draws the rest).
    views: ["places"],
    sections: [],
    doc: (_page, v, index) => worldDoc(v, index),
  }),
];
