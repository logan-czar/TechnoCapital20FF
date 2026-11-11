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
/** A business unit (spec 3.6). One per company in the MVP; unit n is company n's starting unit. */
export type UnitId = Ordinal<"UnitId">;
/** A startup event that fired, fixed or random (spec 3.1 `startup_events`, 5.19). */
export type StartupEventId = Ordinal<"StartupEventId">;
/** A posted Pdoomberg Wire headline (spec 5.18, 8): its place in post order, from 0 (D544). */
export type HeadlineId = Ordinal<"HeadlineId">;

/** A US politician (politics POC, D980), from `politicians_made`; never a place in the table. */
export type PoliticianId = Ordinal<"PoliticianId">;
/** A US state: its row in `PoliticsState.states` (D980). */
export type UsStateId = Ordinal<"UsStateId">;
/** A House district: its row in `PoliticsState.districts` (D982). */
export type DistrictId = Ordinal<"DistrictId">;
/** An appointed US post: its row in `PoliticsState.posts` (D983, D984). */
export type PoliticsPostId = Ordinal<"PoliticsPostId">;

// The pivot's ids (pivot spec; D1029). Each is a row in the table named; the tables arrive with their
// milestones (M2 to M5), and until then only the contracts (views, actions, protocol) name them.

/** A county: its row in `World.geo.counties`, in FIPS order (pivot 5.1). */
export type CountyId = Ordinal<"CountyId">;
/** A person who outlives office (pivot 5.7), from the persons-made count; never a place in a table. */
export type PersonId = Ordinal<"PersonId">;
/** A race: an office, a place, its primaries and its general (pivot 6.2). */
export type RaceId = Ordinal<"RaceId">;
/** A bill (pivot 7.1). */
export type BillId = Ordinal<"BillId">;
/** A news outlet (pivot 8.2). */
export type OutletId = Ordinal<"OutletId">;
/** A polling firm (pivot 8.4). */
export type PollsterId = Ordinal<"PollsterId">;
/** A social feed account (pivot 8.3): what the player follows there. Not a trading account. */
export type HandleId = Ordinal<"HandleId">;
/** A prediction market contract (pivot 10.1). */
export type ContractId = Ordinal<"ContractId">;
/** Anything an order book trades: a contract now, a stock or an option later (pivot 11.1). */
export type InstrumentId = Ordinal<"InstrumentId">;
/** An order on a book (pivot 11.1), from the orders-made count. */
export type OrderId = Ordinal<"OrderId">;
/** A trading account on a venue: the player's two, and each bettor cohort's (pivot 11.3, 14.1). */
export type AccountId = Ordinal<"AccountId">;

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
