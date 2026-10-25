// The mock sim: a stand-in for packages/sim until the real one is wired in (Step 3). It keeps a
// clock, the controls (spec 9.1), a random-walk market and a typed `SimViews`, and runs ticks at
// D8's speeds. It has no timers and reads no wall clock: the host tells it how many real
// milliseconds passed (`advance`), so pacing is testable.

import {
  ALERT_KIND_DEFAULT_LEVEL,
  ALERT_KIND_VALUES,
  type AlertKind,
  type AlertLevel,
  barRows,
  type ClockView,
  type DateTime,
  dateTimeHour,
  type Headline,
  lockTick,
  MAX_SPEED,
  type Notice,
  postedViewsNone,
  type Quarter,
  type Reply,
  recapTick,
  releaseTick,
  SECONDS_PER_HOUR,
  type SimDate,
  type SimViews,
  type Skip,
  simDateIsQuarterFirstMonth,
  skipTarget,
  type UiControl,
  type ViewName,
  type ViewsPatch,
} from "@tc20ff/sim";
import {
  barHistory,
  clockView,
  closeDay,
  companyRowsView,
  INDEX_START,
  industryRowsView,
  initialStocks,
  initialViews,
  MOCK_BAR_COMPANIES,
  MockRng,
  type MockStock,
  mockHeadline,
  quotesView,
  stepStocks,
} from "./mockViews.ts";
import type { MockWorld } from "./mockWorld.ts";

/** Ticks one `advance` call may run at speed 5 ("as many as fit in a frame budget", protocol.ts). */
export const MAX_TICKS_PER_ADVANCE = 48;
/** Ticks one `advance` may run at speeds 1 to 4, so a stalled tab does not spiral on resume. */
export const CATCH_UP_TICKS = 8;

/** The calendar quarter a date falls in. */
function quarterOf(d: SimDate): Quarter {
  return { year: d.year, q: Math.floor((d.month - 1) / 3) + 1 };
}
function quarterBefore(q: Quarter): Quarter {
  return q.q === 1 ? { year: q.year - 1, q: 4 } : { year: q.year, q: q.q - 1 };
}

export interface MockSave {
  mock: 1;
  seed: number;
  now: DateTime;
  speed: number;
  alerts: AlertLevel[];
}

/**
 * The views the mock fills; the others stay placeholders and are never posted (views/patch.ts), as
 * with the real sim until each view is ported.
 */
const MOCK_VIEWS: readonly ViewName[] = [
  "clock",
  "places",
  "countries",
  "quotes",
  "price_bars",
  "company_rows",
  "industry_rows",
  "news",
];

export class MockSim {
  readonly seed: number;
  now: DateTime = 0;
  speed = 1;
  paused = true;
  skip: Skip | null = null;
  alerts: AlertLevel[] = ALERT_KIND_VALUES.map((k) => ALERT_KIND_DEFAULT_LEVEL[k]);
  views: SimViews;
  /** What the last frame posted (views/patch.ts), so each patch carries only what moved. */
  private readonly posted = postedViewsNone();
  private readonly stocks: MockStock[];
  private readonly indexLevels: number[];
  private readonly rng: MockRng;
  private carryMs = 0;

  constructor(
    readonly world: MockWorld,
    seed: number,
    start?: Pick<MockSave, "now" | "speed" | "alerts">,
  ) {
    this.seed = seed;
    this.rng = new MockRng(seed);
    if (start) {
      this.now = start.now;
      this.speed = start.speed;
      this.alerts = start.alerts.slice();
    }
    this.stocks = initialStocks(world);
    this.indexLevels = world.data.financial_zones.rows.map(() => INDEX_START);
    this.views = initialViews(world, this.stocks, this.rng, this.clock(), this.indexLevels);
  }

  /** Rust `controlsEffectiveSpeed`: 0 paused, max while skipping. */
  effectiveSpeed(): number {
    if (this.paused) return 0;
    return this.skip !== null ? MAX_SPEED : this.speed;
  }

  clock(): ClockView {
    return clockView(this.now, this.effectiveSpeed(), this.speed, this.paused, this.skip?.kind ?? null);
  }

  /** The views whose version moved since the last `takePatch` (the protocol's Frame views). */
  takePatch(): ViewsPatch {
    // The semantics of views/patch.ts `viewsPatchSince`, over the views the mock fills (its builders
    // are not on the public face): only moved views, news as an append, `news_reset` on the first
    // patch of a game (a new MockSim is a new game or a load).
    const posted = this.posted;
    const patch: ViewsPatch = {};
    if (this.views.refresh !== posted.refresh) {
      patch.refresh = this.views.refresh;
      posted.refresh = this.views.refresh;
    }
    if (this.views.omniscient !== posted.omniscient) {
      patch.omniscient = this.views.omniscient;
      posted.omniscient = this.views.omniscient;
    }
    for (const name of MOCK_VIEWS) {
      if (name === "news") continue;
      const v = this.views[name];
      if (v.version === posted.versions[name]) continue;
      posted.versions[name] = v.version;
      this.take(patch, name);
    }
    const feed = this.views.news.data.feed;
    const reset = posted.news_len < 0 || feed.length < posted.news_len;
    const from = reset ? 0 : posted.news_len;
    if (reset || feed.length > from) {
      patch.news_appended = feed.slice(from);
      if (reset) patch.news_reset = true;
      posted.news_len = feed.length;
      patch.news_version = this.views.news.version;
      posted.versions.news = this.views.news.version;
    }
    return patch;
  }

  private take<K extends Exclude<ViewName, "news">>(patch: ViewsPatch, name: K): void {
    patch[name] = this.views[name];
  }

  /** True when a patch would be non-empty. */
  hasPatch(): boolean {
    return this.views.refresh !== this.posted.refresh;
  }

  /**
   * Runs the ticks `dtMs` of real time buys at the effective speed: one game hour per
   * SECONDS_PER_HOUR seconds at speeds 1 to 4, MAX_TICKS_PER_ADVANCE at speed 5 (spec 9.1, D8).
   * Stops early when a pause lands.
   */
  advance(dtMs: number): Notice[] {
    const speed = this.effectiveSpeed();
    if (speed === 0) {
      this.carryMs = 0;
      return [];
    }
    const sph = SECONDS_PER_HOUR[speed - 1] ?? null;
    let n: number;
    if (sph === null) {
      n = MAX_TICKS_PER_ADVANCE;
    } else {
      this.carryMs += dtMs;
      n = Math.min(CATCH_UP_TICKS, Math.floor(this.carryMs / (sph * 1000)));
      this.carryMs = n === CATCH_UP_TICKS ? 0 : this.carryMs - n * sph * 1000;
    }
    const notices: Notice[] = [];
    for (let i = 0; i < n && !this.paused; i++) notices.push(...this.step());
    return notices;
  }

  /** One tick (one game hour), returning its notices; the last is TickDone. */
  step(): Notice[] {
    const notices: Notice[] = [];
    this.now += 1;
    const refresh = this.views.refresh + 1;
    this.views.refresh = refresh;
    const t = this.now;
    const date = this.clock().date;
    const hour = this.clock().hour;
    stepStocks(this.stocks, this.rng, this.world);
    this.rebuildIndices();
    this.views.quotes = {
      data: quotesView(this.stocks, this.world, this.indexLevels),
      version: refresh,
      dirty: true,
    };

    if (hour === 0) {
      const yesterday = this.previousDay(t);
      notices.push({ kind: "DayDone", date: yesterday });
      this.dailyViews(yesterday, refresh);
      if (date.day === 1) {
        notices.push({ kind: "MonthDone", month: { year: yesterday.year, month: yesterday.month } });
        this.views.company_rows = {
          data: { rows: companyRowsView(this.world, this.stocks) },
          version: refresh,
          dirty: true,
        };
        this.views.industry_rows = {
          data: { rows: industryRowsView(this.world, t) },
          version: refresh,
          dirty: true,
        };
      }
    }
    const q = quarterOf(date);
    if (releaseTick(q) === t) {
      notices.push({ kind: "EarningsReleased", quarter: quarterBefore(quarterOf(date)) });
      this.alert(notices, "EarningsDay", { kind: "Quarter", quarter: quarterBefore(quarterOf(date)) });
    }
    if (lockTick(q) === t) {
      notices.push({ kind: "PlanLocked", quarter: quarterOf(date) });
      this.alert(notices, "PlanLock", { kind: "Quarter", quarter: quarterOf(date) });
    }
    if (recapTick(q) === t)
      this.alert(notices, "QuarterlyRecap", { kind: "Quarter", quarter: quarterOf(date) });
    if (dateTimeHour(t) === 0 && date.day === 1 && simDateIsQuarterFirstMonth(date))
      this.alert(notices, "QuarterStart", { kind: "Quarter", quarter: quarterOf(date) });

    if (this.skip !== null && t >= this.skip.target) {
      const kind = this.skip.kind;
      this.skip = null;
      this.paused = true;
      notices.push({ kind: "Paused", reason: { kind: "SkipDone", skip: kind } });
    }
    this.views.clock = { data: this.clock(), version: refresh, dirty: true };
    notices.push({ kind: "TickDone", time: t });
    return notices;
  }

  /** Applies a UI control at once (D5), as `Sim::apply`. */
  apply(c: UiControl): Reply {
    const notices: Notice[] = [];
    switch (c.kind) {
      case "SetSpeed":
        if (!Number.isInteger(c.speed) || c.speed < 0 || c.speed > MAX_SPEED) {
          return { kind: "SimError", error: { kind: "BadSpeed", speed: c.speed } };
        }
        if (c.speed === 0) {
          this.paused = true;
          notices.push({ kind: "Paused", reason: { kind: "Player" } });
        } else {
          this.speed = c.speed;
          this.paused = false;
        }
        break;
      case "Pause":
        this.paused = true;
        notices.push({ kind: "Paused", reason: { kind: "Player" } });
        break;
      case "Resume":
        this.paused = false;
        break;
      case "SkipTo":
        this.skip = { kind: c.skip, target: skipTarget(this.now, c.skip) };
        this.paused = false;
        break;
      case "SetAlert":
        this.alerts[ALERT_KIND_VALUES.indexOf(c.alert_kind)] = c.level;
        break;
      case "SetOmniscient":
        // Debug builds only (design fix 8); the mock is a release build.
        return { kind: "SimError", error: { kind: "DebugOnly" } };
      case "WatchlistAdd":
        if (c.company >= this.world.companies.length) {
          return { kind: "SimError", error: { kind: "UnknownCompany", company: c.company } };
        }
        break;
      case "WatchlistRemove":
        break;
    }
    // A control rebuilds the on_control views (clock; spec 9.4).
    const refresh = this.views.refresh + 1;
    this.views.refresh = refresh;
    this.views.clock = { data: this.clock(), version: refresh, dirty: true };
    return { kind: "Ok", notices };
  }

  save(): MockSave {
    return { mock: 1, seed: this.seed, now: this.now, speed: this.speed, alerts: this.alerts.slice() };
  }

  private alert(
    out: Notice[],
    kind: AlertKind,
    payload: Extract<Notice, { kind: "Alert" }>["payload"],
  ): void {
    const level = this.alerts[ALERT_KIND_VALUES.indexOf(kind)];
    if (level === undefined || level === "Off") return;
    out.push({ kind: "Alert", alert_kind: kind, level, payload });
    if (level === "Pause") {
      this.paused = true;
      out.push({ kind: "Paused", reason: { kind: "Alert", alert_kind: kind } });
    }
  }

  private previousDay(t: DateTime): SimDate {
    return this.dateOf(t - 1);
  }

  private dateOf(t: DateTime): SimDate {
    return clockView(t, 0, 1, true, null).date;
  }

  private rebuildIndices(): void {
    const sums = new Map<number, [number, number]>();
    for (const s of this.stocks) {
      const e = sums.get(s.exchange) ?? [0, 0];
      e[0] += s.price / (s.prevClose || 1);
      e[1] += 1;
      sums.set(s.exchange, e);
    }
    for (const [zone, [sum, n]] of sums) this.indexLevels[zone] = (INDEX_START * sum) / n;
  }

  /** The Daily views (spec 9.4): price bars and news. */
  private dailyViews(day: SimDate, refresh: number): void {
    const bars = closeDay(this.stocks, day);
    const prev = this.views.price_bars.data.companies;
    const keep = prev.length > 0 ? prev : [];
    this.views.price_bars = {
      data: {
        companies: keep.map((h) => {
          const bar = bars.get(h.id);
          const old = barRows(h.bars);
          return { id: h.id, bars: barHistory(bar ? [...old, bar] : old) };
        }),
      },
      version: refresh,
      dirty: true,
    };
    const feed = this.views.news.data.feed;
    const fresh: Headline[] = [];
    // Two or three stories a day (spec 5.18 volume is not modelled).
    const count = 1 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < count; i++) fresh.push(mockHeadline(this.world, this.rng, feed.length + i, day));
    this.views.news = { data: { feed: [...feed, ...fresh] }, version: refresh, dirty: true };
  }
}

export { MOCK_BAR_COMPANIES };
