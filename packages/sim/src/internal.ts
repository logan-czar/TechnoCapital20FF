// Test and headless access to the raw world (Rust's `test-hooks` and `soak-stats` features).
// apps/web must never import this (Biome rule and scripts/ts/boundary.ts).

export { DEBT_HOLD_SHARE_PER_LEVEL, debtAggressionOf } from "./ai/financing.ts";
export * from "./economy/profiles.ts";
export {
  grossAssets as companyGrossAssets,
  sheet as companySheet,
  trailingRevenue as companyTrailingRevenue,
} from "./finance/jobs.ts";
export { companyFinanceStatus } from "./finance/state.ts";
export * from "./index.ts";
// The clock and scheduler (time/) and every module's jobs in their slots (jobs.ts).
export * from "./jobs.ts";
// The whole Sim (lib.ts) with its test and soak hooks, the soak totals and the views framework.
export * from "./lib.ts";
export * from "./soak.ts";
export * from "./time/index.ts";
export * from "./types/calendar.ts";
export * from "./types/collections.ts";
export * from "./types/draws.ts";
export * from "./types/ids.ts";
export * from "./types/log.ts";
export * from "./types/num.ts";
export * from "./types/state/ai.ts";
export * from "./types/state/births.ts";
export * from "./types/state/finance.ts";
export * from "./types/state/map.ts";
export * from "./types/state/market.ts";
export * from "./types/state/news.ts";
export * from "./types/state/ops.ts";
export * from "./types/state/people.ts";
export * from "./types/state/recap.ts";
// Module-owned state types (one file per owning Rust module). The finance rating band shares the
// name `Band` with the estimate band; the explicit export keeps the estimate band's plain name
// (as ./types/views/index.ts does) and the rating band stays `RatingBand`.
export type { Band } from "./types/views/estimate.ts";
export * from "./types/world.ts";
export * from "./views/index.ts";
