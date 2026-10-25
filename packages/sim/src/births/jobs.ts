// Births and listings on the World (build-plan M6.6 to M6.9): the load's births draws (the tipped
// lab, the starting private companies' first IPO votes), and the first three steps of the 4.4
// plan lock: fixed startup events due (5.19.2), random startup events (5.19.1), then IPO board
// votes and listings (5.20.1). Each startup is carved from its industry's fringe and joins every
// table: its unit, its company with its books, its stock row (private, valued), its founders in
// the character table and its cast on the board (5.19.3, 5.19.4). Ported from
// crates/sim/src/births/jobs.rs.
//
// The formulas are lane F's pure functions in this module's siblings; each job reads the World,
// calls them in id order and writes the results back (the pure step contract, `world` docs).
// Every draw is a gen-stream draw (5.19, 5.20.1), except a listing's estimated fair value error
// (prices stream, D140, D150).

import { quarterIndex } from "../economy/ai_boom.ts";
import { balanceSheet } from "../finance/balance.ts";
import { homeSpread, lineLimit } from "../finance/credit.ts";
import {
  companyFinanceAtLoad,
  companyFinanceInGame,
  companyFinanceQuarters,
  companyFinanceStatus,
} from "../finance/state.ts";
import { ledgerNetIncome, trailingFour } from "../finance/statements.ts";
import { taxBookDefault } from "../finance/tax.ts";
import { barBuilderStart } from "../market/daily.ts";
import {
  bookFloorShare,
  fairValue,
  fairValueBasisAtRelease,
  perShare,
  revenueGrowth,
} from "../market/fair_value.ts";
import { drawEfvError, fairValueInputs, listCompany as marketListCompany } from "../market/jobs.ts";
import { stockAtLoad } from "../market/state.ts";
import {
  chatbotRush,
  drawTippedLab,
  fixedEvent as fixedEventHeadline,
  type Headline,
  headlineOfEvent,
  hotCluster,
  ipoVote,
  listing as listingHeadline,
  newsWireQueue,
  startupLaunch,
  tippedLabCandidates,
} from "../news.ts";
import { computeBill } from "../ops/compute.ts";
import { dataBookDefault } from "../ops/data.ts";
import { productiveCompute, START_PRODUCTIVITY } from "../ops/stations.ts";
import { characterKey, GENERATED_TIER } from "../people/full.ts";
import { managementScore } from "../people/management.ts";
import { nameBooksGet } from "../people/names.ts";
import { boardOf } from "../people/seating.ts";
import { quarterNext, simDateQuarter } from "../time/calendar.ts";
import { type JobCtx, jobCtxNotice, type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import type { Quarter, SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CharacterId, CompanyId, IndustryId, ProvinceId, StartupEventId, UnitId } from "../types/ids.ts";
import { saturatingSubCount } from "../types/num.ts";
import type { BallotVoter, EventKind, Region, VoteResult, VoterRole } from "../types/state/births.ts";
import type { Seat, Trait } from "../types/state/people.ts";
import { LABOR_SEAT_COUNT, SEAT_LABOR } from "../types/state/people.ts";
import type { Company, Director, Holding, SeatHolder, SimpleSeat, World } from "../types/world.ts";
import { companySeat } from "../world/entities.ts";
import type { CastSeat } from "./cast.ts";
import { seatCast } from "./cast.ts";
import { drawFixedEvent, dueEvents, type FixedEvent } from "./fixed.ts";
import {
  applyCap,
  drawFirstVote,
  holdVote,
  listCompany,
  listingResplitHolding,
  MIN_QUARTERS_SINCE_BIRTH,
  nextVoteAfter,
  passesIpoTests,
  voters,
} from "./ipo.ts";
import { companyNamesDraw, ticker } from "./names.ts";
import { drawRandomEvents, type EventDraft, type StartupDraft } from "./random.ts";
import { buildStartup, capTable, fringeRevenue, sizedRevenue } from "./startup.ts";
import { birthsHomeOthers, birthsInRegions, sitesKeyCityLists, sitesPlace } from "./state.ts";
import { hqWeight, industryWeight } from "./weights.ts";

type Industry = World["industries"][number];
type Stock = World["market"]["stocks"][number];

/**
 * companies.csv id prefix: a born company takes the next CO- id (spec 5.19.3; D4 ordinals
 * append).
 */
export const COMPANY_KEY_PREFIX = "CO-";
/** industries.csv id of AI labs: the tipped lab's candidates and F4's headline (5.1.1, 5.18). */
export const AI_LABS_KEY = "ai_labs";
/** startup-events.csv id of the boom event, whose headline names the tipped lab (5.18 F4). */
export const CHATBOT_EVENT_ID = "F4";
/** Spec 5.20: a born company may be put to a vote 8 quarters after its birth. */
export const IPO_QUARTERS_AFTER_BIRTH = MIN_QUARTERS_SINCE_BIRTH;

/** The key of the `n`th company, 1-based (CO-0001 to CO-0651 load; born companies append). */
export function companyKey(n: number): string {
  return `${COMPANY_KEY_PREFIX}${String(n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------------------------
// Load (spec 5.1.1, 5.20.1 step 1).

/**
 * The tipped lab (spec 5.1.1, 7-starting-world 7.6; D111, D281): one uniform gen draw among the
 * five largest AI labs by starting revenue. Called at load right after the economy's draws, so on
 * the gen stream it follows the pop roll and comes before the boards.
 */
export function drawTippedLabAtLoad(world: World, draws: DrawSource): void {
  const labs: [CompanyId, number][] = [];
  world.companies.forEach((c, id) => {
    if ((world.industries[c.industry] as Industry).key === AI_LABS_KEY)
      labs.push([id as CompanyId, c.revenue_usd]);
  });
  world.births.tipped_lab = drawTippedLab(tippedLabCandidates(labs), draws);
}

/**
 * Each starting private company's first IPO vote (spec 5.20.1 step 1, A; D276): one of the four
 * 2020 plan locks, a gen draw each in company id order, made at load after the boards.
 */
export function drawFirstVotes(world: World, draws: DrawSource): void {
  for (const c of world.companies) {
    if (!c.public) c.ipo_next_vote = drawFirstVote(draws);
  }
}

// ---------------------------------------------------------------------------------------------
// Where startups go (spec 5.19.1, 5.19.2).

/** Named companies of `industry` with HQ in each province (spec 5.19.1), companies still in the game. */
function namedByProvince(world: World, industry: IndustryId): number[] {
  const n = new Array<number>(world.provinces.length).fill(0);
  for (const c of world.companies) {
    if (c.industry === industry && companyFinanceInGame(c.finance)) {
      n[c.hq_province] = (n[c.hq_province] as number) + 1;
    }
  }
  return n;
}

/**
 * The HQ candidates of a startup in `industry` (spec 5.19.1): every province with its weight
 * `province weight × (1 + named companies there) × 3 if a key city there lists the industry`, in
 * id order, the province weight counting development above the floor (D830); with `regions`, only
 * the provinces inside them (5.19.2).
 */
function hqCandidates(
  world: World,
  industry: IndustryId,
  regions: readonly Region[] | null,
): [ProvinceId, number][] {
  const named = namedByProvince(world, industry);
  const sites = world.births.sites;
  const ids: ProvinceId[] = [];
  world.provinces.forEach((p, id) => {
    const pid = id as ProvinceId;
    if (
      regions === null ||
      birthsInRegions(
        world.births,
        pid,
        (world.countries[p.country] as World["countries"][number]).key,
        regions,
      )
    ) {
      ids.push(pid);
    }
  });
  const withBase = (base: readonly number[]): [ProvinceId, number][] =>
    ids.map((id): [ProvinceId, number] => [
      id,
      hqWeight(base[id] as number, named[id] as number, sitesKeyCityLists(sites, id, industry)),
    ]);
  // D830: development above the floor; an event's regions whose provinces all sit at the
  // floor fall back to the 2.3.1 weight, so the event can still place its HQ
  const out = withBase(sites.hq_weight);
  if (out.every(([, w]) => w <= 0.0)) return withBase(sites.weight);
  return out;
}

/** The 5.19.1 industry weights, every industry in id order. */
function industryWeights(world: World): [IndustryId, number][] {
  return world.industries.map((ind, id): [IndustryId, number] => [
    id as IndustryId,
    industryWeight(
      ind.q_growth,
      fringeRevenue(ind.fringe_assets, ind.params.asset_turnover),
      ind.phase_label,
    ),
  ]);
}

// ---------------------------------------------------------------------------------------------
// One startup (spec 5.19.3, 5.19.4).

/**
 * Builds one startup from its draft and adds it to every table (spec 5.19.3, 5.19.4): the carve
 * from the fringe, the unit, the company with its books and stock row, its name, its founders and
 * its seated cast. null when the 5.19.3 cap skips it (under $1M).
 */
export function birth(
  world: World,
  draws: DrawSource,
  draft: StartupDraft,
  event: StartupEventId,
  date: SimDate,
): CompanyId | null {
  const ind = world.industries[draft.industry] as Industry;
  const revenue = sizedRevenue(
    draft.target_revenue_usd,
    fringeRevenue(ind.fringe_assets, ind.params.asset_turnover),
  );
  if (revenue === null) return null;
  const id = world.companies.length as CompanyId;
  const key = companyKey(world.companies.length + 1);
  const country_id = (world.provinces[draft.hq] as World["provinces"][number]).country;
  const country = world.countries[country_id] as World["countries"][number];
  const zone = world.zones[country.zone] as World["zones"][number];
  // D271: the home spread at birth on the zone's effective spread.
  const home = homeSpread(zone.credit_spread, country.sovereign_spread);
  const params = structuredClone(ind.params);
  const b = buildStartup({
    key,
    revenue,
    params,
    industry_key: ind.key,
    sector: ind.sector,
    fringe_assets: ind.fringe_assets,
    tax_rate: country.corp_tax_rate,
    sovereign: country.sovereign_rating,
    base_rate: world.base_rate,
    home_spread: home,
    g_sector: ind.lt,
    book_floor_share: bookFloorShare(ind.key),
  });
  const lt = ind.lt;
  ind.fringe_assets = b.fringe_assets_after;

  // The name first, then the cast (D272, D274).
  const name = companyNamesDraw(
    world.births.names,
    country_id,
    draft.industry,
    (n) => world.companies.some((c) => c.name === n),
    draws,
  );
  const names = nameBooksGet(world.name_books, country_id);
  if (names === null) throw new Error("every country has a name book (checked at load)");
  const others = birthsHomeOthers(world.births, country_id, draft.hq);
  const cast = seatCast(
    draws,
    names,
    (n) => world.characters.some((c) => c.name === n),
    b.labor,
    draft.full,
    draft.partial,
    { hq: draft.hq, others },
  );

  // The founders join the character table (spec 3.7.2: next CH- ids).
  const founders: CharacterId[] = cast.founders.map((f) => {
    const ch = world.characters.length as CharacterId;
    world.characters.push({
      key: characterKey(world.characters.length + 1),
      name: f.name,
      tier: GENERATED_TIER,
      age: f.age,
      skills: { ...f.skills },
      traits: [...f.traits],
      home_province: f.home_province,
      cash_usd: f.cash_usd,
    });
    return ch;
  });
  const simple = (character: SimpleSeat["character"]): SimpleSeat => {
    const sid = world.simple_characters_made;
    world.simple_characters_made += 1;
    return { id: sid, character };
  };
  const founderAt = (i: number): CharacterId => founders[i] as CharacterId;
  const board: (SeatHolder | null)[] = new Array<SeatHolder | null>(LABOR_SEAT_COUNT).fill(null);
  cast.seats.forEach((seat, slot) => {
    board[slot] = castHolder(seat, founderAt, simple);
  });
  const directors: Director[] = cast.directors.map((d): Director => {
    if (d.kind === "Founder") return { kind: "Full", character: founderAt(d.index) };
    return { kind: "Simple", seat: simple(d.character) };
  });
  const caps = capTable(b.shares_out, founders.length);
  const holders: Holding[] = founders.map((ch, i) => ({
    holder: { kind: "Founder", character: ch },
    shares: caps.founders[i] as number,
  }));
  holders.push({ holder: { kind: "SeedInvestors" }, shares: caps.seed_investors });

  // The unit (spec 5.19.3): asset_book = gross, no ramping, productivity 100.
  const unit_id = world.units.length as UnitId;
  world.units.push({
    company: id,
    industry: draft.industry,
    base_province: draft.hq,
    gross_assets: b.gross_assets,
    ramping: [],
    asset_book: b.asset_book,
    productivity: START_PRODUCTIVITY,
    location_bonus: 0.0,
    fixed_cost_rate: b.fixed_cost_rate,
    growth_plan: 0.0,
    rd_plan: b.rd_plan,
    revenue_m: 0.0,
    variable_m: 0.0,
    fixed_m: 0.0,
    rd_m: 0.0,
    dep_m: 0.0,
    shared_m: 0.0,
    capex_m: 0.0,
    sale_proceeds_m: 0.0,
    sale_gain_m: 0.0,
  });

  // The books (spec 5.19.3 seed round): cash, no line, the rating implied from the run rate, the
  // limit at that rating, and the opening balance sheet; no history (TTM figures scale the
  // quarters so far, D228). `companyFinanceAtLoad` starts with an empty archive (Rust
  // `Arc::default()`).
  const finance = companyFinanceAtLoad(0.0, b.rating);
  finance.line.limit = lineLimit(b.asset_book, b.cash, 0.0, b.rating);
  finance.opening = balanceSheet(
    { cash: b.cash, asset_book: b.asset_book, line_drawn: 0.0, tax: taxBookDefault() },
    "Active",
  );
  const lead = founders[0] ?? null;
  let next_vote: Quarter = simDateQuarter(date);
  for (let k = 0; k < IPO_QUARTERS_AFTER_BIRTH; k++) next_vote = quarterNext(next_vote);
  world.companies.push({
    key,
    name,
    ticker: "",
    industry: draft.industry,
    hq_country: country_id,
    hq_province: draft.hq,
    public: false,
    revenue_usd: revenue,
    shares_out: b.shares_out,
    units: [unit_id],
    controller: lead,
    labor_units: b.labor,
    stations: { ...b.stations },
    pc: productiveCompute(b.stations, params.pc_modifier),
    pc_bonus: b.run_rate.pc_bonus,
    compute: computeBill(b.stations, 0.0),
    data: [{ industry: draft.industry, book: dataBookDefault() }],
    board,
    seats_to_fill: [],
    management_score: 0.0,
    archetype: b.archetype,
    cash_usd: b.cash,
    finance,
    state_controlled: false,
    origin: { kind: "Born", date, event },
    founders,
    directors,
    holders,
    loss_quarters: 0,
    plan: null,
    failed_raises: 0,
    raise_pending: false,
    ipo_next_vote: next_vote,
    ipo_last_vote: null,
    birth_run_rate: b.run_rate,
    start_control: null,
  });
  const company = world.companies[id] as Company;
  company.management_score = managementScore(boardOf(world, company));

  // The stock row: private, valued by the 7.1 rule; with no quarter it is valued as a loss-maker
  // from the next daily refresh (D253).
  const stock = stockAtLoad(null, 0.0, b.shares_out);
  stock.fair_value = b.engine_value;
  stock.value = perShare(b.engine_value, b.shares_out);
  stock.basis = fairValueBasisAtRelease(null, 0.0, lt);
  stock.bar = barBuilderStart(date, 0.0);
  world.market.stocks.push(stock);
  return id;
}

/** A cast seat as the board holds it (spec 5.19.4): a founder full, a partial or filler simple. */
function castHolder(
  seat: CastSeat | null,
  founderAt: (i: number) => CharacterId,
  simple: (c: SimpleSeat["character"]) => SimpleSeat,
): SeatHolder | null {
  if (seat === null) return null;
  if (seat.kind === "Founder") return { kind: "Full", character: founderAt(seat.index) };
  return { kind: "Simple", seat: simple(seat.character) };
}

/**
 * Builds an event's startups in draft order and logs the event (spec 3.1 `startup_events`).
 * Returns the event's id and the companies made; an event whose every startup the cap skipped is
 * not logged (D154).
 */
function fireEvent(world: World, ctx: JobCtx, draft: EventDraft): [StartupEventId, CompanyId[]] | null {
  const date = ctx.facts.date;
  const event = world.births.events.length as StartupEventId;
  const made: CompanyId[] = [];
  for (const s of draft.startups) {
    const id = birth(world, ctx.draws, s, event, date);
    if (id !== null) made.push(id);
  }
  if (made.length === 0) return null;
  world.births.events.push({
    id: event,
    kind: structuredClone(draft.kind),
    date,
    industries: made.map((c) => (world.companies[c] as Company).industry),
    companies: [...made],
  });
  jobCtxNotice(ctx, { kind: "StartupEvent", event });
  for (const c of made) jobCtxNotice(ctx, { kind: "CompanyBorn", company: c });
  return [event, made];
}

// ---------------------------------------------------------------------------------------------
// The plan lock (spec 4.4 row 3).

/**
 * Plan lock step 1 (spec 5.19.2): the fixed events due, in file order (F1 to F9; F9 at the first
 * lock with the AI stage Postcrash, D275). Each event draws its startups' HQs inside its regions,
 * builds them and posts its own headline: F4 "[tipped lab]'s chatbot sets off a startup rush: [n]
 * new AI labs", the others "[event name]: [n] new startups" (5.18, D279).
 */
export function fixedEventsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  const due = dueEvents(world.births.fixed, world.births.fixed_fired, date, world.ai.stage);
  for (const i of due) {
    world.births.fixed_fired[i] = true;
    const event: FixedEvent = structuredClone(world.births.fixed[i] as FixedEvent);
    const draft = drawFixedEvent(
      event,
      (name) => {
        const at = world.industries.findIndex((ind) => ind.name === name);
        return at < 0 ? null : (at as IndustryId);
      },
      (industry, regions) => hqCandidates(world, industry, regions),
      ctx.draws,
    );
    const fired = fireEvent(world, ctx, draft);
    if (fired === null) continue;
    const [eventId, made] = fired;
    let headline: Headline;
    const labsAt = world.industries.findIndex((ind) => ind.key === AI_LABS_KEY);
    if (event.id === CHATBOT_EVENT_ID && labsAt >= 0) {
      const labs = labsAt as IndustryId;
      const n = made.filter((c) => (world.companies[c] as Company).industry === labs).length;
      headline = chatbotRush(date, event.id, labs, tippedLabName(world), n);
    } else {
      headline = fixedEventHeadline(date, event.id, event.name, made.length);
    }
    newsWireQueue(world.news, headlineOfEvent(headline, eventId));
  }
}

/** The tipped lab's name (5.1.1), or a generic name with no candidate. */
export function tippedLabName(world: World): string {
  const c = world.births.tipped_lab;
  return c === null ? "An AI lab" : (world.companies[c] as Company).name;
}

/**
 * Plan lock step 2 (spec 5.19.1): the Poisson count of random events, each placed by the industry
 * and HQ weights and built. A one-startup event posts "[Name] launches in [industry] in [city or
 * province]"; a hot cluster "[n] startups launch in [industry] in [city]" (5.18).
 */
export function randomEventsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  const weights = industryWeights(world);
  const drafts = drawRandomEvents(weights, (ind) => hqCandidates(world, ind, null), ctx.draws);
  for (const draft of drafts) {
    const fired = fireEvent(world, ctx, draft);
    if (fired === null) continue;
    const [eventId, made] = fired;
    const firstId = made[0] as CompanyId;
    const first = world.companies[firstId] as Company;
    const industry = first.industry;
    const ind_name = (world.industries[industry] as Industry).name;
    const p = first.hq_province;
    const place = sitesPlace(world.births.sites, p, (world.provinces[p] as World["provinces"][number]).name);
    const headline =
      made.length === 1
        ? startupLaunch(date, industry, firstId, first.name, ind_name, place)
        : hotCluster(date, industry, ind_name, place, made.length);
    newsWireQueue(world.news, headlineOfEvent(headline, eventId));
  }
}

/** The traits of a seat holder (simple or full), and the full character's id. */
function holderTraits(world: World, h: SeatHolder): [readonly Trait[], CharacterId | null] {
  if (h.kind === "Simple") return [h.seat.character.traits, null];
  return [(world.characters[h.character] as World["characters"][number]).traits, h.character];
}

/** Quarters from `from` to `to` (to − from), at least 0. */
function quartersBetween(from: Quarter, to: Quarter): number {
  return Math.max(quarterIndex(to) - quarterIndex(from), 0);
}

/** One company's IPO vote (spec 5.20.1 steps 2 to 5), if it is due and passes the 5.20 tests. */
function vote(world: World, id: CompanyId, q: Quarter, draws: DrawSource): VoteResult | null {
  const c = world.companies[id] as Company;
  const s = world.market.stocks[id] as Stock;
  if (s.exchange !== null || c.ipo_next_vote === null || quarterIndex(c.ipo_next_vote) > quarterIndex(q)) {
    return null;
  }
  const quarters = companyFinanceQuarters(c.finance);
  const ttm = trailingFour(quarters);
  if (ttm === null) return null;
  const label = (world.industries[c.industry] as Industry).phase_label;
  const since_birth = c.origin.kind === "Born" ? quartersBetween(simDateQuarter(c.origin.date), q) : null;
  const revenues = quarters.map((st) => st.lines.revenue);
  if (
    !passesIpoTests({
      listed: false,
      status: companyFinanceStatus(c.finance),
      quarters_since_birth: since_birth,
      ttm_revenue: ttm.revenue,
      ttm_net_income: ledgerNetIncome(ttm),
      revenue_growth: revenueGrowth(revenues),
      rating: c.finance.rating,
      label,
    })
  ) {
    return null;
  }
  // Voters (5.20.1 steps 2 and 4; D276): the seated labor seats, the directors, then a named or
  // state controller holding no seat.
  let seated_controller = false;
  const seats: [Seat, readonly Trait[], boolean][] = [];
  c.board.forEach((h, i) => {
    if (h === null) return;
    const [traits, ch] = holderTraits(world, h);
    const ctl = ch !== null && ch === c.controller;
    seated_controller ||= ctl;
    seats.push([SEAT_LABOR[i] as Seat, traits, ctl]);
  });
  const directors: [readonly Trait[], boolean][] = c.directors.map((d): [readonly Trait[], boolean] => {
    if (d.kind === "Simple") return [d.seat.character.traits, false];
    const ctl = d.character === c.controller;
    seated_controller ||= ctl;
    return [(world.characters[d.character] as World["characters"][number]).traits, ctl];
  });
  let unseated: readonly Trait[] | null;
  if (seated_controller) unseated = null;
  else if (c.state_controlled) unseated = [];
  else
    unseated =
      c.controller === null ? null : (world.characters[c.controller] as World["characters"][number]).traits;
  const v = voters(seats, directors, unseated);
  const zone = (world.countries[c.hq_country] as World["countries"][number]).zone;
  const result = holdVote(v, label, (world.zones[zone] as World["zones"][number]).confidence, draws);
  // Who cast each ballot, as the board stands now (D542): the roles name the seats.
  for (const b of result.ballots) b.voter = ballotVoter(c, b.role);
  return result;
}

/**
 * The member a ballot's role names on the board at the vote (D542); the controller's extra vote is
 * the state's or the named controller's, as `vote` gives it.
 */
function ballotVoter(c: Company, role: VoterRole): BallotVoter | null {
  const simple = (s: SimpleSeat): BallotVoter => ({ kind: "Partial", id: s.id, name: s.character.name });
  switch (role.kind) {
    case "Seat": {
      const h = companySeat(c, role.seat);
      if (h === null) return null;
      return h.kind === "Simple" ? simple(h.seat) : { kind: "Full", character: h.character };
    }
    case "Director": {
      const d = c.directors[role.position];
      if (d === undefined) return null;
      return d.kind === "Simple" ? simple(d.seat) : { kind: "Full", character: d.character };
    }
    case "Controller":
      if (c.state_controlled) return { kind: "State" };
      return c.controller === null ? null : { kind: "Full", character: c.controller };
  }
}

/**
 * Plan lock step 3 (spec 5.20, 5.20.1): every private Active company whose vote is due
 * (`ipo_next_vote` at or before this lock) and that passes the 5.20 tests holds its board vote, in
 * id order; a failed vote comes back 4 quarters later; each vote posts a headline. Then the cap of
 * 3 a quarter (the largest by TTM revenue, ties to the lower id; the rest count as failed) and the
 * listings, in id order (D155). A due company that fails the tests is not put to a vote and stays
 * due (D156).
 */
export function ipoJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  const q = simDateQuarter(date);
  const passed: [CompanyId, number][] = [];
  for (let i = 0; i < world.companies.length; i++) {
    const id = i as CompanyId;
    const result = vote(world, id, q, ctx.draws);
    if (result === null) continue;
    const c = world.companies[id] as Company;
    const zone = (world.countries[c.hq_country] as World["countries"][number]).zone;
    newsWireQueue(
      world.news,
      ipoVote(
        date,
        c.industry,
        id,
        c.name,
        (world.zones[zone] as World["zones"][number]).exchange_code,
        result.passed,
        [result.yes, result.no],
      ),
    );
    jobCtxNotice(ctx, { kind: "IpoVote", company: id, passed: result.passed });
    if (result.passed) {
      const ttm = trailingFour(companyFinanceQuarters(c.finance));
      passed.push([id, ttm === null ? 0.0 : ttm.revenue]);
    } else {
      c.ipo_next_vote = nextVoteAfter(q);
    }
    c.ipo_last_vote = { date, result, capped: false };
  }
  const [listing, capped] = applyCap(passed);
  for (const id of capped) {
    const c = world.companies[id] as Company;
    c.ipo_next_vote = nextVoteAfter(q);
    if (c.ipo_last_vote !== null) c.ipo_last_vote.capped = true;
  }
  listing.sort((a, b) => a - b);
  for (const id of listing) list(world, ctx, id);
}

/**
 * Lists a company whose vote passed (spec 5.20.1 Listing): pre-money value = the 5.13 fair value
 * with its exchange's X and no private discount; the 7.1 open price; existing holdings re-split to
 * `pre-money ÷ open_price` (any rounding remainder to the largest holding, ties to the earlier,
 * D153); 20% new shares to the public float at `open_price × 0.92` less 3% fees, the net into cash
 * and booked as shares issued (D125), so assets = liabilities + equity; a unique ticker; P =
 * open_price, buzz 0; it joins its exchange's index with the divisor rescaled (`market/jobs`
 * `listCompany`, the level does not move). V is then refreshed for the new book and X, and its
 * estimated fair value error drawn (D140, D150).
 */
export function list(world: World, ctx: JobCtx, id: CompanyId): void {
  const date = ctx.facts.date;
  const c = world.companies[id] as Company;
  const zone = (world.countries[c.hq_country] as World["countries"][number]).zone;
  const basis = { ...(world.market.stocks[id] as Stock).basis };
  const inputs = fairValueInputs(world, id, basis);
  inputs.listing_confidence = (world.zones[zone] as World["zones"][number]).confidence;
  const pre_money = fairValue(inputs);
  const l = listCompany(pre_money, c.key);
  const symbol = ticker(c.name, (t) => world.companies.some((o) => o.ticker === t));

  const old = c.shares_out;
  let held = 0;
  for (const h of c.holders) {
    h.shares = listingResplitHolding(l, h.shares, old);
    held += h.shares;
  }
  // The largest holding, ties to the earlier (Rust `max_by` with `then(b.cmp(&a))`).
  let big = -1;
  c.holders.forEach((h, i) => {
    if (big < 0 || h.shares > (c.holders[big] as Holding).shares) big = i;
  });
  if (big >= 0) {
    const h = c.holders[big] as Holding;
    h.shares = saturatingSubCount(h.shares + l.resplit_shares, held);
  }
  c.holders.push({ holder: { kind: "PublicFloat" }, shares: l.new_shares });
  c.shares_out = l.shares_out;
  c.cash_usd += l.net;
  c.finance.pending.shares_issued_net += l.net;
  c.ticker = symbol;
  c.ipo_next_vote = null;
  marketListCompany(world, id, l.open_price, date);
  const fv = fairValue(fairValueInputs(world, id, basis));
  const s = world.market.stocks[id] as Stock;
  s.fair_value = fv;
  s.value = perShare(fv, c.shares_out);
  s.buzz = 0.0;
  s.efv_error = drawEfvError(ctx.draws);
  newsWireQueue(
    world.news,
    listingHeadline(
      date,
      c.industry,
      id,
      c.name,
      (world.zones[zone] as World["zones"][number]).exchange_code,
      l.open_price,
      l.net,
    ),
  );
  jobCtxNotice(ctx, { kind: "CompanyListed", company: id });
}

/**
 * Registers the births jobs in the plan lock's first three slots (spec 4.4 row 3). Called from
 * `jobs.ts`'s `registerJobs`.
 */
export function register(s: Scheduler): void {
  schedulerRegister(s, "LockFixedStartupEvents", "births.fixed_events", fixedEventsJob);
  schedulerRegister(s, "LockRandomStartupEvents", "births.random_events", randomEventsJob);
  schedulerRegister(s, "LockIpoVotes", "births.ipo_votes_and_listings", ipoJob);
}

/** For tests: an event's kind is fixed (5.19.2). */
export function isFixed(kind: EventKind): boolean {
  return kind.kind === "Fixed";
}
