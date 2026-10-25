// `SimViews` (crates/sim/src/views/mod.rs): the read-only query tables the UI reads (spec 9, 9.2,
// 9.4; build-plan M1.6, M7.3).
//
// The sim builds every view after each tick on the spec 9.4 cadence. Each view carries a version
// (the refresh it was last rebuilt in) and a dirty flag (rebuilt in the latest refresh), so the
// UI side copies only what changed. UI code never touches sim tables (spec 9). In TS the views
// cross the Web Worker boundary by structured clone, so every type here is plain data.
//
// One file per view (`sim_views!` list order below); `ClockView` is in ./clock.ts and re-exported.
// Types from other sim modules that views carry are in ./shared.ts.
//
// The logic (Cadence::is_periodic and ::is_due, ViewInput, the builders, View's build and refresh
// methods and SimViews' build, rebuild, same_data, copy_changed_from, refresh_after_tick,
// refresh_after_control, clock and map_layer_versions) is in src/views/index.ts; the ViewData
// trait's consts are `VIEW_SPECS` below. Not ported: Jobs and VIEW_WORKERS (D801: Rust worker
// threads) and get_map_layer (D700, with the map layers view in Step 3).

import type { BirthsView } from "./births.ts";
import type { CapTableView } from "./cap_table.ts";
import type { CharactersView } from "./characters.ts";
import type { ClockView } from "./clock.ts";
import type { CompanyDetailView } from "./company_detail.ts";
import type { CompanyRowsView } from "./company_rows.ts";
import type { CountriesView } from "./countries.ts";
import type { CycleView } from "./cycle.ts";
import type { ExchangesView } from "./exchanges.ts";
import type { FilingsView } from "./filings.ts";
import type { IndustryDetailView } from "./industry_detail.ts";
import type { IndustryRowsView } from "./industry_rows.ts";
import type { MapLayersView } from "./map_layers.ts";
import type { MapStaticView } from "./map_static.ts";
import type { MarketStatsView } from "./market_stats.ts";
import type { NewsView } from "./news.ts";
import type { PlacesView } from "./places.ts";
import type { PriceBarsView } from "./price_bars.ts";
import type { ProjectionView } from "./projection.ts";
import type { ProvinceCardsView } from "./province_cards.ts";
import type { QuotesView } from "./quotes.ts";
import type { RatesView } from "./rates.ts";
import type { RatingsView } from "./ratings.ts";
import type { RecapView } from "./recap.ts";
import type { StatementsView } from "./statements.ts";
import type { TechView } from "./tech.ts";
import type { UnitsView } from "./units.ts";
import type { ZonesView } from "./zones.ts";

export * from "./births.ts";
export * from "./cap_table.ts";
export * from "./characters.ts";
export * from "./clock.ts";
export * from "./company_detail.ts";
export * from "./company_rows.ts";
export * from "./countries.ts";
export * from "./cycle.ts";
// Two Rust types are named `Band`: the estimate band wins the plain name here; the rating band
// (finance::rating::Band, ./shared.ts) is re-exported as `RatingBand` further down.
export type { Band } from "./estimate.ts";
export * from "./estimate.ts";
export * from "./exchanges.ts";
export * from "./filings.ts";
export * from "./industry_detail.ts";
export * from "./industry_rows.ts";
export * from "./map_layers.ts";
export * from "./map_static.ts";
export * from "./market_stats.ts";
export * from "./news.ts";
export * from "./places.ts";
export * from "./price_bars.ts";
export * from "./projection.ts";
export * from "./province_cards.ts";
export * from "./quotes.ts";
export * from "./rates.ts";
export * from "./ratings.ts";
export * from "./recap.ts";
export type { Band as RatingBand } from "./shared.ts";
export * from "./shared.ts";
export * from "./statements.ts";
export * from "./tech.ts";
export * from "./units.ts";
export * from "./zones.ts";

/** How often a view is rebuilt (spec 9.4). */
export type Cadence =
  | "EveryTick"
  /** At 00:00. */
  | "Daily"
  /** On the 1st at 00:00, and on load. */
  | "Monthly"
  /**
   * Monthly, and at the plan lock, when companies are born and list (5.19, 5.20; D159): the
   * company views, so a newborn is in every table the tick it is born.
   */
  | "MonthlyAndLock"
  /** On the quarter's compile, release (and its 01:00 price move), lock and recap ticks. */
  | "Quarterly"
  /** Once at load. */
  | "OnceAtLoad";

/**
 * One view with its version and dirty flag (spec 9.4, 12.3). In Rust the data is shared behind
 * an `Arc` (D775) and the fields are private (read by `get`, `version`, `is_dirty`).
 */
export interface View<T> {
  data: T;
  /** The refresh this view was last rebuilt in. */
  version: number;
  /** Rebuilt in the latest refresh. */
  dirty: boolean;
}

/** Every view the UI reads (spec 9.4), in the Rust `sim_views!` order. */
export interface SimViews {
  /** The latest refresh number (Rust private, read by `refresh()`). */
  refresh: number;
  /**
   * Omniscient at the last build, so a control that toggles it rebuilds the `on_omniscient`
   * views (D423). Rust private.
   */
  omniscient: boolean;
  clock: View<ClockView>;
  places: View<PlacesView>;
  countries: View<CountriesView>;
  zones: View<ZonesView>;
  rates: View<RatesView>;
  characters: View<CharactersView>;
  cap_table: View<CapTableView>;
  quotes: View<QuotesView>;
  price_bars: View<PriceBarsView>;
  exchanges: View<ExchangesView>;
  market_stats: View<MarketStatsView>;
  news: View<NewsView>;
  births: View<BirthsView>;
  projection: View<ProjectionView>;
  company_rows: View<CompanyRowsView>;
  company_detail: View<CompanyDetailView>;
  units: View<UnitsView>;
  tech: View<TechView>;
  industry_rows: View<IndustryRowsView>;
  industry_detail: View<IndustryDetailView>;
  cycle: View<CycleView>;
  map_layers: View<MapLayersView>;
  province_cards: View<ProvinceCardsView>;
  statements: View<StatementsView>;
  filings: View<FilingsView>;
  ratings: View<RatingsView>;
  recap: View<RecapView>;
  map_static: View<MapStaticView>;
}

/** A view's field name in `SimViews`. */
export type ViewName = Exclude<keyof SimViews, "refresh" | "omniscient">;

/**
 * Every view, in the Rust `sim_views!` order: the order views are built and refreshed in (and
 * timed in, `TickPart::View`, D400).
 */
export const VIEW_NAMES = [
  "clock",
  "places",
  "countries",
  "zones",
  "rates",
  "characters",
  "cap_table",
  "quotes",
  "price_bars",
  "exchanges",
  "market_stats",
  "news",
  "births",
  "projection",
  "company_rows",
  "company_detail",
  "units",
  "tech",
  "industry_rows",
  "industry_detail",
  "cycle",
  "map_layers",
  "province_cards",
  "statements",
  "filings",
  "ratings",
  "recap",
  "map_static",
] as const satisfies readonly ViewName[];

/** One view's `ViewData` constants (Rust trait consts; defaults false). */
export interface ViewSpec {
  /** When it is rebuilt (spec 9.4). Every view is also built at a new game and on load. */
  cadence: Cadence;
  /** Also rebuilt after a control (speed, pause, skip), between ticks. */
  on_control: boolean;
  /**
   * Also rebuilt after a control that turns Omniscient on or off (D423): the views whose
   * figures are estimate bands unless Omniscient shows the truth.
   */
  on_omniscient: boolean;
  /** Rebuilt in place, reusing its last build's allocations (D402) or archived estimates (D435). */
  rebuild_in_place: boolean;
}

function spec(
  cadence: Cadence,
  flags: { on_control?: true; on_omniscient?: true; rebuild_in_place?: true } = {},
): ViewSpec {
  return {
    cadence,
    on_control: flags.on_control ?? false,
    on_omniscient: flags.on_omniscient ?? false,
    rebuild_in_place: flags.rebuild_in_place ?? false,
  };
}

/** Each view's cadence and rebuild flags, from its Rust `impl ViewData`. */
export const VIEW_SPECS: Readonly<Record<ViewName, ViewSpec>> = {
  clock: spec("EveryTick", { on_control: true }),
  places: spec("OnceAtLoad"),
  countries: spec("MonthlyAndLock"),
  zones: spec("Daily"),
  rates: spec("Monthly"),
  characters: spec("MonthlyAndLock"),
  cap_table: spec("MonthlyAndLock"),
  quotes: spec("EveryTick", { on_control: true, rebuild_in_place: true }),
  price_bars: spec("Daily"),
  exchanges: spec("Daily"),
  market_stats: spec("Daily"),
  news: spec("Daily"),
  births: spec("Quarterly", { on_omniscient: true }),
  projection: spec("Daily", { on_control: true }),
  company_rows: spec("MonthlyAndLock", { on_omniscient: true }),
  company_detail: spec("MonthlyAndLock", { on_omniscient: true }),
  units: spec("MonthlyAndLock", { on_omniscient: true }),
  tech: spec("MonthlyAndLock", { on_omniscient: true }),
  industry_rows: spec("Monthly", { on_omniscient: true }),
  industry_detail: spec("Monthly", { on_omniscient: true }),
  cycle: spec("Daily", { on_control: true }),
  map_layers: spec("MonthlyAndLock", { on_omniscient: true }),
  province_cards: spec("Monthly"),
  statements: spec("Quarterly", { on_omniscient: true, rebuild_in_place: true }),
  filings: spec("Quarterly", { on_omniscient: true }),
  ratings: spec("Quarterly", { on_omniscient: true }),
  recap: spec("Quarterly", { on_control: true }),
  map_static: spec("OnceAtLoad"),
};
