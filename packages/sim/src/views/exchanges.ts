// v_exchanges: `list_exchanges()` and `get_exchange(code)` (spec 9.2; batches 152 and 154): the 26
// zone exchanges with their code, name, zone, hub city and hub province, headline index name and
// level, listed company count and investor confidence (5.1.2), the constituents, and the index's
// daily closes from 2020, 10 years kept (D540; design fix 462). Rebuilt daily (spec 9.4 has no
// row for it; the index closes and confidence move at 00:00, D146); the live level each tick is
// in v_quotes. Ported from crates/sim/src/views/exchanges.rs.

import { exchangeIndexLevel } from "../market/exchange_index.ts";
import { exchangeCaps } from "../market/jobs.ts";
import { type CompanyId, ordinal, type ZoneId } from "../types/ids.ts";
import type { ExchangeRow, ExchangesView } from "../types/views/exchanges.ts";
import { chunkLogClone } from "../world/log.ts";
import type { ViewInput } from "./index.ts";

/** Rust `ExchangesView::get`: `get_exchange(code)`. */
export function exchangesViewGet(v: ExchangesView, code: string): ExchangeRow | null {
  return v.exchanges.find((e) => e.code === code) ?? null;
}

/** Rust `ExchangesView::of_zone`: the exchange of zone `zone` (one exchange a zone, spec 5.14). */
export function exchangesViewOfZone(v: ExchangesView, zone: ZoneId): ExchangeRow | null {
  return v.exchanges[zone] ?? null;
}

/** Rust `impl ViewData for ExchangesView`: `build`. */
export function buildExchanges(input: ViewInput): ExchangesView {
  const w = input.world;
  const caps = exchangeCaps(w);
  const constituents: CompanyId[][] = w.zones.map(() => []);
  w.market.stocks.forEach((s, i) => {
    if (s.quoted && s.exchange !== null) {
      (constituents[s.exchange] as CompanyId[]).push(ordinal<CompanyId>(i));
    }
  });
  const exchanges = w.zones.map((zone, i): ExchangeRow => {
    const members = constituents[i] as CompanyId[];
    return {
      zone: ordinal<ZoneId>(i),
      zone_number: zone.number,
      zone_key: zone.key,
      code: zone.exchange_code,
      name: zone.exchange_name,
      hub_city: zone.hub_city,
      hub_province: zone.hub_province,
      index_name: zone.headline_index,
      level: exchangeIndexLevel(w.market.indices[i] as (typeof w.market.indices)[number], caps[i] as number),
      listed_count: members.length,
      confidence: zone.confidence,
      constituents: members,
      closes: {
        log: chunkLogClone((w.market.index_history[i] as (typeof w.market.index_history)[number]).log),
      },
    };
  });
  return { exchanges };
}
