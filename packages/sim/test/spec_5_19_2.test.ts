// Port of crates/sim/tests/spec_5_19_2.rs: spec 5.19.2 (fixed startup events), build-plan M6.7: F1
// to F9 from startup-events.csv, each firing once at its plan lock (F9 at the first lock after the
// bust), and their drafts.
//
// Expects:
//   ../../src/births/fixed.ts      fixedEventFromRow(row) -> Result<FixedEvent, BadEvent>,
//                                  fixedEventStartupCount(e), fixedEventIsDue(e, lock, stage,
//                                  fired), regionContains(region, superregion_slug, iso3),
//                                  dueEvents(events, fired, lock, stage) -> number[],
//                                  drawFixedEvent(e, resolve(name) -> IndustryId | null,
//                                  hq(industry, regions) -> [ProvinceId, weight][], draws) ->
//                                  EventDraft
//   ../../src/economy/ai_boom.ts   boomDate(), stageAt(date, boom, pop) -> [AiStage, number]
//   ../../src/time/calendar.ts     quarterNext, quarterFirstDay (ported)
//
// Changed from the Rust: RngStreams::new(3) is the new generator (D951). The draft checks (counts,
// revenue and cast ranges, region routing) hold for any draws.
import { describe, expect, it } from "vitest";
import {
  drawFixedEvent,
  dueEvents,
  type FixedEvent,
  fixedEventFromRow,
  fixedEventIsDue,
  fixedEventStartupCount,
  regionContains,
} from "../src/births/fixed.ts";
import { boomDate, stageAt } from "../src/economy/ai_boom.ts";
import { quarterFirstDay, quarterNext, simDateYmd } from "../src/time/calendar.ts";
import type { Quarter, SimDate } from "../src/types/calendar.ts";
import type { IndustryId, ProvinceId } from "../src/types/ids.ts";
import type { Region } from "../src/types/state/births.ts";
import { data, unwrap } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

function events(): FixedEvent[] {
  return data().startup_events.rows.map((r) => unwrap(fixedEventFromRow(r), "FixedEvent::from_row"));
}

const sumOf = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("spec 5.19.2 fixed startup events", () => {
  it("nine_events_and_32_startups", () => {
    const ev = events();
    expect(ev.map((e) => e.id)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"]);
    // Spec 5.19.2: 32 startups, 8 before the boom, 21 in 2030 to 2035 and 3 after the bust.
    const n = ev.map((e) => fixedEventStartupCount(e));
    expect(sumOf(n)).toBe(32);
    expect(sumOf(n.slice(0, 3))).toBe(8);
    expect(sumOf(n.slice(3, 8))).toBe(21);
    expect(n[8]).toBe(3);
    // F6's labs are in China; F5's groups may sit in either of two superregions.
    expect(ev[5]?.groups[0]?.regions).toEqual([{ kind: "Country", iso3: "CHN" }]);
    expect(ev[4]?.groups[0]?.regions).toEqual([
      { kind: "Superregion", slug: "east-asia-oceania" },
      { kind: "Superregion", slug: "north-america" },
    ]);
    expect(regionContains({ kind: "Any" }, "europe", "DEU")).toBe(true);
    expect(regionContains({ kind: "Country", iso3: "CHN" }, "east-asia-oceania", "JPN")).toBe(false);
    // F1: 2 AI labs in North America, $5M to $15M, cast 2 to 3 full and 1 to 2 partial.
    const f1 = ev[0] as FixedEvent;
    expect(f1.groups[0]?.industry_name).toBe("AI labs");
    expect(f1.revenue_usd).toEqual([5.0e6, 15.0e6]);
    expect([f1.full.lo, f1.full.hi, f1.partial.lo, f1.partial.hi]).toEqual([2, 3, 1, 2]);
  });

  it("each_fires_once_at_its_plan_lock", () => {
    // The 5.19.2 table's dates, with the pop on 1 January 2040: the bust runs 8 quarters, so F9
    // fires at the first lock of 2042.
    const ev = events();
    const pop = simDateYmd(2040, 1, 1);
    const fired = ev.map(() => false);
    const when: [string, SimDate][] = [];
    let q: Quarter = { year: 2020, q: 1 } as Quarter;
    while (q.year <= 2050) {
      const lock = simDateYmd(q.year, quarterFirstDay(q).month, 9);
      const [stage] = stageAt(lock, boomDate(), pop);
      for (const i of dueEvents(ev, fired, lock, stage)) {
        fired[i] = true;
        when.push([(ev[i] as FixedEvent).id, lock]);
      }
      q = quarterNext(q);
    }
    const want: [string, SimDate][] = [
      ["F1", simDateYmd(2020, 4, 9)],
      ["F2", simDateYmd(2021, 4, 9)],
      ["F3", simDateYmd(2022, 1, 9)],
      ["F4", simDateYmd(2030, 1, 9)],
      ["F5", simDateYmd(2031, 1, 9)],
      ["F6", simDateYmd(2032, 1, 9)],
      ["F7", simDateYmd(2033, 1, 9)],
      ["F8", simDateYmd(2035, 1, 9)],
      ["F9", simDateYmd(2042, 1, 9)],
    ];
    expect(when).toEqual(want);
    // A pop later moves F9 with it: pop Q3 2041 + 8 quarters is Q3 2043.
    const pop2 = simDateYmd(2041, 7, 1);
    const lock = simDateYmd(2043, 7, 9);
    const [stage] = stageAt(lock, boomDate(), pop2);
    expect(fixedEventIsDue(ev[8] as FixedEvent, lock, stage, false)).toBe(true);
    const before = simDateYmd(2043, 4, 9);
    expect(fixedEventIsDue(ev[8] as FixedEvent, before, stageAt(before, boomDate(), pop2)[0], false)).toBe(
      false,
    );
  });

  it("drafts_follow_the_groups_and_ranges", () => {
    const ev = events();
    // A resolver that knows every industry name, and a candidate list that remembers the regions
    // it was asked for.
    const names = ev.flatMap((e) => e.groups.map((g) => g.industry_name));
    const resolve = (n: string): IndustryId | null => {
      const i = names.indexOf(n);
      return i < 0 ? null : (i as IndustryId);
    };
    const hq = (_: IndustryId, regions: readonly Region[]): [ProvinceId, number][] => {
      const base = regions.some((r) => r.kind === "Country" && r.iso3 === "CHN") ? 100 : 0;
      return Array.from({ length: 5 }, (_, k): [ProvinceId, number] => [(base + k) as ProvinceId, 1.0]);
    };
    const rng = newRng(3);
    for (const e of ev) {
      const d = drawFixedEvent(e, resolve, hq, rng);
      expect(d.kind).toEqual({ kind: "Fixed", id: e.id });
      expect(d.startups.length).toBe(fixedEventStartupCount(e));
      for (const s of d.startups) {
        expect(s.target_revenue_usd).toBeGreaterThanOrEqual(e.revenue_usd[0] - 1e-6);
        expect(s.target_revenue_usd).toBeLessThanOrEqual(e.revenue_usd[1] + 1e-6);
        expect(s.full >= e.full.lo && s.full <= e.full.hi).toBe(true);
        expect(s.partial >= e.partial.lo && s.partial <= e.partial.hi).toBe(true);
      }
    }
    // F6: the two Chinese labs draw from the CHN candidates, the rest from anywhere.
    const d = drawFixedEvent(ev[5] as FixedEvent, resolve, hq, rng);
    expect(d.startups.slice(0, 2).every((s) => s.hq >= 100)).toBe(true);
    expect(d.startups.slice(2).every((s) => s.hq < 100)).toBe(true);
    // An unknown industry makes no startup.
    const none = (_: string): IndustryId | null => null;
    expect(drawFixedEvent(ev[0] as FixedEvent, none, hq, rng).startups.length).toBe(0);
  });
});
