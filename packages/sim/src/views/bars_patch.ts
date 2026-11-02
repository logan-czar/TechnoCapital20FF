// Posting v_price_bars as new bars only. The view holds every company's whole history and moves daily,
// so posting it whole cost about 50 MB a frame by a run's eighth year, faster than the UI could read
// it, until the worker's postMessage ran out of memory (D1004). The worker keeps what it has posted,
// a frame carries what is new, and the UI joins it to what it holds, as `news_appended` does for the
// news feed. `viewsPatchSince` is left as it is. Not a Rust file.

import type { CompanyId } from "../types/ids.ts";
import type { PriceBarsDelta, PriceBarsDeltaRow, ViewsPatch } from "../types/protocol.ts";
import type { DailyBar } from "../types/state/market.ts";
import type { View } from "../types/views/index.ts";
import type { PriceBarsView, PriceHistory } from "../types/views/price_bars.ts";
import { appendBufFromRows, appendBufRows } from "../world/log.ts";

/** What the worker has posted of one company's bars. */
interface PostedCompany {
  /** The closed chunks, by reference: a chunk never changes once closed. */
  chunks: DailyBar[][];
  /** Rows of the open chunk. */
  open: number;
}

/** What the worker has posted of the view, by company. */
export type PostedBars = Map<number, PostedCompany>;

/** Nothing posted: the next frame carries every history whole. */
export function postedBarsNone(): PostedBars {
  return new Map();
}

/** One company's new bars since `prev`, or null when it has none. */
function deltaRow(id: CompanyId, chunks: DailyBar[][], open: DailyBar[], prev: PostedCompany | undefined) {
  let drop = 0;
  let reset = prev === undefined;
  if (prev !== undefined) {
    // Old chunks fall off the front at the 10-year limit; any other change resends the history.
    drop = chunks.length === 0 ? prev.chunks.length : prev.chunks.indexOf(chunks[0] as DailyBar[]);
    if (drop < 0) reset = true;
    else {
      const kept = prev.chunks.length - drop;
      if (chunks.length < kept) reset = true;
      for (let i = 0; i < kept && !reset; i++) {
        if (prev.chunks[drop + i] !== chunks[i]) reset = true;
      }
    }
  }
  const closed = reset || prev === undefined ? chunks : chunks.slice(prev.chunks.length - drop);
  const openReset = reset || prev === undefined || closed.length > 0 || open.length < prev.open;
  const added = openReset ? open : open.slice(prev.open);
  if (!reset && drop === 0 && closed.length === 0 && added.length === 0 && !openReset) return null;
  const row: PriceBarsDeltaRow = {
    id,
    reset,
    drop: reset ? 0 : drop,
    closed,
    open_reset: openReset,
    open: added,
  };
  return row;
}

/**
 * Replaces a patch's `price_bars` with `price_bars_delta`, and records what it carries in `posted`.
 * A patch without the view is left as it is.
 */
export function priceBarsCompact(patch: ViewsPatch, posted: PostedBars): void {
  const view = patch.price_bars;
  if (view === undefined) return;
  const rows: PriceBarsDeltaRow[] = [];
  const seen = new Set<number>();
  for (const c of view.data.companies) {
    seen.add(c.id);
    const chunks = appendBufRows(c.bars.log.closed);
    const open = appendBufRows(c.bars.log.open);
    const row = deltaRow(c.id, chunks, open, posted.get(c.id));
    if (row !== null) rows.push(row);
    posted.set(c.id, { chunks, open: open.length });
  }
  const removed: CompanyId[] = [];
  for (const id of posted.keys()) {
    if (!seen.has(id)) {
      removed.push(id as CompanyId);
      posted.delete(id);
    }
  }
  delete patch.price_bars;
  patch.price_bars_delta = { version: view.version, dirty: view.dirty, rows, removed };
}

/** The view after a frame's delta: `old` as the UI holds it, plus what is new. */
export function priceBarsApply(
  old: View<PriceBarsView> | undefined,
  delta: PriceBarsDelta,
): View<PriceBarsView> {
  const byId = new Map<number, PriceHistory>((old?.data.companies ?? []).map((c) => [c.id, c]));
  for (const id of delta.removed) byId.delete(id);
  for (const r of delta.rows) {
    const had = r.reset ? undefined : byId.get(r.id);
    const closed = [...(had ? appendBufRows(had.bars.log.closed).slice(r.drop) : []), ...r.closed];
    const open = r.open_reset || !had ? r.open : [...appendBufRows(had.bars.log.open), ...r.open];
    byId.set(r.id, {
      id: r.id,
      bars: { log: { closed: appendBufFromRows(closed), open: appendBufFromRows(open) } },
    });
  }
  const companies = [...byId.values()].sort((a, b) => a.id - b.id);
  return { data: { companies }, version: delta.version, dirty: delta.dirty };
}
