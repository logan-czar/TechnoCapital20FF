// Types from sim modules other than views/, world/ and time/ that the views carry in their
// fields, re-exported from their owning module's file in ../state/ so the views (and the public
// face, through ./index.ts) can name them. Nothing is declared here.

export type { Archetype, FinancingPlan, LockedPlan, OperatingPlan, RaiseMethod } from "../state/ai.ts";
export { ARCHETYPE_VALUES } from "../state/ai.ts";
export type { EventKind, EventType } from "../state/births.ts";
export type {
  BalanceSheet,
  Band,
  CompanyStatus,
  ImpliedRating,
  KeyFigures,
  Ledger,
  Period,
  PostedMonth,
  Rating,
  Statement,
} from "../state/finance.ts";
export { RATING_VALUES } from "../state/finance.ts";
export type { BorderKind, MapGeo, MapInfo, Neighbor, ProvinceShape } from "../state/map.ts";
export type { BarHistory, DailyBar, IndexClose, IndexHistory, SurpriseTag } from "../state/market.ts";
export type { Headline, HeadlineKind } from "../state/news.ts";
export type { ComputeBill, Stations } from "../state/ops.ts";
export type { Seat, Skills, Trait } from "../state/people.ts";
export { SEAT_LABOR, SEAT_VALUES, TRAIT_VALUES } from "../state/people.ts";
export type { Outlook, RatingWatch } from "../state/recap.ts";
