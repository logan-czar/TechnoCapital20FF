// v_statements' in-place rebuild (D435, D962): reusing the last build's quarter estimates gives
// exactly `build`'s result, and never changes the last build. Rust checks this through the
// Omniscient toggle in tests/m9_estimate_bands.rs; here it is checked directly. Not a Rust file.
import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../../src/lib.ts";
import { mapDataDefault } from "../../src/map.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { plainEqual, type ViewInput } from "../../src/views/index.ts";
import { buildStatements, rebuildStatementsFrom } from "../../src/views/statements.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";

describe("statements view", () => {
  it("the rebuild from the last build equals a fresh build and leaves the last one alone", () => {
    const sim = unwrap(simNew(data(), 4), "Sim::new");
    const input = (): ViewInput => ({
      world: simWorld(sim),
      controls: sim.controls(),
      seed: sim.seed(),
      map: mapDataDefault(),
    });
    runTo(sim, simDateYmd(2020, 1, 3));
    const prev = buildStatements(input());
    const copy = structuredClone(prev);
    expect(prev.companies.some((c) => c.estimated && c.estimated_quarters.length === 4)).toBe(true);
    runTo(sim, simDateYmd(2020, 4, 3));
    const rebuilt = rebuildStatementsFrom(prev, input());
    expect(plainEqual(rebuilt, buildStatements(input()))).toBe(true);
    expect(plainEqual(prev, copy)).toBe(true);
    // The quarter released on 2 April is in, estimated afresh; the older ones are reused.
    const c = rebuilt.companies.find((x) => x.estimated)!;
    expect(c.estimated_quarters.at(-1)?.period).toEqual({ kind: "Quarter", quarter: { year: 2020, q: 1 } });
    // An older quarter is the last build's estimate itself, not a fresh one.
    const old = prev.companies[c.id]!;
    const q4 = c.estimated_quarters.find(
      (e) => e.period.kind === "Quarter" && e.period.quarter.year === 2019 && e.period.quarter.q === 4,
    );
    expect(q4).toBeDefined();
    expect(old.estimated_quarters.includes(q4!)).toBe(true);
  }, 120_000);
});
