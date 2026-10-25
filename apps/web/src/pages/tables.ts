// Table models more than one page shows (the Rust pages borrowed them from each other's files):
// the provinces of some countries (province.rs `provinces_model`: the Country and Zone pages) and
// the company status text (company.rs `status_text`). Framework-owned: page lanes import these
// rather than copy them, and add a model here only when two page files need it.

import type { CompanyStatus, CountryId } from "@tc20ff/sim";
import type { NameIndex } from "../links/names.ts";
import type { Cell } from "../widgets/cells.ts";
import type { DocColumn, TableDoc } from "./doc.ts";
import type { PageRef } from "./ref.ts";
import type { ViewsData } from "./views.ts";

/** A link cell to a page, named by the index. */
export function linkCell(index: NameIndex, page: PageRef): Cell {
  return { k: "link", text: index.title(page), page };
}

/** A company's status on screen (company.rs `status_text`). */
export function statusText(s: CompanyStatus): string {
  return s;
}

export const PROVINCE_COLUMNS: readonly DocColumn[] = [
  { title: "Province", width: 220 },
  { title: "Country", width: 150 },
  { title: "Region", width: 150 },
  { title: "C", width: 40, hint: "Commerce (3.3)" },
  { title: "I", width: 40, hint: "Industry (3.3)" },
  { title: "P", width: 40, hint: "Population (3.3)" },
  { title: "Metro", width: 130 },
  { title: "HQs", width: 50 },
  { title: "Units", width: 50 },
];

/**
 * The provinces of `countries` as links (M8.7, D707), from v_province_card: name, country,
 * region, the three development tracks (spec 3.3), Metro, HQs and units.
 */
export function provincesTable(
  id: string,
  countries: readonly CountryId[],
  v: ViewsData,
  index: NameIndex,
): TableDoc {
  const want = new Set<number>(countries);
  const rows = (v.province_cards?.cards ?? [])
    .filter((c) => want.has(c.country))
    .map((c): Cell[] => [
      linkCell(index, { kind: "province", id: c.id }),
      linkCell(index, { kind: "country", id: c.country }),
      { k: "text", v: c.region },
      { k: "int", v: c.commerce },
      { k: "int", v: c.industry },
      { k: "int", v: c.population },
      { k: "text", v: c.metro ?? "" },
      { k: "int", v: c.hqs.length },
      { k: "int", v: c.units.length },
    ]);
  return { id, columns: [...PROVINCE_COLUMNS], rows };
}
