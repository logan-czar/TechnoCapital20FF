// Ordinal ids (build-plan 2.3 `world/`; crates/sim/src/world/ids.rs). Each table row is addressed
// by its position. Ordinals follow the CSV ids in ascending byte order (D4), so iterating a table
// in ordinal order is iterating it in id order, and "ties go to the lower id" (D2) is "ties go to
// the lower ordinal". Branded numbers: a CompanyId cannot be passed where a ProvinceId is wanted.

declare const brand: unique symbol;

/** A number tagged with the table it indexes. Erased at run time. */
export type Ordinal<Name extends string> = number & { readonly [brand]: Name };

/** A financial zone (spec 3.2.1), from financial-zones.csv `zone_id`. */
export type ZoneId = Ordinal<"ZoneId">;
/** A country (spec 3.2), from countries.csv `iso3`. */
export type CountryId = Ordinal<"CountryId">;
/** A province (spec 3.3), from the provinces-*.csv `id`. The map's province ordinal (spec 9.2). */
export type ProvinceId = Ordinal<"ProvinceId">;
/** An industry (spec 3.4), from industries.csv `id`. */
export type IndustryId = Ordinal<"IndustryId">;
/** A corporation (spec 3.5), from companies.csv `id`; companies born in play append (5.19). */
export type CompanyId = Ordinal<"CompanyId">;
/** A full character (spec 3.7.2), from characters.csv `id`; those made in play append. */
export type CharacterId = Ordinal<"CharacterId">;
/** A business unit (spec 3.6). One per company in the MVP; unit n is company n's starting unit. */
export type UnitId = Ordinal<"UnitId">;
/** A startup event that fired, fixed or random (spec 3.1 `startup_events`, 5.19). */
export type StartupEventId = Ordinal<"StartupEventId">;
/** A posted Pdoomberg Wire headline (spec 5.18, 8): its place in post order, from 0 (D544). */
export type HeadlineId = Ordinal<"HeadlineId">;

/** Rust's `u32::try_from(index).expect(..)`: an ordinal is a whole number in 0..2^32. */
export const MAX_ORDINAL = 0xffff_ffff;

/** Makes an ordinal from a table index (Rust `Ordinal::from_index`). */
export function ordinal<Id extends Ordinal<string>>(index: number): Id {
  if (!Number.isInteger(index) || index < 0 || index > MAX_ORDINAL) {
    throw new RangeError(`table index ${index} is not a u32 ordinal`);
  }
  return index as Id;
}

/** Compares two ordinals for sorting (lower id first, D2). */
export function cmpId<Id extends Ordinal<string>>(a: Id, b: Id): number {
  return a - b;
}
