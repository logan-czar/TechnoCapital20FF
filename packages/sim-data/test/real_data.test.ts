// Port of crates/sim-data/tests/real_data.rs: today data in docs/design/data loads with the
// expected counts and passes every check (build-plan M0.2, M0.4).
//
// Expects:
//   "@tc20ff/sim-data": check, EXPECTED_COUNTS (array of [name, count] pairs), worldDataCounts
//   (WorldData::counts, returns [name, count][]), type WorldData.
//   "@tc20ff/sim-data/node": loadWorld, defaultDataDir (via ./helpers.ts)
// EventTrigger::AfterBust is the string "AfterBust" (unit enums are string unions, D952).
import { check, EXPECTED_COUNTS, worldDataCounts } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { errText, worldOnce } from "./helpers.ts";

describe("real data", () => {
  it("loads_with_expected_counts", () => {
    const counts = worldDataCounts(worldOnce());
    for (const [name, expected] of EXPECTED_COUNTS) {
      const hit = counts.find(([k]) => k === name);
      expect(hit, name).toBeDefined();
      expect(hit?.[1], name).toBe(expected);
    }
  });

  it("passes_all_checks", () => {
    const errors = check(worldOnce());
    expect(errors.map(errText).join("\n")).toBe("");
    expect(errors.length).toBe(0);
  });

  it("fixed_startup_events_load", () => {
    const ev = worldOnce().startup_events.rows;
    expect(ev.length).toBe(9);
    const f6 = ev[5];
    expect(f6?.startups[0]?.industry).toBe("AI labs");
    expect(f6?.startups[0]?.regions).toEqual(["CHN"]);
    expect(ev[8]?.trigger).toBe("AfterBust");
    let total = 0;
    for (const e of ev) for (const g of e.startups) total += g.count;
    expect(total).toBe(32);
  });

  it("names_load_for_all_superregions", () => {
    const w = worldOnce();
    expect(w.names.length).toBe(8);
    for (const t of w.names) {
      expect(t.rows.length, `${t.file}: ${t.rows.length} names`).toBeGreaterThan(50);
    }
    const chinese = w.names[0]?.rows.find((r) => r.culture === "chinese");
    expect(chinese).toBeDefined();
    expect(chinese?.family_first).toBe(true);
  });
});
