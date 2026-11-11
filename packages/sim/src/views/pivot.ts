// The pivot's views (types/views/: v_feed, v_social, v_polls, v_forecast, v_races, v_people,
// v_records, v_markets, v_account, v_notifications, v_districts, v_usmap_layers, v_returns): their
// empty values, one place for a host or a mock to find them all.
//
// The seven of M2's sim lanes (D1037) have their builder slot and empty value in the view's own
// file (races.ts, returns.ts, people.ts, districts.ts, usmap_layers.ts, account.ts,
// notifications.ts) and are re-exported here. The six that wait for M3 to M5 are below: the lane
// that builds one moves its `empty` into the view's own file beside its `build`.

import type { FeedView } from "../types/views/feed.ts";
import type { ForecastView } from "../types/views/forecast.ts";
import type { MarketsView } from "../types/views/markets.ts";
import type { PollsView } from "../types/views/polls.ts";
import type { RecordsView } from "../types/views/records.ts";
import type { SocialView } from "../types/views/social.ts";

export { emptyAccount } from "./account.ts";
export { emptyDistricts } from "./districts.ts";
export { emptyNotifications } from "./notifications.ts";
export { emptyPeople } from "./people.ts";
export { emptyRaces } from "./races.ts";
export { emptyReturns } from "./returns.ts";
export { emptyUsMapLayers } from "./usmap_layers.ts";

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
  return { updated: null, races: [], chambers: [], states: [], electoral_votes: null };
}

export function emptyRecords(): RecordsView {
  return { bills: [], roll_calls: [], actions: [], filings: [] };
}

export function emptyMarkets(): MarketsView {
  return { contracts: [] };
}
