// Port of crates/sim/tests/m3_management_productivity.rs: M3.3 and M3.7 against the live engine:
// the management score each month from the seated board (spec 5.7) and productivity at 4.3 step
// 10 (5.6). Expected values are worked from the spec formulas written out here, never from the
// engine's functions.
//
// Spec M3.7 done: score 50 gives -6 a year at the norm, +4 at double, -16 with none. The three
// barebones companies (one labor unit, no idle, no research, no held data) are given a board that
// scores exactly 50 and R&D plans of 2x, 1x and 0x the norm, and run a year.
//
// Expects:
//   ../src/lib.ts           simNew, simWorld, simRegisterTestJob(sim, "MonthlyFringe", name, job)
//   ./common/ops.ts            company, runTo;  ./common/m3.ts  SKILL_KINDS, specSize, sizeIndex
//   A seat holder is { kind: "Simple", seat: SimpleSeat } | { kind: "Full", character: id };
//   skills are read by field name (Skills::get).
//
// Changed from the Rust: Sim::new(data, seed) uses the new generator (D951). The scores, the 5.6
// productivity step and the clamp are formula checks on the engine's own state, and the test jobs
// override plans and boards each month, so no assertion depends on a draw. The scenario check on
// size means (about 33, 47, 60 within 2.5) is statistical over the loaded boards, which any sound
// generator meets, but it is the one assertion to look at first if a new seed shifts a mean.
// The printlns are dropped.
import { describe, expect, it } from "vitest";
import { simNew, simRegisterTestJob, simWorld } from "../src/lib.ts";
import { simDateYmd } from "../src/time/calendar.ts";
import type { JobCtx } from "../src/time/scheduler.ts";
import type { Seat, SimpleCharacter, Skills, Trait } from "../src/types/state/people.ts";
import { SEAT_LABOR } from "../src/types/state/people.ts";
import type { Company, SeatHolder, World } from "../src/types/world.ts";
import { data, unwrap } from "./common/index.ts";
import { sizeIndex, specSize } from "./common/m3.ts";
import { company, runTo } from "./common/ops.ts";

type Stations = Company["stations"];

/** Spec 5.7 weights: CEO 30%, COO 20%, CFO 20%, CIO 10%, Chair 10%, other seats (CMO) 10%. */
function specWeight(seat: Seat): number {
  switch (seat) {
    case "Ceo":
      return 0.3;
    case "Coo":
    case "Cfo":
      return 0.2;
    default:
      return 0.1;
  }
}

/** Spec 3.7: the seat's skill (the CEO averages Finance, Operations and Persuasion). */
function specSeatSkill(s: Skills, seat: Seat): number {
  switch (seat) {
    case "Ceo":
      return (s.finance + s.operations + s.persuasion) / 3.0;
    case "Cfo":
      return s.finance;
    case "Cio":
      return s.intrigue;
    case "Cmo":
    case "Chair":
      return s.persuasion;
    case "Coo":
      return s.operations;
  }
}

/** Spec 3.7.1 management shifts: Diligent +2, Lazy -2, Ambitious +1, Greedy -1 as CFO (D206). */
function specShift(t: Trait, seat: Seat): number {
  switch (t) {
    case "Diligent":
      return 2.0;
    case "Lazy":
      return -2.0;
    case "Ambitious":
      return 1.0;
    case "Greedy":
      return seat === "Cfo" ? -1.0 : 0.0;
    default:
      return 0.0;
  }
}

/** Spec 5.7: `min(100, sum weight x skill / 20 x 100)`, empty seats (and the Chair) at skill 3. */
function specScore(w: World, c: Company): number {
  let sum = specWeight("Chair") * 3.0;
  SEAT_LABOR.forEach((seat, i) => {
    const h = c.board[i] ?? null;
    let skill: number;
    if (h === null) {
      skill = 3.0;
    } else {
      const who =
        h.kind === "Simple" ? h.seat.character : (w.characters[h.character] as (typeof w.characters)[number]);
      const shift = who.traits.reduce((a: number, t: Trait) => a + specShift(t, seat), 0);
      skill = Math.min(Math.max(specSeatSkill(who.skills, seat) + shift, 0.0), 30.0);
    }
    sum += specWeight(seat) * skill;
  });
  return Math.min((sum / 20.0) * 100.0, 100.0);
}

/**
 * Spec 5.6, written out: research x1.00 at 0 units, x1.01 at 1 to 9, x1.02 at 10 to 99, ...;
 * decay 0.5, 0.4 with 10%+ idle, 0.3 with 25%+.
 */
function specDelta(rdTotal: number, rdNorm: number, score: number, s: Stations): number {
  const digits = s.research === 0 ? 0 : String(s.research).length;
  const researchMult = 1.0 + 0.01 * digits;
  const l = s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle;
  const idle = s.idle / l;
  const decay = idle >= 0.25 ? 0.3 : idle >= 0.1 ? 0.4 : 0.5;
  // D973: an overspend of x norms counts as x / (1 + x).
  const x = rdTotal / rdNorm - 1.0;
  const counted = x > 0.0 ? x / (1.0 + x) : x;
  return (10.0 * counted * (0.5 + score / 100.0) * researchMult) / 12.0 - decay;
}

describe("m3 management", () => {
  it("management_scores_at_load_by_size", () => {
    const w = simWorld(unwrap(simNew(data(), 21), "Sim::new"));
    const sums: [number, number][] = [
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    for (const c of w.companies) {
      const want = specScore(w, c);
      expect(Math.abs(c.management_score - want) < 1e-9, c.key).toBe(true);
      // Only full boards count toward the spec's size means (every labor seat filled).
      if (c.labor_units >= 5) {
        const s = sums[sizeIndex(specSize(c.revenue_usd))] as [number, number];
        s[0] += c.management_score;
        s[1] += 1;
      }
    }
    const means = sums.map(([s, n]) => s / n);
    // spec 3.7.1: about 33, 47, 60; D206.
    [33.0, 47.0, 60.0].forEach((spec, i) => {
      expect(Math.abs((means[i] as number) - spec) < 2.5, `${means[i]} vs about ${spec}`).toBe(true);
    });
  });
});

/**
 * A CEO whose seat skill is 79 / 3 with no shifting trait: with the four other labor seats closed
 * and the Chair empty (skill 3) the board scores (0.3 x 79/3 + 0.7 x 3) / 20 x 100 = 50.
 */
function scoreFiftyCeo(): SeatHolder {
  const character: SimpleCharacter = {
    name: "Test Fifty",
    age: 40,
    skills: { finance: 27, operations: 26, persuasion: 26, intrigue: 3, tech: 3, hustle: 3 },
    traits: ["Brave"],
    seat: "Ceo",
    size: "Small",
  };
  return { kind: "Simple", seat: { id: 4294967295, character } };
}

/** Barebones companies and their R&D plan as a multiple of the norm. */
const BAREBONES_PLANS: [string, number][] = [
  ["CO-0003", 2.0],
  ["CO-0026", 1.0],
  ["CO-0027", 0.0],
];

/** Cash the test companies hold each month (far above any year of their costs). */
const SOLVENT_CASH_USD = 1.0e9;

/**
 * Overrides the Lite AI's plan each month (4.3 step 3): the score-50 CEO, the R&D plans and the
 * CEO on productivity (the 6.4 split would put a 100%-coverage CEO at L = 1 on 50/50, which
 * changes no term of 5.6 but is not the case written here).
 */
function plansAndBoard(w: World, _ctx: JobCtx): void {
  for (const [key, mult] of BAREBONES_PLANS) {
    const id = company(w, key);
    const c = w.companies[id] as Company;
    c.board[0] = scoreFiftyCeo();
    c.stations = { productivity: 1, enterprise: 0, fifty_fifty: 0, research: 0, idle: 0 };
    const unit = w.units[c.units[0] as number] as (typeof w.units)[number];
    const norm = (w.industries[unit.industry] as (typeof w.industries)[number]).params.rd_norm;
    unit.rd_plan = mult * norm;
    // Keep the test companies solvent, so the M4 books (5.12 distress) never freeze them before
    // the year is out: CO-0026 and CO-0027 start with $0 cash and no line, so the barebones
    // loadout is in forced sales from the first month (design fix 226).
    c.cash_usd = SOLVENT_CASH_USD;
    c.finance.line.drawn = 0.0;
  }
}

describe("m3 productivity", () => {
  it("score_fifty_a_year_at_the_norm_double_and_none", () => {
    const sim = unwrap(simNew(data(), 4), "Sim::new");
    simRegisterTestJob(sim, "MonthlyFringe", "test.plans", plansAndBoard);
    // Twelve monthly jobs: 1 Feb 2020 to 1 Jan 2021.
    runTo(sim, simDateYmd(2021, 1, 1));
    const w = simWorld(sim);
    // Spec 5.6 check (score 50): -6 at the norm, -16 with none; at double the norm +4 a year in the
    // spec, -1 with the D973 curve (an overspend of one norm counts as half).
    BAREBONES_PLANS.forEach(([key], i) => {
      const c = w.companies[company(w, key)] as Company;
      expect(Math.abs(c.management_score - 50.0) < 1e-9, key).toBe(true);
      expect(c.stations).toEqual({ productivity: 1, enterprise: 0, fifty_fifty: 0, research: 0, idle: 0 });
      expect((c.data[0] as (typeof c.data)[number]).book.free_rd_pct).toBe(0);
      const p = (w.units[c.units[0] as number] as (typeof w.units)[number]).productivity;
      const want = [99.0, 94.0, 84.0][i] as number;
      expect(Math.abs(p - want) < 1e-9, `${key}: ${p} vs ${want}`).toBe(true);
    });
  });
});

/**
 * On 1 Feb (step 3): Arrowhead gets 12 research stations out of its idle; two other units sit at
 * the clamp edges with R&D pushing them over.
 */
function researchAndClamp(w: World, ctx: JobCtx): void {
  const { month, year } = ctx.facts.date;
  if (month !== 2 || year !== 2020) return;
  const a = w.companies[company(w, "CO-0001")] as Company;
  a.stations.research = 12;
  a.stations.idle -= 12;
  for (const [key, p, mult] of [
    ["CO-0002", 199.9, 3.0],
    ["CO-0004", 30.1, 0.0],
  ] as [string, number, number][]) {
    const unit = w.units[
      (w.companies[company(w, key)] as Company).units[0] as number
    ] as (typeof w.units)[number];
    const norm = (w.industries[unit.industry] as (typeof w.industries)[number]).params.rd_norm;
    unit.productivity = p;
    unit.rd_plan = mult * norm;
  }
}

describe("m3 productivity step", () => {
  it("productivity_step_follows_5_6_on_the_live_engine", () => {
    const sim = unwrap(simNew(data(), 6), "Sim::new");
    simRegisterTestJob(sim, "MonthlyFringe", "test.research", researchAndClamp);
    // Every unit's month, worked by hand from the state before the tick.
    runTo(sim, simDateYmd(2020, 1, 31));
    const before = structuredClone(simWorld(sim));
    runTo(sim, simDateYmd(2020, 2, 1));
    const w = simWorld(sim);
    let checked = 0;
    w.units.forEach((u, uid) => {
      const c = w.companies[u.company] as Company;
      const key = c.key;
      if (key === "CO-0002" || key === "CO-0004") return;
      const b = before.units[uid] as (typeof w.units)[number];
      const norm = (w.industries[u.industry] as (typeof w.industries)[number]).params.rd_norm;
      // Free R&D this month is the step of held TB at the start of the month (5.9 step 1).
      const free = (c.data[0] as (typeof c.data)[number]).book.free_rd_pct / 100.0;
      const held0 = ((before.companies[u.company] as Company).data[0] as (typeof c.data)[number]).book.held;
      const step = held0 < 1.0 ? 0.0 : 1.0 + Math.floor(Math.log10(held0));
      expect(Math.abs(free * 100.0 - step) < 1e-9, key).toBe(true);
      const score = specScore(w, c);
      const want = Math.min(
        Math.max(b.productivity + specDelta(b.rd_plan + free, norm, score, c.stations), 30.0),
        200.0,
      );
      expect(Math.abs(u.productivity - want) < 1e-9, `${key}: ${u.productivity} vs ${want}`).toBe(true);
      checked += 1;
    });
    expect(checked).toBe(w.units.length - 2);
    // Arrowhead with 12 research stations out of the 9 January split's 291 idle (6.4: 100 / 1 / 0
    // / 291): x1.02; 279 of 392 idle, decay 0.3. Its R&D is the locked 1.8% plus 1% free.
    const a = w.companies[company(w, "CO-0001")] as Company;
    expect([a.stations.research, a.stations.idle]).toEqual([12, 279]);
    const au = w.units[a.units[0] as number] as (typeof w.units)[number];
    const rdTotal = (before.units[a.units[0] as number] as (typeof w.units)[number]).rd_plan + 0.01;
    expect(Math.abs(rdTotal - 0.028) < 1e-12).toBe(true);
    const want =
      100.0 + (10.0 * (rdTotal / 0.05 - 1.0) * (0.5 + specScore(w, a) / 100.0) * 1.02) / 12.0 - 0.3;
    expect(Math.abs(au.productivity - want) < 1e-9).toBe(true);
    // The clamp (5.6): 30 to 200.
    const prod = (key: string): number =>
      (w.units[(w.companies[company(w, key)] as Company).units[0] as number] as (typeof w.units)[number])
        .productivity;
    expect(prod("CO-0002")).toBe(200.0);
    expect(prod("CO-0004")).toBe(30.0);
  });
});

/** On 1 Feb (step 3): Arrowhead's CEO is replaced; the score moves at step 10 of the same tick. */
function swapCeo(w: World, ctx: JobCtx): void {
  if (ctx.facts.date.month === 2 && ctx.facts.date.year === 2020) {
    const a = w.companies[company(w, "CO-0001")] as Company;
    a.board[0] = scoreFiftyCeo();
  }
}

describe("m3 management recompute", () => {
  it("management_score_is_recomputed_each_month", () => {
    const sim = unwrap(simNew(data(), 6), "Sim::new");
    simRegisterTestJob(sim, "MonthlyFringe", "test.swap_ceo", swapCeo);
    const w0 = simWorld(sim);
    const atLoad = (w0.companies[company(w0, "CO-0001")] as Company).management_score;
    runTo(sim, simDateYmd(2020, 2, 1));
    const w = simWorld(sim);
    const a = w.companies[company(w, "CO-0001")] as Company;
    expect(Math.abs(a.management_score - specScore(w, a)) < 1e-9).toBe(true);
    expect(a.management_score).not.toBe(atLoad);
  });
});
