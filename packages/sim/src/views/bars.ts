// The bars of a price history as one array (views/price_bars.rs). A `BarHistory` is a ChunkLog:
// closed month chunks plus the open one, so the UI must not read `log.open` alone. Not a Rust file.

import type { BarHistory, DailyBar } from "../types/state/market.ts";
import { chunkLogRows } from "../world/log.ts";

/** Every daily bar of `h`, oldest first (closed chunks, then the open one). */
export function barRows(h: BarHistory): DailyBar[] {
  return chunkLogRows(h.log);
}
