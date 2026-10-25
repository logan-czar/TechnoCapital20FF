// Pending page tests, lane A (docs/build/ts-pages-guide.md): the Rust tests each lane-A page
// ports, as todos. When a page lands, its lane moves its block to
// apps/web/test/pages/<page>.test.ts(x), turns each todo into a test, and deletes the block here.
// Vitest reports todos as skipped, so this file runs in the gate and shows what is left.
//
// Lane A is the only writer of this file.

import { describe, it } from "vitest";

describe("Company page (kinds/company.tsx; crates/game/src/pages/company.rs)", () => {
  it.todo(
    "every company page builds, fresh and past the first lock, with its sections (b1_pages every_entity_page_builds)",
  );
  it.todo(
    "shows every spec 8 field on a listed, a private, a born and a listing-in-play company (b1_pages company_pages_show_every_spec8_field)",
  );
  it.todo(
    "a private company page shows bands and never the truth, against an Omniscient twin (b1_pages a_private_company_page_shows_bands_and_never_the_truth)",
  );
  it.todo(
    "links its industry, HQ, exchange, controller, owner of record, event, founders and board (b1_pages pages_link_their_names)",
  );
  it.todo(
    "no ballot odds anywhere (b1_pages no_ballot_odds_anywhere, a_director_who_moved_up_still_counts_as_the_voter)",
  );
  it.todo("the Board tab lists directors by seat position (b1_pages board_lists_directors_by_position)");
  it.todo("live values follow the views without a rebuild (b1_pages live_values_follow_the_views)");
  it.todo(
    "sections and tabs persist in the settings (b1_pages company_sections_and_tabs_persist; workspace sections_collapse_and_hide)",
  );
  it.todo(
    "the chart's band comes from the bars, daily then the 10-year weekly view (a1_views the_chart_band_comes_from_the_bars)",
  );
  it.todo(
    "the company hover card shows bands for a private company (workspace a_private_company_card_shows_bands)",
  );
});

describe("Character page (kinds/character.tsx; character.rs)", () => {
  it.todo("every full character's page builds with its three sections (b1_pages every_entity_page_builds)");
  it.todo("links home, roles and holdings (b1_pages pages_link_their_names)");
  it.todo("a partial character is marked and not linked (b1_pages board_lists_directors_by_position)");
});

describe("Zone and Exchange pages (kinds/zone.tsx, kinds/exchange.tsx; zone.rs, exchange.rs)", () => {
  it.todo(
    "every zone and exchange page builds; members and constituents tables match the views (b1_pages every_entity_page_builds)",
  );
  it.todo(
    "links the exchange, the member countries, the zone and the constituents (b1_pages pages_link_their_names)",
  );
  it.todo(
    "the index chart draws v_exchanges' daily closes (b1_pages the_index_chart_draws_the_sim_s_daily_closes)",
  );
  it.todo(
    "daily figures, the chart and the constituents follow the first day after they open (b1_pages live_tables_and_charts_follow_the_first_change)",
  );
  it.todo("a load shows the saved index history (b1_pages a_load_shows_the_saved_index_history)");
});

describe("Province page (kinds/province.tsx; province.rs)", () => {
  it.todo(
    "lists its HQs and units with links (m8_province the_province_page_lists_its_hqs_and_units_with_links)",
  );
  it.todo(
    "province names link to their pages everywhere (m8_province province_names_link_to_their_pages_everywhere)",
  );
  it.todo("the command bar finds provinces by name and CSV id (m8_province the_command_bar_finds_provinces)");
});

describe("List pages (kinds/lists.tsx; lists.rs)", () => {
  it.todo("each list page has its index table, id = the kind key (workspace every_page_kind_builds)");
  it.todo(
    "a private company shows bands in the Companies list, sorting by midpoint (a1_views a_private_company_shows_bands_and_never_the_truth)",
  );
  it.todo(
    "names come from the views: countries, zones, characters, places (a1_views names_come_from_the_a1_views)",
  );
});

describe("Quarterly recap (kinds/recap.tsx; recap.rs)", () => {
  it.todo(
    "opens in a pane from its pause alert in the pre-quarter-end week, and by quarter (market_pages recap_opens_from_its_alert_and_by_quarter)",
  );
  it.todo(
    "a private company's recap figures are bands (market_pages private_figures_are_bands_and_never_the_truth, recap part)",
  );
  it.todo("links the previous and next quarters and the watchlist companies (placeholder.rs related, Recap)");
});
