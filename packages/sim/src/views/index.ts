// `SimViews`: the read-only query tables the UI reads (spec 9, 9.2, 9.4; build-plan M1.6, M7.3).
// Ported from the framework half of crates/sim/src/views/mod.rs; the types are in
// types/views/index.ts (with `VIEW_NAMES`, the `sim_views!` order, and `VIEW_SPECS`, each view's
// `ViewData` constants).
//
// The sim builds every view after each tick on the spec 9.4 cadence and hands out `SimViews`
// (`Sim.views()`); the worker posts the views whose version moved (`viewsPatchSince`). UI code
// never touches sim tables (spec 9). Each view carries a version (the refresh it was last rebuilt
// in) and a dirty flag (rebuilt in the latest refresh), so a reader copies only what changed.
//
// **One builder per view.** `VIEW_BUILDERS` below has one slot per view, in the `sim_views!`
// order: a builder ports its view in its own file (views/<name>.ts, Step 3) and sets `build` (and,
// for a `rebuild_in_place` view, `rebuildFrom`) on its line. Until then the slot's `build` is null
// and the view is **unported**: it holds its typed `empty()` value from the first build, a tick or
// a control never rebuilds it (its data and version stay; its dirty flag is false after the next
// tick), and only a new game or a load builds it again (all views rebuild then, at the next
// refresh number, as in Rust). So an unported view never crashes a step and never posts twice.
//
// Differences from Rust:
// - Rust shares each view's data behind an `Arc` (D775) and rebuilds the `REBUILD_IN_PLACE` views
//   in place when no reader holds the last build. Here a reader may always hold a build (a test
//   keeping `views()`, a `copyChangedFrom` copy), so **a build is never mutated once made**: each
//   rebuild makes new data (a `rebuildFrom(prev, input)` may read `prev`, D435, but not change
//   it), and view wrappers are copied, not shared, between `SimViews` values.
// - Rust builds a month's or a quarter's views on worker threads (D801, `Jobs`, `VIEW_WORKERS`).
//   Each view is a pure function of the state built into its own field, so building them one
//   after another in `VIEW_NAMES` order gives the same views; there are no threads here.
// - `ViewInput::estimator` (D420) belongs to views/estimate (Step 3) and is not here.
// - `SimViews::get_map_layer` (D700) needs the map layers view's `layer` (Step 3); only
//   `map_layer_versions` is here.

import type { MapData } from "../map.ts";
import {
  type TickFacts,
  type TickObserver,
  tickFactsIsLockTick,
  tickFactsIsMidnight,
  tickFactsIsMonthStart,
  tickFactsIsPriceMoveTick,
  tickFactsIsQuarterStart,
  tickFactsIsRecapTick,
  tickFactsIsReleaseTick,
  tickFactsNew,
} from "../time/scheduler.ts";
import type { Controls } from "../types/control.ts";
import {
  type Cadence,
  type ClockView,
  type SimViews,
  VIEW_NAMES,
  VIEW_SPECS,
  type View,
  type ViewName,
} from "../types/views/index.ts";
import type { MapMode } from "../types/views/map_layers.ts";
import type { World } from "../types/world.ts";
import { buildCapTable } from "./cap_table.ts";
import { buildCharacters } from "./characters.ts";
import { buildClock, emptyClock } from "./clock.ts";
import { buildCompanyDetail } from "./company_detail.ts";
import { buildCompanyRows } from "./company_rows.ts";
import { buildCountries } from "./countries.ts";
import { buildCycle } from "./cycle.ts";
import { buildExchanges } from "./exchanges.ts";
import { buildFilings } from "./filings.ts";
import { buildMapStatic } from "./map_static.ts";
import { buildMarketStats } from "./market_stats.ts";
import { buildNews } from "./news.ts";
import { buildPlaces } from "./places.ts";
import { buildPriceBars } from "./price_bars.ts";
import { buildProvinceCards } from "./province_cards.ts";
import { buildRates } from "./rates.ts";
import { buildRatings } from "./ratings.ts";
import { buildStatements, rebuildStatementsFrom } from "./statements.ts";
import { buildZones } from "./zones.ts";

// ---------------------------------------------------------------- Cadence

/**
 * A month's or a quarter's cadence: rebuilt on a few costly ticks (Rust built these on worker
 * threads, D801); every-tick and daily views are cheap.
 */
export function cadenceIsPeriodic(c: Cadence): boolean {
  return c === "Monthly" || c === "MonthlyAndLock" || c === "Quarterly";
}

/** Whether a view of this cadence is rebuilt after the tick `f` (spec 9.4). */
export function cadenceIsDue(c: Cadence, f: TickFacts): boolean {
  switch (c) {
    case "EveryTick":
      return true;
    case "Daily":
      return tickFactsIsMidnight(f);
    case "Monthly":
      return tickFactsIsMonthStart(f);
    case "MonthlyAndLock":
      return tickFactsIsMonthStart(f) || tickFactsIsLockTick(f);
    case "Quarterly":
      return (
        tickFactsIsQuarterStart(f) ||
        tickFactsIsReleaseTick(f) ||
        tickFactsIsPriceMoveTick(f) ||
        tickFactsIsLockTick(f) ||
        tickFactsIsRecapTick(f)
      );
    case "OnceAtLoad":
      return false;
  }
}

// ---------------------------------------------------------------- ViewInput and builders

// The static map data the map views read (M8; Rust `crate::map::MapData`, ../map.ts): built from
// the loaded data next to the World, never saved or hashed (lib.ts `SimDeps.mapDataBuild`).
export type { MapData };

/**
 * What a view is built from: the state after the latest tick and the controls. Views read; they
 * never change anything.
 */
export interface ViewInput {
  readonly world: World;
  readonly controls: Controls;
  /** The game seed: the estimate bands hash it (D421). Views never see the RNG streams. */
  readonly seed: number;
  /** The static map data (M8). Not world state: never saved or hashed. */
  readonly map: MapData;
}

/** One view's slot: how to build it (Rust `impl ViewData`), or null while it is not ported. */
export interface ViewBuilder<T> {
  /** The Rust type it ports, for messages. */
  readonly rust: string;
  /** A typed empty value: an unported view's data (never read by a ported one). */
  empty(): T;
  /** Rust `ViewData::build`; null until Step 3 ports the view. Must not keep or change `input`. */
  readonly build: ((input: ViewInput) => T) | null;
  /**
   * Rust `ViewData::rebuild_from` for a `rebuild_in_place` view (D402, D435): a rebuild that may
   * read the last build `prev` but never changes it; the result must equal `build`'s. Omitted:
   * the view is built anew.
   */
  readonly rebuildFrom?: ((prev: T, input: ViewInput) => T) | null;
}

/** Every view's builder slot. */
export type ViewBuilders = { readonly [N in ViewName]: ViewBuilder<SimViews[N]["data"]> };

function unported<T>(rust: string, empty: () => NoInfer<T>): ViewBuilder<T> {
  return { rust, empty, build: null };
}

/**
 * Every view's builder, in the `sim_views!` order. Step 3 swaps each `unported(...)` for the
 * ported view's slot (`{ rust, empty, build: buildPlaces }`), on the same line.
 */
export const VIEW_BUILDERS: ViewBuilders = {
  clock: { rust: "views::clock::ClockView", empty: emptyClock, build: buildClock },
  places: {
    rust: "views::places::PlacesView",
    empty: () => ({ provinces: [], countries: [] }),
    build: buildPlaces,
  },
  countries: {
    rust: "views::countries::CountriesView",
    empty: () => ({ countries: [] }),
    build: buildCountries,
  },
  zones: { rust: "views::zones::ZonesView", empty: () => ({ zones: [] }), build: buildZones },
  rates: {
    rust: "views::rates::RatesView",
    empty: () => ({
      base_rate: 0,
      zones: [],
      sovereigns: [],
      rating_spreads: [],
    }),
    build: buildRates,
  },
  characters: {
    rust: "views::characters::CharactersView",
    empty: () => ({ full: [], partial: [] }),
    build: buildCharacters,
  },
  cap_table: {
    rust: "views::cap_table::CapTableView",
    empty: () => ({ companies: [] }),
    build: buildCapTable,
  },
  quotes: unported("views::quotes::QuotesView", () => ({ rows: [], indices: [] })),
  price_bars: {
    rust: "views::price_bars::PriceBarsView",
    empty: () => ({ companies: [] }),
    build: buildPriceBars,
  },
  exchanges: {
    rust: "views::exchanges::ExchangesView",
    empty: () => ({ exchanges: [] }),
    build: buildExchanges,
  },
  market_stats: {
    rust: "views::market_stats::MarketStatsView",
    empty: () => ({
      listed: 0,
      quoted: 0,
      median_gap: 0,
      within_band: 0,
      mean_confidence: 0,
      reports: 0,
      beats: 0,
      misses: 0,
    }),
    build: buildMarketStats,
  },
  news: { rust: "views::news::NewsView", empty: () => ({ feed: [] }), build: buildNews },
  births: unported("views::births::BirthsView", () => ({
    events: [],
    births: [],
    listings: [],
    full_characters_made: 0,
    full_characters: 0,
    births_column_quarters: [],
    births_by_industry: [],
  })),
  projection: unported("views::projection::ProjectionView", () => ({ elapsed_share: 0, companies: [] })),
  company_rows: {
    rust: "views::company_rows::CompanyRowsView",
    empty: () => ({ rows: [] }),
    build: buildCompanyRows,
  },
  company_detail: {
    rust: "views::company_detail::CompanyDetailView",
    empty: () => ({ companies: [] }),
    build: buildCompanyDetail,
  },
  units: unported("views::units::UnitsView", () => ({ units: [] })),
  tech: unported("views::tech::TechView", () => ({ companies: [] })),
  industry_rows: unported("views::industry_rows::IndustryRowsView", () => ({ rows: [] })),
  industry_detail: unported("views::industry_detail::IndustryDetailView", () => ({ industries: [] })),
  cycle: {
    rust: "views::cycle::CycleView",
    empty: () => ({
      phase: "Expansion",
      g_t: 0,
      quarters_left: 0,
      z_avg: 0,
      base_rate: 0,
      zones: [],
      ai_stage: "Preboom",
      boom_year: null,
      boom_date: { year: 2020, month: 1, day: 1 },
      ai_labs_lt: 0,
      pop_date: null,
    }),
    build: buildCycle,
  },
  map_layers: unported("views::map_layers::MapLayersView", () => ({
    political: { country: [], contested: [] },
    country_names: [],
    tracks: [],
    zone: [],
    unit_assets: [],
    hqs: [],
    sectors: [],
    industry_names: [],
  })),
  province_cards: {
    rust: "views::province_cards::ProvinceCardsView",
    empty: () => ({ cards: [] }),
    build: buildProvinceCards,
  },
  statements: {
    rust: "views::statements::StatementsView",
    empty: () => ({ companies: [] }),
    build: buildStatements,
    rebuildFrom: rebuildStatementsFrom,
  },
  filings: {
    rust: "views::filings::FilingsView",
    empty: () => ({ quarter: null, filings: [] }),
    build: buildFilings,
  },
  ratings: {
    rust: "views::ratings::RatingsView",
    empty: () => ({ companies: [], base_rate: 0 }),
    build: buildRatings,
  },
  recap: unported("views::recap::RecapView", () => ({ recaps: [], watchlist: [] })),
  map_static: {
    rust: "views::map_static::MapStaticView",
    empty: () => ({
      provinces: [],
      metros: [],
      key_cities: [],
      regions: [],
      geo: null,
    }),
    build: buildMapStatic,
  },
};

/**
 * `builders` with every view outside `keep` unported (its empty value, never rebuilt): for a Sim
 * on a test world that holds too little for the other builders.
 */
export function viewBuildersOnly(
  keep: readonly ViewName[],
  builders: ViewBuilders = VIEW_BUILDERS,
): ViewBuilders {
  const out: Record<string, ViewBuilder<unknown>> = {};
  for (const n of VIEW_NAMES) {
    const b = builders[n] as ViewBuilder<unknown>;
    out[n] = keep.includes(n) ? b : unported(b.rust, b.empty);
  }
  return out as unknown as ViewBuilders;
}

/** Whether view `name` has a ported builder. */
export function viewIsPorted(name: ViewName, builders: ViewBuilders = VIEW_BUILDERS): boolean {
  return builders[name].build !== null;
}

// ---------------------------------------------------------------- one view

type AnyView = View<unknown>;
type AnyBuilder = ViewBuilder<unknown>;

function viewOf(views: SimViews, name: ViewName): AnyView {
  return views[name] as AnyView;
}

function setView(views: SimViews, name: ViewName, v: AnyView): void {
  (views as unknown as Record<ViewName, AnyView>)[name] = v;
}

function builderOf(builders: ViewBuilders, name: ViewName): AnyBuilder {
  return builders[name] as AnyBuilder;
}

/** Rust `View::built`: a first build at `version`, dirty. */
function viewBuilt(b: AnyBuilder, input: ViewInput, version: number): AnyView {
  return { data: b.build === null ? b.empty() : b.build(input), version, dirty: true };
}

/** Rust `View::after_tick`: rebuilds the view if its cadence is due; an unported one never is. */
function viewAfterTick(
  name: ViewName,
  v: AnyView,
  b: AnyBuilder,
  facts: TickFacts,
  input: ViewInput,
  version: number,
): AnyView {
  const spec = VIEW_SPECS[name];
  const build = b.build;
  if (build === null || !cadenceIsDue(spec.cadence, facts)) {
    return v.dirty ? { data: v.data, version: v.version, dirty: false } : v;
  }
  const rebuildFrom = b.rebuildFrom;
  const data =
    spec.rebuild_in_place && rebuildFrom !== undefined && rebuildFrom !== null
      ? rebuildFrom(v.data, input)
      : build(input);
  return { data, version, dirty: true };
}

/**
 * Rust `View::after_control`: rebuilds after a control if this view follows controls (or
 * Omniscient, and it was toggled) and its data changed; null if it did not. An unported view
 * never does.
 */
function viewAfterControl(
  name: ViewName,
  v: AnyView,
  b: AnyBuilder,
  input: ViewInput,
  version: number,
  toggled: boolean,
): AnyView | null {
  const spec = VIEW_SPECS[name];
  if (b.build === null || !(spec.on_control || (spec.on_omniscient && toggled))) return null;
  const data = b.build(input);
  if (plainEqual(data, v.data)) return null;
  return { data, version, dirty: true };
}

/**
 * Structural equality of plain view data (Rust `PartialEq`): numbers by `===` (so NaN differs
 * from itself and 0 equals -0, as f64 `==`), arrays and objects field by field, Maps and Sets by
 * their entries in order.
 */
export function plainEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!plainEqual(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  if (a instanceof Map || b instanceof Map || a instanceof Set || b instanceof Set) {
    if (!(a instanceof Map && b instanceof Map) && !(a instanceof Set && b instanceof Set)) return false;
    return plainEqual([...a.entries()], [...(b as Map<unknown, unknown> | Set<unknown>).entries()]);
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.hasOwn(b, k)) return false;
    if (!plainEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

// ---------------------------------------------------------------- SimViews

/**
 * Rust `SimViews::build`: every view built from the state, all dirty, at refresh 1: the first
 * build of a `Sim` (spec 9.4).
 */
export function simViewsBuild(input: ViewInput, builders: ViewBuilders = VIEW_BUILDERS): SimViews {
  const views: Record<string, unknown> = { refresh: 1, omniscient: input.controls.omniscient };
  for (const n of VIEW_NAMES) views[n] = viewBuilt(builderOf(builders, n), input, 1);
  return views as unknown as SimViews;
}

/**
 * Rust `SimViews::rebuild`: every view rebuilt from a new state, all dirty, at the next refresh
 * number: at a NewGame and on load (spec 9.4). The refresh counter and every view's version keep
 * climbing, so a reader that copies views by version never mistakes a new game's views for ones
 * it already has.
 */
export function simViewsRebuild(
  views: SimViews,
  input: ViewInput,
  builders: ViewBuilders = VIEW_BUILDERS,
): void {
  views.refresh += 1;
  views.omniscient = input.controls.omniscient;
  for (const n of VIEW_NAMES) setView(views, n, viewBuilt(builderOf(builders, n), input, views.refresh));
}

/**
 * Rust `SimViews::same_data`: every view holds the same data as in `other`, whatever their
 * versions and dirty flags (for checking that a copy shows a given state).
 */
export function simViewsSameData(a: SimViews, b: SimViews): boolean {
  return VIEW_NAMES.every((n) => plainEqual(viewOf(a, n).data, viewOf(b, n).data));
}

/**
 * Rust `SimViews::copy_changed_from`: makes `dst` show `src`: every view whose version differs is
 * copied in (its wrapper copied, its data shared: a build is never mutated), the others are left
 * alone, and the refresh number follows. Runs over the whole `VIEW_NAMES` list, so a reader that
 * copies views by version cannot miss one.
 */
export function simViewsCopyChangedFrom(dst: SimViews, src: SimViews): void {
  for (const n of VIEW_NAMES) {
    const s = viewOf(src, n);
    if (viewOf(dst, n).version !== s.version)
      setView(dst, n, { data: s.data, version: s.version, dirty: s.dirty });
  }
  dst.refresh = src.refresh;
  dst.omniscient = src.omniscient;
}

/** A copy of `views` that shares every build (Rust `Clone`: the `Arc`s are shared). */
export function simViewsClone(views: SimViews): SimViews {
  const out: Record<string, unknown> = { refresh: views.refresh, omniscient: views.omniscient };
  for (const n of VIEW_NAMES) {
    const v = viewOf(views, n);
    out[n] = { data: v.data, version: v.version, dirty: v.dirty };
  }
  return out as unknown as SimViews;
}

/**
 * Rust `SimViews::refresh_after_tick`: after a tick, rebuilds the views due on this tick and
 * clears the others' dirty flags (spec 9.4). With an `observer`, each view rebuilt is timed as a
 * `View` part (D400), in `VIEW_NAMES` order; without one the views are the same (see the header
 * on D801's threads).
 */
export function simViewsRefreshAfterTick(
  views: SimViews,
  input: ViewInput,
  observer: TickObserver | null = null,
  builders: ViewBuilders = VIEW_BUILDERS,
): void {
  views.refresh += 1;
  const facts = tickFactsNew(input.world.clock);
  for (const n of VIEW_NAMES) {
    const b = builderOf(builders, n);
    // Rust times every view whose cadence is due; an unported view builds nothing, so it is not.
    const watch = observer !== null && b.build !== null && cadenceIsDue(VIEW_SPECS[n].cadence, facts);
    if (watch) observer.started({ kind: "View", name: n });
    setView(views, n, viewAfterTick(n, viewOf(views, n), b, facts, input, views.refresh));
    if (watch) observer.finished({ kind: "View", name: n });
  }
}

/**
 * Rust `SimViews::refresh_after_control`: after a control, rebuilds the views that follow
 * controls (the clock), and those that follow Omniscient when it was toggled (D423). The refresh
 * number moves only if a view changed.
 */
export function simViewsRefreshAfterControl(
  views: SimViews,
  input: ViewInput,
  builders: ViewBuilders = VIEW_BUILDERS,
): void {
  const next = views.refresh + 1;
  const toggled = input.controls.omniscient !== views.omniscient;
  views.omniscient = input.controls.omniscient;
  let changed = false;
  for (const n of VIEW_NAMES) {
    const v = viewAfterControl(n, viewOf(views, n), builderOf(builders, n), input, next, toggled);
    if (v !== null) {
      setView(views, n, v);
      changed = true;
    }
  }
  if (changed) views.refresh = next;
}

/** Rust `SimViews::refresh`: the latest refresh number. */
export function simViewsRefresh(views: SimViews): number {
  return views.refresh;
}

/** Rust `SimViews::clock`: the clock (spec 9.1 `clock()`). */
export function simViewsClock(views: SimViews): ClockView {
  return views.clock.data;
}

/**
 * Rust `SimViews::map_layer_versions`: the versions of the views `get_map_layer(mode)` reads
 * (v_map_layers, and for the Financial zones mode v_cycle and v_exchanges; 0 for a view the mode
 * does not read): the map rewrites its colour table only when these move (m8-plan risks).
 */
export function simViewsMapLayerVersions(views: SimViews, mode: MapMode): [number, number, number] {
  return mode.kind === "FinancialZones"
    ? [views.map_layers.version, views.cycle.version, views.exchanges.version]
    : [views.map_layers.version, 0, 0];
}
