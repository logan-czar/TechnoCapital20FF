// Every module's jobs in their slots (spec 4). Ported from `register_jobs` and `scheduler` in
// crates/sim/src/lib.rs, with each module's `register` inlined in the same call order.
//
// **Order inside one slot is registration order**, so where two modules put jobs in the same
// slot, the order below is part of the job order and must follow the spec text for that step.
// Slots expected to be shared, in the order their jobs must go (lib.rs docs):
//
// - Alerts: `time` (calendar alerts) only; other modules raise alerts from their own slots
//   through `jobCtxRaiseAlert` (the economy raises the World event alert in 1a).
// - MonthlyAiEvents (4.3 step 1): `economy` (boom and pop, 5.1.1), then `news` (the chatbot
//   headline, 5.18).
// - MonthlyDemand (4.3 step 2): `economy` (demand and labels), then `news` (phase change
//   headlines).
// - MonthlyExpenses (4.3 step 9): `economy` (variable, fixed cash, depreciation, R&D, shared,
//   5.5), then `finance` (the month's ledger opens with those lines; tax accrues at step 14, once
//   interest is known, D227).
// - MonthlyAssets (4.3 step 11): `economy` (asset decay, growth plan buys and sells, ramping,
//   5.10), then `people` (simple characters for new seats, 3.7.1), then `finance` (depreciation,
//   purchases and sales posted).
// - MonthlyCashSettle (4.3 step 13): `finance` (settle, distress, bankruptcy), then `market`
//   (delisting the new bankruptcies, D134), then `news` (bankruptcy headlines).
// - CloseStatements (4.4 close): `finance` (tax paid, then the statements, D122), then `ai`
//   (loss_q from the quarter just archived).
// - ReleasePublish (4.4 release): `finance` (removals, 5.12 step 3), then `news` (removal
//   headlines).
// - PriceMoveResultHeadlines (4.4 price move): `news` only.
// - LockIpoVotes (4.4 plan lock): `births` (votes, then listings, 5.20.1).
// - LockAiPlans (4.4 plan lock): `ai` (the Lite AI batch, every company not frozen, newborns
//   included).
// - LockConsensus (4.4 plan lock): `market` (the projection and consensus, 5.16).
//
// Step 1 of the TS port: only `time` is ported. Every other job is a `notPorted` placeholder
// under its Rust slot and name; the comment on each line names the Rust function a Step 2 builder
// swaps in (keep the line where it is: its position is its order). Once a module is ported, its
// lines may move into that module's own `register(s)` called from here, in the same place.

import * as ai from "./ai/jobs.ts";
import { register as economyRegister } from "./economy/index.ts";
import * as finance from "./finance/jobs.ts";
import { register as opsRegister } from "./ops/index.ts";
import { newSeatsJob } from "./people/seating.ts";
import * as timeAlerts from "./time/alerts.ts";
import { type JobFn, type Scheduler, schedulerNew, schedulerRegister } from "./time/scheduler.ts";

/**
 * A placeholder for a job not ported yet: a no-op that records nothing. `rustPath` names the Rust
 * function it stands for.
 */
function notPorted(rustPath: string): JobFn {
  const job: JobFn = () => {};
  Object.defineProperty(job, "name", { value: `notPorted(${rustPath})` });
  return job;
}

/**
 * Registers every module's jobs in their slots (spec 4), in Rust's `register_jobs` order: time,
 * economy, ops, people, finance, market, births, ai, news, recap. The scheduler itself never
 * changes.
 */
export function registerJobs(s: Scheduler): void {
  const r = schedulerRegister;

  // time::alerts::register
  timeAlerts.register(s);

  // economy::register (crates/sim/src/economy/mod.rs)
  economyRegister(s);

  // ops::register (crates/sim/src/ops/mod.rs)
  opsRegister(s);

  // people::register (crates/sim/src/people/mod.rs)
  r(s, "MonthlyAssets", "people.new_seats", newSeatsJob); // people/seating newSeatsJob

  // finance::register (crates/sim/src/finance/jobs.rs)
  r(s, "MonthlyExpenses", "finance.open_month", finance.openMonthJob); // finance/jobs openMonthJob
  r(s, "MonthlyAssets", "finance.post_assets", finance.postAssetsJob); // finance/jobs postAssetsJob
  r(s, "MonthlyInterest", "finance.interest", finance.interestJob); // finance/jobs interestJob
  r(s, "MonthlyCashSettle", "finance.settle", finance.settleJob); // finance/jobs settleJob
  r(s, "MonthlyLedger", "finance.ledger", finance.ledgerJob); // finance/jobs ledgerJob
  // D122: the close pays the tax and then compiles, both here; the CloseTax slot stays empty.
  r(s, "CloseStatements", "finance.close", finance.closeJob); // finance/jobs closeJob
  r(s, "ReleasePublish", "finance.removals", finance.removalsJob); // finance/jobs removalsJob
  r(s, "PriceMoveRatingReview", "finance.rating_review", finance.ratingReviewJob); // finance/jobs ratingReviewJob
  r(s, "PriceMoveCreditLineReview", "finance.line_review", finance.lineReviewJob); // finance/jobs lineReviewJob
  r(s, "YearlyAnnualStatements", "finance.annual_statements", finance.annualStatementsJob); // finance/jobs annualStatementsJob

  // market::register (crates/sim/src/market/jobs.rs)
  r(s, "SharePrices", "market.prices", notPorted("market::jobs::prices_job")); // market/jobs pricesJob
  r(s, "PriceMoveFairValue", "market.full_fair_value", notPorted("market::jobs::full_fair_value_job")); // market/jobs fullFairValueJob
  r(s, "PriceMoveEarningsJump", "market.earnings_jump", notPorted("market::jobs::earnings_jump_job")); // market/jobs earningsJumpJob
  r(s, "PriceMoveBuzz", "market.buzz", notPorted("market::jobs::buzz_job")); // market/jobs buzzJob
  r(s, "DailyPriceBars", "market.bars", notPorted("market::jobs::bars_job")); // market/jobs barsJob
  r(s, "DailyFairValue", "market.fair_value", notPorted("market::jobs::fair_value_job")); // market/jobs fairValueJob
  r(s, "DailyReactionWeek", "market.reaction_week", notPorted("market::jobs::reaction_week_job")); // market/jobs reactionWeekJob
  r(s, "DailyZoneConfidence", "market.zone_confidence", notPorted("market::jobs::zone_confidence_job")); // market/jobs zoneConfidenceJob
  r(s, "MonthlyCashSettle", "market.delist", notPorted("market::jobs::delist_job")); // market/jobs delistJob
  r(s, "CloseResultTags", "market.result_tags", notPorted("market::jobs::result_tags_job")); // market/jobs resultTagsJob
  r(s, "LockConsensus", "market.consensus", notPorted("market::jobs::consensus_job")); // market/jobs consensusJob
  r(s, "YearlyArchive", "market.archive_bars", notPorted("market::jobs::archive_bars_job")); // market/jobs archiveBarsJob

  // births::jobs::register (crates/sim/src/births/jobs.rs)
  r(s, "LockFixedStartupEvents", "births.fixed_events", notPorted("births::jobs::fixed_events_job")); // births/jobs fixedEventsJob
  r(s, "LockRandomStartupEvents", "births.random_events", notPorted("births::jobs::random_events_job")); // births/jobs randomEventsJob
  r(s, "LockIpoVotes", "births.ipo_votes_and_listings", notPorted("births::jobs::ipo_job")); // births/jobs ipoJob

  // ai::jobs::register (crates/sim/src/ai/jobs.rs)
  r(s, "CloseStatements", "ai.loss_quarters", ai.lossQuartersJob); // ai/jobs lossQuartersJob
  r(s, "LockAiPlans", "ai.plan_lock", notPorted("ai::jobs::plan_lock_job")); // ai/jobs planLockJob

  // news::jobs::register (crates/sim/src/news/jobs.rs)
  r(s, "MonthlyAiEvents", "news.chatbot", notPorted("news::jobs::chatbot_news_job")); // news/jobs chatbotNewsJob
  r(s, "MonthlyDemand", "news.phase_changes", notPorted("news::jobs::phase_news_job")); // news/jobs phaseNewsJob
  r(s, "MonthlyCashSettle", "news.bankruptcies", notPorted("news::jobs::bankruptcy_news_job")); // news/jobs bankruptcyNewsJob
  r(s, "ReleasePublish", "news.removals", notPorted("news::jobs::removal_news_job")); // news/jobs removalNewsJob
  r(s, "PriceMoveResultHeadlines", "news.results_and_ratings", notPorted("news::jobs::result_news_job")); // news/jobs resultNewsJob
  r(s, "DailyNews", "news.post", notPorted("news::jobs::daily_news_job")); // news/jobs dailyNewsJob

  // recap::jobs::register (crates/sim/src/recap/jobs.rs)
  r(s, "RecapBuild", "recap.build", notPorted("recap::jobs::recap_job")); // recap/jobs recapJob
}

/**
 * Rust `sim::scheduler()`: a scheduler with every module's jobs, as a game runs them: for
 * re-running steps on a cloned world (the spec 5.16 projections) and for tests that drive the
 * slots directly.
 */
export function scheduler(): Scheduler {
  const s = schedulerNew();
  registerJobs(s);
  return s;
}
