// Careers rules (pivot 5.9, 5.10; D1041): exits raise vacancies and the right ones are filled the
// same day, people outlive office, benches keep their size, challengers and the ladder are
// deterministic, an executive can cross over, and each level raises exactly one skill.

import { describe, expect, it } from "vitest";
import { usStateOfProvinces } from "../../src/governing/levers.ts";
import {
  BENCH_PER_STATE,
  careersDay,
  challengerFor,
  declareCycle,
  executiveCrossovers,
  levelXp,
  personAward,
  personDie,
  personScandalExit,
  SKILL_CAP,
} from "../../src/politics/careers.ts";
import { HOUSE_RANGES } from "../../src/politics/generate.ts";
import { officeHolderOf, personGet, seatKey } from "../../src/politics/people.ts";
import { rngStreamsDraws, rngStreamsNew } from "../../src/rng.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { type CompanyId, ordinal, type PersonId, type UsStateId } from "../../src/types/ids.ts";
import type { OfficeSeat, Person } from "../../src/types/state/persons.ts";
import type { World } from "../../src/types/world.ts";
import { seatsUp, world1995 } from "./common.ts";

const draws = (seed: number) => rngStreamsDraws(rngStreamsNew(seed));
const JAN_1996 = simDateYmd(1996, 1, 1);

function holderOf(w: World, seat: OfficeSeat): Person {
  const h = officeHolderOf(w.persons, seat);
  if (h === undefined) throw new Error(`${seatKey(seat)} vacant`);
  return personGet(w.persons, h.person) as Person;
}

describe("exits and vacancies (pivot 5.9, 6.1)", () => {
  const base = world1995(1);

  it("a death raises a vacancy; a House seat waits for its special, the rest are filled that day", () => {
    const w = structuredClone(base);
    const house: OfficeSeat = { kind: "House", state: ordinal<UsStateId>(4), district: 3 };
    const senate: OfficeSeat = { kind: "Senate", state: ordinal<UsStateId>(4), senate_class: 1 };
    const judge = w.persons.offices.find((o) => o.seat.kind === "Judge")?.seat as OfficeSeat;
    const gov: OfficeSeat = { kind: "Governor", state: ordinal<UsStateId>(4) };
    const dying = [house, senate, judge, gov].map((seat) => holderOf(w, seat));
    for (const p of dying) personDie(w, p.id, JAN_1996);
    expect(w.persons.vacancies.map((v) => [seatKey(v.seat), v.fill])).toEqual([
      [seatKey(house), "Special"],
      [seatKey(senate), "Appointment"],
      [seatKey(judge), "Appointment"],
      [seatKey(gov), "Succession"],
    ]);
    careersDay(w, draws(5), simDateYmd(1996, 1, 2));
    expect(w.persons.vacancies.map((v) => seatKey(v.seat))).toEqual([seatKey(house)]);
    expect(officeHolderOf(w.persons, house)).toBeUndefined();
    const appointed = holderOf(w, senate);
    expect(appointed.career.at(-1)?.how).toBe("Appointed");
    expect(appointed.home_state).toBe(4);
    expect(officeHolderOf(w.persons, senate)?.term_ends).toEqual(simDateYmd(1997, 1, 3));
    expect(holderOf(w, gov).career.at(-1)?.how).toBe("Succeeded");
    expect(holderOf(w, gov).party).toBe(dying[3]?.party);
    expect(holderOf(w, judge).career.at(-1)?.how).toBe("Appointed");
    // People outlive office: the dead stay in the table with their record closed.
    for (const p of dying) {
      const after = personGet(w.persons, p.id) as Person;
      expect(after.status).toBe("Dead");
      expect(after.left).toEqual(JAN_1996);
      expect(after.career.at(-1)).toMatchObject({ to: JAN_1996, exit: "Died" });
    }
  });

  it("the president's death makes the vice president president, and a new vice president is named", () => {
    const w = structuredClone(base);
    const pres = holderOf(w, { kind: "President" });
    const vp = holderOf(w, { kind: "VicePresident" });
    personDie(w, pres.id, JAN_1996);
    careersDay(w, draws(6), simDateYmd(1996, 1, 2));
    expect(holderOf(w, { kind: "President" }).id).toBe(vp.id);
    expect(vp.career.at(-2)).toMatchObject({ exit: "Promoted" });
    const now = personGet(w.persons, vp.id) as Person;
    expect(now.career.at(-1)).toMatchObject({ how: "Succeeded", to: null });
    const newVp = holderOf(w, { kind: "VicePresident" });
    expect(newVp.id).not.toBe(vp.id);
    expect(newVp.career.at(-1)?.how).toBe("Appointed");
    expect(w.persons.vacancies).toEqual([]);
  });

  it("deaths and retirements across the years raise vacancies; nobody is lost from the table", () => {
    const w = structuredClone(base);
    const d = draws(7);
    const before = w.persons.persons.length;
    let vacated = 0;
    for (let y = 1996; y <= 2005; y++) {
      const seated = new Set(w.persons.offices.map((o) => o.person));
      careersDay(w, d, simDateYmd(y, 1, 1));
      for (const id of seated) {
        const p = personGet(w.persons, id) as Person;
        if (p.status === "Dead" || p.status === "Retired") vacated += 1;
      }
    }
    expect(vacated).toBeGreaterThan(20);
    expect(w.persons.persons.length).toBeGreaterThan(before);
    expect(w.persons.persons.map((p) => p.id)).toEqual(w.persons.persons.map((_, i) => i));
    // Every vacancy left open is a House special (lane E's).
    expect(w.persons.vacancies.every((v) => v.fill === "Special")).toBe(true);
    // The executive and the courts stay full.
    for (const kind of ["President", "VicePresident", "Cabinet", "Senate", "Governor", "Judge", "FedChair"]) {
      const seats = base.persons.offices.filter((o) => o.seat.kind === kind).length;
      expect(w.persons.offices.filter((o) => o.seat.kind === kind).length, kind).toBe(seats);
    }
  });

  it("a scandal exit resigns every office and leaves public life", () => {
    const w = structuredClone(base);
    const seat: OfficeSeat = { kind: "House", state: ordinal<UsStateId>(9), district: 1 };
    const p = holderOf(w, seat);
    personScandalExit(w, p.id, JAN_1996);
    expect(personGet(w.persons, p.id)).toMatchObject({ status: "Retired", left: JAN_1996 });
    expect(p.career.at(-1)?.exit).toBe("Resigned");
    expect(w.persons.vacancies.map((v) => seatKey(v.seat))).toEqual([seatKey(seat)]);
  });
});

describe("benches (pivot 5.9 item 1)", () => {
  it("every state's bench is refilled to its size each 1 January", () => {
    const w = world1995(3);
    const d = draws(8);
    for (let y = 1996; y <= 2000; y++) {
      careersDay(w, d, simDateYmd(y, 1, 1));
      w.politics.states.forEach((st, i) => {
        const bench = (w.persons.benches[i] ?? []).filter(
          (id) => personGet(w.persons, id)?.status === "Bench",
        );
        expect(bench.length, `${st.name} ${y}`).toBe(st.senate_classes.length > 0 ? BENCH_PER_STATE : 0);
      });
    }
  });
});

describe("challengers and the ladder (pivot 5.9)", () => {
  const base = world1995(1);

  it("challengerFor is deterministic", () => {
    const a = structuredClone(base);
    const b = structuredClone(base);
    const req = {
      state: ordinal<UsStateId>(4),
      party: "Republicans" as const,
      ranges: HOUSE_RANGES,
      origin: "Challenger" as const,
    };
    const pa = challengerFor(a, draws(11), req);
    const pb = challengerFor(b, draws(11), req);
    expect(pa).toEqual(pb);
    expect(pa).toMatchObject({ status: "Candidate", home_state: 4, party: "Republicans" });
  });

  it("declares candidates top of the ladder down, deterministically, nobody twice", () => {
    const date = simDateYmd(1996, 9, 1);
    const a = structuredClone(base);
    const b = structuredClone(base);
    const seats = seatsUp(a, 1996);
    const da = declareCycle(a, draws(12), seats, date);
    const db = declareCycle(b, draws(12), seats, date);
    expect(da).toEqual(db);
    expect(a.persons).toEqual(b.persons);
    expect(da.map((d) => seatKey(d.seat))).toEqual(seats.map(seatKey));
    const all = da.flatMap((d) => d.candidates.map((c) => c.person));
    expect(new Set(all).size).toBe(all.length);
    let running = 0;
    let held = 0;
    for (const d of da) {
      // Both parties are on every ballot (an incumbent stands for theirs).
      expect(new Set(d.candidates.map((c) => c.party)), seatKey(d.seat)).toEqual(
        new Set(["Democrats", "Republicans"]),
      );
      if (d.incumbent !== null) {
        held += 1;
        if (d.incumbent_out === null) running += 1;
      }
    }
    // Incumbents usually run again.
    expect(running / held).toBeGreaterThan(0.75);
    // Some House members and governors reach for the Senate.
    const senateFromBelow = da
      .filter((d) => d.seat.kind === "Senate")
      .flatMap((d) => d.candidates)
      .filter((c) => !c.incumbent && (personGet(a.persons, c.person)?.status ?? "") === "InOffice");
    expect(senateFromBelow.length).toBeGreaterThan(0);
  });

  it("bars a president who has served two terms", () => {
    const w = structuredClone(base);
    const p = holderOf(w, { kind: "President" });
    const line = p.career.at(-1);
    if (line === undefined) throw new Error("no line");
    line.from = simDateYmd(1989, 1, 20);
    const [d] = declareCycle(w, draws(13), [{ kind: "President" }], simDateYmd(1996, 9, 1));
    expect(d?.incumbent_out).toBe("TermLimited");
    expect(d?.candidates.some((c) => c.person === p.id)).toBe(false);
  });
});

describe("executive crossovers (pivot 5.9 item 3)", () => {
  it("an executive of a bankrupt US company joins their state's bench with their identity", () => {
    const w = world1995(1);
    const states = usStateOfProvinces(w);
    const i = w.companies.findIndex(
      (c) =>
        c.hq_country === w.politics.country && states.has(c.hq_province) && c.board.some((h) => h !== null),
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const c = w.companies[i] as World["companies"][number];
    c.finance.distress.status = "Bankrupt";
    const execs = c.board.filter((h) => h !== null).map((h) => h.seat.character);
    const made = executiveCrossovers(w, draws(14), JAN_1996, 1);
    expect(made.map((p) => p.name)).toEqual(execs.map((e) => e.name));
    for (const [k, p] of made.entries()) {
      const e = execs[k] as (typeof execs)[number];
      expect(p).toMatchObject({
        origin: "Executive",
        company: i as CompanyId,
        status: "Bench",
        born: 1996 - e.age,
      });
      expect(p.skills).toEqual(e.skills);
      expect(p.traits).toEqual(e.traits);
      expect(p.home_state).toBe(states.get(c.hq_province));
      expect(w.persons.benches[p.home_state]).toContain(p.id);
    }
    // Each executive crosses once.
    expect(executiveCrossovers(w, draws(15), JAN_1996, 1)).toEqual([]);
  });
});

describe("XP and levels (pivot 5.10)", () => {
  it("each level raises exactly one skill by one, never past the cap", () => {
    const w = world1995(1);
    const p = holderOf(w, { kind: "House", state: ordinal<UsStateId>(4), district: 1 });
    const d = draws(16);
    const sum = (x: Person) => Object.values(x.skills).reduce((a, b) => a + b, 0);
    for (let n = 0; n < 12; n++) {
      const level = p.level;
      const before = { ...p.skills };
      const raised = personAward(w, d, p.id, "ElectionWon");
      expect(raised.length).toBe(p.level - level);
      expect(p.xp).toBeLessThan(levelXp(p.level + 1));
      expect(sum(p) - Object.values(before).reduce((a, b) => a + b, 0)).toBe(raised.length);
      for (const k of raised) expect(p.skills[k]).toBeGreaterThan(before[k]);
    }
    expect(p.level).toBeGreaterThan(2);
    const capped = holderOf(w, { kind: "House", state: ordinal<UsStateId>(4), district: 2 });
    for (const k of Object.keys(capped.skills) as (keyof Person["skills"])[]) capped.skills[k] = SKILL_CAP;
    personAward(w, d, capped.id, "BillPassed");
    personAward(w, d, capped.id, "BillPassed");
    expect(capped.level).toBe(1);
    expect(Object.values(capped.skills).every((v) => v === SKILL_CAP)).toBe(true);
  });

  it("the level curve is named and rising", () => {
    expect([1, 2, 3, 4].map(levelXp)).toEqual([50, 150, 300, 500]);
    expect(personGet(world1995(1).persons, 0 as PersonId)?.level).toBe(0);
  });
});
