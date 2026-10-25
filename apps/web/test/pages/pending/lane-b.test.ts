// Pending page tests, lane B (docs/build/ts-pages-guide.md): the Rust tests each lane-B page
// ports, as todos. When a page lands, its lane moves its block to
// apps/web/test/pages/<page>.test.ts(x), turns each todo into a test, and deletes the block here.
// Vitest reports todos as skipped, so this file runs in the gate and shows what is left.
//
// Lane B is the only writer of this file.

import { describe, it } from "vitest";

describe("Industries and an industry (kinds/industries.tsx; industries.rs)", () => {
  it.todo(
    "the Industries table has its 42 rows with the births column and the top 5 as links (market_pages industries_has_42_rows_and_a_detail_page)",
  );
  it.todo("an industry's page shows its figures, charts, company list and fringe row (same test)");
  it.todo("an industry without headlines says so (c1_news_feed an_industry_without_headlines_says_so)");
  it.todo("an estimated industry shows supply, S, M and fringe as bands (D432, D437)");
});

describe("News feed and a headline (kinds/news.tsx; news.rs)", () => {
  it.todo(
    "the feed filters by industry and by company; every startup event appears (market_pages news_filters_by_industry_and_lists_startup_events)",
  );
  it.todo("the lazy feed matches the whole feed (c1_news_feed the_lazy_feed_matches_the_whole_feed)");
  it.todo("a long feed costs what a short one does (c1_news_feed a_long_feed_costs_what_a_short_one_does)");
  it.todo("a headline's page links every subject (placeholder.rs related, Headline)");
});

describe("Startup events (kinds/events.tsx; events.rs)", () => {
  it.todo(
    "an event's page lists its industries and startups as links, with founding sizes as bands while private",
  );
  it.todo(
    "the event list names events and companies from the views (b1_pages the_event_log_names_events_and_companies)",
  );
});

describe("Pdoomberg (pdoomberg/; crates/game/src/pdoomberg)", () => {
  it.todo(
    "every function key opens its page, only while the terminal is open; F4 holds only the lock (market_pages every_function_key_opens_its_page)",
  );
  it.todo(
    "TICKER Fn opens Pdoomberg on that company; F3 draws daily and 10-year charts over the EFV band (market_pages ticker_function_commands_route)",
  );
  it.todo(
    "F2, F5, F10 show a private company's figures as bands, never the truth; band columns sort by midpoint (market_pages private_figures_are_bands_and_never_the_truth)",
  );
  it.todo(
    "the F10 screener filters by origin and listing date, and by the 9.2 filters (market_pages screener_filters_by_origin_and_listing)",
  );
  it.todo("a right-click load on F10 keeps the page (market_pages right_click_load_keeps_the_page)");
  it.todo("no IPO ballot odds on any market or Pdoomberg page (market_pages no_ballot_odds_on_any_page)");
});
