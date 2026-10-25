// Two small list pages built on the table widget: industries (v_industry_rows) and countries
// (v_countries).

import type { CountryRow, IndustryRow } from "@tc20ff/sim";
import { memo } from "react";
import { useViewData } from "../sim/hooks.ts";
import { figureCell } from "../widgets/cells.ts";
import { type Column, DataTable } from "../widgets/DataTable.tsx";

const INDUSTRY_COLUMNS: Column<IndustryRow>[] = [
  {
    id: "name",
    header: "Industry",
    width: 240,
    cell: (r) => ({ k: "link", text: r.name, page: { kind: "industry", id: r.id } }),
  },
  { id: "sector", header: "Sector", width: 160, cell: (r) => ({ k: "text", v: r.sector }) },
  { id: "demand", header: "Demand", width: 100, cell: (r) => ({ k: "money", v: r.demand }) },
  { id: "supply", header: "Supply", width: 100, cell: (r) => figureCell(r.supply, "money") },
  { id: "ratio", header: "S", width: 70, cell: (r) => figureCell(r.supply_ratio, "ratio") },
  { id: "phase", header: "Phase", width: 70, cell: (r) => ({ k: "text", v: r.phase_label }) },
  {
    id: "growth",
    header: "Growth",
    width: 80,
    cell: (r) => ({ k: "gain", v: r.growth_annual, unit: "percent" }),
  },
  { id: "fringe", header: "Fringe", width: 80, cell: (r) => figureCell(r.fringe_share, "percent") },
];

const COUNTRY_COLUMNS: Column<CountryRow>[] = [
  {
    id: "name",
    header: "Country",
    width: 220,
    cell: (r) => ({ k: "link", text: r.name, page: { kind: "country", id: r.id } }),
  },
  { id: "iso3", header: "ISO3", width: 60, cell: (r) => ({ k: "text", v: r.iso3 }) },
  { id: "region", header: "Region", width: 180, cell: (r) => ({ k: "text", v: r.superregion }) },
  { id: "gdp", header: "GDP", width: 100, cell: (r) => ({ k: "money", v: r.gdp_usd }) },
  { id: "tax", header: "Corp tax", width: 80, cell: (r) => ({ k: "percent", v: r.corp_tax_rate }) },
  { id: "rating", header: "Rating", width: 70, cell: (r) => ({ k: "rating", v: r.sovereign_rating }) },
  { id: "hqs", header: "HQs", width: 60, cell: (r) => ({ k: "int", v: r.hq_companies.length }) },
];

function IndustriesPaneInner() {
  const view = useViewData("industry_rows");
  const rows = view?.rows ?? [];
  return (
    <div className="pane">
      <div className="toolbar">{rows.length} industries</div>
      <div className="fill">
        <DataTable rows={rows} columns={INDUSTRY_COLUMNS} rowKey={(r) => r.id} />
      </div>
    </div>
  );
}

function CountriesPaneInner() {
  const view = useViewData("countries");
  const rows = view?.countries ?? [];
  return (
    <div className="pane">
      <div className="toolbar">{rows.length} countries</div>
      <div className="fill">
        <DataTable rows={rows} columns={COUNTRY_COLUMNS} rowKey={(r) => r.id} />
      </div>
    </div>
  );
}

export const IndustriesPane = memo(IndustriesPaneInner);
export const CountriesPane = memo(CountriesPaneInner);
