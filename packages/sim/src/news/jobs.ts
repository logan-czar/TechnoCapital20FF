// The Pdoomberg Wire on the World (build-plan M6.5): each headline type of spec 5.18 queued where
// its event happens, and the daily post (4.2 step 5) whose headlines move their exchanges'
// confidence (4.2 step 6, 5.1.2; D137). Ported from crates/sim/src/news/jobs.rs.
//
// | Headline (5.18) | Queued in |
// |---|---|
// | Phase change | 4.3 step 2, after the labels move |
// | Chatbot (5.1.1) | 4.3 step 1a, the boom day |
// | Bankruptcy | 4.3 step 13, after the settle and the delisting |
// | Removal | 4.4 release, after the removals |
// | Five largest beats and misses; rating changes of 2+ notches | 4.4 price move step 6 |
// | Startup events, IPO votes, listings | the plan lock (`births::jobs`) |
// | Raises and failed raises | the plan lock's batch (`ai::jobs`, parked with 6.6) |
//
// A headline is dated the day it is made and posts at the next 00:00 daily job (4.2 step 5 runs
// before the monthly and quarterly jobs of the same tick; D158).

import { AI_LABS_KEY, tippedLabName } from "../births/jobs.ts";
import { companyIsFrozen } from "../economy/index.ts";
import { ratingShifted } from "../finance/rating.ts";
import {
  bankruptcy,
  chatbot,
  newsWirePostDay,
  newsWireQueue,
  phaseChange,
  ratingChange,
  removal,
  result,
  topResults,
} from "../news.ts";
import { type JobCtx, type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import { dateEq } from "../types/calendar.ts";
import type { CompanyId, IndustryId } from "../types/ids.ts";
import { ordinal } from "../types/ids.ts";
import type { World } from "../types/world.ts";

/**
 * 4.3 step 2 (news part, after the economy's labels): each industry whose phase label changed
 * since the last month posts one headline (spec 5.18; D279 text).
 */
export function phaseNewsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  if (world.news.labels.length === world.industries.length) {
    for (let i = 0; i < world.industries.length; i++) {
      const ind = world.industries[i] as World["industries"][number];
      const old = world.news.labels[i] as World["news"]["labels"][number];
      if (old !== ind.phase_label) {
        newsWireQueue(world.news, phaseChange(date, ordinal<IndustryId>(i), ind.name, old, ind.phase_label));
      }
    }
  }
  world.news.labels = world.industries.map((i) => i.phase_label);
}

/**
 * 4.3 step 1a (news part, after the boom event): on the boom day "[tipped lab] launches its
 * chatbot" (spec 5.1.1, 5.18).
 */
export function chatbotNewsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  if (!dateEq(date, world.ai.boom_date) || world.ai.stage !== "Boom") return;
  const labs = world.industries.findIndex((i) => i.key === AI_LABS_KEY);
  if (labs < 0) return;
  const name = tippedLabName(world);
  newsWireQueue(world.news, chatbot(date, ordinal<IndustryId>(labs), world.births.tipped_lab, name));
}

/**
 * 4.3 step 13 (news part, after finance's settle and the delisting): each company that went
 * Bankrupt today (spec 5.12 step 2, 5.18). D137 supersedes D126: the headline is the wire's, and
 * its −5 confidence reaches the company's exchange through the next daily post.
 */
export function bankruptcyNewsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as World["companies"][number];
    const on = c.finance.bankrupt_on;
    if (on !== null && dateEq(on, date)) {
      newsWireQueue(world.news, bankruptcy(date, c.industry, ordinal<CompanyId>(i), c.name));
    }
  }
}

/** 4.4 release (news part, after the removals): each company removed today (spec 5.12 step 3). */
export function removalNewsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as World["companies"][number];
    const on = c.finance.removed_on;
    if (on !== null && dateEq(on, date)) {
      newsWireQueue(world.news, removal(date, c.industry, ordinal<CompanyId>(i), c.name));
    }
  }
}

/**
 * 4.4 price move step 6 (spec 5.18): the release's five largest beats and five largest misses
 * among the quoted companies (a private company publishes no results, D157), then every rating
 * change of 2 or more notches at this morning's review.
 */
export function resultNewsJob(world: World, ctx: JobCtx): void {
  const date = ctx.facts.date;
  const results: [CompanyId, number][] = [];
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as World["companies"][number];
    const s = world.market.stocks[i] as World["market"]["stocks"][number];
    if (!companyIsFrozen(c) && s.quoted) results.push([ordinal<CompanyId>(i), s.last_surprise]);
  }
  const [beats, misses] = topResults(results);
  for (const [id, s] of [...beats, ...misses]) {
    const c = world.companies[id] as World["companies"][number];
    const h = result(date, c.industry, id, c.name, s);
    if (h !== null) newsWireQueue(world.news, h);
  }
  for (let i = 0; i < world.companies.length; i++) {
    const c = world.companies[i] as World["companies"][number];
    const f = c.finance;
    if (companyIsFrozen(c) || f.last_review_notches === 0) continue;
    const from = ratingShifted(f.rating, -f.last_review_notches);
    const h = ratingChange(date, c.industry, ordinal<CompanyId>(i), c.name, from, f.rating);
    if (h !== null) newsWireQueue(world.news, h);
  }
}

/** 4.2 step 5 (spec 5.18): the day's queued headlines post to the feed; 4.2 step 6 reads them. */
export function dailyNewsJob(world: World, ctx: JobCtx): void {
  newsWirePostDay(world.news, ctx.facts.date);
}

/**
 * Registers the news jobs. jobs.ts registers each line in its Rust order, after the economy,
 * finance and market, so each reads the state its slot's other jobs leave.
 */
export function register(s: Scheduler): void {
  const r = schedulerRegister;
  r(s, "MonthlyAiEvents", "news.chatbot", chatbotNewsJob);
  r(s, "MonthlyDemand", "news.phase_changes", phaseNewsJob);
  r(s, "MonthlyCashSettle", "news.bankruptcies", bankruptcyNewsJob);
  r(s, "ReleasePublish", "news.removals", removalNewsJob);
  r(s, "PriceMoveResultHeadlines", "news.results_and_ratings", resultNewsJob);
  r(s, "DailyNews", "news.post", dailyNewsJob);
}
