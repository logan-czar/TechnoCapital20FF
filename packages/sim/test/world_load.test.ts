// Port of crates/sim/tests/world_load.rs: the world tables build from today data in id order,
// with units converted (build-plan 2.3, decisions D3 and D4).
//
// Expects:
//   ../src/world/load.ts   worldFromData(data) -> Result<World, LoadError>   [World::from_data]
//   ./common/index.ts         data(), unwrap(), rowOf(), idRows()
// Table[id] indexing replaces Rust Table::get and Index: an out-of-range id is undefined here.
import { describe, expect, it } from "vitest";
import type { CompanyId } from "../src/types/ids.ts";
import type { World } from "../src/types/world.ts";
import { worldFromData } from "../src/world/load.ts";
import { data, idRows, rowOf, unwrap } from "./common/index.ts";

function world(): World {
  return unwrap(worldFromData(data()), "world builds");
}

describe("world load", () => {
  it("counts_match_the_data", () => {
    const w = world();
    expect(w.countries.length).toBe(211);
    expect(w.provinces.length).toBe(3963);
    expect(w.companies.length).toBe(651);
    expect(w.characters.length).toBe(296);
    expect(w.industries.length).toBe(42);
    expect(w.zones.length).toBe(26);
  });

  it("ordinals_follow_ids", () => {
    const w = world();
    // Byte order of the CSV ids (D4): strictly ascending keys.
    const sorted = (keys: string[]): boolean => keys.every((k, i) => i === 0 || (keys[i - 1] ?? "") < k);
    expect(sorted(w.provinces.map((p) => p.key))).toBe(true);
    expect(sorted(w.companies.map((c) => c.key))).toBe(true);
    expect(sorted(w.countries.map((c) => c.key))).toBe(true);
    expect(sorted(w.industries.map((c) => c.key))).toBe(true);
    expect(sorted(w.zones.map((c) => c.key))).toBe(true);
    expect(sorted(w.characters.map((c) => c.key))).toBe(true);
    for (const [id, c] of idRows<CompanyId, (typeof w.companies)[number]>(w.companies)) {
      // CompanyId::from_index(id.index()) == id is the identity on branded numbers.
      expect(w.companies[id]).toBe(c);
      expect(w.provinces[c.hq_province]).toBeDefined();
    }
  });

  it("units_convert_once_at_load", () => {
    const w = world();
    // CO-0001 Arrowhead Drilling: $40M revenue, 6,666,667 shares (companies.csv, company-start.csv).
    const arrowhead = rowOf(w.companies, 0 as CompanyId);
    expect(arrowhead.key).toBe("CO-0001");
    expect(arrowhead.revenue_usd).toBe(40_000_000.0);
    expect(arrowhead.shares_out).toBe(6_666_667);
    expect(rowOf(w.industries, arrowhead.industry).name).toBe("Oil");
    expect(rowOf(w.provinces, arrowhead.hq_province).key).toBe("CA-0033");
    const usa = w.countries.find((c) => c.key === "USA");
    expect(usa).toBeDefined();
    if (usa === undefined) return;
    expect(usa.gdp_usd).toBe(23_500.0e9);
    expect(rowOf(w.zones, usa.zone).key).toBe("NA");
    expect(rowOf(w.zones, usa.zone).credit_spread_base).toBe(0.0001);
  });
});
