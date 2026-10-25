// Port of crates/sim/tests/spec_5_10.rs: spec 5.10 (labor units, seats, drop order) and 3.7
// (seats open with labor units 1 to 5): build-plan M3.1, tested at 1, 4, 5 and 400 labor units.
// Pure formulas, no RNG.
//
// Expects:
//   ../../src/ops/labor.ts  fitStations(stations, labor), laborUnits(gross, labor_value),
//                           openSeats(labor) -> Seat[], seatChanges(old, new) -> { opened, closed }
//   ../../src/ops/stations.ts  stationsTotal(s)   [Stations::total]
//   SEAT_LABOR from types/state/people.ts is Seat::LABOR
import { describe, expect, it } from "vitest";
import { fitStations, laborUnits, openSeats, seatChanges } from "../../src/ops/labor.ts";
import { stationsTotal } from "../../src/ops/stations.ts";
import { SEAT_LABOR } from "../../src/types/state/people.ts";
import { stationsOf } from "./common/defaults.ts";

/** industries.csv labor_value_usd (every industry in the MVP). */
const LV = 100_000.0;

describe("spec 5.10 labor", () => {
  it("labor_units_are_assets_over_labor_value_minimum_one", () => {
    expect(laborUnits(0.0, LV), "minimum 1, the CEO").toBe(1);
    expect(laborUnits(99_999.0, LV)).toBe(1);
    expect(laborUnits(100_000.0, LV), "the barebones company").toBe(1);
    expect(laborUnits(400_000.0, LV)).toBe(4);
    expect(laborUnits(599_999.0, LV)).toBe(5);
    expect(laborUnits(40.0e6, LV)).toBe(400);
    expect(laborUnits(39_215_686.0, LV), "Arrowhead (7.1)").toBe(392);
  });

  it("seats_open_with_the_count", () => {
    expect(openSeats(1)).toEqual(["Ceo"]);
    expect(openSeats(4)).toEqual(["Ceo", "Cfo", "Cio", "Cmo"]);
    expect(openSeats(5)).toEqual([...SEAT_LABOR]);
    expect(openSeats(400), "no charter seats beyond 5 (C14)").toEqual([...SEAT_LABOR]);
  });

  it("seats_open_and_close_on_recount", () => {
    const up = seatChanges(1, 4);
    expect(up.opened).toEqual(["Cfo", "Cio", "Cmo"]);
    expect(up.closed).toEqual([]);
    const toFive = seatChanges(4, 5);
    expect(toFive.opened).toEqual(["Coo"]);
    const down = seatChanges(400, 4);
    expect(down.closed).toEqual(["Coo"]);
    expect(down.opened).toEqual([]);
    const toOne = seatChanges(5, 1);
    expect(toOne.closed).toEqual(["Cfo", "Cio", "Cmo", "Coo"]);
    expect(seatChanges(400, 5), "both at five seats").toEqual({ opened: [], closed: [] });
    expect(seatChanges(4, 4)).toEqual({ opened: [], closed: [] });
  });

  it("drop_order_is_idle_research_enterprise_then_productivity", () => {
    const s = stationsOf({ productivity: 100, enterprise: 50, research: 30, idle: 220 });
    expect(stationsTotal(s)).toBe(400);
    // 400 to 200: the 220 idle cover 200.
    const a = fitStations(s, 200);
    expect([a.idle, a.research, a.enterprise, a.productivity]).toEqual([20, 30, 50, 100]);
    // 400 to 120: all idle and research go, then 30 enterprise.
    const b = fitStations(s, 120);
    expect([stationsTotal(a), stationsTotal(b)]).toEqual([200, 120]);
    expect([b.idle, b.research, b.enterprise, b.productivity]).toEqual([0, 0, 20, 100]);
    // 400 to 5: only productivity is left.
    const c = fitStations(s, 5);
    expect([c.idle, c.research, c.enterprise, c.productivity]).toEqual([0, 0, 0, 5]);
    // 400 to 4, then 1.
    expect(fitStations(s, 4).productivity).toBe(4);
    expect(stationsTotal(fitStations(s, 1))).toBe(1);
    // A 50/50 station drops after enterprise, before productivity (D201).
    const ceo = stationsOf({ productivity: 1, fifty_fifty: 1, enterprise: 1 });
    const one = fitStations(ceo, 1);
    expect([one.productivity, one.fifty_fifty, one.enterprise]).toEqual([1, 0, 0]);
  });

  it("new_labor_waits_idle_for_the_next_plan", () => {
    const s = stationsOf({ productivity: 1, enterprise: 1, idle: 2 });
    const grown = fitStations(s, 400);
    expect(stationsTotal(grown)).toBe(400);
    expect([grown.productivity, grown.enterprise, grown.idle]).toEqual([1, 1, 398]);
  });

  it("startups_near_one_million_open_all_five_seats", () => {
    // 5.19.3: a startup under 1M is skipped; assets = revenue x capital_per_dollar (1.0), so the
    // smallest startup has 1M of assets, 10 labor units and all five seats (5.19.4, C31; D200).
    const l = laborUnits(1.0e6 * 1.0, LV);
    expect(l).toBe(10);
    expect(openSeats(l)).toEqual([...SEAT_LABOR]);
    expect(seatChanges(0, l).opened).toEqual([...SEAT_LABOR]);
  });
});
