// The mock's pivot world: a small fake game behind the 13 pivot views (pivot 5 to 14). It builds a
// seeded slice of the 2020 election year from the fixtures (fixtures/*.ts, one file per view
// family), rolls it forward hour by hour (articles, posts, polls, the forecast, contract prices,
// bills, election night, certification), takes the player's actions, and says which views moved.
//
// It is not the sim: nothing here is a spec formula, and the numbers are mock numbers. What it keeps
// honest is the shape and the consistency of what the views carry, so the apps can be built and
// exercised end to end before the real builders exist. README.md describes the world and its
// scripted dates.

import {
  type ActError,
  type CompanyId,
  type ContractBook,
  type ContractId,
  type DateTime,
  dateTimeDate,
  dateTimeHour,
  dateTimeWeekday,
  type EntityRef,
  type HandleId,
  type InstrumentId,
  type NotificationRow,
  type OrderRow,
  type Party,
  type PersonId,
  type PlayerAction,
  type Poll,
  type RaceCountyReturns,
  type RaceId,
  type RollCallVotes,
  type SimDate,
  type SimViews,
} from "@tc20ff/sim";
import {
  type AccountState,
  accountView,
  closeOrder,
  contractCost,
  fillContract,
  fillStock,
  newAccount,
  newOrder,
  notificationsView,
  notify,
  PLAYER_MAX_STAKE,
  positionOf,
  reserved,
  START_CASH,
  STOCK_COMMISSION,
  STOCK_INSTRUMENT_BASE,
  STOCK_SPREAD,
  sameRef,
  settle,
} from "./fixtures/account.ts";
import {
  correct,
  coverage,
  type FeedState,
  feedView,
  genFeed,
  type MockOutlet,
  OUTLET,
  publish,
  rankFrontPages,
  regionalOf,
  STORY,
  type Story,
  spin,
} from "./fixtures/feed.ts";
import {
  COMMON_SIGMA,
  chamberModel,
  controlOf,
  FORECAST_HOUR,
  type ForecastModel,
  forecastView,
  type Outlook,
  pollMargin,
  runForecast,
  seatDist,
  totalEv,
} from "./fixtures/forecast.ts";
import {
  type CountyResult,
  districtsView,
  genGeo,
  type MockGeo,
  type MockState,
  usMapLayersView,
} from "./fixtures/geo.ts";
import {
  BOOK_LEVELS,
  closeContract,
  contractBook,
  contractHistory,
  genMarkets,
  listContract,
  type MarketState,
  type MockContract,
  type MockContractHistory,
  marketNewDay,
  marketStep,
  marketsView,
  resolveContract,
  takeLiquidity,
} from "./fixtures/markets.ts";
import { leaveOffice, type MockPerson, peopleView } from "./fixtures/people.ts";
import { playerScript, type ScriptedAction } from "./fixtures/player.ts";
import {
  genPolling,
  type MockPolling,
  POLL_HOUR,
  pollsDue,
  pollsView,
  primaryPolls,
} from "./fixtures/polls.ts";
import {
  ballotCandidate,
  genPolitics,
  type MockPolitics,
  type MockRace,
  needsRecount,
  racesView,
} from "./fixtures/races.ts";
import {
  addAction,
  BILL,
  fileReports,
  genRecords,
  holdVote,
  type MockBill,
  type RecordsState,
  recordsView,
  rollCallVotes,
  setStage,
  type VoteNeed,
} from "./fixtures/records.ts";
import {
  type Caller,
  type CountEvents,
  type CountState,
  countStep,
  countyResults,
  countyReturns,
  genCount,
  returnsView,
} from "./fixtures/returns.ts";
import { MockRng, unitHash } from "./fixtures/rng.ts";
import {
  CERTIFICATION_DATE,
  MOCK_HISTORY_START,
  RECOUNT_CERTIFICATION_DATE,
  SCRIPT,
  ymd,
} from "./fixtures/script.ts";
import {
  candidateLine,
  genSocial,
  post,
  punditLine,
  type SocialState,
  settleRumour,
  socialView,
} from "./fixtures/social.ts";
import type { MockWorld } from "./mockWorld.ts";

/** The pivot's views, in `VIEW_NAMES` order. */
export const PIVOT_VIEWS = [
  "feed",
  "social",
  "polls",
  "forecast",
  "races",
  "people",
  "records",
  "markets",
  "account",
  "notifications",
  "districts",
  "usmap_layers",
  "returns",
] as const;
export type PivotViewName = (typeof PIVOT_VIEWS)[number];

/** The views that carry a hidden field (pivot 5.11): rebuilt when Omniscient toggles. */
const HIDDEN_VIEWS: readonly PivotViewName[] = [
  "feed",
  "polls",
  "races",
  "people",
  "districts",
  "usmap_layers",
];

/** What the pivot world reads of the stock market the mock already runs (fixtures/market.ts). */
export interface PivotHooks {
  /** A listed company's price now, USD; null for a company with no listing. */
  stockPrice(company: CompanyId): number | null;
  shares(company: CompanyId): number;
  /** The listed companies, largest first. */
  largest(): CompanyId[];
}

/** Why the pivot world pauses the game (pivot 2.4): election day at 00:00, or any other pausing notice. */
export type PivotPause = "ElectionDay" | "Notice";

/** A player action and the tick it was applied after (pivot 16.1: actions are recorded for replay). */
export interface RecordedAction {
  at: DateTime;
  action: PlayerAction;
}

/** How much of the ordinary daily coverage runs before October, to keep the starting feed small. */
const EARLY_DENSITY = 0.4;
const DENSE_FROM = SCRIPT.tax_reported;
/** The chance an hour that a resting order inside the spread, or at the best price, is hit (pivot 11.1). */
const FILL_CHANCE_INSIDE = 0.2;
const FILL_CHANCE_AT_BEST = 0.06;
/** How sure each kind of caller must be, in standard deviations (pivot 9.3). */
const CALL_THRESHOLD = { wire: 3, national: 2.5, regional: 2.7, careless: 1.6 } as const;

const round = (x: number) => Math.floor(x + 0.5);
const cents = (usd: number) => `$${(Math.floor(usd * 100 + 0.5) / 100).toFixed(2)}`;

export class MockPivot {
  readonly geo: MockGeo;
  readonly pol: MockPolitics;
  readonly polling: MockPolling;
  readonly feed: FeedState;
  readonly social: SocialState;
  readonly records: RecordsState;
  readonly markets: MarketState;
  readonly count: CountState;
  readonly account: AccountState;
  readonly polls: Poll[];
  /** The tick the game began at; before it is the pre-rolled history. */
  readonly start: DateTime;
  now: DateTime;
  omniscient = false;
  /** The player's actions since `start`, for a save (pivot 16.1). */
  recorded: RecordedAction[] = [];
  /** The forecast site's last run, and what the market reads now (the count, on election night). */
  private model: ForecastModel;
  private live: ForecastModel;
  private forecastDate: SimDate | null = null;
  private readonly pollsByRace: Poll[][];
  private lastCounty: (CountyResult | null)[];
  private readonly callers: Caller[];
  private readonly rng: MockRng;
  private readonly dirty = new Set<PivotViewName>(PIVOT_VIEWS);
  private paused: PivotPause | null = null;
  private readonly queue: ScriptedAction[];
  private readonly rumourPosts = { real: -1, fake: -1 };
  private fakeArticle = -1;
  /** Alert rules that fired this tick, so one story does not ring twice. */
  private rang = new Set<number>();

  constructor(
    readonly base: MockWorld,
    seed: number,
    start: DateTime,
    readonly hooks: PivotHooks,
    /** A loaded game: the tick it was saved at and the actions taken since `start`. */
    resume?: { now: DateTime; actions: readonly RecordedAction[] },
  ) {
    // The pivot world has its own stream, so the stock walk's numbers are what they were.
    this.rng = new MockRng((seed ^ 0x51ed270b) >>> 0);
    const rng = this.rng;
    this.geo = genGeo(base, rng);
    this.pol = genPolitics(base, this.geo, rng);
    this.polling = genPolling(this.pol, rng);
    this.feed = genFeed(this.geo, rng);
    this.social = genSocial(this.pol, this.polling, this.feed, [
      this.pol.interior,
      this.pol.dropout_person,
      this.pol.retiree,
    ]);
    this.records = genRecords(base, this.pol, this.geo, rng);
    this.count = genCount(this.pol, this.geo, rng);
    this.polls = primaryPolls(this.polling, this.pol, rng);
    this.pollsByRace = this.pol.races.map(() => []);
    this.start = start;
    this.now = Math.min(start, MOCK_HISTORY_START);
    this.model = runForecast(this.pol, this.geo, (r) => this.pollsByRace[r] as Poll[], this.now);
    this.live = this.model;
    this.markets = genMarkets(this.pol, this.geo, this.records, this.model);
    this.account = newAccount();
    // The map starts with the last presidential vote: each county's lean, a little off (pivot 15.3).
    this.lastCounty = this.geo.counties.map((c) => {
      const margin = round((c.lean - 1.5 + 6 * (unitHash(c.fips, 3) - 0.5)) * 10) / 10;
      return { winner: (margin >= 0 ? "Democrats" : "Republicans") as Party, margin };
    });
    this.callers = this.feed.outlets
      .filter((o) => o.kind !== "National" || o.reliability > 0.5 || o.id === OUTLET.careless)
      .map((o) => ({
        outlet: o.id,
        threshold:
          o.id === OUTLET.careless
            ? CALL_THRESHOLD.careless
            : o.kind === "Wire"
              ? CALL_THRESHOLD.wire
              : o.kind === "Regional"
                ? CALL_THRESHOLD.regional
                : CALL_THRESHOLD.national,
        state: o.state,
        house: o.kind !== "National" || o.id === OUTLET.careless,
        careless: o.id === OUTLET.careless,
      }));

    // The pre-rolled history: the world runs from its own start to the game's, with the player's
    // scripted first trades, then on to a loaded game's tick with the actions the save recorded.
    this.queue = playerScript(this).filter((a) => a.at <= start);
    this.drain();
    while (this.now < start) this.step(this.now + 1);
    if (!this.account.open) this.openAccount();
    if (resume !== undefined) {
      this.queue.push(...resume.actions.map((r): ScriptedAction => ({ at: r.at, run: () => r.action })));
      this.drain();
      while (this.now < resume.now) this.step(this.now + 1);
      this.recorded = resume.actions.slice();
    }
    this.paused = null;
    for (const v of PIVOT_VIEWS) this.dirty.add(v);
  }

  // ---------------------------------------------------------------- views

  /** The views that moved since the last call. */
  takeDirty(): PivotViewName[] {
    const out = PIVOT_VIEWS.filter((v) => this.dirty.has(v));
    this.dirty.clear();
    return out;
  }

  /** Why the game must pause, once, when a tick or an action raised a notice that pauses it (pivot 2.4). */
  takePause(): PivotPause | null {
    const p = this.paused;
    this.paused = null;
    return p;
  }

  setOmniscient(on: boolean): void {
    if (on === this.omniscient) return;
    this.omniscient = on;
    for (const v of HIDDEN_VIEWS) this.dirty.add(v);
  }

  view<K extends PivotViewName>(name: K): SimViews[K]["data"];
  view(name: PivotViewName): SimViews[PivotViewName]["data"] {
    const o = this.omniscient;
    switch (name) {
      case "feed":
        return feedView(this.feed, this.geo, o);
      case "social":
        return socialView(
          this.social,
          new Set(this.account.follows.filter((f) => f.kind === "Handle").map((f) => f.id)),
        );
      case "polls":
        return pollsView(this.polling, this.polls, o);
      case "forecast":
        return forecastView(this.forecastDate === null ? null : this.model, this.pol, this.forecastDate);
      case "races":
        return racesView(this.pol, this.geo, o);
      case "people":
        return peopleView(this.pol.people, o);
      case "records":
        return recordsView(this.records);
      case "markets":
        return marketsView(this.markets, this.account.orders);
      case "account":
        return accountView(this.account, (i) => this.mark(i));
      case "notifications":
        return notificationsView(this.account);
      case "districts":
        return districtsView(this.geo, this.pol.reps, o);
      case "usmap_layers":
        return usMapLayersView(this.geo, this.lastCounty, o);
      case "returns":
        return returnsView(this.count, this.pol, this.geo, this.now);
    }
  }

  // The slices the view types describe but the protocol cannot carry yet (README).

  /** A contract's depth (`ContractBook`, the slice of v_markets). */
  book(contract: ContractId): ContractBook | null {
    return contractBook(this.markets, contract, this.account.orders, this.now);
  }
  /** A contract's hourly prices since it was listed. */
  history(contract: ContractId): MockContractHistory | null {
    return contractHistory(this.markets, contract);
  }
  /** One race's count by county (`RaceCountyReturns`, the slice of v_returns). */
  countyReturns(race: RaceId): RaceCountyReturns | null {
    return countyReturns(this.count, this.pol, this.geo, race, this.now);
  }
  /** How each member voted (`RollCallVotes`, the slice of v_records). */
  rollCall(id: number): RollCallVotes | null {
    return rollCallVotes(this.records, id);
  }

  /** An instrument's price now: cents for a contract, USD for a share. */
  mark(i: InstrumentId): number {
    if (i >= STOCK_INSTRUMENT_BASE)
      return this.hooks.stockPrice((i - STOCK_INSTRUMENT_BASE) as CompanyId) ?? 0;
    const c = this.markets.contracts[i];
    return c === undefined ? 0 : (c.last ?? round(c.mid));
  }

  /** Whether a reference names something the views hold. */
  exists(ref: EntityRef): boolean {
    const n = ref.id;
    if (!Number.isInteger(n) || n < 0) return false;
    switch (ref.kind) {
      case "Person":
        return n < this.pol.people.length;
      case "Race":
        return n < this.pol.races.length;
      case "Bill":
        return n < this.records.bills.length;
      case "Company":
        return n < this.base.companies.length;
      case "Industry":
        return n < this.base.data.industries.rows.length;
      case "State":
        return this.geo.states.some((s) => s.id === n);
      case "County":
        return n < this.geo.counties.length;
      case "District":
        return n < this.geo.districts.length;
      case "Outlet":
        return n < this.feed.outlets.length;
      case "Pollster":
        return n < this.polling.pollsters.length;
      case "Handle":
        return n < this.social.handles.length;
      case "Contract":
        return n < this.markets.contracts.length;
    }
  }

  // ---------------------------------------------------------------- time

  /** Runs the tick that ends at `t`: one game hour. */
  step(t: DateTime): void {
    this.now = t;
    this.rang = new Set();
    const hour = dateTimeHour(t);
    if (hour === 0) this.newDay();
    this.script(t);
    if (hour === POLL_HOUR) this.releasePolls(t);
    if (hour === FORECAST_HOUR && t < SCRIPT.election_day + 24) this.rerunForecast(t);
    if (t >= SCRIPT.election_day) this.runCount(t);
    if (marketStep(this.markets, this.pol, this.live, t >= SCRIPT.election_day, t, this.rng))
      this.dirty.add("markets");
    this.matchResting(t);
    this.dailyContent(t, hour);
    if (hour === POLL_HOUR) {
      rankFrontPages(this.feed, t);
      this.dirty.add("feed");
    }
    this.priceAlerts();
    if (this.account.positions.length > 0) this.dirty.add("account");
    this.drain();
  }

  private drain(): void {
    while (this.queue.length > 0 && (this.queue[0] as ScriptedAction).at <= this.now) {
      const next = this.queue.shift() as ScriptedAction;
      if (!this.account.open) this.openAccount();
      const action = next.run();
      if (action !== null) this.apply(action);
    }
  }

  private openAccount(): void {
    this.account.open = true;
    this.account.cash.Brokerage = START_CASH;
    this.dirty.add("account");
  }

  private newDay(): void {
    marketNewDay(this.markets);
    this.dirty.add("markets");
    for (const o of this.account.orders) {
      if (o.status === "Open" && o.tif === "Day") {
        closeOrder(this.account, o.id, "Expired");
        this.dirty.add("account");
      }
    }
  }

  // ---------------------------------------------------------------- publishing

  private name(p: PersonId): string {
    return (this.pol.people[p] as MockPerson).name;
  }

  /** An article is out: it may ring the player's "Any" alerts (pivot 14.4). */
  private print(outlet: MockOutlet, s: Story, unconfirmed = false): number {
    const a = publish(this.feed, this.now, outlet.id, s, unconfirmed);
    this.dirty.add("feed");
    this.ring(s.refs, s.headline);
    const handle = this.social.of_outlet.get(outlet.id);
    if (handle !== undefined && outlet.kind === "Wire") this.say(handle, s.headline, s.refs);
    return a.id;
  }

  private say(handle: number, text: string, refs: EntityRef[], rumour: "Open" | null = null): number {
    const p = post(this.social, this.now, handle as HandleId, text, refs, rumour);
    this.dirty.add("social");
    this.ring(refs, text);
    return p.id;
  }

  private ring(refs: readonly EntityRef[], text: string): void {
    for (const r of this.account.rules) {
      if (r.rule.when.kind !== "Any" || this.rang.has(r.id)) continue;
      if (!refs.some((x) => sameRef(x, r.rule.target))) continue;
      this.rang.add(r.id);
      this.tell("Alert", text, [r.rule.target], r.rule.pause, r.id);
    }
  }

  private tell(
    kind: NotificationRow["kind"],
    text: string,
    refs: EntityRef[],
    paused: boolean,
    rule: number | null = null,
  ): void {
    notify(this.account, this.now, kind, text, refs, paused, rule);
    this.dirty.add("notifications");
    if (paused && this.paused !== "ElectionDay")
      this.paused = kind === "ElectionDay" ? "ElectionDay" : "Notice";
  }

  /** A scandal, roll call or resolution names something the player holds a position on (pivot 2.4 item 4). */
  private holding(ref: EntityRef, text: string): void {
    const held = this.account.positions.some((p) => {
      if (p.venue === "Exchange") {
        const c = this.markets.contracts[p.instrument];
        return c !== undefined && c.subject !== null && sameRef(c.subject, ref);
      }
      return ref.kind === "Company" && p.instrument - STOCK_INSTRUMENT_BASE === ref.id;
    });
    if (held) this.tell("Holding", text, [ref], true);
  }

  // ---------------------------------------------------------------- polls and the forecast

  private releasePolls(t: DateTime): void {
    const fresh = pollsDue(this.polling, this.pol, t, this.polls.length, this.rng);
    if (fresh.length === 0) return;
    const dense = t >= DENSE_FROM;
    for (const p of fresh) {
      this.polls.push(p);
      (this.pollsByRace[p.race] as Poll[]).push(p);
      const r = this.pol.races[p.race] as MockRace;
      const margin = pollMargin(p, r);
      const lead = ballotCandidate(r, margin >= 0 ? r.dem : r.rep);
      const trail = ballotCandidate(r, margin >= 0 ? r.rep : r.dem);
      const firm = (this.polling.pollsters[p.pollster] as { name: string }).name;
      const refs: EntityRef[] = [
        { kind: "Pollster", id: p.pollster },
        { kind: "Race", id: r.id },
        { kind: "Person", id: lead.person },
        { kind: "Person", id: trail.person },
      ];
      const pct = (ballot: number) => Math.floor((p.shares[ballot]?.share ?? 0) * 100);
      const handle = this.social.of_pollster.get(p.pollster);
      if (handle !== undefined) {
        this.say(
          handle,
          `NEW ${r.title}: ${this.name(lead.person)} ${pct(margin >= 0 ? r.dem : r.rep)}%, ${this.name(trail.person)} ${pct(margin >= 0 ? r.rep : r.dem)}% (n=${p.sample}, MoE ${p.margin_of_error})`,
          refs,
        );
      }
      if (r.office === "House" || !this.rng.chance(dense ? 0.6 : 0.25)) continue;
      const outlets =
        r.state === null
          ? coverage(this.feed, this.rng, null, dense ? 0.3 : 0.1)
          : [regionalOf(this.feed, r.state)];
      for (const o of outlets) {
        this.print(
          o,
          STORY.poll(
            spin(o, lead.party),
            firm,
            r.title,
            this.name(lead.person),
            this.name(trail.person),
            margin,
            p.sample,
            refs,
          ),
        );
      }
      if (this.rng.chance(0.3)) {
        this.say(
          this.rng.pick(this.social.pundits),
          punditLine(this.rng, `${this.name(lead.person)} up ${Math.abs(margin).toFixed(0)} in ${r.title}`),
          refs.slice(1),
        );
      }
    }
    this.dirty.add("polls");
  }

  private rerunForecast(t: DateTime): void {
    this.model = runForecast(this.pol, this.geo, (r) => this.pollsByRace[r] as Poll[], t);
    this.forecastDate = dateTimeDate(t);
    if (t < SCRIPT.election_day) this.live = this.model;
    this.dirty.add("forecast");
    if (dateTimeWeekday(t) === "Mon") {
      const dem = this.model.pres_dem >= 0.5;
      const wire = this.feed.outlets[OUTLET.wire] as MockOutlet;
      this.print(
        wire,
        STORY.forecast(
          dem ? "Democrats" : "Republicans",
          dem ? this.model.pres_dem : 1 - this.model.pres_dem,
          [{ kind: "Race", id: 0 }],
        ),
      );
    }
  }

  // ---------------------------------------------------------------- election night

  private runCount(t: DateTime): void {
    if (this.count.done && t > SCRIPT.recount_certification) return;
    const size = totalEv(this.geo);
    const tie = this.pol.incumbent_party === "Democrats" ? 1 : 0;
    const presDem = (states: Outlook[]) =>
      controlOf(
        seatDist(
          states.map((o, i) => ({ o, weight: (this.geo.states[i] as MockState).electoral_votes })),
          0,
          0,
          size,
        ),
        size,
        tie,
      );
    const ev = countStep(
      this.count,
      this.pol,
      this.geo,
      t,
      this.model.outlooks,
      this.model.pres_states,
      presDem,
      this.callers,
    );
    if (ev.moved) {
      this.dirty.add("returns");
      const anyClosed = this.count.closed.some((c) => c !== null);
      this.live = chamberModel(
        this.pol,
        this.geo,
        this.pol.races.map((r) => this.count.outlooks[r.id] ?? (this.model.outlooks[r.id] as Outlook)),
        this.geo.states.map((_, i) => this.count.pres_states[i] ?? (this.model.pres_states[i] as Outlook)),
        anyClosed ? 0 : COMMON_SIGMA,
      );
    }
    this.reportCount(ev);
  }

  private reportCount(ev: CountEvents): void {
    const wire = this.feed.outlets[OUTLET.wire] as MockOutlet;
    if (ev.closed.length > 0) {
      for (const r of ev.closed) r.status = "Counting";
      this.dirty.add("races");
      const states = [...new Set(ev.closed.map((r) => r.state).filter((s): s is number => s !== null))].map(
        (s) => this.geo.states[s] as MockState,
      );
      if (states.length > 0) {
        this.print(wire, {
          headline: `Polls close in ${states.map((s) => s.name).join(", ")}`,
          body: `Voting has ended in ${states.map((s) => s.name).join(", ")}. The first counties are expected to report within the hour.`,
          refs: states.map((s) => ({ kind: "State", id: s.id })),
        });
      }
    }
    for (const { race: r, call } of ev.calls) {
      const o = this.feed.outlets[call.outlet] as MockOutlet;
      const cand = r.candidates.find((c) => c.person === call.person);
      const refs: EntityRef[] = [
        { kind: "Outlet", id: o.id },
        { kind: "Person", id: call.person },
        { kind: "Race", id: r.id },
      ];
      // The wire and the local paper write up every call; a national desk only the presidency.
      if (o.kind !== "National" || r.office === "President" || o.id === OUTLET.careless) {
        this.print(
          o,
          STORY.call(
            spin(o, cand?.party ?? null),
            o.name,
            this.name(call.person),
            r.title,
            this.count.reporting[r.id] as number,
            refs,
          ),
        );
      }
      if (o.kind === "Wire" && r.office !== "House") {
        const mine = this.social.of_person.get(call.person);
        if (mine !== undefined)
          this.say(
            mine,
            `Thank you. ${r.title === "President" ? "The country" : r.title} has spoken, and I am ready to get to work.`,
            refs.slice(2),
          );
        this.say(
          this.rng.pick(this.social.pundits),
          punditLine(this.rng, `${this.name(call.person)} takes ${r.title}`),
          refs.slice(1),
        );
      }
    }
    for (const { race: r, call } of ev.retractions) {
      const o = this.feed.outlets[call.outlet] as MockOutlet;
      const refs: EntityRef[] = [
        { kind: "Outlet", id: o.id },
        { kind: "Race", id: r.id },
      ];
      this.print(o, STORY.retraction(o.name, r.title, refs));
      this.say(
        this.rng.pick(this.social.pundits),
        `${o.name} just pulled its call in ${r.title}. This is why you wait for the wire.`,
        refs,
      );
    }
    for (const r of ev.complete) {
      if (this.count.recount[r.id] === true) {
        r.status = "Recount";
        this.dirty.add("races");
        const refs: EntityRef[] = [{ kind: "Race", id: r.id }];
        this.print(wire, STORY.recount(r.title, r.final_margin, refs));
        if (r.state !== null)
          this.print(regionalOf(this.feed, r.state), STORY.recount(r.title, r.final_margin, refs));
      } else {
        // Its contracts stop trading and wait for certification (pivot 10.4).
        for (const c of this.raceContracts(r)) closeContract(c);
        this.cancelOrdersOnClosed();
        this.dirty.add("markets");
      }
    }
  }

  private raceContracts(r: MockRace): MockContract[] {
    return this.markets.contracts.filter((c) => c.fair.kind === "RaceWinner" && c.fair.race === r.id);
  }

  /** A race is certified (pivot 9.4): its record is final and its contracts settle (pivot 10.4). */
  private certify(r: MockRace, date: SimDate): void {
    r.status = "Certified";
    const won = ballotCandidate(r, r.winner_ballot);
    r.winner = won.person;
    r.candidates = r.candidates.map((c, i) =>
      r.ballot.includes(i) ? { ...c, status: c.person === won.person ? "Won" : "Lost" } : c,
    );
    this.count.certified[r.id] = date;
    this.dirty.add("races");
    this.dirty.add("returns");
    for (const c of this.raceContracts(r)) {
      this.resolve(c, c.fair.kind === "RaceWinner" && c.fair.ballot === r.winner_ballot);
    }
    if (r.office !== "House") {
      const refs: EntityRef[] = [
        { kind: "Race", id: r.id },
        { kind: "Person", id: won.person },
      ];
      const o =
        r.state === null ? (this.feed.outlets[OUTLET.wire] as MockOutlet) : regionalOf(this.feed, r.state);
      this.print(o, STORY.certified(r.title, this.name(won.person), r.final_margin, refs));
    }
  }

  private certifyAll(recountRace: boolean): void {
    const date = recountRace ? RECOUNT_CERTIFICATION_DATE : CERTIFICATION_DATE;
    for (const r of this.pol.races) {
      if (needsRecount(r) === recountRace) this.certify(r, date);
    }
    const pol = this.pol;
    const pres = pol.races[0] as MockRace;
    if (!recountRace) {
      this.lastCounty = countyResults(pol, this.geo.counties);
      this.dirty.add("usmap_layers");
    }
    // The chamber and bracket contracts settle once every race they count is certified.
    const certified = (office: string) =>
      pol.races.filter((r) => r.office === office).every((r) => r.status === "Certified");
    const demWon = (office: string) =>
      pol.races.filter((r) => r.office === office && r.winner_ballot === r.dem).length;
    const presDem = pres.winner_ballot === pres.dem;
    const senateDem = pol.senators.filter((s) => !s.up && s.party === "Democrats").length + demWon("Senate");
    const houseDem = demWon("House");
    for (const c of this.markets.contracts) {
      if (c.status === "Resolved") continue;
      const f = c.fair;
      if (f.kind === "Chamber" && certified(f.chamber)) {
        const dem = f.chamber === "House" ? houseDem : senateDem;
        const size = f.chamber === "House" ? pol.reps.length : pol.senators.length;
        const demControl = dem * 2 > size || (dem * 2 === size && presDem);
        this.resolve(c, (f.party === "Democrats") === demControl);
      } else if (f.kind === "SenateSeats" && certified("Senate"))
        this.resolve(c, senateDem >= f.lo && senateDem <= f.hi);
      else if (f.kind === "Ev" && certified("President")) {
        const ev = (pres.electoral as [number, number])[0];
        this.resolve(c, ev >= f.lo && ev <= f.hi);
      } else if (f.kind === "PopVote" && certified("President"))
        this.resolve(c, pres.final_margin >= f.lo && pres.final_margin < f.hi);
    }
  }

  /** Resolves a contract and settles the player's holding of it (pivot 10.4, 2.4 item 1). */
  private resolve(c: MockContract, outcome: boolean): void {
    if (c.status === "Resolved") return;
    resolveContract(c, outcome);
    this.dirty.add("markets");
    this.cancelOrdersOnClosed();
    const done = settle(this.account, c.id as number as InstrumentId, outcome);
    if (done === null) return;
    this.dirty.add("account");
    this.tell(
      "Resolution",
      `"${c.title}" resolved ${outcome ? "Yes" : "No"}: paid ${cents(done.payout)}, fee ${cents(done.fee)}, ${done.gain >= 0 ? "gain" : "loss"} ${cents(Math.abs(done.gain))}.`,
      [{ kind: "Contract", id: c.id }],
      true,
    );
  }

  private cancelOrdersOnClosed(): void {
    for (const o of this.account.orders) {
      if (o.status !== "Open" || o.venue !== "Exchange") continue;
      if (this.markets.contracts[o.instrument]?.status !== "Open") {
        closeOrder(this.account, o.id, "Cancelled");
        this.dirty.add("account");
      }
    }
  }

  // ---------------------------------------------------------------- the script

  private vote(
    bill: number,
    chamber: "House" | "Senate",
    question: string,
    need: VoteNeed,
    passes: boolean,
    reach: number,
  ): void {
    const b = this.records.bills[bill] as MockBill;
    const row = holdVote(
      this.records,
      this.pol,
      b.id,
      chamber,
      question,
      dateTimeDate(this.now),
      need,
      passes,
      this.rng,
    );
    this.dirty.add("records");
    const refs: EntityRef[] = [
      { kind: "Bill", id: b.id },
      { kind: "Person", id: b.sponsor },
    ];
    const sponsorParty = (this.pol.people[b.sponsor] as MockPerson).party;
    for (const o of coverage(this.feed, this.rng, null, reach)) {
      this.print(
        o,
        STORY.rollCall(
          spin(o, row.passed ? sponsorParty : null),
          b.title,
          chamber,
          question,
          row.yeas,
          row.nays,
          row.passed,
          refs,
        ),
      );
    }
    this.holding(
      refs[0] as EntityRef,
      `${chamber} roll call ${question.toLowerCase()} of the ${b.title}: ${row.yeas} to ${row.nays}, ${row.passed ? "passed" : "failed"}.`,
    );
  }

  private script(t: DateTime): void {
    const S = SCRIPT;
    const pol = this.pol;
    const ms = this.markets;
    const today = dateTimeDate(t);
    const wire = this.feed.outlets[OUTLET.wire] as MockOutlet;
    const careless = this.feed.outlets[OUTLET.careless] as MockOutlet;
    const named = (key: string) => ms.contracts[ms.named[key] as number] as MockContract;
    const bill = (id: number) => this.records.bills[id] as MockBill;
    const president = this.name(pol.president);
    switch (t) {
      case S.infra_house:
        this.vote(BILL.infrastructure, "House", "On passage", "Majority", true, 0.4);
        setStage(this.records, BILL.infrastructure, "SenateFloor", today);
        ms.targets.infra_law = 0.55;
        break;
      case S.veto: {
        const b = bill(BILL.border);
        addAction(this.records, {
          date: today,
          kind: "Veto",
          actor: pol.president,
          subject: null,
          text: `Vetoed the ${b.title}.`,
          changes: [],
        });
        this.dirty.add("records");
        const refs: EntityRef[] = [
          { kind: "Bill", id: b.id },
          { kind: "Person", id: pol.president },
        ];
        for (const o of coverage(this.feed, this.rng, null, 0.5))
          this.print(o, STORY.veto(b.title, president, refs));
        ms.targets.veto_override = 0.15;
        listContract(
          ms,
          {
            kind: "Governing",
            group: null,
            title: `The veto of the ${b.title} is overridden by 30 September`,
            rule: `Resolves Yes if two thirds of each chamber vote to override the President's veto of the ${b.title} on or before 30 September 2020. Resolves No at the end of that day otherwise. There are no refunds.`,
            subject: { kind: "Bill", id: b.id },
            listed: today,
            deadline: ymd(9, 30),
            fair: { kind: "Script", key: "veto_override" },
            liquidity: 250,
          },
          0.15,
          t,
          "veto_override",
        );
        this.dirty.add("markets");
        break;
      }
      case S.veto_override:
        this.vote(BILL.border, "House", "On overriding the veto", "Override", false, 0.4);
        setStage(this.records, BILL.border, "Dead", today);
        ms.targets.veto_override = 0.01;
        break;
      case S.veto_deadline:
        this.resolve(named("veto_override"), false);
        break;
      case S.cloture_fails:
        this.vote(BILL.platform, "Senate", "On cloture", "Cloture", false, 0.4);
        setStage(this.records, BILL.platform, "Dead", today);
        break;
      case S.tax_reported: {
        setStage(this.records, BILL.tax, "HouseFloor", today);
        this.dirty.add("records");
        const b = bill(BILL.tax);
        this.print(
          wire,
          STORY.stage(b.title, "is reported out of committee and heads to the House floor", [
            { kind: "Bill", id: b.id },
          ]),
        );
        break;
      }
      case S.filing_q3:
      case S.filing_pre_general: {
        const q3 = t === S.filing_q3;
        fileReports(this.records, pol, q3 ? ymd(9, 30) : ymd(10, 14), q3 ? 13 : 2, this.rng);
        this.dirty.add("records");
        this.dirty.add("races");
        for (const r of pol.races.filter(
          (x) => x.office === "President" || (x.office === "Senate" && this.rng.chance(0.3)),
        )) {
          const top = r.ballot
            .map((i) => r.candidates[i] as MockRace["candidates"][number])
            .reduce((a, b) => ((b.raised ?? 0) > (a.raised ?? 0) ? b : a));
          const last = this.records.filings.filter((f) => f.race === r.id && f.person === top.person).pop();
          const refs: EntityRef[] = [
            { kind: "Person", id: top.person },
            { kind: "Race", id: r.id },
          ];
          const o = r.state === null ? wire : regionalOf(this.feed, r.state);
          this.print(
            o,
            STORY.filing(r.title, this.name(top.person), last?.raised ?? 0, last?.cash ?? 0, refs),
          );
        }
        break;
      }
      case S.rumour_true_posted: {
        const who = this.name(pol.interior);
        const refs: EntityRef[] = [{ kind: "Person", id: pol.interior }];
        this.rumourPosts.real = this.say(
          this.social.anonymous[0] as number,
          `Hearing ${who} has told senior staff they are out at Interior before the election. Letter already drafted.`,
          refs,
          "Open",
        );
        this.say(
          this.social.pundits[1] as number,
          `If the ${who} chatter is real, that is a Cabinet seat open a fortnight before the vote. Big if.`,
          refs,
        );
        ms.targets.leaves = 0.45;
        break;
      }
      case S.rumour_true_confirmed: {
        const who = this.name(pol.interior);
        const refs: EntityRef[] = [
          { kind: "Person", id: pol.interior },
          { kind: "Person", id: pol.president },
        ];
        pol.people[pol.interior] = leaveOffice(pol.people[pol.interior] as MockPerson, today);
        this.dirty.add("people");
        for (const o of coverage(this.feed, this.rng, null, 0.8)) {
          this.print(
            o,
            STORY.confirmed(
              `Interior Secretary ${who} resigns`,
              `${who} resigned as Secretary of the Interior this afternoon, confirming days of speculation. President ${president} accepted the resignation and said a successor would be named next week.`,
              refs,
            ),
          );
        }
        settleRumour(this.social, this.rumourPosts.real, "Confirmed");
        this.dirty.add("social");
        ms.targets.leaves = 0.99;
        this.holding(refs[0] as EntityRef, `${who} has resigned as Secretary of the Interior.`);
        this.resolve(named("leaves"), true);
        break;
      }
      case S.debate: {
        const a = pol.people[pol.president] as MockPerson;
        const b = pol.people[pol.challenger] as MockPerson;
        const [win, lose] = a.skills.persuasion >= b.skills.persuasion ? [a, b] : [b, a];
        const refs: EntityRef[] = [
          { kind: "Person", id: win.id },
          { kind: "Person", id: lose.id },
          { kind: "Race", id: 0 },
        ];
        for (const o of coverage(this.feed, this.rng, null, 1.2))
          this.print(o, STORY.debate(spin(o, win.party), win.name, lose.name, refs));
        this.say(
          this.social.of_person.get(win.id) as number,
          "Tonight you saw the choice. One of us has a plan. See you on 3 November.",
          refs.slice(2),
        );
        this.say(
          this.social.of_person.get(lose.id) as number,
          "Ninety minutes of dodging from my opponent. The voters noticed.",
          refs.slice(2),
        );
        for (const h of this.social.pundits.slice(0, 2))
          this.say(h, punditLine(this.rng, `${win.name} won the debate`), refs);
        break;
      }
      case S.rumour_false_posted: {
        const r = pol.races[pol.dropout_race] as MockRace;
        const who = this.name(pol.dropout_person);
        const refs: EntityRef[] = [
          { kind: "Person", id: pol.dropout_person },
          { kind: "Race", id: r.id },
        ];
        this.rumourPosts.fake = this.say(
          this.social.anonymous[1] as number,
          `${who} is about to drop out of ${r.title}. Staff told last night, announcement within days.`,
          refs,
          "Open",
        );
        ms.targets.dropout = 0.3;
        listContract(
          ms,
          {
            kind: "Person",
            group: null,
            title: `${who} drops out of ${r.title} by 2 November`,
            rule: `Resolves Yes if ${who} publicly ends their campaign for ${r.title} on or before 2 November 2020. Resolves No at the end of that day otherwise. There are no refunds.`,
            subject: { kind: "Person", id: pol.dropout_person },
            listed: today,
            deadline: ymd(11, 2),
            fair: { kind: "Script", key: "dropout" },
            liquidity: 200,
          },
          0.3,
          t,
          "dropout",
        );
        this.dirty.add("markets");
        break;
      }
      case S.rumour_false_printed: {
        const r = pol.races[pol.dropout_race] as MockRace;
        const who = this.name(pol.dropout_person);
        const refs: EntityRef[] = [
          { kind: "Person", id: pol.dropout_person },
          { kind: "Race", id: r.id },
        ];
        this.fakeArticle = this.print(
          careless,
          STORY.rumour(`${who} is preparing to withdraw from ${r.title}`, refs),
          true,
        );
        ms.targets.dropout = 0.5;
        break;
      }
      case S.rumour_false_debunked: {
        const r = pol.races[pol.dropout_race] as MockRace;
        const who = this.name(pol.dropout_person);
        const refs: EntityRef[] = [
          { kind: "Person", id: pol.dropout_person },
          { kind: "Race", id: r.id },
        ];
        this.print(wire, STORY.debunked(who, "preparing to withdraw", refs));
        if (r.state !== null)
          this.print(regionalOf(this.feed, r.state), STORY.debunked(who, "preparing to withdraw", refs));
        this.say(
          this.social.of_person.get(pol.dropout_person) as number,
          `I am not going anywhere. See you at the polls. Whoever is selling this story, ask who paid for it.`,
          refs.slice(1),
        );
        correct(
          this.feed,
          this.fakeArticle,
          `${who} has denied this report on the record, and it has not been substantiated.`,
        );
        settleRumour(this.social, this.rumourPosts.fake, "Debunked");
        this.dirty.add("feed");
        this.dirty.add("social");
        ms.targets.dropout = 0.03;
        break;
      }
      case S.nomination: {
        const who = this.name(pol.nominee);
        const refs: EntityRef[] = [
          { kind: "Person", id: pol.president },
          { kind: "Person", id: pol.nominee },
        ];
        addAction(this.records, {
          date: today,
          kind: "Nomination",
          actor: pol.president,
          subject: pol.nominee,
          text: "Nominated to be Secretary of the Interior.",
          changes: [],
        });
        this.dirty.add("records");
        for (const o of coverage(this.feed, this.rng, null, 0.5))
          this.print(o, STORY.nomination(president, who, "Secretary of the Interior", refs));
        ms.targets.confirm = 0.6;
        listContract(
          ms,
          {
            kind: "Governing",
            group: null,
            title: `${who} is confirmed as Secretary of the Interior by 30 November`,
            rule: `Resolves Yes if the Senate confirms ${who} as Secretary of the Interior on or before 30 November 2020. Resolves No at the end of that day otherwise, including if the nomination is withdrawn. There are no refunds.`,
            subject: { kind: "Person", id: pol.nominee },
            listed: today,
            deadline: ymd(11, 30),
            fair: { kind: "Script", key: "confirm" },
            liquidity: 200,
            status: "Listed",
          },
          0.6,
          t,
          "confirm",
        );
        this.dirty.add("markets");
        break;
      }
      case S.confirm_opens:
        named("confirm").status = "Open";
        this.dirty.add("markets");
        break;
      case S.bill_senate_vote:
        this.vote(BILL.infrastructure, "Senate", "On cloture", "Cloture", true, 0.3);
        this.vote(BILL.infrastructure, "Senate", "On passage", "Majority", true, 0.7);
        setStage(this.records, BILL.infrastructure, "President", today);
        ms.targets.infra_law = 0.93;
        break;
      case S.bill_signed: {
        setStage(this.records, BILL.infrastructure, "Law", today, { year: 2021, month: 1, day: 1 });
        this.dirty.add("records");
        const b = bill(BILL.infrastructure);
        const refs: EntityRef[] = [
          { kind: "Bill", id: b.id },
          { kind: "Person", id: pol.president },
        ];
        for (const o of coverage(this.feed, this.rng, null, 0.6))
          this.print(o, STORY.signed(b.title, president, refs));
        this.resolve(named("infra_law"), true);
        break;
      }
      case S.dropout_deadline:
        this.resolve(named("dropout"), false);
        break;
      case S.election_day:
        this.print(wire, STORY.electionDay([{ kind: "Race", id: 0 }]));
        // The count's view exists from now, with nothing in it until the first polls close.
        this.dirty.add("returns");
        this.tell(
          "ElectionDay",
          "Election day. The first polls close at 19:00.",
          [{ kind: "Race", id: 0 }],
          true,
        );
        break;
      case S.bill_house_vote:
        this.vote(BILL.tax, "House", "On passage", "Majority", true, 0.5);
        setStage(this.records, BILL.tax, "SenateFloor", today);
        break;
      case S.senate_deadline:
        this.resolve(named("tax_senate"), false);
        break;
      case S.certification:
        this.certifyAll(false);
        break;
      case S.recount_done: {
        const r = pol.races[pol.recount_race] as MockRace;
        const refs: EntityRef[] = [
          { kind: "Race", id: r.id },
          { kind: "Person", id: ballotCandidate(r, r.winner_ballot).person },
        ];
        this.print(wire, {
          headline: `Recount in ${r.title} confirms ${this.name(refs[1]?.id as PersonId)} ahead`,
          body: `The recount in ${r.title} is complete. It moved a few dozen votes and left ${this.name(refs[1]?.id as PersonId)} ahead by ${Math.abs(r.final_margin).toFixed(2)} points. Certification follows tomorrow.`,
          refs,
        });
        for (const x of pol.races.filter(needsRecount))
          for (const c of this.raceContracts(x)) closeContract(c);
        this.cancelOrdersOnClosed();
        this.dirty.add("markets");
        break;
      }
      case S.recount_certification:
        this.certifyAll(true);
        break;
    }
  }

  /** The ordinary day: a rally story, an endorsement, a company story, a market story and a few posts. */
  private dailyContent(t: DateTime, hour: number): void {
    const rng = this.rng;
    if (t >= SCRIPT.election_day + 24 * 10 || hour < 9 || hour > 20) return;
    const density = t >= DENSE_FROM ? 1 : EARLY_DENSITY;
    const campaigning = t < SCRIPT.election_day;
    if (hour === 9 && campaigning && rng.chance(density)) {
      const st = rng.pick(this.geo.states);
      const races = this.pol.races.filter((r) => r.state === st.idx && r.office !== "House");
      const r = rng.pick(races);
      const c = ballotCandidate(r, rng.int(2));
      const county = this.geo.counties[rng.pick(st.counties)] as { id: number; name: string };
      this.print(
        regionalOf(this.feed, st.idx),
        STORY.rally(this.name(c.person), r.title, county.name, [
          { kind: "Person", id: c.person },
          { kind: "Race", id: r.id },
          { kind: "County", id: county.id },
        ]),
      );
    }
    if (hour === 12 && campaigning && rng.chance(0.35 * density)) {
      const r = rng.pick(this.pol.races.filter((x) => x.office === "Senate" || x.office === "Governor"));
      const c = ballotCandidate(r, rng.chance(0.5) ? r.dem : r.rep);
      const backers = this.pol.senators.filter((s) => s.party === c.party && s.person !== c.person);
      if (backers.length > 0 && r.state !== null) {
        const who = rng.pick(backers).person;
        this.print(
          regionalOf(this.feed, r.state),
          STORY.endorsement(`Senator ${this.name(who)}`, this.name(c.person), r.title, [
            { kind: "Person", id: who },
            { kind: "Person", id: c.person },
            { kind: "Race", id: r.id },
          ]),
        );
      }
    }
    if (hour === 16 && rng.chance(0.3 * density)) {
      const top = this.hooks.largest();
      if (top.length > 0) {
        const id = top[rng.int(Math.min(30, top.length))] as CompanyId;
        const c = this.base.companies[id] as { name: string; industry: number };
        const industry = this.base.data.industries.rows[c.industry]?.name ?? "sector";
        this.print(
          this.feed.outlets[3] as MockOutlet,
          STORY.company(c.name, industry, rng.chance(0.5), [
            { kind: "Company", id },
            { kind: "Industry", id: c.industry },
          ]),
        );
      }
    }
    if (hour === 17 && rng.chance(0.3 * density)) {
      // The day's biggest mover on the exchange.
      let best: MockContract | null = null;
      let move = 3;
      for (const c of this.markets.contracts) {
        const n = c.history.length;
        if (c.status !== "Open" || n < 25) continue;
        const d = Math.abs((c.history[n - 1] as number) - (c.history[n - 25] as number));
        if (d > move) {
          move = d;
          best = c;
        }
      }
      if (best !== null) {
        const n = best.history.length;
        this.print(
          this.feed.outlets[OUTLET.wire] as MockOutlet,
          STORY.market(best.title, best.history[n - 25] as number, best.history[n - 1] as number, [
            { kind: "Contract", id: best.id },
          ]),
        );
      }
    }
    if (hour === 18 && campaigning && rng.chance(density)) {
      const people = [...this.social.of_person.keys()];
      const who = rng.pick(people);
      const r = this.pol.races.find((x) =>
        x.ballot.some((i) => (x.candidates[i] as { person: number }).person === who),
      );
      if (r !== undefined) {
        const st = r.state === null ? rng.pick(this.geo.states) : (this.geo.states[r.state] as MockState);
        const county = this.geo.counties[rng.pick(st.counties)] as { id: number; name: string };
        this.say(this.social.of_person.get(who) as number, candidateLine(rng, r.title, county.name), [
          { kind: "Race", id: r.id },
          { kind: "County", id: county.id },
        ]);
      }
    }
    if (hour === 20 && rng.chance(0.4 * density)) {
      const pres = this.pol.races[0] as MockRace;
      const dem = this.live.pres_dem;
      const lead = ballotCandidate(pres, dem >= 0.5 ? pres.dem : pres.rep);
      this.say(
        rng.pick(this.social.pundits),
        punditLine(
          rng,
          `${this.name(lead.person)} is the favourite at ${round(Math.max(dem, 1 - dem) * 100)} cents`,
        ),
        [
          { kind: "Person", id: lead.person },
          { kind: "Race", id: pres.id },
        ],
      );
    }
  }

  // ---------------------------------------------------------------- the player

  /** The player's price alerts (pivot 14.4): each fires once as its price crosses. */
  private priceAlerts(): void {
    for (const r of this.account.rules) {
      const w = r.rule.when;
      if (w.kind === "Any") continue;
      const target = r.rule.target;
      const price =
        target.kind === "Contract"
          ? this.mark(target.id as InstrumentId)
          : (this.hooks.stockPrice(target.id as CompanyId) ?? 0);
      const hit = w.kind === "PriceAbove" ? price > w.price : price < w.price;
      if (hit && r.armed) {
        const what =
          target.kind === "Contract"
            ? `"${(this.markets.contracts[target.id] as MockContract).title}"`
            : (this.base.companies[target.id] as { name: string }).name;
        this.tell(
          "Alert",
          `${what} is ${w.kind === "PriceAbove" ? "above" : "below"} ${w.price}: now ${Math.floor(price * 100 + 0.5) / 100}.`,
          [target],
          r.rule.pause,
          r.id,
        );
      }
      r.armed = !hit;
    }
  }

  private fillNote(o: OrderRow, qty: number, value: number): void {
    const what =
      o.what.kind === "Contract"
        ? `"${(this.markets.contracts[o.what.id] as MockContract).title}"`
        : (this.base.companies[o.what.id] as { name: string }).name;
    const unit =
      o.venue === "Exchange" ? `${Math.floor((value / qty) * 10 + 0.5) / 10}c` : cents(value / qty);
    this.tell("Fill", `${o.side === "Buy" ? "Bought" : "Sold"} ${qty} ${what} at ${unit}.`, [o.what], true);
    this.dirty.add("account");
    this.dirty.add("markets");
  }

  /** Fills an exchange order against the book; returns the contracts filled. */
  private take(o: OrderRow, c: MockContract): number {
    const fills = takeLiquidity(c, o.side, o.qty - o.filled, o.limit);
    let order = o;
    let qty = 0;
    let value = 0;
    for (const f of fills) {
      order = fillContract(this.account, order, this.now, f.qty, f.price);
      qty += f.qty;
      value += f.qty * f.price;
    }
    if (qty > 0) this.fillNote(o, qty, value);
    return qty;
  }

  /** The player's resting orders meet the hour's book (pivot 11.1). */
  private matchResting(t: DateTime): void {
    for (const o of this.account.orders.slice()) {
      if (o.status !== "Open" || o.venue !== "Exchange" || o.limit === null) continue;
      const c = this.markets.contracts[o.instrument] as MockContract;
      if (c.status !== "Open") continue;
      const buy = o.side === "Buy";
      const touch = buy ? c.ask : c.bid;
      const best = buy ? c.bid : c.ask;
      if (touch !== null && (buy ? o.limit >= touch : o.limit <= touch)) {
        this.take(o, c);
        continue;
      }
      // Not marketable: someone may still hit it, more often when it is the best price.
      const inside = best === null || (buy ? o.limit > best : o.limit < best);
      const luck = unitHash(`o${o.id}`, t);
      const left = o.qty - o.filled;
      const qty =
        inside && luck < FILL_CHANCE_INSIDE
          ? left
          : o.limit === best && luck < FILL_CHANCE_AT_BEST
            ? Math.min(left, Math.ceil(c.liquidity / 4))
            : 0;
      if (qty === 0) continue;
      fillContract(this.account, o, t, qty, o.limit);
      c.last = o.limit;
      c.volume += qty;
      this.fillNote(o, qty, qty * o.limit);
    }
  }

  /**
   * A player action (types/action.ts), applied at once between ticks. Returns the error, or null
   * when it was applied; an applied action is recorded for replay (pivot 16.1).
   */
  act(action: PlayerAction): ActError | null {
    const err = this.apply(action);
    if (err === null) this.recorded.push({ at: this.now, action });
    return err;
  }

  private apply(action: PlayerAction): ActError | null {
    const a = this.account;
    const invalid = (message: string): ActError => ({ kind: "Invalid", message });
    const rejected = (message: string): ActError => ({ kind: "Rejected", message });
    if (!a.open) return rejected("the player has no account yet");
    switch (action.kind) {
      case "PlaceOrder": {
        const { venue, instrument, side, qty, limit, tif } = action;
        if (!Number.isInteger(qty) || qty <= 0)
          return invalid("an order's quantity is a whole number above 0");
        if (venue === "Exchange") {
          const c = instrument < STOCK_INSTRUMENT_BASE ? this.markets.contracts[instrument] : undefined;
          if (c === undefined) return invalid(`no contract has instrument ${instrument}`);
          if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 99))
            return invalid("a contract's limit price is a whole number of cents, 1 to 99");
          if (c.status !== "Open")
            return rejected(
              c.status === "Listed" ? "this market has not opened yet" : "this market is closed",
            );
          const held = positionOf(a, instrument)?.qty ?? 0;
          const worst =
            limit ??
            (side === "Buy"
              ? Math.min(99, (c.ask ?? 99) + BOOK_LEVELS)
              : Math.max(1, (c.bid ?? 1) - BOOK_LEVELS));
          const need = contractCost(held, side, qty, worst);
          const free = a.cash.Exchange - reserved(a);
          if (need > free + 1e-9)
            return rejected(
              `not enough cash at the exchange: the order needs ${cents(need)} and ${cents(Math.max(0, free))} is free`,
            );
          const o = newOrder(a, this.now, venue, instrument, side, qty, limit, tif);
          const filled = this.take(o, c);
          // A market order does not rest: what the book could not fill is cancelled.
          if (limit === null && filled < qty) closeOrder(a, o.id, "Cancelled");
          this.dirty.add("account");
          this.dirty.add("markets");
          return null;
        }
        const company = (instrument - STOCK_INSTRUMENT_BASE) as CompanyId;
        const quote = instrument >= STOCK_INSTRUMENT_BASE ? this.hooks.stockPrice(company) : null;
        if (quote === null) return invalid(`no listed stock has instrument ${instrument}`);
        // pivot 13.1: the brokerage fills at the hourly price plus the spread, long only.
        const price = quote * (side === "Buy" ? 1 + STOCK_SPREAD : 1 - STOCK_SPREAD);
        if (limit !== null && (side === "Buy" ? limit < price : limit > price)) {
          return rejected(
            `the brokerage fills at once at the hourly price (${cents(price)}): a limit order must be marketable`,
          );
        }
        const held = positionOf(a, instrument)?.qty ?? 0;
        if (side === "Sell" && qty > held)
          return rejected("the brokerage is long only: you cannot sell more shares than you hold");
        if (side === "Buy") {
          if (qty * price + STOCK_COMMISSION > a.cash.Brokerage + 1e-9)
            return rejected(
              `not enough cash at the brokerage: the order needs ${cents(qty * price + STOCK_COMMISSION)}`,
            );
          if (held + qty > PLAYER_MAX_STAKE * this.hooks.shares(company))
            return rejected(`over the ${PLAYER_MAX_STAKE * 100}% limit on any one company's shares`);
        }
        const o = newOrder(a, this.now, venue, instrument, side, qty, limit, tif);
        fillStock(a, o, this.now, price);
        this.fillNote(o, qty, qty * price);
        return null;
      }
      case "CancelOrder": {
        const o = a.orders.find((x) => x.id === action.order);
        if (o === undefined) return invalid(`no order ${action.order}`);
        if (o.status !== "Open") return rejected("that order is no longer open");
        closeOrder(a, o.id, "Cancelled");
        this.dirty.add("account");
        this.dirty.add("markets");
        return null;
      }
      case "Transfer": {
        const { from, to, amount } = action;
        if (from === to) return invalid("a transfer moves cash between two different accounts");
        if (!(amount > 0) || !Number.isFinite(amount)) return invalid("a transfer's amount is above 0");
        const free = a.cash[from] - (from === "Exchange" ? reserved(a) : 0);
        if (amount > free + 1e-9)
          return rejected(`not enough free cash at the ${from.toLowerCase()}: ${cents(Math.max(0, free))}`);
        a.cash[from] -= amount;
        a.cash[to] += amount;
        this.dirty.add("account");
        return null;
      }
      case "Follow":
      case "Unfollow": {
        if (!this.exists(action.target))
          return invalid(`nothing to follow: ${action.target.kind} ${action.target.id}`);
        const i = a.follows.findIndex((f) => sameRef(f, action.target));
        if (action.kind === "Follow" && i < 0)
          a.follows.push({ kind: action.target.kind, id: action.target.id });
        if (action.kind === "Unfollow" && i >= 0) a.follows.splice(i, 1);
        this.dirty.add("account");
        if (action.target.kind === "Handle") this.dirty.add("social");
        return null;
      }
      case "AlertRuleAdd": {
        const { rule } = action;
        if (!this.exists(rule.target))
          return invalid(`nothing to watch: ${rule.target.kind} ${rule.target.id}`);
        if (rule.when.kind !== "Any") {
          if (rule.target.kind !== "Contract" && rule.target.kind !== "Company")
            return invalid("a price alert is for a contract or a company");
          if (!(rule.when.price > 0)) return invalid("a price alert's price is above 0");
        }
        a.rules.push({ id: a.next_rule++, rule, armed: true });
        this.dirty.add("account");
        return null;
      }
      case "AlertRuleRemove": {
        const i = a.rules.findIndex((r) => r.id === action.rule);
        if (i < 0) return invalid(`no alert rule ${action.rule}`);
        a.rules.splice(i, 1);
        this.dirty.add("account");
        return null;
      }
    }
  }
}
