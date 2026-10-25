// Fixed startup events F1 to F9 (spec 5.19.2, A, T), from startup-events.csv: which are due at a
// plan lock, and the draft of each (its startups' industries, HQs, sizes and casts). Ported from
// crates/sim/src/births/fixed.rs.
//
// A fixed event fires at the first plan lock on or after its date (F9: the first plan lock after
// the bust ends, the pop + 8 quarters, 5.1.1), once. It fires even if its industry is labeled Glut
// or Bust, but never takes more than the fringe allows (the 5.19.3 cap). Its HQ uses the 5.19.1
// province weights inside its region.
//
// Trigger, Region, FixedGroup and FixedEvent are in types/state/births.ts.

import type { StartupEvent } from "@tc20ff/sim-data";
import { simDateNew } from "../time/calendar.ts";
import { cmpDate, type SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { IndustryId, ProvinceId } from "../types/ids.ts";
import type { FixedEvent, FixedGroup, Region, Trigger } from "../types/state/births.ts";
import type { AiStage, Result } from "../types/world.ts";
import {
  countRangeDraw,
  countRangeNew,
  drawTargetRevenue,
  type EventDraft,
  type StartupDraft,
  USD_PER_MILLION,
} from "./random.ts";
import { weightedPick } from "./weights.ts";

export type { FixedEvent, FixedGroup, Region, Trigger };

/** startup-events.csv region word for "anywhere". */
export const ANY_REGION = "any";

/** Parses a region word: `any`, a three-letter upper-case iso3, else a superregion slug (Rust `Region::parse`). */
export function regionParse(word: string): Region {
  if (word === ANY_REGION) return { kind: "Any" };
  if (/^[A-Z]{3}$/.test(word)) return { kind: "Country", iso3: word };
  return { kind: "Superregion", slug: word };
}

/** True if a province in `superregion_slug` and country `iso3` is inside this region (Rust `Region::contains`). */
export function regionContains(r: Region, superregion_slug: string, iso3: string): boolean {
  switch (r.kind) {
    case "Any":
      return true;
    case "Superregion":
      return r.slug === superregion_slug;
    case "Country":
      return r.iso3 === iso3;
  }
}

/** A startup-events.csv row that cannot be read. */
export interface BadEvent {
  /** Rust `BadEvent(String)`. */
  message: string;
}

/** Rust `str::parse::<integer>()`: an optional sign and digits only. */
function parseInteger(s: string): number | null {
  return /^[+-]?\d+$/.test(s) ? Number.parseInt(s, 10) : null;
}

function parseDate(s: string): SimDate | null {
  const parts = s.split("-");
  const y = parts[0] === undefined ? null : parseInteger(parts[0]);
  const m = parts[1] === undefined ? null : parseInteger(parts[1]);
  const d = parts[2] === undefined ? null : parseInteger(parts[2]);
  if (y === null || m === null || d === null) return null;
  // y is i32 and m and d are u8 in Rust: out of range parses fail.
  if (y < -2147483648 || y > 2147483647) return null;
  if (m < 0 || m > 255 || d < 0 || d > 255) return null;
  return simDateNew(y, m, d);
}

/** From a startup-events.csv row (Rust `FixedEvent::from_row`). */
export function fixedEventFromRow(row: StartupEvent): Result<FixedEvent, BadEvent> {
  let trigger: Trigger;
  if (row.trigger === "Date") {
    const date = parseDate(row.date);
    if (date === null) return { ok: false, error: { message: `${row.id}: bad date \`${row.date}\`` } };
    trigger = { kind: "Date", date };
  } else {
    trigger = { kind: "AfterBust" };
  }
  return {
    ok: true,
    value: {
      id: row.id,
      name: row.name,
      trigger,
      groups: row.startups.map((g) => ({
        count: g.count,
        industry_name: g.industry,
        regions: g.regions.map((r) => regionParse(r)),
      })),
      revenue_usd: [row.revenue_min_usd_m * USD_PER_MILLION, row.revenue_max_usd_m * USD_PER_MILLION],
      full: countRangeNew(row.full_min, row.full_max),
      partial: countRangeNew(row.partial_min, row.partial_max),
    },
  };
}

/** Startups the event asks for in all (5.19.2: 32 over F1 to F9; Rust `FixedEvent::startup_count`). */
export function fixedEventStartupCount(e: FixedEvent): number {
  let n = 0;
  for (const g of e.groups) n += g.count;
  return n;
}

/**
 * True if the event is due at a plan lock on `lock_date` with the AI in `stage`, given whether it
 * has fired (spec 5.19.2: the first lock on or after its date; F9 the first lock after the bust,
 * D275; Rust `FixedEvent::is_due`).
 */
export function fixedEventIsDue(e: FixedEvent, lock_date: SimDate, stage: AiStage, fired: boolean): boolean {
  if (fired) return false;
  switch (e.trigger.kind) {
    case "Date":
      return cmpDate(lock_date, e.trigger.date) >= 0;
    case "AfterBust":
      return stage === "Postcrash";
  }
}

/**
 * The fixed events due at a lock, in file order (F1 to F9; spec 5.19.2 "fixed events due"), given
 * each event's fired flag (3.1 `startup_events`).
 */
export function dueEvents(
  events: readonly FixedEvent[],
  fired: readonly boolean[],
  lock_date: SimDate,
  stage: AiStage,
): number[] {
  const out: number[] = [];
  events.forEach((e, i) => {
    if (fixedEventIsDue(e, lock_date, stage, fired[i] ?? false)) out.push(i);
  });
  return out;
}

/**
 * The HQ candidates of an industry inside some regions: provinces with their 5.19.1 HQ weights, in
 * id order (Rust `RegionSites`).
 */
export type RegionSites = (industry: IndustryId, regions: readonly Region[]) => [ProvinceId, number][];

/**
 * The draft of a due fixed event (spec 5.19.2). Groups in file order, startups in turn; each
 * startup draws its own HQ from `hq_candidates(industry, regions)` (the provinces inside the
 * group's regions with their 5.19.1 HQ weights, in id order), then its target revenue, full count
 * and partial count (gen stream; D275). A group whose industry `resolve` does not know, or with no
 * province weight in its regions, makes no startup.
 */
export function drawFixedEvent(
  event: FixedEvent,
  resolve: (name: string) => IndustryId | null,
  hq_candidates: RegionSites,
  draws: DrawSource,
): EventDraft {
  const startups: StartupDraft[] = [];
  for (const g of event.groups) {
    const industry = resolve(g.industry_name);
    if (industry === null) continue;
    const sites = hq_candidates(industry, g.regions);
    const weights = sites.map(([, w]) => w);
    for (let k = 0; k < g.count; k++) {
      const i = weightedPick(weights, draws);
      if (i === null) break;
      startups.push({
        industry,
        hq: (sites[i] as [ProvinceId, number])[0],
        target_revenue_usd: drawTargetRevenue(event.revenue_usd[0], event.revenue_usd[1], draws),
        full: countRangeDraw(event.full, draws),
        partial: countRangeDraw(event.partial, draws),
      });
    }
  }
  return { kind: { kind: "Fixed", id: event.id }, startups };
}
