// Asset sales at the sale factor (spec 5.10; 10.0.7): capacity sold at cost, the same share of the
// book, cash received `book sold × sale factor`, and the gain or loss in pre-tax income. Used by
// growth plan sales (4.3 step 11), forced sales in distress (5.12 step 1, 4.3 step 13) and the
// removal sale at the Bust factor (5.12 step 3). Ported from crates/sim/src/finance/sales.rs.
//
// The sale factor table is economy's: `saleFactor` (economy/assets.ts) of the industry's
// PhaseLabel (Boom 1.00, Normal 0.85, Glut 0.70, Bust 0.60). These functions take the factor as
// an input.
//
// AssetSale is in types/state/finance.ts.

import { SALE_FACTOR_BUST } from "../economy/assets.ts";
import { maxF, minF } from "../types/num.ts";
import type { AssetSale } from "../types/state/finance.ts";

export type { AssetSale };

/** Spec 5.12 step 3: a removed company's assets sell at the Bust factor whatever the label. */
export const REMOVAL_SALE_FACTOR = SALE_FACTOR_BUST;

/** Rust `AssetSale::default()`. */
export function assetSaleDefault(): AssetSale {
  return { capacity_sold: 0, book_sold: 0, proceeds: 0, gain: 0, share: 0 };
}

/**
 * Sells `capacity` of a unit's gross assets (spec 5.10): the book sold is the same share of
 * asset_book; capacity is capped at what the unit has.
 */
export function sellCapacity(
  gross_assets: number,
  asset_book: number,
  capacity: number,
  factor: number,
): AssetSale {
  if (gross_assets <= 0.0 || capacity <= 0.0) return assetSaleDefault();
  const sold = minF(capacity, gross_assets);
  const share = sold / gross_assets;
  return saleOfShare(gross_assets, asset_book, share, factor);
}

/**
 * Sells just enough to raise `cash_needed` (spec 5.12 step 1: "sells assets at the sale factor
 * until cash reaches 0"), or everything if that is not enough. A unit with no book left raises
 * nothing and sells nothing (D225).
 */
export function sellForCash(
  gross_assets: number,
  asset_book: number,
  cash_needed: number,
  factor: number,
): AssetSale {
  if (gross_assets <= 0.0 || asset_book <= 0.0 || cash_needed <= 0.0 || factor <= 0.0) {
    return assetSaleDefault();
  }
  const share = minF(cash_needed / factor / asset_book, 1.0);
  return saleOfShare(gross_assets, asset_book, share, factor);
}

/** Sells everything (spec 5.12 step 3, at `REMOVAL_SALE_FACTOR`). */
export function sellAll(gross_assets: number, asset_book: number, factor: number): AssetSale {
  if (gross_assets <= 0.0 && asset_book <= 0.0) return assetSaleDefault();
  return saleOfShare(gross_assets, asset_book, 1.0, factor);
}

function saleOfShare(gross_assets: number, asset_book: number, share: number, factor: number): AssetSale {
  // Selling the whole unit takes the exact balances, so nothing is left from float error.
  const [capacity_sold, book_sold] =
    share >= 1.0
      ? [maxF(gross_assets, 0.0), maxF(asset_book, 0.0)]
      : [gross_assets * share, asset_book * share];
  const proceeds = book_sold * factor;
  return {
    capacity_sold,
    book_sold,
    proceeds,
    gain: proceeds - book_sold,
    share: minF(share, 1.0),
  };
}
