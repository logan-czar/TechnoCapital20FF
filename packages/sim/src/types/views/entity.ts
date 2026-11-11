// A reference from one thing the player reads to another (pivot 8, 15.3): an article names a
// person, a notification names a contract. The desktop's apps turn one into a link
// (apps/web/src/links/nav.ts `openApp`).

/** What an `EntityRef` can name. */
export type EntityKind =
  | "Person"
  | "Race"
  | "Bill"
  | "Company"
  | "Industry"
  | "State"
  | "County"
  | "District"
  | "Outlet"
  | "Pollster"
  | "Handle"
  | "Contract";

/** EntityKind in declaration order. */
export const ENTITY_KIND_VALUES = [
  "Person",
  "Race",
  "Bill",
  "Company",
  "Industry",
  "State",
  "County",
  "District",
  "Outlet",
  "Pollster",
  "Handle",
  "Contract",
] as const;

/**
 * One thing, by kind and id: `id` is that kind's branded id (types/ids.ts: `PersonId` for
 * "Person", `UsStateId` for "State", `HandleId` for "Handle", and so on), as a plain number.
 */
export interface EntityRef {
  kind: EntityKind;
  id: number;
}
