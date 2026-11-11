// A new mock game's `SimViews`: every view present, those the shell reads filled from their
// fixtures, the pivot's views empty until `MockPivot` (../pivot.ts) fills them.

import {
  type ClockView,
  type CountryId,
  emptyAccount,
  emptyDistricts,
  emptyFeed,
  emptyForecast,
  emptyHistory,
  emptyMarkets,
  emptyNotifications,
  emptyPeople,
  emptyPolitics,
  emptyPolls,
  emptyRaces,
  emptyRecords,
  emptyReturns,
  emptySocial,
  emptyUsMapLayers,
  type SimViews,
  type ZoneId,
} from "@tc20ff/sim";
import type { MockWorld } from "../mockWorld.ts";
import { companyRowsView, industryRowsView } from "./companies.ts";
import { initialBars, type MockStock, quotesView } from "./market.ts";
import type { MockRng } from "./rng.ts";
import { view } from "./shared.ts";

/** A `SimViews` for a new game: every view present, those the shell reads filled. */
export function initialViews(
  w: MockWorld,
  stocks: MockStock[],
  rng: MockRng,
  clock: ClockView,
  indexLevels: number[],
): SimViews {
  const v = 1;
  const endDay = Math.floor(clock.now / 24);
  return {
    refresh: v,
    omniscient: false,
    clock: view(clock, v),
    places: view(
      {
        provinces: w.provinces.map((p) => ({ id: p.id, key: p.key, name: p.name, country: p.country })),
        countries: w.countryOrder.map((row, id) => {
          const c = w.data.countries.rows[row] as { iso3: string; name: string };
          return { id: id as CountryId, iso3: c.iso3, name: c.name };
        }),
      },
      v,
    ),
    countries: view(
      {
        countries: w.countryOrder.map((row, id) => {
          const c = w.data.countries.rows[row] as {
            iso3: string;
            name: string;
            superregion: string;
            gdp_usd_bn: number;
          };
          const hq = w.companies.filter((x) => x.country === id).map((x) => x.id);
          return {
            id: id as CountryId,
            iso3: c.iso3,
            name: c.name,
            superregion: c.superregion,
            zone: (w.zoneOfIso3.get(c.iso3) ?? 0) as ZoneId,
            zone_name: "",
            gdp_usd: c.gdp_usd_bn * 1e9,
            corp_tax_rate: 0.21,
            sovereign_rating: "Bbb",
            sovereign_spread: 0.01,
            hq_companies: hq,
          };
        }),
      },
      v,
    ),
    zones: view({ zones: [] }, v),
    rates: view({ base_rate: 0.02, zones: [], sovereigns: [], rating_spreads: [] }, v),
    characters: view({ full: [], partial: [] }, v),
    cap_table: view({ companies: [] }, v),
    quotes: view(quotesView(stocks, w, indexLevels), v),
    price_bars: view({ companies: initialBars(stocks, w, rng, endDay) }, v),
    exchanges: view({ exchanges: [] }, v),
    market_stats: view(
      {
        listed: stocks.length,
        quoted: stocks.length,
        median_gap: 0.05,
        within_band: stocks.length,
        mean_confidence: 0,
        reports: 0,
        beats: 0,
        misses: 0,
      },
      v,
    ),
    news: view({ feed: [] }, v),
    births: view(
      {
        events: [],
        births: [],
        listings: [],
        full_characters_made: 0,
        full_characters: 0,
        births_column_quarters: [],
        births_by_industry: [],
      },
      v,
    ),
    projection: view({ elapsed_share: 0, companies: [] }, v),
    company_rows: view({ rows: companyRowsView(w, stocks) }, v),
    company_detail: view({ companies: [] }, v),
    units: view({ units: [] }, v),
    tech: view({ companies: [] }, v),
    industry_rows: view({ rows: industryRowsView(w, clock.now) }, v),
    industry_detail: view({ industries: [] }, v),
    cycle: view(
      {
        phase: "Expansion",
        g_t: 0.02,
        quarters_left: 4,
        z_avg: 0,
        base_rate: 0.02,
        zones: [],
        ai_stage: "Preboom",
        boom_year: null,
        boom_date: { year: 2023, month: 1, day: 1 },
        ai_labs_lt: 0.1,
        pop_date: null,
      },
      v,
    ),
    map_layers: view(
      {
        political: { country: [], contested: [] },
        country_names: [],
        tracks: [],
        zone: [],
        unit_assets: [],
        hqs: [],
        sectors: [],
        industry_names: [],
      },
      v,
    ),
    province_cards: view({ cards: [] }, v),
    statements: view({ companies: [] }, v),
    filings: view({ quarter: null, filings: [] }, v),
    ratings: view({ companies: [], base_rate: 0.02 }, v),
    recap: view({ recaps: [], watchlist: [] }, v),
    map_static: view({ provinces: [], metros: [], key_cities: [], regions: [], geo: null }, v),
    politics: view(emptyPolitics(), v),
    history: view(emptyHistory(), v),
    // The pivot's views: empty here; `MockPivot` (../pivot.ts) fills them when the mock runs its pivot world.
    feed: view(emptyFeed(), v),
    social: view(emptySocial(), v),
    polls: view(emptyPolls(), v),
    forecast: view(emptyForecast(), v),
    races: view(emptyRaces(), v),
    people: view(emptyPeople(), v),
    records: view(emptyRecords(), v),
    markets: view(emptyMarkets(), v),
    account: view(emptyAccount(), v),
    notifications: view(emptyNotifications(), v),
    districts: view(emptyDistricts(), v),
    usmap_layers: view(emptyUsMapLayers(), v),
    returns: view(emptyReturns(), v),
  };
}
