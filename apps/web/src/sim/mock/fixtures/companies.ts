// The company and industry list fixtures (v_company_rows, v_industry_rows), moved as they were
// from mockViews.ts.

import type { CompanyRow, DateTime, IndustryId, IndustryRow } from "@tc20ff/sim";
import { hashStr, type MockWorld, unitHash } from "../mockWorld.ts";
import type { MockStock } from "./market.ts";
import { exact, shown } from "./shared.ts";

export function companyRowsView(w: MockWorld, stocks: MockStock[]): CompanyRow[] {
  const byId = new Map(stocks.map((s) => [s.id, s]));
  return w.companies.map((c): CompanyRow => {
    const s = byId.get(c.id);
    return {
      id: c.id,
      key: c.key,
      name: c.name,
      ticker: c.ticker,
      industry: c.industry,
      hq_country: c.country,
      public: c.public,
      revenue_ttm: shown(c.revenueUsd, !c.public, `${c.key}r`),
      net_income_ttm: shown(c.revenueUsd * (0.04 + 0.12 * unitHash(c.key, 3)), !c.public, `${c.key}n`),
      rating: c.rating,
      status: c.status,
      exchange: s ? s.exchange : null,
      price: s ? s.price : 0,
      change: s && s.prevClose > 0 ? (s.price - s.prevClose) / s.prevClose : 0,
      value: shown(s ? s.price * s.shares : c.valueUsd * 0.7, !c.public, `${c.key}v`),
      archetype: "Incumbent",
      origin: { kind: "Start" },
      listing: s ? { kind: "BeforeStart", exchange: s.exchange } : { kind: "Private" },
      controller: { kind: "None" },
      controller_name: null,
      estimated: !c.public,
    };
  });
}

export function industryRowsView(w: MockWorld, now: DateTime): IndustryRow[] {
  const year = now / (24 * 365);
  return w.data.industries.rows.map((x, i): IndustryRow => {
    const demand = x.world_size_2020_usd_bn * 1e9 * (1 + x.trend_growth) ** year;
    const supplyRatio = 1 + (unitHash(x.id, 21) - 0.5) * 0.2;
    const labels = ["Boom", "Normal", "Normal", "Glut", "Bust"] as const;
    const top = w.companies
      .filter((c) => c.industry === (i as IndustryId))
      .sort((a, b) => b.revenueUsd - a.revenueUsd || a.id - b.id)
      .slice(0, 5)
      .map((c) => c.id);
    return {
      id: i as IndustryId,
      key: x.id,
      name: x.name,
      sector: x.sector,
      demand,
      trend_demand: demand,
      supply: exact(demand * supplyRatio),
      supply_ratio: exact(supplyRatio),
      market_factor: exact(1 / supplyRatio),
      phase_label: labels[hashStr(x.id) % labels.length] as IndustryRow["phase_label"],
      lt: x.trend_growth,
      growth_annual: x.trend_growth + (unitHash(x.id, 22) - 0.5) * 0.04,
      fringe_share: exact(0.1 + 0.2 * unitHash(x.id, 23)),
      named_revenue_m: exact((demand / 12) * 0.8),
      fringe_revenue_m: exact((demand / 12) * 0.2),
      top_companies: top,
      estimated: false,
    };
  });
}
