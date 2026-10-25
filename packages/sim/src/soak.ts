// The engine's own true totals for the headless soak (build-plan M10.1; D427). Never a view: once
// a private company's figures are estimate bands in every view (D420), and the totals of an
// industry with one or two of them too (D432), the soak's spec 10 columns that read true figures
// get them here, computed exactly as the soak computed them from the views before (same order,
// same sums), so its CSVs stay the same. `simSoakStats` (lib.ts) serves it to the headless runner
// only (Rust feature `soak-stats`); the game reads only `SimViews` (spec 9). Ported from
// crates/sim/src/soak.rs.

import type { CompanyId } from "./types/ids.ts";
import { totalCmp } from "./types/num.ts";
import type { CompanyStatus } from "./types/state/finance.ts";
import type { World } from "./types/world.ts";
import { businessUnitEbitM } from "./world/entities.ts";

/** One industry's true figures the soak reads. */
export interface SoakIndustry {
  /** Last month's revenue of the named units, summed biggest first (as v_industry_row did). */
  named_revenue_m: number;
  fringe_revenue_m: number;
  supply_ratio: number;
  market_factor: number;
}

export interface SoakStats {
  /** Credit lines drawn, USD, summed over every company in id order (spec 5.12). */
  line_drawn_usd: number;
  /** Companies whose units' last-month EBIT (after R&D, spec 5.5) sums above 0. */
  profitable_companies: number;
  /** The mean productivity over every unit (spec 5.6). */
  mean_productivity: number;
  /**
   * The median productivity of the units with gross assets above 0 of companies not frozen, the
   * mean of the middle two for an even count; 0 with none (spec 10, D321).
   */
  median_productivity: number;
  /** Data held plus unstructured over all companies, TB (spec 5.9). */
  data_tb: number;
  /** In industry id order. */
  industries: SoakIndustry[];
}

/** The median of sorted values (0 when empty). */
export function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0.0;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return 0.5 * (sorted[n / 2 - 1]! + sorted[n / 2]!);
}

/** finance/distress.rs `CompanyStatus::is_frozen`: Bankrupt or Removed (spec 5.12 step 2; D231). */
function isFrozen(status: CompanyStatus): boolean {
  return status === "Bankrupt" || status === "Removed";
}

/**
 * views/industry_rows.rs `companies_by_revenue`: every industry's companies with last month's
 * revenue, biggest first, ties to the lower id. A copy until the views port (Step 3) lands it;
 * then import it from views/industry_rows.ts.
 */
function companiesByRevenue(w: World): [CompanyId, number][][] {
  const out: [CompanyId, number][][] = w.industries.map(() => []);
  for (const u of w.units) out[u.industry]!.push([u.company, u.revenue_m]);
  for (const list of out) list.sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);
  return out;
}

/** The soak's totals at the world's clock. */
export function soakStats(w: World): SoakStats {
  const companies = w.companies;
  let line_drawn_usd = 0.0;
  for (const c of companies) line_drawn_usd += c.finance.line.drawn;
  const ebit = companies.map(() => 0.0);
  for (const u of w.units) ebit[u.company] = ebit[u.company]! + businessUnitEbitM(u);
  const prod = w.units
    .filter((u) => u.gross_assets > 0.0 && !isFrozen(companies[u.company]!.finance.distress.status))
    .map((u) => u.productivity);
  prod.sort(totalCmp);
  let prodSum = 0.0;
  for (const u of w.units) prodSum += u.productivity;
  const mean_productivity = prodSum / Math.max(w.units.length, 1);
  // Per company, held plus unstructured over its industries, then summed (as TechRow did).
  let data_tb = 0.0;
  for (const c of companies) {
    let held = 0.0;
    for (const d of c.data) {
      let unstructured = 0.0;
      for (const tb of d.book.unstructured) unstructured += tb;
      held += d.book.held + unstructured;
    }
    data_tb += held;
  }
  const ranked = companiesByRevenue(w);
  const industries = w.industries.map((ind, id) => {
    let named = 0.0;
    for (const [, r] of ranked[id]!) named += r;
    return {
      named_revenue_m: named,
      fringe_revenue_m: ind.fringe_revenue_m,
      supply_ratio: ind.supply_ratio,
      market_factor: ind.market_factor,
    };
  });
  return {
    line_drawn_usd,
    profitable_companies: ebit.filter((e) => e > 0.0).length,
    mean_productivity,
    median_productivity: median(prod),
    data_tb,
    industries,
  };
}
