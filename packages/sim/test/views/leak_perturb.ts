// The leak test's perturbed world (leak.test.ts, check 4): a copy of the state in which every
// company that shows estimates (D420) has other books. Not a Rust file.
//
// What is perturbed: every number of a banded company's state, its Company row (the finance
// subtree too), its units and its stock, but those `KEPT` names with their reason (ids, dates,
// shares and the cap table, what D420 leaves exact as operations, the compute and licences cost
// of D434, the published rating and distress state, the board, market data); a number a later
// field adds is perturbed until it is classed. So the cached values derived from the books (the
// last surprise, E_norm and G, a plan's money, a birth's run rate, the loss quarter count) move
// with them, and a view that shows one is caught. Two booleans and one tag that follow the books
// are changed too (`FLIPPED`, the surprise tier). Not perturbed: every publishing company. The
// recaps' pages (D433) are perturbed for a banded company: its consensus and projection, and what
// follows (the range, surprise and reaction).
//
// How: each number x becomes x × k + c, k from `FACTORS` and c a small offset in the field's
// unit, both stepped by a counter of the numbers perturbed so far (a count gains 1 to 3). So the
// books change unevenly: a ratio of two figures (a margin, a quarter-on-quarter growth) changes as
// well as each figure, and a true 0 does not stay 0, so a derived value that follows the books (a
// figure in $M, rounded to $1M, over the shares, a ratio) changes too. A year statement whose
// four quarters are archived is rebuilt from the perturbed quarters (flows summed, the balance
// sheet, held TB and guidance Q4's), so the perturbed books stay ones the estimated year can
// band (D430) and the perturbed build's bands can be checked against them.
import { jumpedPrice, surprise } from "../../src/market/earnings.ts";
import { range } from "../../src/market/projection.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import type { SurpriseTag } from "../../src/types/state/market.ts";
import type { ExpectedResult } from "../../src/types/state/recap.ts";
import type { World } from "../../src/types/world.ts";
import { showsEstimates } from "../../src/views/estimate.ts";
import { isDateLike, isRecord } from "./leak_rules.ts";

/** The scale factors (none is 1). */
const FACTORS = [1.25, 0.8, 1.5, 1.125, 0.625, 1.375, 0.9];
/**
 * The offsets' units: money in USD, data in TB, a ratio (odd values, so a perturbed truth does
 * not meet a public number such as a 0.75 share or a 0.375 tax rate by chance).
 */
const OFFSET_USD = 1234.5678;
const OFFSET_TB = 0.37129;
const OFFSET_RATIO = 0.0123457;

/**
 * The numbers of a banded company's state left as they are, by normalized path (`company.`,
 * `unit.` or `stock.`, then the fields, `[]` for an index), each with its reason. Everything else
 * numeric is perturbed (see the header).
 */
export const KEPT: readonly (readonly [RegExp, string])[] = [
  // Ids and enum numbers (dates are skipped by their shape).
  [/^company\.(industry|hq_country|hq_province|units\[\]|controller|founders\[\]|origin\.event)$/, "an id"],
  [/^company\.data\[\]\.industry$/, "an id"],
  [/^company\.(board|directors)\[\]\.(character|seat\.id)$/, "an id"],
  [/^company\.holders\[\]\.holder\.(character|company|country)$/, "an id"],
  [/^company\.start_control\.(owner_of_record|controller\.(character|company|country))$/, "an id"],
  [/^company\.ipo_last_vote\.result\.ballots\[\]\.voter\.(id|character)$/, "an id"],
  [/^unit\.(company|industry|base_province)$/, "an id"],
  [/^stock\.exchange$/, "an id"],
  // Shares are not money, so a cap table is never banded (D420, D425).
  [
    /^company\.(shares_out|holders\[\]\.shares|start_control\.stake)$/,
    "shares and the cap table (D420, D425)",
  ],
  [/^stock\.shares$/, "shares (D420, D147)"],
  // Operations that follow the stations, not books (D420; productivity's D436 tension is
  // leak.test.ts `knownExact`).
  [/^company\.(labor_units|stations\.\w+|pc|pc_bonus|management_score)$/, "an operation (D420)"],
  [/^company\.data\[\]\.book\.free_rd_pct$/, "the free R&D step, an operation (D420)"],
  [
    /^company\.finance\.archive\.(quarters|years)\[\]\.key\.(productivity|pc_bonus|labor_units|free_rd_pct|management_score)$/,
    "an operation (D420)",
  ],
  [/^company\.birth_run_rate\.pc_bonus$/, "the PC bonus, an operation (D420)"],
  [/^unit\.productivity$/, "productivity, an operation (D420; D436 bands it in v_units)"],
  [/^unit\.location_bonus$/, "the province's location bonus (spec 5.2: published bonuses, D430)"],
  // The plans are shown exactly (spec 8 Units tab, D420).
  [/^unit\.(growth_plan|rd_plan)$/, "the plans (D420)"],
  [/^company\.plan\.operating\.(growth|rd_plan|stations\.\w+)$/, "the plans and stations (D420)"],
  // The compute bill: a published price list times counts (D434).
  [/^company\.compute\.\w+$/, "the compute bill (D434)"],
  [
    /^company\.finance\.(pending|month|months\[\]\.lines|last_month\.lines|archive\.(quarters|years)\[\]\.lines)\.shared$/,
    "the compute and licences line (D434)",
  ],
  [/^unit\.shared_m$/, "the compute and licences cost (D434)"],
  // The rating, its breakdown and the distress state are published (F6, D157, D420): v_ratings
  // shows every company's, the implied rating's notches too, so one copied elsewhere is no leak.
  [
    /^company\.finance\.(implied\.\w+_notches|last_review_notches|line\.excess_months_left|distress\.(distress_months|frozen_quarters))$/,
    "the rating and distress state (F6, D157, D420)",
  ],
  // The board and its vote (spec 3.7, 5.20.1 step 3: phase, confidence and traits).
  [/^company\.(board|directors)\[\]\.seat\.character\.(age|skills\.\w+)$/, "a board member (3.7)"],
  [/^company\.ipo_last_vote\.result\.(yes|no|ballots\[\]\.chance)$/, "the IPO vote (5.20.1 step 3)"],
  // Market data (3.10, 5.14; the EFV error, D140; the bars, D424).
  [/^stock\.(price|prev_close|ipo_price|buzz|efv_error|bar\.\w+|bars\..+)$/, "market data (3.10, D140)"],
];

/** Booleans that follow the books (21.3.2 result tags): flipped. */
const FLIPPED: ReadonlySet<string> = new Set(["stock.tags.loss", "stock.tags.record_quarter"]);

/** The surprise tier follows the books (5.15): each moves to another. */
const OTHER_TIER: Record<SurpriseTag, SurpriseTag> = {
  BigBeat: "Miss",
  Beat: "BigMiss",
  Miss: "BigBeat",
  BigMiss: "Beat",
};

const TB = /(\.book\.held|\.book\.unstructured\[\]|\.key\.held_tb)$/;
const RATIO = /(growth_factor|_surprise|fixed_cost_rate|\.sale\.share)$/;
const COUNT = /(loss_quarters|failed_raises|months_left)$/;

const LEDGER_FIELDS = [
  "revenue",
  "variable",
  "fixed_cash",
  "rd",
  // Not `shared`: it is kept (D434), so the year's stays its own.
  "depreciation",
  "line_interest",
  "line_fee",
  "interest_income",
  "asset_sale_gain",
  "tax",
  "tax_paid",
  "asset_purchases",
  "asset_sale_proceeds",
  "line_drawn_or_repaid",
  "shares_issued_net",
  "dividends",
] as const;

/** The ids of the companies that show estimates now (D420). */
export function bandedCompanies(w: World): CompanyId[] {
  return w.companies.map((_, i) => i as CompanyId).filter((id) => showsEstimates(w, id));
}

/** Why a banded company's number at `path` is kept, or null: it is perturbed. */
export function keptWhy(path: string): string | null {
  for (const [re, why] of KEPT) if (re.test(path)) return why;
  return null;
}

/** A copy of `w` with every banded company's books perturbed (see the header). */
export function perturbBooks(w: World): World {
  const p = structuredClone(w);
  const banded = new Set(bandedCompanies(p));
  // Objects a publishing company reaches: perturbing one of them would change a published figure.
  const published = new Set<object>();
  p.companies.forEach((c, i) => {
    if (banded.has(i as CompanyId)) return;
    const f = c.finance;
    for (const s of [...f.archive.quarters, ...f.archive.years]) {
      published.add(s);
      published.add(s.lines);
      published.add(s.balance);
      published.add(s.key);
    }
  });
  const seen = new Set<object>();
  let n = 0;
  /** Perturbs every number under `x` not `KEPT` (an object reached twice, once). */
  const walk = (x: unknown, path: string): void => {
    if (Array.isArray(x)) {
      if (seen.has(x)) return;
      seen.add(x);
      x.forEach((y, i) => {
        if (typeof y === "number") x[i] = bump(y, `${path}[]`);
        else walk(y, `${path}[]`);
      });
      return;
    }
    if (!isRecord(x) || seen.has(x) || isDateLike(x)) return;
    if (published.has(x))
      throw new Error(`${path}: a banded company's books are shared with a published one`);
    seen.add(x);
    for (const k of Object.keys(x)) {
      const y = x[k];
      const at = `${path}.${k}`;
      if (typeof y === "number") x[k] = bump(y, at);
      else if (typeof y === "boolean" && FLIPPED.has(at)) x[k] = !y;
      else walk(y, at);
    }
  };
  const bump = (x: number, path: string): number => {
    if (keptWhy(path) !== null) return x;
    const j = n++;
    if (COUNT.test(path)) return x + 1 + (j % 3);
    const offset = TB.test(path) ? OFFSET_TB : RATIO.test(path) ? OFFSET_RATIO : OFFSET_USD;
    return x * FACTORS[j % FACTORS.length]! + offset * (1 + (j % 3));
  };
  for (const id of banded) {
    const c = p.companies[id]!;
    walk(c, "company");
    for (const u of c.units) walk(p.units[u]!, "unit");
    const s = p.market.stocks[id]!;
    walk(s, "stock");
    if (s.tags.surprise !== null) s.tags.surprise = OTHER_TIER[s.tags.surprise];
    // A year with its four quarters stays their year (3.9, D430): its flows are their sums,
    // its balance sheet, held TB and guidance Q4's, as the estimated year takes them.
    const f = c.finance;
    for (const y of f.archive.years) {
      const year = y.period.kind === "Year" ? y.period.year : Number.NaN;
      const qs = f.archive.quarters.filter(
        (q) => q.period.kind === "Quarter" && q.period.quarter.year === year,
      );
      if (qs.length !== 4) continue;
      for (const l of LEDGER_FIELDS) y.lines[l] = qs.reduce((sum, q) => sum + q.lines[l], 0);
      const q4 = qs[3]!;
      y.balance = { ...q4.balance };
      y.key = { ...y.key, held_tb: q4.key.held_tb, guidance: [q4.key.guidance[0], q4.key.guidance[1]] };
    }
  }
  // The recaps' pages (D433), which the views copy: a banded company's consensus and projection
  // are perturbed, and what the recap works out from them follows (src/recap.ts: the expected
  // surprise, 5.15; the reaction, its jump; the range, the 5.16 range at the page's width,
  // centred on the consensus), so the perturbed pages stay ones the view's bands can hold.
  // Confidence and the outlook stay (shown as they are, as Rust).
  const expectedRow = (e: ExpectedResult): void => {
    if (!banded.has(e.company) || seen.has(e)) return;
    seen.add(e);
    const j = n++;
    e.projection = e.projection * FACTORS[j % FACTORS.length]! + OFFSET_USD;
    e.consensus = e.consensus * FACTORS[(j + 1) % FACTORS.length]! + 2 * OFFSET_USD;
    e.expected_surprise = surprise(e.projection, e.consensus);
  };
  for (const r of p.recaps) {
    for (const e of [...r.world.expected_beats, ...r.world.expected_misses]) expectedRow(e);
    for (const c of r.companies) {
      if (!banded.has(c.company)) continue;
      const old = c.expected.consensus;
      const width = old === 0 ? 0 : (c.range[1] - c.range[0]) / 2 / Math.abs(old);
      expectedRow(c.expected);
      c.range = range(c.expected.consensus, width);
      c.expected_reaction = jumpedPrice(1.0, c.expected.expected_surprise) - 1.0;
    }
  }
  return p;
}
