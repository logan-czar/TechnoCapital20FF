// The Pdoomberg Wire news feed (build-plan M6.5): headline types, the daily post and the
// release-day result headlines. Ported from crates/sim/src/news.rs (news/jobs.rs is
// ./news/jobs.ts).
//
// Spec sections: 5.18, 8 (News feed); scheduled in 4.2 step 5 and the 4.4 price move.
//
// Formula half (lane F, F6): one constructor per 5.18 headline type, the release-day picks (the
// five largest beats and misses), the queue the daily job posts from, and the tipped lab that
// names the chatbot headline (5.1.1). No scheduler wiring. Every headline carries the neutral
// **Pdoomberg Wire** byline (5.18 A); texts follow 5.18's wording where it gives one and D279
// where it does not.
//
// HeadlineKind, Headline and NewsWire (the data) are in types/state/news.ts.

import { ratingLabel, notchesBetween } from "./finance/rating.ts";
import { type ConfidenceHeadline, RATING_CHANGE_MIN_NOTCHES } from "./market/confidence.ts";
import { surpriseTagFromSurprise } from "./market/earnings.ts";
import { monthEq, type SimDate } from "./types/calendar.ts";
import { cmpDate } from "./types/calendar.ts";
import { simDateMonthOf } from "./time/calendar.ts";
import type { DrawSource } from "./types/draws.ts";
import type { CompanyId, IndustryId, StartupEventId } from "./types/ids.ts";
import { ordinal } from "./types/ids.ts";
import { roundHalfAway, totalCmp } from "./types/num.ts";
import type { RaiseMethod } from "./types/state/ai.ts";
import type { Rating } from "./types/state/finance.ts";
import type { Headline, HeadlineKind, NewsWire } from "./types/state/news.ts";
import { BYLINE } from "./types/state/news.ts";
import type { PhaseLabel } from "./types/world.ts";
import { phaseLabelName } from "./world/entities.ts";
import { chunkLogLast, chunkLogNew, chunkLogPush, chunkLogIter } from "./world/log.ts";
import type { HeadlineId } from "./types/ids.ts";

export type { Headline, HeadlineKind, NewsWire };
export { BYLINE };

/** Spec 5.18: each release posts the five largest beats and the five largest misses (D279). */
export const TOP_RESULTS = 5;
/** Spec 5.18: a rating change posts at 2 or more notches. */
export const RATING_HEADLINE_MIN_NOTCHES = RATING_CHANGE_MIN_NOTCHES;
/** Spec 7-starting-world 7.6: the tip names one of five candidate labs (A). */
export const TIPPED_LAB_CANDIDATES = 5;
/** Percent, for headline figures. */
export const PERCENT = 100.0;
/** USD per $M, for headline figures. */
export const USD_PER_MILLION = 1.0e6;

/** Rust `Headline::of_event`: the headline as the report of startup event `event` (D543). */
export function headlineOfEvent(h: Headline, event: StartupEventId): Headline {
  h.event = event;
  return h;
}

/** Rust `Headline::byline`: always `BYLINE` (spec 5.18 A). */
export function headlineByline(_h: Headline): string {
  return BYLINE;
}

/**
 * The 5.1.2 confidence points this headline carries for its company's exchange, if any: beats and
 * misses, bankruptcies and rating changes of 2+ notches. Rust `Headline::confidence`.
 */
export function headlineConfidence(h: Headline): ConfidenceHeadline | null {
  const k = h.kind;
  switch (k.kind) {
    case "Result":
      return { kind: k.tag };
    case "Bankruptcy":
      return { kind: "Bankruptcy" };
    case "RatingChange":
      return { kind: "RatingChange", notches: notchesBetween(k.from, k.to) };
    default:
      return null;
  }
}

function headline(
  date: SimDate,
  industry: IndustryId | null,
  company: CompanyId | null,
  kind: HeadlineKind,
  text: string,
): Headline {
  return { id: ordinal<HeadlineId>(0), date, industry, company, event: null, kind, text };
}

/**
 * Rust `format!("{:.N}")` for N 0 or 1: Rust rounds an exact tie to even, JS toFixed to the
 * larger. The exact binary ties are x = k + 0.5 (N 0) and x = j / 4 with j odd (N 1; then x * 10
 * is exact, a half-integer).
 */
function fmtFixed(x: number, digits: 0 | 1): string {
  const scaled = digits === 0 ? x : (x * 4) % 2 !== 0 && Number.isInteger(x * 4) ? x * 10 : Number.NaN;
  const lo = Math.floor(scaled);
  if (scaled - lo === 0.5) {
    const even = lo % 2 === 0 ? lo : lo + 1;
    return digits === 0 ? even.toFixed(0) : (even / 10).toFixed(1);
  }
  return x.toFixed(digits);
}

/** A whole percent for a headline (|s| × 100, rounded). */
function pct(x: number): string {
  return fmtFixed(roundHalfAway(Math.abs(x) * PERCENT), 0);
}

/**
 * Spec 5.18: each phase change posts one headline for the industry (D279: "[Industry] moves from
 * [old] to [new]").
 */
export function phaseChange(
  date: SimDate,
  industry: IndustryId,
  industryName: string,
  from: PhaseLabel,
  to: PhaseLabel,
): Headline {
  return headline(
    date,
    industry,
    null,
    { kind: "PhaseChange", from, to },
    `${industryName} moves from ${phaseLabelName(from)} to ${phaseLabelName(to)}`,
  );
}

/** A release-day beat or miss (spec 5.18, 5.15 tags; D279), or null inside ±5%. */
export function result(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  surprise: number,
): Headline | null {
  const tag = surpriseTagFromSurprise(surprise);
  if (tag === null) return null;
  const p = pct(surprise);
  let text: string;
  switch (tag) {
    case "BigBeat":
      text = `${name} posts a big beat, ${p}% over consensus`;
      break;
    case "Beat":
      text = `${name} beats consensus by ${p}%`;
      break;
    case "Miss":
      text = `${name} misses consensus by ${p}%`;
      break;
    case "BigMiss":
      text = `${name} posts a big miss, ${p}% under consensus`;
      break;
  }
  return headline(date, industry, company, { kind: "Result", tag, surprise }, text);
}

/** Release picks: (company, surprise s), in post order. */
export type Picks = [CompanyId, number][];

/**
 * The release's picks (spec 5.18 "the five largest beats and misses"; D279): the five largest
 * beats (s above +5%, largest first) and the five largest misses (s below −5%, worst first),
 * ties to the lower id. Input is (company, s) for every company that reported.
 */
export function topResults(results: readonly (readonly [CompanyId, number])[]): [Picks, Picks] {
  const beats: Picks = [];
  const misses: Picks = [];
  for (const [c, s] of results) {
    const tag = surpriseTagFromSurprise(s);
    if (tag === "Beat" || tag === "BigBeat") beats.push([c, s]);
    else if (tag === "Miss" || tag === "BigMiss") misses.push([c, s]);
  }
  beats.sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);
  misses.sort((a, b) => totalCmp(a[1], b[1]) || a[0] - b[0]);
  beats.length = Math.min(beats.length, TOP_RESULTS);
  misses.length = Math.min(misses.length, TOP_RESULTS);
  return [beats, misses];
}

/** Spec 5.18: a bankruptcy (5.12 step 2). */
export function bankruptcy(date: SimDate, industry: IndustryId, company: CompanyId, name: string): Headline {
  return headline(
    date,
    industry,
    company,
    { kind: "Bankruptcy" },
    `${name} goes bankrupt; shareholders wiped out`,
  );
}

/** Spec 5.18: a removal (5.12 step 3). */
export function removal(date: SimDate, industry: IndustryId, company: CompanyId, name: string): Headline {
  return headline(
    date,
    industry,
    company,
    { kind: "Removal" },
    `${name} is wound up and removed after its bankruptcy`,
  );
}

/** Spec 5.18: a rating change of 2+ notches, or null for a smaller move. */
export function ratingChange(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  from: Rating,
  to: Rating,
): Headline | null {
  const n = notchesBetween(from, to);
  if (Math.abs(n) < RATING_HEADLINE_MIN_NOTCHES) return null;
  const verb = n > 0 ? "upgraded" : "downgraded";
  return headline(
    date,
    industry,
    company,
    { kind: "RatingChange", from, to },
    `${name} ${verb} ${Math.abs(n)} notches to ${ratingLabel(to)}, from ${ratingLabel(from)}`,
  );
}

/** Spec 5.18, 6.6: a raise that succeeded. */
export function raise(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  method: RaiseMethod,
  netUsd: number | null,
): Headline {
  const how = method === "CreditLine" ? "on its credit line" : "in a share issue";
  const text =
    netUsd !== null
      ? `${name} raises $${fmtFixed(netUsd / USD_PER_MILLION, 1)}M ${how}`
      : `${name} raises money ${how}`;
  return headline(date, industry, company, { kind: "Raise", method, net_usd: netUsd }, text);
}

/** Spec 5.18, 6.6: a raise that failed. */
export function failedRaise(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  method: RaiseMethod,
): Headline {
  const how = method === "CreditLine" ? "draw on its credit line" : "sell new shares";
  return headline(date, industry, company, { kind: "FailedRaise", method }, `${name} fails to ${how}`);
}

/** Spec 5.18: a fixed startup event posts its own line (D279: "[event name]: [n] new startups"). */
export function fixedEvent(date: SimDate, eventId: string, eventName: string, startups: number): Headline {
  return headline(
    date,
    null,
    null,
    { kind: "FixedStartupEvent", event: eventId, startups },
    `${eventName}: ${startups} new startups`,
  );
}

/** Spec 5.18 F4: "[tipped lab]'s chatbot sets off a startup rush: [n] new AI labs". */
export function chatbotRush(date: SimDate, eventId: string, aiLabs: IndustryId, tippedLab: string, n: number): Headline {
  return headline(
    date,
    aiLabs,
    null,
    { kind: "FixedStartupEvent", event: eventId, startups: n },
    `${tippedLab}'s chatbot sets off a startup rush: ${n} new AI labs`,
  );
}

/** Spec 5.18: a random event's startup, "[Name] launches in [industry] in [city or province]". */
export function startupLaunch(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  industryName: string,
  place: string,
): Headline {
  return headline(
    date,
    industry,
    company,
    { kind: "StartupLaunch" },
    `${name} launches in ${industryName} in ${place}`,
  );
}

/** Spec 5.18: a hot cluster, "[n] startups launch in [industry] in [city]". */
export function hotCluster(date: SimDate, industry: IndustryId, industryName: string, place: string, n: number): Headline {
  return headline(
    date,
    industry,
    null,
    { kind: "HotCluster", startups: n },
    `${n} startups launch in ${industryName} in ${place}`,
  );
}

/**
 * Spec 5.18: an IPO vote, "[Name] board votes to list on [exchange code], [yes] to [no]" or
 * "[Name] board votes against listing, [no] to [yes]". `votes` is (yes, no).
 */
export function ipoVote(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  exchange: string,
  passed: boolean,
  votes: readonly [number, number],
): Headline {
  const [yes, no] = votes;
  const text = passed
    ? `${name} board votes to list on ${exchange}, ${yes} to ${no}`
    : `${name} board votes against listing, ${no} to ${yes}`;
  return headline(date, industry, company, { kind: "IpoVote", passed, yes, no, exchange }, text);
}

/** Spec 5.18: a listing, "[Name] lists on [exchange code] at $[price], raising $[net]M". */
export function listing(
  date: SimDate,
  industry: IndustryId,
  company: CompanyId,
  name: string,
  exchange: string,
  price: number,
  netUsd: number,
): Headline {
  return headline(
    date,
    industry,
    company,
    { kind: "Listing", exchange, price, net_usd: netUsd },
    `${name} lists on ${exchange} at $${fmtFixed(price, 0)}, raising $${fmtFixed(netUsd / USD_PER_MILLION, 1)}M`,
  );
}

/** Spec 5.1.1, 5.18: the boom event, "[tipped lab] launches its chatbot". */
export function chatbot(date: SimDate, aiLabs: IndustryId, company: CompanyId | null, tippedLab: string): Headline {
  return headline(date, aiLabs, company, { kind: "Chatbot" }, `${tippedLab} launches its chatbot`);
}

/**
 * The five candidate labs for the tip (7-starting-world 7.6: "rows in AI labs", A; D281): the
 * five largest AI labs companies by starting revenue, ties to the lower id. Input is (company,
 * starting revenue) of every AI labs company.
 */
export function tippedLabCandidates(labs: readonly (readonly [CompanyId, number])[]): CompanyId[] {
  const v = [...labs];
  v.sort((a, b) => totalCmp(b[1], a[1]) || a[0] - b[0]);
  return v.slice(0, TIPPED_LAB_CANDIDATES).map(([id]) => id);
}

/**
 * The tipped lab (spec 5.1.1 A, D111, D281): one candidate, uniform on the gen stream, drawn at
 * load right after the pop roll. null with no candidate.
 */
export function drawTippedLab(candidates: readonly CompanyId[], draws: DrawSource): CompanyId | null {
  if (candidates.length === 0) return null;
  const i = draws.intInclusive("Gen", 0, candidates.length - 1);
  return candidates[i] as CompanyId;
}

/** Rust `NewsWire::default()`: empty queue, feed, today and labels. */
export function newsWireDefault(): NewsWire {
  return { queued: [], feed: chunkLogNew(), today: [], labels: [] };
}

export function newsWireQueue(w: NewsWire, h: Headline): void {
  w.queued.push(h);
}

/**
 * 4.2 step 5: posts every queued headline dated on or before `today`, in queue order, and
 * returns them (the day's headlines, for 4.2 step 6's confidence news).
 */
export function newsWirePostDay(w: NewsWire, today: SimDate): Headline[] {
  const post: Headline[] = [];
  const keep: Headline[] = [];
  for (const h of w.queued) {
    if (cmpDate(h.date, today) <= 0) post.push(h);
    else keep.push(h);
  }
  w.queued = keep;
  // Each takes the next id in post order (D544).
  const last = chunkLogLast(w.feed);
  const first = last === null ? 0 : last.id + 1;
  post.forEach((h, i) => {
    h.id = ordinal<HeadlineId>(first + i);
    // The feed keeps its own copy: the headline in `today` is not the one in the feed.
    chunkLogPush(w.feed, structuredClone(h), (a, b) => monthEq(simDateMonthOf(a.date), simDateMonthOf(b.date)));
  });
  w.today = post.map((h) => structuredClone(h));
  return post;
}

/** Headlines posted since `since` (9.2 `get_news(since, filter)`), oldest first. */
export function* newsWireSince(w: NewsWire, since: SimDate): Generator<Headline, void, undefined> {
  for (const h of chunkLogIter(w.feed)) if (cmpDate(h.date, since) >= 0) yield h;
}
