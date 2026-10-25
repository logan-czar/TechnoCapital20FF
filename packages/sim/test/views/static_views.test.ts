// Checks for the views ported in Step 3 chunk B1 (places, countries, zones, rates, cycle,
// price_bars, exchanges, market_stats, news, province_cards): each view agrees with the World it
// is built from, and the lookups the Rust views carry work. The Rust files have no in-file tests;
// these cover what the integration tests (m5_views, m9_views, m9_c1_views) read from them.
import { describe, expect, it } from "vitest";
import { corporateSpread, RATING_ALL } from "../../src/finance/rating.ts";
import { companyFinanceStatus } from "../../src/finance/state.ts";
import { simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../../src/time/calendar.ts";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import { TRACKING_BAND } from "../../src/types/views/market_stats.ts";
import { countriesViewByIso3, countriesViewGet } from "../../src/views/countries.ts";
import { exchangesViewGet, exchangesViewOfZone } from "../../src/views/exchanges.ts";
import { gap } from "../../src/views/market_stats.ts";
import { newsViewGet, newsViewGetNews, newsViewSince } from "../../src/views/news.ts";
import { placesViewPlaceName } from "../../src/views/places.ts";
import { priceBarsViewGetPriceHistory } from "../../src/views/price_bars.ts";
import { largestTrack } from "../../src/views/province_cards.ts";
import { data, unwrap } from "../common/index.ts";

function runDays(sim: ReturnType<typeof mkSim>, days: number): void {
  const end = simNow(sim) + days * 24;
  while (simNow(sim) < end) simStep(sim);
}

function mkSim() {
  return unwrap(simNew(data(), 11), "Sim::new");
}

describe("static views (chunk B1)", () => {
  it("places, countries, zones, rates and cycle follow the world's tables", () => {
    const sim = mkSim();
    const w = simWorld(sim);
    const v = simViews(sim);
    expect(v.places.data.provinces.map((p) => p.key)).toEqual(w.provinces.map((p) => p.key));
    expect(v.places.data.countries.map((c) => c.iso3)).toEqual(w.countries.map((c) => c.key));
    const usa = countriesViewByIso3(v.countries.data, "USA");
    expect(usa?.name).toBe("United States");
    expect(countriesViewByIso3(v.countries.data, "ZZZ")).toBeNull();
    expect(countriesViewGet(v.countries.data, usa?.id as never)).toBe(usa);
    // HQ lists: every live company once, in id order.
    const hq = v.countries.data.countries.flatMap((c) => c.hq_companies);
    const live = w.companies.filter((c) => companyFinanceStatus(c.finance) !== "Removed").length;
    expect(hq.length).toBe(live);
    for (const c of v.countries.data.countries) {
      expect([...c.hq_companies].sort((a, b) => a - b)).toEqual(c.hq_companies);
    }
    expect(v.zones.data.zones.length).toBe(26);
    const members = v.zones.data.zones.flatMap((z) => z.members);
    expect(members.length).toBe(w.countries.length);
    expect(v.rates.data.rating_spreads.map((r) => r.rating)).toEqual([...RATING_ALL]);
    expect(v.rates.data.rating_spreads.map((r) => r.spread)).toEqual(RATING_ALL.map(corporateSpread));
    expect(v.rates.data.sovereigns.length).toBe(w.countries.length);
    expect(v.cycle.data.zones.length).toBe(26);
    expect(v.cycle.data.pop_date, "hidden outside Omniscient").toBeNull();
    const p = v.places.data.provinces[0];
    expect(placesViewPlaceName(v.places.data, p?.id as never)).toMatch(/, /);
  });

  it("province cards: largest track ties count for both", () => {
    expect(largestTrack(5, 3)).toBe("Commerce");
    expect(largestTrack(3, 5)).toBe("Industry");
    expect(largestTrack(4, 4)).toBe("Both");
    const sim = mkSim();
    const cards = simViews(sim).province_cards.data.cards;
    expect(cards.length).toBe(simWorld(sim).provinces.length);
    // The development tracks come from the province files, map assets or not.
    expect(cards[0]?.total).toBe(
      (cards[0]?.commerce ?? 0) + (cards[0]?.industry ?? 0) + (cards[0]?.population ?? 0),
    );
    expect(cards[0]?.total).toBeGreaterThan(0);
  });

  it("exchanges, market stats and gap", () => {
    const sim = mkSim();
    const w = simWorld(sim);
    const v = simViews(sim);
    expect(v.exchanges.data.exchanges.length).toBe(26);
    const ex = v.exchanges.data.exchanges[0];
    expect(exchangesViewGet(v.exchanges.data, ex?.code as string)).toBe(ex);
    expect(exchangesViewGet(v.exchanges.data, "NOPE")).toBeNull();
    expect(exchangesViewOfZone(v.exchanges.data, ex?.zone as never)).toBe(ex);
    for (const e of v.exchanges.data.exchanges) expect(e.listed_count).toBe(e.constituents.length);
    const quoted = w.market.stocks.filter((s) => s.quoted).length;
    expect(v.market_stats.data.quoted).toBe(quoted);
    expect(v.market_stats.data.listed >= quoted).toBe(true);
    expect(gap(110, 100)).toBeCloseTo(0.1, 12);
    expect(gap(1, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(TRACKING_BAND).toBe(0.3);
  });

  it("price bars and news after a few days", () => {
    const sim = mkSim();
    runDays(sim, 40);
    const v = simViews(sim);
    const bars = v.price_bars.data.companies;
    expect(bars.length > 0).toBe(true);
    expect(bars.every((h, i) => i === 0 || (bars[i - 1] as { id: number }).id < h.id)).toBe(true);
    const id = (bars[0] as { id: CompanyId }).id;
    const from = simDateYmd(2020, 1, 1);
    const to = simDateYmd(2020, 3, 1);
    const daily = priceBarsViewGetPriceHistory(v.price_bars.data, id, "Daily", from, to);
    const weekly = priceBarsViewGetPriceHistory(v.price_bars.data, id, "Weekly", from, to);
    const monthly = priceBarsViewGetPriceHistory(v.price_bars.data, id, "Monthly", from, to);
    expect(daily.length > weekly.length && weekly.length > monthly.length).toBe(true);
    // A weekly bar spans its days: open of the first, close and EFV of the last.
    const first = daily[0];
    expect(weekly[0]?.open).toBe(first?.open);
    expect(weekly[0]?.high).toBeGreaterThanOrEqual(first?.high as number);
    // Aggregation never changed the build (a copy was aggregated).
    expect(priceBarsViewGetPriceHistory(v.price_bars.data, id, "Daily", from, to)).toEqual(daily);
    expect(priceBarsViewGetPriceHistory(v.price_bars.data, 999999 as CompanyId, "Daily", from, to)).toEqual(
      [],
    );
    // The feed lists the wire's headlines, oldest first with ids in post order.
    const feed = v.news.data.feed;
    expect(feed.map((h) => h.id)).toEqual(feed.map((_, i) => i));
    if (feed.length > 0) {
      expect(newsViewGet(v.news.data, 0 as never)).toBe(feed[0]);
      const last = feed[feed.length - 1];
      expect(newsViewSince(v.news.data, last?.date as never).length > 0).toBe(true);
      expect(newsViewGetNews(v.news.data, simDateYmd(2019, 1, 1), null)).toEqual(feed);
      expect(newsViewGetNews(v.news.data, simDateYmd(2019, 1, 1), 9999 as IndustryId)).toEqual([]);
    }
    expect(dateTimeMidnight(simDateYmd(2020, 1, 1))).toBeLessThanOrEqual(simNow(sim));
  }, 120_000);
});
