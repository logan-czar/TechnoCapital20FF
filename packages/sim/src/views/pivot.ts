// The pivot's views (types/views/: v_feed, v_social, v_polls, v_forecast, v_races, v_people,
// v_records, v_markets, v_account, v_notifications, v_districts, v_usmap_layers, v_returns): their
// empty values. No builder yet: each is registered unported in views/index.ts `VIEW_BUILDERS`, so
// the sim holds its empty value and never posts it (views/patch.ts). The lane that builds a view
// moves its `empty` into the view's own file beside its `build`.

import type { AccountView } from "../types/views/account.ts";
import type { DistrictsView } from "../types/views/districts.ts";
import type { FeedView } from "../types/views/feed.ts";
import type { ForecastView } from "../types/views/forecast.ts";
import type { MarketsView } from "../types/views/markets.ts";
import type { NotificationsView } from "../types/views/notifications.ts";
import type { PeopleView } from "../types/views/people.ts";
import type { PollsView } from "../types/views/polls.ts";
import type { RacesView } from "../types/views/races.ts";
import type { RecordsView } from "../types/views/records.ts";
import type { ReturnsView } from "../types/views/returns.ts";
import type { SocialView } from "../types/views/social.ts";
import type { UsMapLayersView } from "../types/views/usmap_layers.ts";

export function emptyFeed(): FeedView {
  return { outlets: [], articles: [], front_pages: [] };
}

export function emptySocial(): SocialView {
  return { handles: [], posts: [] };
}

export function emptyPolls(): PollsView {
  return { pollsters: [], polls: [] };
}

export function emptyForecast(): ForecastView {
  return { updated: null, races: [], chambers: [], electoral_votes: null };
}

export function emptyRaces(): RacesView {
  return { cycle: null, races: [] };
}

export function emptyPeople(): PeopleView {
  return { people: [] };
}

export function emptyRecords(): RecordsView {
  return { bills: [], roll_calls: [], actions: [], filings: [] };
}

export function emptyMarkets(): MarketsView {
  return { contracts: [] };
}

export function emptyAccount(): AccountView {
  return {
    open: false,
    cash: [],
    net_worth: 0,
    positions: [],
    orders: [],
    fills: [],
    realised_gains: 0,
    tax_due: 0,
    follows: [],
    alert_rules: [],
    bankrupt: false,
  };
}

export function emptyNotifications(): NotificationsView {
  return { items: [] };
}

export function emptyDistricts(): DistrictsView {
  return { plans: [], districts: [] };
}

export function emptyUsMapLayers(): UsMapLayersView {
  return {
    counties: {
      fips: [],
      state: [],
      name: [],
      population: [],
      district: [],
      last_winner: [],
      last_margin: [],
      lean: null,
    },
    states: [],
  };
}

export function emptyReturns(): ReturnsView {
  return { election: null, races: [] };
}
