// The market on the World (build-plan M5.1 to M5.8): the load's values and prices (spec 7.1), the
// hourly price step (4.1 step 2, 5.14), the 01:00 price move on release days (4.1 step 3, 4.4:
// full fair value, earnings jump, buzz), the daily jobs (4.2 steps 1, 2, 3 and 6: bars and buzz,
// the fair value refresh, the reaction week, index closes and zone confidence), the delisting at
// bankruptcy (5.12 step 2, D126), the close's result tags (4.4, 21.3.2), the plan lock's
// consensus (5.16) and the 4.5 bar archive. Ported from crates/sim/src/market/jobs.rs.
//
// The formulas are lane F's pure functions in this module's siblings; each job reads the World,
// calls them in company id order and writes the results back (the pure step contract, `world`
// docs). The hourly step is the hot path (about 470 stocks on every tick, 262,800 ticks in a
// 30-year run): it allocates nothing and draws exactly as `stepPrices` does (D135).

import { companyIsFrozen } from "../economy/index.ts";
import { companyHomeSpread, runRate, sheet } from "../finance/jobs.ts";
import { companyFinanceQuarters } from "../finance/state.ts";
import { ledgerEbit, ledgerNetIncome, trailingFour } from "../finance/statements.ts";
import { scheduler } from "../jobs.ts";
import { headlineConfidence } from "../news.ts";
import { BAREBONES_REVENUE_USD } from "../ops/stations.ts";
import { confidenceFactor } from "../people/management.ts";
import { NoNoise } from "../rng.ts";
import {
  dateTimeDate,
  dateTimeMidnight,
  monthFirstDay,
  monthNext,
  quarterFirstDay,
  quarterNext,
  simDateMonthOf,
  simDateQuarter,
  simDateYmd,
} from "../time/calendar.ts";
import {
  type JobCtx,
  jobCtxDetached,
  type Scheduler,
  type Slot,
  schedulerRegister,
  schedulerRunSlots,
  tickFactsNew,
} from "../time/scheduler.ts";
import { cmpDate, type DateTime, EPOCH_YEAR, type SimDate } from "../types/calendar.ts";

import type { DrawSource } from "../types/draws.ts";
import type { CompanyId, ZoneId } from "../types/ids.ts";
import { ordinal } from "../types/ids.ts";
import type { Notice } from "../types/notice.ts";
import { assertCount, maxF } from "../types/num.ts";
import type { FairValueBasis, Stock } from "../types/state/market.ts";
import type { Headline } from "../types/state/news.ts";
import type { Company, World } from "../types/world.ts";
import { chunkLogNew } from "../world/log.ts";
import { type ConfidenceHeadline, newsPoints, updateConfidence } from "./confidence.ts";
import {
  barBuilderClose,
  barBuilderStart,
  barBuilderTick,
  decayBuzz,
  isReversionDay,
  revertTowardValue,
} from "./daily.ts";
import { jumpedBuzz, jumpedPrice, resultTags, surprise } from "./earnings.ts";
import {
  type EngineValueInputs,
  engineValueAtLoad,
  LOAD_REVENUE_GROWTH,
  loadNetIncome,
} from "./engine_value.ts";
import {
  exchangeIndexAtLoad,
  exchangeIndexCloseDay,
  exchangeIndexLevel,
  exchangeIndexReweight,
  indexHistoryDropBefore,
  indexHistoryNew,
  indexHistoryRecord,
  marketCap,
} from "./exchange_index.ts";
import {
  bookFloorShare,
  type FairValueInputs,
  fairValue,
  fairValueBasisAtRelease,
  perShare,
  revenueGrowth,
} from "./fair_value.ts";
import {
  fatTailedNormal,
  noise,
  pricesMove,
  reactionVolatilityMult,
  rho,
  SECTOR_BETA,
  SECTOR_VOLATILITY,
  sigmaHourly,
  stepPrice,
  targetValue,
} from "./price.ts";
import { consensus } from "./projection.ts";
import { barHistoryDropBefore, barHistoryPush, stockCap } from "./state.ts";

/** Spec 3.14.2: the estimated fair value error is uniform within ±15% for a listed company (T). */
export const EFV_ERROR_WIDTH = 0.15;
/** Spec 4.5 step 2: 10 years of daily bars are kept (T). */
export const BAR_YEARS_KEPT = 10;

// ---------------------------------------------------------------------------------------------
// Reading the World.

/**
 * The 5.13 inputs of company `id` today on `basis` (D243): book equity from the balance sheet
 * (3.9), M_sector, the HQ home spread on the zone's effective spread (5.1.2, 5.12), the
 * industry's phase label (5.1), the company's own confidence factor (5.7), its listing
 * exchange's confidence (5.1.2; null while private) and the industry's book floor.
 */
export function fairValueInputs(world: World, id: CompanyId, basis: FairValueBasis): FairValueInputs {
  const c = world.companies[id] as Company;
  const ind = world.industries[c.industry] as World["industries"][number];
  const exchange = (world.market.stocks[id] as Stock).exchange;
  return {
    basis,
    book_equity: sheet(world, c).equity,
    sector_multiple: ind.params.earnings_multiple,
    home_spread: companyHomeSpread(world, c, false),
    label: ind.phase_label,
    company_confidence: confidenceFactor(c.management_score),
    listing_confidence:
      exchange === null ? null : (world.zones[exchange] as World["zones"][number]).confidence,
    book_floor_share: bookFloorShare(ind.key),
    shares_out: c.shares_out,
  };
}

/**
 * The full recalculation's basis (spec 5.13 steps 1 and 2, 4.4 price move): TTM net income over
 * the archived quarters (annualized for fewer than four, null with none; D228, D253), g from the
 * archive's quarterly revenues (D254) and the industry's lt as g_sector (D1).
 */
export function releaseBasis(world: World, id: CompanyId): FairValueBasis {
  const c = world.companies[id] as Company;
  const quarters = companyFinanceQuarters(c.finance);
  const revenues = quarters.map((q) => q.lines.revenue);
  const ttm = trailingFour(quarters);
  return fairValueBasisAtRelease(
    ttm === null ? null : ledgerNetIncome(ttm),
    revenueGrowth(revenues),
    (world.industries[c.industry] as World["industries"][number]).lt,
  );
}

/** Each exchange's quoted market cap, in zone id order (spec 5.14). */
export function exchangeCaps(world: World): number[] {
  const caps = new Array<number>(world.zones.length).fill(0.0);
  for (const s of world.market.stocks) {
    if (s.exchange !== null) caps[s.exchange] = (caps[s.exchange] as number) + stockCap(s);
  }
  return caps;
}

/** The quoted cap of one exchange (spec 5.14). */
export function exchangeCap(world: World, zone: ZoneId): number {
  let sum = 0.0;
  for (const s of world.market.stocks) if (s.exchange === zone) sum += stockCap(s);
  return sum;
}

/** The headline index level of an exchange now (spec 5.14): null with no quoted company. */
export function indexLevel(world: World, zone: ZoneId): number | null {
  return exchangeIndexLevel(
    world.market.indices[zone] as World["market"]["indices"][number],
    exchangeCap(world, zone),
  );
}

/**
 * The Pdoomberg Wire headlines posted today (4.2 step 5) on companies listed on `zone`'s exchange
 * (spec 5.1.2 news_z, 5.18; D137, D158): a company whose stock row names the exchange, so a
 * bankruptcy delisted at step 13 still counts on its exchange; `confidenceNews` reads their
 * points.
 */
export function confidenceHeadlines(world: World, zone: ZoneId): Headline[] {
  return world.news.today.filter(
    (h) => h.company !== null && (world.market.stocks[h.company] as Stock).exchange === zone,
  );
}

/**
 * news_z of one exchange (spec 5.1.2): the points of the day's headlines on its companies that
 * carry any (beats and misses, bankruptcies, 2+ notch rating changes).
 */
export function confidenceNews(headlines: readonly Headline[]): number {
  const points: ConfidenceHeadline[] = [];
  for (const h of headlines) {
    const c = headlineConfidence(h);
    if (c !== null) points.push(c);
  }
  return newsPoints(points);
}

// ---------------------------------------------------------------------------------------------
// Load (spec 7.1).

/**
 * The market start state (spec 7.1 Shares row, 5.14; build-plan M5.2): each company's engine
 * value at load is its fair value, on the load basis (run-rate net income before line interest at
 * g 0 against the industry's lt, D244); V is that ÷ shares_out; P stays company-start.csv's
 * open_price (set in the load, so P = V up to the share rounding); buzz 0; the consensus for the
 * 2 January 2020 release is the synthetic Q4 2019 net income, so its surprise is 0 (D133); every
 * exchange's index is 1,000 at its listed cap. Call after `finance.start`. Its only draws are
 * each quoted stock's estimated fair value error for the first quarter, one prices-stream
 * uniform each in company id order, so EFV is never true V (spec 8; D150).
 */
export function start(world: World, draws: DrawSource): void {
  for (let id = 0; id < world.companies.length; id++) {
    const cid = ordinal<CompanyId>(id);
    const c = world.companies[id] as Company;
    const ind = world.industries[c.industry] as World["industries"][number];
    const country = world.countries[c.hq_country] as World["countries"][number];
    // 7.1 values the run rate at companies.csv revenue R: a company below $0.1M (the barebones
    // loadout, D107) has R 0 and so EBIT 0, and values at its book (D244, D145).
    const ebit = c.revenue_usd < BAREBONES_REVENUE_USD ? 0.0 : ledgerEbit(runRate(world, c)[0]);
    const exchange = (world.market.stocks[id] as Stock).exchange;
    const ni = loadNetIncome(ebit, country.corp_tax_rate);
    const inputs: EngineValueInputs = {
      book_equity: sheet(world, c).equity,
      run_rate_ebit: ebit,
      tax_rate: country.corp_tax_rate,
      sector_multiple: ind.params.earnings_multiple,
      g_sector: ind.lt,
      // D235: the zone's base spread at load.
      home_spread: companyHomeSpread(world, c, true),
      listing_confidence:
        exchange === null ? null : (world.zones[exchange] as World["zones"][number]).confidence_start,
      book_floor_share: bookFloorShare(ind.key),
    };
    const value = engineValueAtLoad(inputs);
    const basis = fairValueBasisAtRelease(ni, LOAD_REVENUE_GROWTH, ind.lt);
    const quarters = companyFinanceQuarters(c.finance);
    const lastQ = quarters.length === 0 ? null : (quarters[quarters.length - 1] as (typeof quarters)[number]);
    const q4Ni = lastQ === null ? 0.0 : ledgerNetIncome(lastQ.lines);
    const q4Revenue = lastQ === null ? 0.0 : lastQ.lines.revenue;
    const earlier = quarters.slice(0, Math.max(quarters.length - 1, 0)).map((q) => q.lines.revenue);
    const shares = c.shares_out;
    const s = world.market.stocks[cid] as Stock;
    s.fair_value = value;
    s.value = perShare(value, shares);
    s.basis = basis;
    s.consensus_ni = q4Ni;
    const surpriseQ4 = surprise(q4Ni, q4Ni);
    s.pending_surprise = surpriseQ4;
    s.last_surprise = surpriseQ4;
    s.tags = resultTags(surpriseQ4, q4Ni, q4Revenue, earlier);
  }
  const caps = exchangeCaps(world);
  world.market.indices = world.zones.map((_, z) => exchangeIndexAtLoad(caps[z] as number));
  // The index history starts with the load level on 1 January 2020 (D540).
  const startDate = simDateYmd(EPOCH_YEAR, 1, 1);
  world.market.index_history = world.market.indices.map((i) => {
    const h = indexHistoryNew();
    if (i.prev_close !== null) indexHistoryRecord(h, startDate, i.prev_close);
    return h;
  });
  for (const s of world.market.stocks) {
    if (s.quoted) s.efv_error = drawEfvError(draws);
  }
}

/**
 * The estimated fair value error e of a quoted stock (spec 3.14.2; D140): uniform within ±15%,
 * one prices-stream uniform.
 */
export function drawEfvError(draws: DrawSource): number {
  return EFV_ERROR_WIDTH * (2.0 * draws.uniform("Prices") - 1.0);
}

// ---------------------------------------------------------------------------------------------
// Hourly (spec 4.1 steps 2 and 3).

/**
 * 4.1 step 2 (spec 5.14): every quoted stock steps toward V* in company id order, with one
 * z_market for all 26 exchanges drawn first, then each stock's z_stock (D246). Closed all of
 * 1 January and frozen on the 00:00 release tick (the slot is not due then; checked again here).
 * Each new price goes into the day's bar. Bankrupt companies are delisted (D126) and not stepped,
 * so `stepPrice`'s $0.01 floor never lifts their $0.00.
 */
export function pricesJob(world: World, ctx: JobCtx): void {
  const t = ctx.facts.now;
  if (!pricesMove(t)) return;
  const mult = reactionVolatilityMult(t);
  const sigmaH = sigmaHourly(SECTOR_VOLATILITY);
  const rhoV = rho(SECTOR_BETA);
  const draws = ctx.draws;
  const zMarket = fatTailedNormal(draws);
  const stocks = world.market.stocks;
  for (let i = 0; i < stocks.length; i++) {
    const s = stocks[i] as Stock;
    if (!s.quoted) continue;
    const zStock = fatTailedNormal(draws);
    const n = noise(sigmaH, rhoV, mult, zMarket, zStock);
    s.price = stepPrice(s.price, targetValue(s.value, s.buzz), n);
    barBuilderTick(s.bar, s.price);
  }
}

/**
 * 4.4 price move step 1, 01:00 on release days (spec 5.13, 4.2 step 2 "full recalculation only at
 * the release"): a new basis from the statements just published, then the fair value on it with
 * today's inputs, for every company not frozen (D243).
 */
export function fullFairValueJob(world: World, _ctx: JobCtx): void {
  for (let i = 0; i < world.companies.length; i++) {
    if (companyIsFrozen(world.companies[i] as Company)) continue;
    const id = ordinal<CompanyId>(i);
    const basis = releaseBasis(world, id);
    const fv = fairValue(fairValueInputs(world, id, basis));
    const shares = (world.companies[i] as Company).shares_out;
    const s = world.market.stocks[i] as Stock;
    s.basis = basis;
    s.fair_value = fv;
    s.value = perShare(fv, shares);
  }
}

/**
 * 4.4 price move step 2 (spec 5.15): `P ×= 1 + 1.5 × clamp(0.5 × s, ±25%)` for every quoted
 * stock with a surprise from the close (D142). The jumped price goes into the day's bar.
 */
export function earningsJumpJob(world: World, _ctx: JobCtx): void {
  for (const s of world.market.stocks) {
    if (s.quoted && s.pending_surprise !== null) {
      s.price = jumpedPrice(s.price, s.pending_surprise);
      barBuilderTick(s.bar, s.price);
    }
  }
}

/**
 * 4.4 price move step 3 (spec 5.15, 3.10): `buzz += clamp(20 × s, ±30)` for every quoted stock,
 * spending the surprise; then each quoted stock draws its estimated fair value error for the
 * quarter, uniform within ±15%, in company id order (spec 3.14.2; D140).
 */
export function buzzJob(world: World, ctx: JobCtx): void {
  for (const s of world.market.stocks) {
    // Rust `pending_surprise.take()`: spent for every stock, quoted or not.
    const sp = s.pending_surprise;
    s.pending_surprise = null;
    if (sp !== null && s.quoted) s.buzz = jumpedBuzz(s.buzz, sp);
  }
  for (const s of world.market.stocks) {
    if (s.quoted) s.efv_error = drawEfvError(ctx.draws);
  }
}

// ---------------------------------------------------------------------------------------------
// Daily (spec 4.2 steps 1, 2, 3 and 6).

/**
 * 4.2 step 1: each quoted stock's bar closes (none for a day with no trading tick, D248) with the
 * day's EFV (D424; a read of the stored value and error, no draw), and every buzz decays 25%.
 */
export function barsJob(world: World, _ctx: JobCtx): void {
  for (const s of world.market.stocks) {
    if (s.quoted) {
      const bar = barBuilderClose(s.bar, s.value * (1.0 + s.efv_error));
      if (bar !== null) barHistoryPush(s.bars, bar);
    }
    s.buzz = decayBuzz(s.buzz);
  }
}

/**
 * 4.2 step 2 (spec 5.13): every company not frozen reruns fair value on its stored basis with
 * today's book equity, label, confidence factor, home spread and exchange confidence (D243).
 */
export function fairValueJob(world: World, _ctx: JobCtx): void {
  for (let i = 0; i < world.companies.length; i++) {
    if (companyIsFrozen(world.companies[i] as Company)) continue;
    const id = ordinal<CompanyId>(i);
    const basis = (world.market.stocks[i] as Stock).basis;
    const fv = fairValue(fairValueInputs(world, id, basis));
    const shares = (world.companies[i] as Company).shares_out;
    const s = world.market.stocks[i] as Stock;
    s.fair_value = fv;
    s.value = perShare(fv, shares);
  }
}

/**
 * 4.2 step 3 (spec 21.3.1): on the 3rd to the 8th of a release month each quoted stock closes 20%
 * of the gap between P and V.
 */
export function reactionWeekJob(world: World, ctx: JobCtx): void {
  if (!isReversionDay(ctx.facts.date)) return;
  for (const s of world.market.stocks) {
    if (s.quoted) s.price = revertTowardValue(s.price, s.value);
  }
}

/**
 * 4.2 step 6 (spec 5.1.2): each exchange in zone id order closes its index for the day (the
 * return in %, 0 with no quoted company) and its confidence moves by `0.9 × c + 3 × r + news`,
 * news from `confidenceHeadlines` (none until M6.5, D137); share counts changed since the last
 * close are synced first, keeping each level (D147). Then the day's bars open at the price the
 * daily jobs leave and the day's change resets (D136).
 */
export function zoneConfidenceJob(world: World, ctx: JobCtx): void {
  for (let i = 0; i < world.companies.length; i++) syncShares(world, ordinal<CompanyId>(i));
  const caps = exchangeCaps(world);
  for (let z = 0; z < world.zones.length; z++) {
    const zid = ordinal<ZoneId>(z);
    const index = world.market.indices[z] as World["market"]["indices"][number];
    const r = exchangeIndexCloseDay(index, caps[z] as number);
    // The day's close joins the index history (D540), a record only: nothing reads it back.
    if (index.prev_close !== null) {
      indexHistoryRecord(
        world.market.index_history[z] as World["market"]["index_history"][number],
        ctx.facts.date,
        index.prev_close,
      );
    }
    const news = confidenceNews(confidenceHeadlines(world, zid));
    const zone = world.zones[z] as World["zones"][number];
    zone.confidence = updateConfidence(zone.confidence, r, news);
  }
  const today = ctx.facts.date;
  for (const s of world.market.stocks) {
    s.bar = barBuilderStart(today, s.price);
    s.prev_close = s.price;
  }
}

// ---------------------------------------------------------------------------------------------
// Monthly, quarterly and yearly.

/**
 * 4.3 step 13, after the finance settle (spec 5.12 step 2, D126): a company that went Bankrupt is
 * delisted. Its exchange's divisor is rescaled at the same prices so the index does not move
 * (D250), then its price is $0.00, its fair value 0 and its open bar dropped (D134, D138).
 * Private companies that go Bankrupt lose their value the same way.
 */
export function delistJob(world: World, ctx: JobCtx): void {
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as Company;
    const s0 = world.market.stocks[i] as Stock;
    if (!companyIsFrozen(c) || (s0.fair_value === 0.0 && !s0.quoted)) continue;
    if (s0.quoted && s0.exchange !== null) {
      const z = s0.exchange;
      const before = exchangeCap(world, z);
      const after = before - stockCap(s0);
      exchangeIndexReweight(
        world.market.indices[z] as World["market"]["indices"][number],
        before,
        maxF(after, 0.0),
      );
    }
    const s = world.market.stocks[i] as Stock;
    s.quoted = false;
    s.price = 0.0;
    // The day's change reads 0, not −P, from the delisting on (D149).
    s.prev_close = 0.0;
    s.fair_value = 0.0;
    s.value = 0.0;
    s.buzz = 0.0;
    s.pending_surprise = null;
    s.bar = barBuilderStart(ctx.facts.date, 0.0);
  }
}

/**
 * 4.4 Close and compile, step 3 (spec 4.4 "tag result types", 5.15, 21.3.2): each company not
 * frozen compares the quarter just archived with its consensus (D142): the surprise s waits for
 * the 01:00 price move; the tags are kept for the headlines.
 */
export function resultTagsJob(world: World, _ctx: JobCtx): void {
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as Company;
    if (companyIsFrozen(c)) continue;
    const quarters = companyFinanceQuarters(c.finance);
    if (quarters.length === 0) continue;
    const last = quarters[quarters.length - 1] as (typeof quarters)[number];
    const ni = ledgerNetIncome(last.lines);
    const revenue = last.lines.revenue;
    const earlier = quarters.slice(0, quarters.length - 1).map((q) => q.lines.revenue);
    const s = world.market.stocks[i] as Stock;
    const sp = surprise(ni, s.consensus_ni);
    s.pending_surprise = sp;
    s.last_surprise = sp;
    s.tags = resultTags(sp, ni, revenue, earlier);
  }
}

/**
 * The 4.3 slots a projection re-runs for one month close (steps 2 to 14; step 1's quarterly draws
 * are "new rolls" and are skipped, D141).
 */
export const PROJECTION_SLOTS: readonly Slot[] = [
  "MonthlyDemand",
  "MonthlyFringe",
  "MonthlyLaborSeats",
  "MonthlyCompute",
  "MonthlySupply",
  "MonthlyRevenue",
  "MonthlyData",
  "MonthlyExpenses",
  "MonthlyProductivity",
  "MonthlyAssets",
  "MonthlyInterest",
  "MonthlyCashSettle",
  "MonthlyLedger",
];

/**
 * What a projection holds at its plan-lock value (spec 5.16; design fix 109, D168): each
 * industry's supply, S and M, and each unit's productivity. Surprises then come "from supply and
 * M moving as other companies grow, and from productivity" (5.16), not from the projection.
 */
export interface HeldAtLock {
  /** Per industry, in id order: supply, S and M (spec 5.2). */
  market: [number, number, number][];
  /** Per unit, in id order: productivity (spec 5.6). */
  productivity: number[];
}

/**
 * The values in `world` now: at the plan lock, the S and M of the last month close (4.3 step 6)
 * and the productivity its step 10 left. Rust `HeldAtLock::of`.
 */
export function heldAtLockOf(world: World): HeldAtLock {
  return {
    market: world.industries.map((i) => [i.supply, i.supply_ratio, i.market_factor]),
    productivity: world.units.map((u) => u.productivity),
  };
}

/** Puts every industry's supply, S and M back to the held values (after 4.3 step 6). */
export function heldAtLockRestoreMarket(held: HeldAtLock, world: World): void {
  if (world.industries.length !== held.market.length) throw new Error("held industries differ");
  world.industries.forEach((ind, i) => {
    const [supply, s, m] = held.market[i] as [number, number, number];
    ind.supply = supply;
    ind.supply_ratio = s;
    ind.market_factor = m;
  });
}

/** Puts every unit's productivity back to the held value (after 4.3 step 10). */
export function heldAtLockRestoreProductivity(held: HeldAtLock, world: World): void {
  if (world.units.length !== held.productivity.length) throw new Error("held units differ");
  world.units.forEach((u, i) => {
    u.productivity = held.productivity[i] as number;
  });
}

/**
 * A copy of `world` for a projection to run on. The projection reads none of the bar and index
 * histories, the news feed or the recaps (it runs month closes, not daily jobs), so those are
 * left out of the copy: cloning ten years of daily bars for every stock four times a year would
 * dominate a 30-year run. (The Rust clone shares them behind `Arc`s.)
 */
function projectionClone(world: World): World {
  const stocks = world.market.stocks.map((s) => ({ ...s, bars: { log: chunkLogNew<never>() } }));
  // The statement archives (most of a company's size after ten years) are shared, not copied, as
  // Rust shares them behind an `Arc`: an archive is copy on write (finance/state.ts, D130), so a
  // month close in the projection that archives a statement makes a fresh archive in the copy
  // and never touches the world's.
  const archives = world.companies.map((c) => c.finance.archive);
  const companies = world.companies.map((c) => ({ ...c, finance: { ...c.finance, archive: EMPTY_ARCHIVE } }));
  const lite = {
    ...world,
    companies,
    market: {
      ...world.market,
      stocks,
      index_history: world.market.index_history.map(() => indexHistoryNew()),
    },
    news: { ...world.news, feed: chunkLogNew<never>() },
    recaps: [],
  } as World;
  const clone = structuredClone(lite);
  clone.companies.forEach((c, i) => {
    c.finance.archive = archives[i] as (typeof archives)[number];
  });
  return clone;
}

/** The archive left in a company's place while the projection copy is made (never read). */
const EMPTY_ARCHIVE: World["companies"][number]["finance"]["archive"] = { quarters: [], years: [] };

/**
 * The engine's projection of each company's net income for the calendar quarter `lock` falls in
 * (spec 5.16 "from the locked plan with current demand, no new rolls"; D141, D168): a clone of
 * the world runs the quarter's remaining month closes (4.3 steps 2 to 14) with NoNoise draws, the
 * close on the next quarter's first day reading this quarter's growth as its own (the quarterly
 * draw is skipped). Every industry's supply, S and M and every unit's productivity are held at
 * their lock values (`HeldAtLock`, put back after steps 6 and 10), so each company's projection
 * runs only its own locked plan (growth, R&D, stations, financing) at the lock's prices and
 * productivity: other companies' growth and the productivity drift are left to the actual
 * quarter (design fix 109). The result is the sum of the months the clone posts, in company id
 * order; 0 for a company frozen in the clone.
 */
export function projectQuarterNetIncome(world: World, lock: DateTime): number[] {
  const held = heldAtLockOf(world);
  const clone = projectionClone(world);
  const sched: Scheduler = scheduler();
  const quarter = simDateQuarter(dateTimeDate(lock));
  const end = quarterFirstDay(quarterNext(quarter));
  const postedBefore = clone.companies.map((c) => c.finance.months.length);
  let close: SimDate = monthFirstDay(monthNext(simDateMonthOf(dateTimeDate(lock))));
  const notices: Notice[] = [];
  while (cmpDate(close, end) <= 0) {
    if (cmpDate(close, end) === 0) {
      for (const ind of clone.industries) {
        ind.prev_q_growth = ind.q_growth;
        ind.prev_lt = ind.lt;
      }
    }
    const now = dateTimeMidnight(close);
    clone.clock = now;
    const ctx = jobCtxDetachedLocal(now, notices);
    for (const slot of PROJECTION_SLOTS) {
      schedulerRunSlots(sched, [slot], clone, ctx);
      if (slot === "MonthlySupply") heldAtLockRestoreMarket(held, clone);
      else if (slot === "MonthlyProductivity") heldAtLockRestoreProductivity(held, clone);
    }
    notices.length = 0;
    close = monthFirstDay(monthNext(simDateMonthOf(close)));
  }
  return clone.companies.map((c, i) => {
    const months = c.finance.months;
    let sum = 0.0;
    for (let m = Math.min(postedBefore[i] as number, months.length); m < months.length; m++) {
      sum += ledgerNetIncome((months[m] as (typeof months)[number]).lines);
    }
    return sum;
  });
}

function jobCtxDetachedLocal(now: DateTime, notices: Notice[]): JobCtx {
  return jobCtxDetached(tickFactsNew(now), NoNoise, notices);
}

/**
 * 4.4 plan lock step 5 (spec 5.16): every company not frozen gets its consensus for the quarter,
 * `projection × (1 + e)` with e from one prices-stream uniform, in company id order (D252, D141).
 */
export function consensusJob(world: World, ctx: JobCtx): void {
  const projection = projectQuarterNetIncome(world, ctx.facts.now);
  for (let i = 0; i < world.companies.length; i++) {
    if (companyIsFrozen(world.companies[i] as Company)) continue;
    const s = world.market.stocks[i] as Stock;
    s.projection_ni = projection[i] as number;
    s.consensus_ni = consensus(s.projection_ni, ctx.draws);
  }
}

/**
 * 4.5 step 2 (spec 3.10, 4.5): each company keeps 10 years of daily bars, and each exchange as
 * many index closes (D540).
 */
export function archiveBarsJob(world: World, ctx: JobCtx): void {
  const d = ctx.facts.date;
  const firstKept = simDateYmd(d.year - BAR_YEARS_KEPT, d.month, d.day);
  for (const s of world.market.stocks) barHistoryDropBefore(s.bars, firstKept);
  for (const h of world.market.index_history) indexHistoryDropBefore(h, firstKept);
}

// ---------------------------------------------------------------------------------------------
// Constituent changes (spec 5.20 listing, 6.6 share issue), for M6.

/**
 * Lists a private company on its HQ zone's exchange at `price` on `date` (spec 5.20, 5.14): it
 * joins the index with the divisor rescaled at the same prices, so the level does not move
 * (D250). Its bar opens at the listing price. Returns false if it was already listed or is
 * frozen.
 */
export function listCompany(world: World, id: CompanyId, price: number, date: SimDate): boolean {
  const c = world.companies[id] as Company;
  if (companyIsFrozen(c) || (world.market.stocks[id] as Stock).exchange !== null) return false;
  const zone = (world.countries[c.hq_country] as World["countries"][number]).zone;
  const shares = c.shares_out;
  const before = exchangeCap(world, zone);
  const after = before + marketCap(price, shares);
  exchangeIndexReweight(world.market.indices[zone] as World["market"]["indices"][number], before, after);
  c.public = true;
  const s = world.market.stocks[id] as Stock;
  s.shares = shares;
  s.exchange = zone;
  s.quoted = true;
  s.listed_on = date;
  s.ipo_price = price;
  s.price = price;
  s.prev_close = price;
  s.bar = barBuilderStart(date, price);
  return true;
}

/**
 * Changes a company's shares outstanding (spec 6.6 share issue, 3.10 "rises with share issues"),
 * keeping its exchange's index level: the divisor is rescaled by cap after ÷ cap before at the
 * same prices (D250), and V follows the new count.
 */
export function setSharesOut(world: World, id: CompanyId, sharesOut: number): void {
  (world.companies[id] as Company).shares_out = assertCount(sharesOut, "shares_out");
  syncShares(world, id);
  const s = world.market.stocks[id] as Stock;
  s.value = perShare(s.fair_value, sharesOut);
}

/**
 * Brings the index's share count of company `id` to its shares_out (D147), rescaling its
 * exchange's divisor by cap after ÷ cap before at the same price (D250), so the level does not
 * move.
 */
function syncShares(world: World, id: CompanyId): void {
  const sharesOut = (world.companies[id] as Company).shares_out;
  const s = world.market.stocks[id] as Stock;
  if (s.shares === sharesOut) return;
  if (s.quoted && s.exchange !== null) {
    const z = s.exchange;
    const before = exchangeCap(world, z);
    const after = before - stockCap(s) + marketCap(s.price, sharesOut);
    exchangeIndexReweight(world.market.indices[z] as World["market"]["indices"][number], before, after);
  }
  s.shares = sharesOut;
}

// ---------------------------------------------------------------------------------------------
// Registration.

/**
 * Registers the market jobs (spec 4.1 steps 2 and 3, 4.2 steps 1 to 3 and 6, 4.3 step 13, the
 * 4.4 close, price move and lock, 4.5 step 2). jobs.ts registers each line in its Rust order, so
 * the delisting at step 13 follows the settle that made the bankruptcy; this function is for
 * callers that want the market alone.
 */
export function register(s: Scheduler): void {
  const r = schedulerRegister;
  r(s, "SharePrices", "market.prices", pricesJob);
  r(s, "PriceMoveFairValue", "market.full_fair_value", fullFairValueJob);
  r(s, "PriceMoveEarningsJump", "market.earnings_jump", earningsJumpJob);
  r(s, "PriceMoveBuzz", "market.buzz", buzzJob);
  r(s, "DailyPriceBars", "market.bars", barsJob);
  r(s, "DailyFairValue", "market.fair_value", fairValueJob);
  r(s, "DailyReactionWeek", "market.reaction_week", reactionWeekJob);
  r(s, "DailyZoneConfidence", "market.zone_confidence", zoneConfidenceJob);
  r(s, "MonthlyCashSettle", "market.delist", delistJob);
  r(s, "CloseResultTags", "market.result_tags", resultTagsJob);
  r(s, "LockConsensus", "market.consensus", consensusJob);
  r(s, "YearlyArchive", "market.archive_bars", archiveBarsJob);
}
