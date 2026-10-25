// Port of crates/sim/tests/spec_5_7.rs: spec 5.7 management score and confidence factor
// (build-plan M3.3): a skill-11 board with an empty Chair scores about 51; generated boards
// average about 33, 47 and 60 by size (3.7.1).
//
// Expects:
//   ../../src/people/management.ts  type Member { skills, traits }, boardDefault() -> Board
//                                   [Board::default], boardSet(board, seat, member) [Board::set],
//                                   confidenceFactor(score), managementScore(board),
//                                   memberSkill(member, seat), mgmtFactor(score)
//   ../../src/people/names.ts       nameBookForCountry(data, iso3)
//   ../../src/people/simple.ts      generateSimple(rng, names, size, seat)
//   ./common/rng.ts                 newRng
//
// Changed from the Rust: the seeded RNG is new (D951), so the seed 51 draws other boards; the
// averages hold within the same +-2 tolerance for any sound generator.
import { describe, expect, it } from "vitest";
import {
  boardDefault,
  boardSet,
  confidenceFactor,
  type Member,
  managementScore,
  memberSkill,
  mgmtFactor,
} from "../../src/people/management.ts";
import { nameBookForCountry } from "../../src/people/names.ts";
import { generateSimple } from "../../src/people/simple.ts";
import {
  type CompanySize,
  SEAT_LABOR,
  type Seat,
  type Skills,
  type Trait,
} from "../../src/types/state/people.ts";
import { data } from "./common/index.ts";
import { newRng } from "./common/rng.ts";

function flat(v: number): Skills {
  return { finance: v, operations: v, persuasion: v, intrigue: v, tech: v, hustle: v };
}

function close(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

describe("spec 5.7 management", () => {
  it("board_of_eleven_with_empty_chair_scores_about_51", () => {
    const s = flat(11);
    const board = boardDefault();
    for (const seat of SEAT_LABOR) {
      boardSet(board, seat, { skills: s, traits: [] });
    }
    // 0.9 x 11 + 0.1 x 3 = 10.2, / 20 x 100 = 51.
    expect(close(managementScore(board), 51.0, 1e-9)).toBe(true);
  });

  it("empty_seats_count_three_and_score_caps_at_100", () => {
    // No board at all: every seat counts 3, so 15.
    expect(close(managementScore(boardDefault()), 15.0, 1e-9)).toBe(true);
    // One labor unit: the CEO alone (skill 10) and five empty seats.
    const s = flat(10);
    const ceoOnly = boardDefault();
    boardSet(ceoOnly, "Ceo", { skills: s, traits: [] });
    expect(close(managementScore(ceoOnly), ((3.0 + 0.7 * 3.0) / 20.0) * 100.0, 1e-9)).toBe(true);
    // A board of 25s (Chair included) caps at 100.
    const top = flat(25);
    const full = boardDefault();
    const seats: Seat[] = ["Ceo", "Cfo", "Cio", "Cmo", "Coo", "Chair"];
    for (const seat of seats) {
      boardSet(full, seat, { skills: top, traits: [] });
    }
    expect(managementScore(full)).toBe(100.0);
  });

  it("ceo_reads_the_average_of_finance_operations_and_persuasion", () => {
    const s: Skills = {
      finance: 9,
      operations: 12,
      persuasion: 15,
      intrigue: 0,
      tech: 30,
      hustle: 30,
    };
    const m: Member = { skills: s, traits: [] };
    expect(close(memberSkill(m, "Ceo"), 12.0, 1e-12)).toBe(true);
    expect(memberSkill(m, "Cfo")).toBe(9.0);
    expect(memberSkill(m, "Coo")).toBe(12.0);
    expect(memberSkill(m, "Cmo")).toBe(15.0);
    expect(memberSkill(m, "Cio")).toBe(0.0);
  });

  it("trait_shifts_apply_in_their_seats", () => {
    const s = flat(10);
    const m = (traits: Trait[]): Member => ({ skills: s, traits });
    // Diligent +2, Lazy -2, Ambitious +1 in any seat (3.7.1; D206).
    for (const seat of SEAT_LABOR) {
      expect(memberSkill(m(["Diligent"]), seat)).toBe(12.0);
      expect(memberSkill(m(["Lazy"]), seat)).toBe(8.0);
      expect(memberSkill(m(["Ambitious"]), seat)).toBe(11.0);
    }
    expect(memberSkill(m(["Diligent", "Ambitious"]), "Coo")).toBe(13.0);
    // Greedy -1 as CFO only.
    expect(memberSkill(m(["Greedy"]), "Cfo")).toBe(9.0);
    expect(memberSkill(m(["Greedy"]), "Ceo")).toBe(10.0);
    // Other traits shift nothing, and their skill effects are not counted here (D206).
    for (const t of ["Gregarious", "Deceitful", "Honest", "Ruthless"] as const) {
      expect(memberSkill(m([t]), "Cmo"), t).toBe(10.0);
    }
    // A shift never takes the skill below 0.
    const lazy: Member = { skills: flat(1), traits: ["Lazy"] };
    expect(memberSkill(lazy, "Coo")).toBe(0.0);
  });

  it("generated_boards_average_about_33_47_60_by_size", () => {
    const d = data();
    const names = nameBookForCountry(d, "USA");
    if (names === null) throw new Error("no USA name book");
    const rng = newRng(51);
    const n = 20_000;
    const cases: [CompanySize, number][] = [
      ["Small", 33.0],
      ["Mid", 47.0],
      ["Large", 60.0],
    ];
    for (const [size, want] of cases) {
      let sum = 0.0;
      for (let i = 0; i < n; i++) {
        const chars = SEAT_LABOR.map((seat) => generateSimple(rng, names, size, seat));
        const board = boardDefault();
        for (const c of chars) {
          boardSet(board, c.seat, { skills: c.skills, traits: c.traits });
        }
        sum += managementScore(board);
      }
      const mean = sum / n;
      // Without traits the means are 33.0, 46.5 and 60.0; the 3.7.1 trait shifts add about 1.4
      // (D206).
      expect(close(mean, want, 2.0), `${size} mean ${mean}`).toBe(true);
    }
  });

  it("confidence_and_management_factors", () => {
    // 10.5.2 table: score 30, 50, 80.
    expect(close(confidenceFactor(30.0), 0.92, 1e-12)).toBe(true);
    expect(close(confidenceFactor(50.0), 1.0, 1e-12)).toBe(true);
    expect(close(confidenceFactor(80.0), 1.12, 1e-12)).toBe(true);
    expect(close(confidenceFactor(0.0), 0.8, 1e-12)).toBe(true);
    expect(close(confidenceFactor(100.0), 1.2, 1e-12)).toBe(true);
    expect(close(mgmtFactor(30.0), 0.8, 1e-12)).toBe(true);
    expect(close(mgmtFactor(50.0), 1.0, 1e-12)).toBe(true);
    expect(close(mgmtFactor(80.0), 1.3, 1e-12)).toBe(true);
  });
});
