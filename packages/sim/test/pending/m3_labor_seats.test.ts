// Port of crates/sim/tests/m3_labor_seats.rs: M3.1 and M3.2 against the live engine: labor units
// recounted at 4.3 step 4, seats opening and closing with them, the station drop order (spec
// 5.10, 3.7), and simple characters seated at load and at step 11 (3.7.1, 7.1).
//
// Spec M3.2 done: "about 2,700 seats filled at load". The data gives 3,207 (design fix 200): the
// count here is derived from company-start.csv and industries.csv independently.
//
// Expects:
//   ../../src/lib.ts           simNew, simWorld, simRegisterTestJob(sim, "MonthlyFringe", name, job)
//   ../../src/ops/stations.ts  stationsTotal(s)
//   ./common/ops.ts            company, companyRow, industryRow, runTo, specLabor
//   ./common/m3.ts             SKILL_KINDS, specSize
//   Seat and Trait are string unions (Trait::name() is the value); a seat holder is
//   { kind: "Simple", seat: SimpleSeat { id, character } } | { kind: "Full", character: id };
//   skills are read by field name (Skills::get). Trait opposites are the adjacent pairs of
//   TRAIT_VALUES (index 2k and 2k + 1), as the contract documents.
//
// Changed from the Rust: Sim::new(data, 11) and (5) use the new generator (D951). The seat counts,
// ranges, trait rules and the 296 loaded characters are data-derived or ranges, so they hold for
// any draws. The recount scenario's assertions are relative to what births made, as in the Rust.
import { describe, expect, it } from "vitest";
import { simNew, simRegisterTestJob, simWorld } from "../../src/lib.ts";
import { stationsTotal } from "../../src/ops/stations.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import {
  type CompanySize,
  SEAT_LABOR,
  type Seat,
  TRAIT_VALUES,
  type Trait,
} from "../../src/types/state/people.ts";
import type { World } from "../../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { SKILL_KINDS, type SkillKind, specSize } from "./common/m3.ts";
import { company, companyRow, industryRow, runTo, specLabor } from "./common/ops.ts";

type Range = [number, number];

/** Spec 3.7.1 table: seat skill and other-skill ranges and ages by size. */
function specRanges(size: CompanySize): [Range, Range, Range] {
  switch (size) {
    case "Small":
      return [
        [4, 10],
        [2, 8],
        [25, 55],
      ];
    case "Mid":
      return [
        [7, 13],
        [3, 9],
        [30, 62],
      ];
    case "Large":
      return [
        [10, 16],
        [4, 10],
        [38, 68],
      ];
  }
}

/** Spec 3.7 table: the skills each seat uses. */
function specSeatSkills(seat: Seat): SkillKind[] {
  switch (seat) {
    case "Ceo":
      return ["finance", "operations", "persuasion"];
    case "Cfo":
      return ["finance"];
    case "Cio":
      return ["intrigue"];
    case "Cmo":
      return ["persuasion"];
    case "Coo":
      return ["operations"];
    case "Chair":
      return ["persuasion"];
  }
}

const opposite = (t: Trait): Trait => TRAIT_VALUES[TRAIT_VALUES.indexOf(t) ^ 1] as Trait;

describe("m3 labor and seats", () => {
  it("seats_filled_at_load_follow_the_data", () => {
    const d = data();
    const w = simWorld(unwrap(simNew(structuredClone(d), 11), "Sim::new"));
    // The count from the data alone: min(5, L) seats per company, L from company-start.csv.
    let wantSeats = 0;
    for (const start of d.company_start.rows) {
      const row = companyRow(d, start.id);
      const lv = industryRow(d, row.industry).labor_value_usd;
      wantSeats += Math.min(specLabor(start.gross_assets_usd, lv), 5);
    }
    let seated = 0;
    let underFive = 0;
    for (const c of w.companies) {
      const start = d.company_start.rows.find((s) => s.id === c.key);
      if (start === undefined) throw new Error(`no start row ${c.key}`);
      const lv = (w.industries[c.industry] as (typeof w.industries)[number]).params.labor_value_usd;
      const l = specLabor(start.gross_assets_usd, lv);
      expect(c.labor_units, c.key).toBe(l);
      const s = c.stations;
      expect(
        s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle,
        `${c.key}: one station per labor unit`,
      ).toBe(l);
      if (l < 5) underFive += 1;
      const size = specSize(c.revenue_usd);
      const [seatRange, otherRange, ageRange] = specRanges(size);
      SEAT_LABOR.forEach((seat, i) => {
        const holder = c.board[i] ?? null;
        expect(holder !== null, `${c.key} ${seat}`).toBe(i < l);
        if (holder === null) return;
        if (holder.kind !== "Simple") {
          throw new Error("no full character sits at load");
        }
        seated += 1;
        const ch = holder.seat.character;
        expect([ch.seat, ch.size]).toEqual([seat, size]);
        expect(ch.age >= ageRange[0] && ch.age <= ageRange[1]).toBe(true);
        for (const k of SKILL_KINDS) {
          const r = specSeatSkills(seat).includes(k) ? seatRange : otherRange;
          const v = ch.skills[k];
          expect(v >= r[0] && v <= r[1], `${c.key} ${seat}`).toBe(true);
        }
        expect(ch.traits.length >= 1 && ch.traits.length <= 2).toBe(true);
        if (ch.traits.length === 2) {
          const [a, b] = ch.traits as [Trait, Trait];
          expect(opposite(a), "no opposite pair").not.toBe(b);
        }
      });
    }
    expect(seated).toBe(wantSeats);
    expect(seated, "design fix 200").toBe(3207);
    expect(underFive, "design fix 200").toBe(16);
    expect(w.simple_characters_made).toBe(3207);
  });

  it("full_characters_load_with_pair_traits_and_controllers", () => {
    const d = data();
    const w = simWorld(unwrap(simNew(structuredClone(d), 11), "Sim::new"));
    expect(w.characters.length).toBe(296);
    for (const ch of w.characters) {
      const row = d.characters.rows.find((r) => r.id === ch.key);
      if (row === undefined) throw new Error(`no row ${ch.key}`);
      expect([ch.age, ch.skills.finance, ch.skills.hustle]).toEqual([row.age, row.finance, row.hustle]);
      // Only the 24 traits of the 12 pairs (1-corporate-core 1.1.2) survive load.
      const pairNames = row.traits
        .map((t) => t.trim())
        .filter((t) => (TRAIT_VALUES as readonly string[]).includes(t));
      expect(ch.traits, ch.key).toEqual(pairNames);
    }
    // CH-0001 John Techno holds only "Operational Excellence", a perk outside the pairs.
    const john = w.characters.find((c) => c.key === "CH-0001");
    expect(john?.traits).toEqual([]);
    // Named controllers: companies.csv `controller` holding a CH- id.
    const named = d.companies.rows.filter((c) => c.controller.startsWith("CH-")).length;
    const linked = w.companies.filter((c) => c.controller !== null).length;
    expect([linked, named]).toEqual([253, 253]);
    const a = w.companies[company(w, "CO-0001")] as (typeof w.companies)[number];
    expect((w.characters[a.controller as number] as (typeof w.characters)[number]).name).toBe(
      "Terry Tippacanoe",
    );
  });
});

/** The company the scenario moves: CO-0025 (Drones, $99,010 of assets, one labor unit). */
const KEY = "CO-0025";

/**
 * A stand-in for the M6 plan and growth: in 4.3 step 3 (before the step 4 recount) it sets
 * CO-0025's gross assets, so L goes 1 to 6 (Feb) to 2 (Mar) to 1 (Apr), and on 1 March assigns a
 * mixed station split so the drop order shows.
 */
function moveAssets(w: World, ctx: JobCtx): void {
  const id = company(w, KEY);
  const c = w.companies[id] as (typeof w.companies)[number];
  const unit = c.units[0] as number;
  const { month, year } = ctx.facts.date;
  let gross: number;
  if (month === 2 && year === 2020) {
    gross = 600_000.0;
  } else if (month === 3 && year === 2020) {
    c.stations = { productivity: 2, enterprise: 1, fifty_fifty: 1, research: 1, idle: 1 };
    gross = 200_000.0;
  } else if (month === 4 && year === 2020) {
    gross = 99_010.0;
  } else {
    return;
  }
  (w.units[unit] as (typeof w.units)[number]).gross_assets = gross;
}

/**
 * Simple characters the casts of companies born at plan locks made (5.19.4): their partial
 * characters and fillers, on the board or as directors.
 */
function madeByBirths(w: World): number {
  let n = 0;
  for (const c of w.companies) {
    if (c.origin.kind !== "Born") continue;
    n += c.board.filter((h) => h?.kind === "Simple").length;
    n += c.directors.filter((x) => x.kind === "Simple").length;
  }
  return n;
}

function filled(w: World, key: string): boolean[] {
  return (w.companies[company(w, key)] as (typeof w.companies)[number]).board.map((h) => h !== null);
}

describe("m3 recount", () => {
  it("recount_opens_and_closes_seats_and_drops_stations_in_order", () => {
    const sim = unwrap(simNew(data(), 5), "Sim::new");
    simRegisterTestJob(sim, "MonthlyFringe", "test.move_assets", moveAssets);
    let w = simWorld(sim);
    const id = company(w, KEY);
    expect((w.companies[id] as (typeof w.companies)[number]).labor_units).toBe(1);
    expect(filled(w, KEY)).toEqual([true, false, false, false, false]);
    const ceoBefore = structuredClone((w.companies[id] as (typeof w.companies)[number]).board[0]);
    const madeAtLoad = w.simple_characters_made;

    // 1 Feb: L = 6. Step 4 opens CFO, CIO, CMO and COO, step 11 seats a simple character in
    // each (sized by the month's run rate, small); the new units are idle (D201).
    runTo(sim, simDateYmd(2020, 2, 1));
    w = simWorld(sim);
    let c = w.companies[id] as (typeof w.companies)[number];
    expect(c.labor_units).toBe(6);
    expect(filled(w, KEY)).toEqual([true, true, true, true, true]);
    expect(c.board[0], "the CEO keeps their seat").toEqual(ceoBefore);
    expect(w.simple_characters_made).toBe(madeAtLoad + 4 + madeByBirths(w));
    SEAT_LABOR.forEach((seat, i) => {
      if (i === 0) return;
      const h = c.board[i];
      if (h?.kind !== "Simple") throw new Error(`${seat} not filled`);
      expect([h.seat.character.seat, h.seat.character.size]).toEqual([seat, "Small"]);
      expect(h.seat.id >= madeAtLoad).toBe(true);
    });
    expect(c.seats_to_fill.length).toBe(0);
    // The 9 January lock's 6.4 split gave the one-unit company's CEO a 50/50 station (L = 1 at
    // 100% data coverage, D207); the five new units are idle.
    expect(c.stations).toEqual({ productivity: 0, enterprise: 0, fifty_fifty: 1, research: 0, idle: 5 });

    // 1 Mar: assigned P2 E1 50/50 1 R1 idle 1, then L = 2: drop idle, research, enterprise,
    // 50/50, then productivity (5.10; D201 places 50/50); CIO, CMO and COO close.
    runTo(sim, simDateYmd(2020, 3, 1));
    w = simWorld(sim);
    c = w.companies[id] as (typeof w.companies)[number];
    expect(c.labor_units).toBe(2);
    expect(c.stations).toEqual({ productivity: 2, enterprise: 0, fifty_fifty: 0, research: 0, idle: 0 });
    expect(filled(w, KEY)).toEqual([true, true, false, false, false]);

    // 1 Apr: L = 1, the CFO closes and productivity drops to the CEO's one station.
    runTo(sim, simDateYmd(2020, 4, 1));
    w = simWorld(sim);
    c = w.companies[id] as (typeof w.companies)[number];
    expect(c.labor_units).toBe(1);
    expect(c.stations.productivity).toBe(1);
    expect(stationsTotal(c.stations)).toBe(1);
    expect(filled(w, KEY)).toEqual([true, false, false, false, false]);
    // Only the four seats opened in February drew characters (and the casts of the 9 January
    // startups, 5.19.4).
    expect(w.simple_characters_made).toBe(madeAtLoad + 4 + madeByBirths(w));
  });
});
