// A placeholder entity page: the name cards of later pages (company, country, province, industry)
// land here. It shows the few facts the mock views carry, to prove opening an entity by command.

import { memo } from "react";
import { useNames } from "../shell/names.ts";
import { useViewData } from "../sim/hooks.ts";
import { display, figureCell, type PageRef, price } from "../widgets/cells.ts";

function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="facts">
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntityPaneInner({ page }: { page: PageRef }) {
  const companies = useViewData("company_rows");
  const industries = useViewData("industry_rows");
  const countries = useViewData("countries");
  const places = useViewData("places");
  const quotes = useViewData("quotes");
  const names = useNames();
  let items: [string, string][] = [];
  let title = "";
  if (page.kind === "company") {
    const c = companies?.rows.find((r) => r.id === page.id);
    const q = quotes?.rows.find((r) => r.id === page.id);
    title = c?.name ?? "";
    if (c) {
      items = [
        ["Ticker", c.ticker],
        ["Industry", names.industry(c.industry)],
        ["HQ", names.country(c.hq_country)],
        ["Status", c.status],
        ["Revenue TTM", display(figureCell(c.revenue_ttm, "money"))],
        ["Value", display(figureCell(c.value, "money"))],
        ["Price", q ? price(q.last) : "private"],
      ];
    }
  } else if (page.kind === "industry") {
    const i = industries?.rows.find((r) => r.id === page.id);
    title = i?.name ?? "";
    if (i) {
      items = [
        ["Sector", i.sector],
        ["Demand", display({ k: "money", v: i.demand })],
        ["Phase", i.phase_label],
        ["Top companies", i.top_companies.map(names.company).join(", ")],
      ];
    }
  } else if (page.kind === "country") {
    const c = countries?.countries.find((r) => r.id === page.id);
    title = c?.name ?? "";
    if (c) {
      items = [
        ["ISO3", c.iso3],
        ["Region", c.superregion],
        ["GDP", display({ k: "money", v: c.gdp_usd })],
        ["Company HQs", String(c.hq_companies.length)],
      ];
    }
  } else {
    const p = places?.provinces.find((r) => r.id === page.id);
    title = p?.name ?? "";
    if (p) items = [["Country", names.country(p.country)]];
  }
  return (
    <div className="pane">
      <div className="scroll">
        <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
        <Facts items={items} />
      </div>
    </div>
  );
}

export const EntityPane = memo(EntityPaneInner);
