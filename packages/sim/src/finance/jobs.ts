// The books on the World (build-plan M4.1 to M4.9): the load's starting rating, line and
// synthetic history (spec 7.1, 4.4), the monthly ledger through 4.3 steps 9 to 14, the 4.4 close
// (tax paid, statements, archive), the release (removals), the 01:00 rating and credit line
// review, the 4.5 yearly statements, and the dividend rule ready for the M6 plan lock. Ported
// from crates/sim/src/finance/jobs.rs.
//
// The formulas are the pure functions in this module's siblings; each job reads the World, calls
// them in company id order and writes the results back (the pure step contract, `world` docs).
// Nothing here draws.
//
// A month's ledger is opened at step 9 (from the flows booked since the last close), filled at
// steps 11, 12 and 13 and posted at step 14. A company frozen when step 9 opens its month
// (Bankrupt or Removed) posts an empty month (D231). Every posted month of a company still in the
// game is checked against the balance identity and rolled forward (M4.9, `checkMonth`); the
// quarter-end month after the close has paid the tax.

import { rdPlanAtLoad } from "../ai/archetype.ts";
import { saleFactor } from "../economy/assets.ts";
import { PRODUCTIVITY_SCALE, QUARTERS_PER_YEAR as QUARTERS_PER_YEAR_F64 } from "../economy/index.ts";
import { variableCostShare } from "../economy/revenue.ts";
import { pPre } from "../economy/supply.ts";
import { dataBookFreeRdFraction } from "../ops/data.ts";
import { BAREBONES_REVENUE_USD } from "../ops/stations.ts";
import { formatMonth, monthPrev, quarterPrev, simDateMonthOf, simDateQuarter } from "../time/calendar.ts";
import {
  type JobCtx,
  jobCtxRaiseAlert,
  type Scheduler,
  schedulerRegister,
  tickFactsIsQuarterStart,
} from "../time/scheduler.ts";
import type { CompanyId } from "../types/ids.ts";
import { maxF, toU32Sat } from "../types/num.ts";
import type {
  BalanceSheet,
  CreditLine,
  ImpliedRating,
  KeyFigures,
  Ledger,
  PostedMonth,
  Statement,
} from "../types/state/finance.ts";
import type { Trait } from "../types/state/people.ts";
import { LABOR_SEAT_COUNT } from "../types/state/people.ts";
import type { Company, World } from "../types/world.ts";
import { businessUnitAssetsEff, companyDataIn } from "../world/entities.ts";
import { type Books, balanceErrorToString, balanceSheet, checkMonth } from "./balance.ts";
import {
  creditLineDefault,
  homeSpread,
  lineLimit,
  lineRate,
  MONTHS_PER_YEAR,
  minCash,
  monthlyCharges,
  reviewLine,
} from "./credit.ts";
import {
  companyStatusIsFrozen,
  onQuarterClose,
  removalDue,
  remove,
  type SettleInputs,
  settleMonth,
  settlementLineChange,
} from "./distress.ts";
import { impliedRating, notchesBetween, reviewMove, startingRating } from "./rating.ts";
import {
  companyFinanceInGame,
  companyFinancePushQuarter,
  companyFinancePushYear,
  companyFinanceQuarters,
  companyFinanceStatus,
} from "./state.ts";
import {
  ledgerDefault,
  ledgerEbitda,
  ledgerOperatingCash,
  ledgerPreTaxIncome,
  MONTHS_PER_QUARTER,
  QUARTERS_PER_YEAR,
  quarterStatement,
  SYNTHETIC_YEAR,
  syntheticHistory,
  trailingFour,
  yearStatement,
} from "./statements.ts";
import { accrueMonth, closeQuarter, quarterTax, taxBookDefault } from "./tax.ts";

// ---------------------------------------------------------------------------------------------
// Reading a company's books from the World.

/** Σ units asset_book (spec 3.5 `book_equity`, 3.9 business assets at book). */
export function assetBook(world: World, c: Company): number {
  let sum = 0.0;
  for (const u of c.units) sum += (world.units[u] as World["units"][number]).asset_book;
  return sum;
}

/** Σ units gross_assets (spec 3.6). */
export function grossAssets(world: World, c: Company): number {
  let sum = 0.0;
  for (const u of c.units) sum += (world.units[u] as World["units"][number]).gross_assets;
  return sum;
}

/** The balances the balance sheet reads (spec 3.9). */
export function books(world: World, c: Company): Books {
  return {
    cash: c.cash_usd,
    asset_book: assetBook(world, c),
    line_drawn: c.finance.line.drawn,
    tax: c.finance.tax,
  };
}

/** The company's balance sheet now (spec 3.9; D230). */
export function sheet(world: World, c: Company): BalanceSheet {
  return balanceSheet(books(world, c), companyFinanceStatus(c.finance));
}

/**
 * The company's home spread (spec 5.1.2 batch 156, 5.12): half its zone's credit spread, half its
 * HQ country's sovereign spread. `base` reads the zone's base spread, as the load does (D235);
 * otherwise the effective spread of the quarter.
 */
export function companyHomeSpread(world: World, c: Company, base: boolean): number {
  const country = world.countries[c.hq_country] as World["countries"][number];
  const zone = world.zones[country.zone] as World["zones"][number];
  const zone_spread = base ? zone.credit_spread_base : zone.credit_spread;
  return homeSpread(zone_spread, country.sovereign_spread);
}

/**
 * Trailing annual revenue (spec 6 min_cash, 3.7.1 company size): the trailing four quarters'
 * revenue (D129); 0 with no statements.
 */
export function trailingRevenue(c: Company): number {
  const l = trailingFour(companyFinanceQuarters(c.finance));
  return l === null ? 0.0 : l.revenue;
}

/** The traits of the company's named controller, if it is a full character (spec 6 "traits"). */
export function controllerTraits(world: World, c: Company): readonly Trait[] {
  return c.controller === null ? [] : (world.characters[c.controller] as World["characters"][number]).traits;
}

/**
 * Key figures at a period end (spec 3.9): productivity (the units' mean), PC bonus, labor units,
 * held TB, free R&D % of the main industry, management score and rating. The guidance range is
 * the 5.16 projection's (M6); (0, 0) until then.
 */
export function keyFigures(world: World, c: Company): KeyFigures {
  const n = Math.max(c.units.length, 1);
  let psum = 0.0;
  for (const u of c.units) psum += (world.units[u] as World["units"][number]).productivity;
  let held = 0.0;
  for (const d of c.data) held += d.book.held;
  const main = companyDataIn(c, c.industry);
  return {
    productivity: psum / n,
    pc_bonus: toU32Sat(maxF(c.pc_bonus, 0.0)),
    labor_units: c.labor_units,
    held_tb: held,
    free_rd_pct: main === null ? 0 : main.free_rd_pct,
    management_score: c.management_score,
    rating: c.finance.rating,
    guidance: [0.0, 0.0],
  };
}

// ---------------------------------------------------------------------------------------------
// Load (spec 7.1, 4.4).

/**
 * The starting run rate of one company (spec 7.1 "Rating", "History"; D121): the 7.1 company at M
 * 1.0 for a year. Each unit makes the revenue 7.1 sized it for (companies.csv R; a barebones unit
 * its $100,000 at its p_pre), variable cost `v × revenue`, and fixed cash, depreciation and
 * shared costs together `f × revenue × 100 ÷ p_pre` (5.5: the fixed cost rate holds them at `f ×
 * turnover × gross`), split as the load month splits them (depreciation and the 3.8 bill as
 * booked, fixed cash the rest). Paid R&D is the 6.3 plan (archetype and trait mults less free
 * R&D, productivity 100, loss_q 0). The line is at the starting rating (5.12) on
 * company-start.csv's cash and line, tax on each quarter's pre-tax income with no carryforward
 * (5.11) and replacement purchases equal to depreciation (a flat history, D228). Returns the
 * year's ledger, the implied rating of the run rate (7.1, 5.12) and the line, both at the
 * company's starting rating: company-start.csv's, which the implied rating must equal (D241,
 * D132; checked for all 651 in `m4_ratings.rs`).
 *
 * The load month itself runs at the load M and on gross assets rounded to the dollar, about 1e-7
 * off R, enough to move a rating that D236 sizes to a band edge; the run rate does not.
 */
export function runRate(world: World, c: Company): [Ledger, ImpliedRating, CreditLine] {
  const traits = controllerTraits(world, c);
  const l = ledgerDefault();
  const sole = c.units.length === 1;
  for (const uid of c.units) {
    const u = world.units[uid] as World["units"][number];
    const params = (world.industries[u.industry] as World["industries"][number]).params;
    const book = companyDataIn(c, u.industry);
    const free = book === null ? 0.0 : dataBookFreeRdFraction(book);
    const p_pre = pPre(u, c);
    // 7.1: the unit makes R at M 1.0 (one unit per company in the MVP); below $0.1M the barebones
    // loadout makes its assets at p_pre (D107).
    const revenue =
      sole && c.revenue_usd >= BAREBONES_REVENUE_USD
        ? c.revenue_usd
        : (businessUnitAssetsEff(u) * params.asset_turnover * p_pre) / PRODUCTIVITY_SCALE;
    const fixed_total = (params.fixed_cost_share * revenue * PRODUCTIVITY_SCALE) / p_pre;
    const depreciation = MONTHS_PER_YEAR * u.dep_m;
    const shared = MONTHS_PER_YEAR * u.shared_m;
    l.revenue += revenue;
    l.variable += revenue * variableCostShare(params);
    l.fixed_cash += fixed_total - depreciation - shared;
    l.shared += shared;
    l.depreciation += depreciation;
    l.rd += revenue * rdPlanAtLoad(params.rd_norm, c.archetype, traits, free);
  }
  const cash = c.cash_usd;
  const drawn = c.finance.line.drawn;
  const book = assetBook(world, c);
  // D235: the zone's base spread at load.
  const home = companyHomeSpread(world, c, true);
  const country = world.countries[c.hq_country] as World["countries"][number];
  const start = startingRating({
    cash,
    line_drawn: drawn,
    ebitda: ledgerEbitda(l),
    revenue: l.revenue,
    industry_key: (world.industries[c.industry] as World["industries"][number]).key,
    sovereign: country.sovereign_rating,
    base_rate: world.base_rate,
    home_spread: home,
  });
  const rating = c.finance.rating;
  const line: CreditLine = {
    drawn,
    limit: lineLimit(book, cash, drawn, rating),
    excess_months_left: 0,
  };
  const charges = monthlyCharges(
    drawn,
    line.limit,
    cash,
    lineRate(world.base_rate, home, rating),
    world.base_rate,
  );
  l.line_interest = MONTHS_PER_YEAR * charges.interest;
  l.line_fee = MONTHS_PER_YEAR * charges.undrawn_fee;
  l.interest_income = MONTHS_PER_YEAR * charges.cash_interest;
  const quarter_pti = ledgerPreTaxIncome(l) / QUARTERS_PER_YEAR_F64;
  l.tax = QUARTERS_PER_YEAR_F64 * quarterTax(quarter_pti, 0.0, country.corp_tax_rate).tax;
  l.tax_paid = l.tax;
  l.asset_purchases = l.depreciation;
  return [l, start, line];
}

/**
 * The finance start state (spec 7.1, 4.4; build-plan M4.2, M4.4, M4.5): each company's run rate
 * and its implied rating (the starting rating itself is company-start.csv's, D241), its line
 * limit, the four synthetic 2019 quarters and the 2019 year, and the opening balance sheet of
 * January 2020. Call once, after the economy and the boards are set (their load month and
 * management scores feed it); it draws nothing.
 */
export function start(world: World): void {
  for (let id = 0; id < world.companies.length; id++) {
    const c = world.companies[id] as Company;
    const [annual, implied, line] = runRate(world, c);
    const status = "Active" as const;
    const opening = balanceSheet(
      {
        cash: c.cash_usd,
        asset_book: assetBook(world, c),
        line_drawn: line.drawn,
        tax: taxBookDefault(),
      },
      status,
    );
    const history = syntheticHistory(annual, opening, keyFigures(world, c));
    const year = yearStatement(SYNTHETIC_YEAR, history);
    const f = c.finance;
    f.implied = implied;
    f.line = line;
    f.opening = opening;
    f.archive = { quarters: history, years: [year] };
  }
}

// ---------------------------------------------------------------------------------------------
// The monthly jobs (spec 4.3 steps 9 to 14).

/**
 * 4.3 step 9 (finance part, after the economy's expenses): opens each company's month from the
 * flows booked since the last close (D125) and posts revenue, variable, fixed cash, R&D and shared
 * costs (5.5). Depreciation posts at step 11 with the asset decay it equals.
 */
export function openMonthJob(world: World, _ctx: JobCtx): void {
  const { companies, units } = world;
  for (const c of companies) {
    const f = c.finance;
    // mem::take: the pending flows become the month, pending starts again at 0.
    f.month = f.pending;
    f.pending = ledgerDefault();
    f.month_active = !companyStatusIsFrozen(companyFinanceStatus(f));
    if (!f.month_active) continue;
    for (const uid of c.units) {
      const u = units[uid] as World["units"][number];
      f.month.revenue += u.revenue_m;
      f.month.variable += u.variable_m;
      f.month.fixed_cash += u.fixed_m;
      f.month.rd += u.rd_m;
      f.month.shared += u.shared_m;
    }
  }
}

/**
 * 4.3 step 11 (finance part, after the economy's asset step): depreciation (this month's asset
 * decay off the book, 5.5), asset purchases, growth plan sale proceeds and their gain (5.10).
 */
export function postAssetsJob(world: World, _ctx: JobCtx): void {
  const { companies, units } = world;
  for (const c of companies) {
    const f = c.finance;
    if (!f.month_active) continue;
    for (const uid of c.units) {
      const u = units[uid] as World["units"][number];
      f.month.depreciation += u.dep_m;
      f.month.asset_purchases += u.capex_m;
      f.month.asset_sale_proceeds += u.sale_proceeds_m;
      f.month.asset_sale_gain += u.sale_gain_m;
    }
  }
}

/**
 * 4.3 step 12 (spec 5.12 "Monthly"): line interest, the undrawn fee and interest on own cash, on
 * the month's opening balances, at `base_rate + home_spread + corporate spread(rating)` with the
 * zone's effective spread of the quarter (D235).
 */
export function interestJob(world: World, _ctx: JobCtx): void {
  const charges = world.companies.map((c) => {
    const f = c.finance;
    if (!f.month_active) return null;
    const home = companyHomeSpread(world, c, false);
    return monthlyCharges(
      f.line.drawn,
      f.line.limit,
      c.cash_usd,
      lineRate(world.base_rate, home, f.rating),
      world.base_rate,
    );
  });
  world.companies.forEach((c, i) => {
    const ch = charges[i];
    if (ch !== null && ch !== undefined) {
      c.finance.month.line_interest = ch.interest;
      c.finance.month.line_fee = ch.undrawn_fee;
      c.finance.month.interest_income = ch.cash_interest;
    }
  });
}

/**
 * 4.3 step 13 (spec 5.12): cash settles with the month's flows (operating cash, purchases and
 * growth plan sales; D124), then `settleMonth`: auto-draw, the review excess, the plan's
 * auto-repay (6.5), forced sales at the industry's sale factor (5.10) and the distress count and
 * bankruptcy. A forced sale takes the same share of every unit's gross assets, book and ramping
 * tranches. A company that goes Bankrupt raises Bankruptcy in watchlist (the scheduler keeps it
 * only for watchlist companies, spec 8), leaves supply from the next step 6 (it is frozen) and is
 * wiped (equity 0, its residual on the estate line, D230).
 */
export function settleJob(world: World, ctx: JobCtx): void {
  const today = ctx.facts.date;
  for (let id = 0; id < world.companies.length; id++) {
    const c = world.companies[id] as Company;
    if (!c.finance.month_active) continue;
    const m = c.finance.month;
    const cash = c.cash_usd + ledgerOperatingCash(m) - m.asset_purchases + m.asset_sale_proceeds;
    const label = (world.industries[c.industry] as World["industries"][number]).phase_label;
    const inputs: SettleInputs = {
      cash,
      line: c.finance.line,
      min_cash: minCash(trailingRevenue(c)),
      gross_assets: grossAssets(world, c),
      asset_book: assetBook(world, c),
      sale_factor: saleFactor(label),
      state: c.finance.distress,
    };
    const s = settleMonth(inputs);
    const share = s.forced_sale.share;
    if (share > 0.0) {
      for (const uid of c.units) {
        const u = world.units[uid] as World["units"][number];
        if (share >= 1.0) {
          u.gross_assets = 0.0;
          u.asset_book = 0.0;
          u.ramping = [];
        } else {
          const keep = 1.0 - share;
          u.gross_assets *= keep;
          u.asset_book *= keep;
          for (const t of u.ramping) t.amount *= keep;
        }
      }
    }
    c.cash_usd = s.cash;
    const f = c.finance;
    f.line = s.line;
    f.distress = s.state;
    f.month.line_drawn_or_repaid += settlementLineChange(s);
    f.month.asset_sale_proceeds += s.forced_sale.proceeds;
    f.month.asset_sale_gain += s.forced_sale.gain;
    if (s.went_bankrupt) {
      f.bankrupt_on = today;
      jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: id as CompanyId });
    }
  }
}

/**
 * 4.3 step 14 (spec 5.11): tax accrues on the quarter so far (D227), then the month is posted.
 * Outside a quarter end the M4.9 check runs here; at a quarter end it runs in the close, after the
 * tax is paid (D122).
 */
export function ledgerJob(world: World, ctx: JobCtx): void {
  const closed = monthPrev(simDateMonthOf(ctx.facts.date));
  const quarter_end = tickFactsIsQuarterStart(ctx.facts);
  for (let id = 0; id < world.companies.length; id++) {
    const rate = (world.countries[(world.companies[id] as Company).hq_country] as World["countries"][number])
      .corp_tax_rate;
    const f = (world.companies[id] as Company).finance;
    if (!companyFinanceInGame(f)) continue;
    if (f.month_active) {
      const pti = ledgerPreTaxIncome(f.month);
      f.month.tax = accrueMonth(f.tax, pti, rate);
    }
    // mem::take(&mut f.month): posted takes the ledger, the month starts again at 0.
    const posted: PostedMonth = { month: closed, lines: f.month };
    f.month = ledgerDefault();
    f.months.push(posted);
    // Rust `PostedMonth` is Copy: last_month is its own copy, so the close's later tax_paid edit
    // to `months.last_mut()` does not reach it until the close writes it back.
    f.last_month = { month: posted.month, lines: { ...posted.lines } };
    if (!quarter_end) checkAndRoll(world, id as CompanyId);
  }
}

/**
 * The M4.9 check of the month just posted (spec 3.9; build-plan M4.9): the closing sheet
 * balances, and cash, book, line, tax payable and equity plus estate roll forward from the opening
 * sheet through the month's ledger. Failures are counted on the World, not raised, so a run
 * reports them (`World::books_check`). The closing sheet becomes the next opening.
 */
export function checkAndRoll(world: World, id: CompanyId): void {
  const c = world.companies[id] as Company;
  const closing = sheet(world, c);
  const posted = c.finance.last_month;
  if (posted === null) return;
  const result = checkMonth(c.finance.opening, posted.lines, closing, companyFinanceStatus(c.finance));
  const key = c.key;
  const log = world.books_check;
  log.checked += 1;
  if (!result.ok) {
    log.failures += 1;
    if (log.first_failure === null) {
      log.first_failure = `${key} ${formatMonth(posted.month)}: ${balanceErrorToString(result.error)}`;
    }
  }
  c.finance.opening = closing;
}

// ---------------------------------------------------------------------------------------------
// The quarterly and yearly jobs (spec 4.4, 4.5).

/**
 * 4.4 Close and compile, after the monthly job (spec 4.4, 5.11; D122): each company still in the
 * game pays the quarter's accrued tax from cash (frozen companies keep it payable for the removal,
 * D233), booked as the quarter's last month's tax paid; the M4.9 check runs for that month; the
 * quarter's statement is built from its three months (unpublished until the release) and archived
 * (20 quarters); a Bankrupt company counts a frozen quarter (D232).
 */
export function closeJob(world: World, ctx: JobCtx): void {
  const quarter = quarterPrev(simDateQuarter(ctx.facts.date));
  for (let id = 0; id < world.companies.length; id++) {
    const c = world.companies[id] as Company;
    if (!companyFinanceInGame(c.finance)) continue;
    if (!companyStatusIsFrozen(companyFinanceStatus(c.finance))) {
      const paid = closeQuarter(c.finance.tax).tax;
      c.cash_usd -= paid;
      const last = c.finance.months[c.finance.months.length - 1];
      if (last !== undefined) {
        last.lines.tax_paid += paid;
        c.finance.last_month = { month: last.month, lines: { ...last.lines } };
      }
    }
    checkAndRoll(world, id as CompanyId);
    const months: Ledger[] = Array.from({ length: MONTHS_PER_QUARTER }, () => ledgerDefault());
    const posted = c.finance.months;
    const n = Math.min(posted.length, MONTHS_PER_QUARTER);
    for (let k = 0; k < n; k++) {
      months[MONTHS_PER_QUARTER - n + k] = (posted[posted.length - n + k] as PostedMonth).lines;
    }
    const statement = quarterStatement(quarter, months, sheet(world, c), keyFigures(world, c));
    const f = c.finance;
    companyFinancePushQuarter(f, statement);
    f.months = [];
    f.distress = onQuarterClose(f.distress);
  }
}

/**
 * 4.4 Release, 00:00 (spec 5.12 step 3, C30): a Bankrupt company past its 2 frozen quarters is
 * removed. Its assets sell at the Bust factor to repay the line, then tax; the rest is written off
 * and any cash left leaves the game (D233). Each unit's remaining gross assets go back to its
 * industry's fringe pool, which the next step 6 supply counts; the simple characters are
 * discarded; the filings stay in the company's archive (D127).
 */
export function removalsJob(world: World, ctx: JobCtx): void {
  const today = ctx.facts.date;
  for (let id = 0; id < world.companies.length; id++) {
    const c = world.companies[id] as Company;
    if (!removalDue(c.finance.distress)) continue;
    const [state, removal] = remove(c.finance.distress, books(world, c), grossAssets(world, c));
    for (const uid of c.units) {
      const unit = world.units[uid] as World["units"][number];
      (world.industries[unit.industry] as World["industries"][number]).fringe_assets += maxF(
        unit.gross_assets,
        0.0,
      );
      unit.gross_assets = 0.0;
      unit.asset_book = 0.0;
      unit.ramping = [];
    }
    c.cash_usd = 0.0;
    c.board = new Array<null>(LABOR_SEAT_COUNT).fill(null);
    c.seats_to_fill = [];
    const f = c.finance;
    f.line = creditLineDefault();
    f.tax = taxBookDefault();
    f.distress = state;
    f.removed_on = today;
    f.removal = removal;
  }
}

/**
 * 4.4 price move, 01:00 on release days (spec 5.12, 3.6.3, 3.6.4): the implied rating from net
 * debt now (line drawn less cash) and the trailing four quarters' EBITDA, line interest and
 * revenue, then a move of 1 notch toward it, 2 when 3 or more away. Frozen companies are not
 * reviewed (D131).
 */
export function ratingReviewJob(world: World, _ctx: JobCtx): void {
  for (const c of world.companies) {
    if (companyStatusIsFrozen(companyFinanceStatus(c.finance))) continue;
    const ttm = trailingFour(companyFinanceQuarters(c.finance));
    if (ttm === null) continue;
    const implied = impliedRating({
      net_debt: c.finance.line.drawn - c.cash_usd,
      ebitda: ledgerEbitda(ttm),
      interest: ttm.line_interest,
      revenue: ttm.revenue,
      industry_key: (world.industries[c.industry] as World["industries"][number]).key,
      sovereign: (world.countries[c.hq_country] as World["countries"][number]).sovereign_rating,
    });
    const f = c.finance;
    const moved = reviewMove(f.rating, implied.implied);
    f.last_review_notches = notchesBetween(f.rating, moved);
    f.rating = moved;
    f.implied = implied;
  }
}

/**
 * 4.4 price move, after the rating review (spec 5.12 "Review", 10.0.9): the limit is recomputed at
 * the new rating; a company over it gets 3 months to repay the excess (D224).
 */
export function lineReviewJob(world: World, _ctx: JobCtx): void {
  for (const c of world.companies) {
    if (companyStatusIsFrozen(companyFinanceStatus(c.finance))) continue;
    const limit = lineLimit(assetBook(world, c), c.cash_usd, c.finance.line.drawn, c.finance.rating);
    const f = c.finance;
    f.line = reviewLine(f.line, limit);
  }
}

/**
 * 4.5 step 1 (1 January, after the Q4 close): the year's statement, the sum of its four quarters,
 * archived (5 years, D228). A company without the year's four quarters (none of the 651; born
 * companies from M6) gets none.
 */
export function annualStatementsJob(world: World, ctx: JobCtx): void {
  const year = ctx.facts.date.year - 1;
  for (const c of world.companies) {
    const f = c.finance;
    const quarters = companyFinanceQuarters(f);
    if (!companyFinanceInGame(f) || quarters.length < QUARTERS_PER_YEAR) continue;
    const last: Statement[] = quarters.slice(quarters.length - QUARTERS_PER_YEAR);
    const whole_year = last.every(
      (s, i) => s.period.kind === "Quarter" && s.period.quarter.year === year && s.period.quarter.q === i + 1,
    );
    if (whole_year) companyFinancePushYear(f, yearStatement(year, last));
  }
}

// ---------------------------------------------------------------------------------------------
// The dividend at the plan lock (spec 5.17; build-plan M4.8, M6.3).

/**
 * Pays a dividend of `amount` at the plan lock (spec 5.17): cash falls now and the dividend is
 * booked into the month it falls in, posted at the next monthly close (D125). The amount is the
 * Lite AI's (`ai/financing`, the one 5.17 calculation, on the balances after the 6.5 draw or
 * repayment); nothing is paid for an amount at or below 0. Returns what was paid.
 */
export function payDividend(world: World, id: CompanyId, amount: number): number {
  if (amount <= 0.0) return 0.0;
  const c = world.companies[id] as Company;
  c.cash_usd -= amount;
  c.finance.pending.dividends += amount;
  return amount;
}

// ---------------------------------------------------------------------------------------------
// Registration.

/**
 * Registers the finance jobs (spec 4.3 steps 9 to 14, 4.4, 4.5). Called from `registerJobs` after
 * the economy, operations and people, so in the shared slots (steps 9 and 11) finance posts what
 * the others computed. (The real order lives in ../jobs.ts; this mirrors Rust `register`.)
 */
export function register(s: Scheduler): void {
  const r = schedulerRegister;
  r(s, "MonthlyExpenses", "finance.open_month", openMonthJob);
  r(s, "MonthlyAssets", "finance.post_assets", postAssetsJob);
  r(s, "MonthlyInterest", "finance.interest", interestJob);
  r(s, "MonthlyCashSettle", "finance.settle", settleJob);
  r(s, "MonthlyLedger", "finance.ledger", ledgerJob);
  // D122: the close pays the tax and then compiles, both here; Slot::CloseTax stays empty.
  r(s, "CloseStatements", "finance.close", closeJob);
  r(s, "ReleasePublish", "finance.removals", removalsJob);
  r(s, "PriceMoveRatingReview", "finance.rating_review", ratingReviewJob);
  r(s, "PriceMoveCreditLineReview", "finance.line_review", lineReviewJob);
  r(s, "YearlyAnnualStatements", "finance.annual_statements", annualStatementsJob);
}
