// personsStart (pivot 5.7, 5.8; D1041): every office of the real 1995 world seated exactly once,
// the politics POC's holders the same people, plausible records, and each state's bench.

import { describe, expect, it } from "vitest";
import { BENCH_PER_STATE, houseSeatsOf, MIN_AGE, officeSeats } from "../../src/politics/careers.ts";
import { PARTY_BLOCS } from "../../src/politics/generate.ts";
import { personGet, seatKey } from "../../src/politics/people.ts";
import { dateTimeDate } from "../../src/time/calendar.ts";
import { cmpDate } from "../../src/types/calendar.ts";
import { ordinal, type UsStateId } from "../../src/types/ids.ts";
import type { OfficeSeat, Person } from "../../src/types/state/persons.ts";
import type { World } from "../../src/types/world.ts";
import { world1995, worldMini } from "./common.ts";

function count(w: World, kind: OfficeSeat["kind"]): number {
  return w.persons.offices.filter((o) => o.seat.kind === kind).length;
}

function seatedOnce(w: World): void {
  const s = w.persons;
  const seats = officeSeats(w);
  const keys = s.offices.map((o) => seatKey(o.seat));
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys).toEqual(seats.map(seatKey));
  // One office per person at the start.
  const people = s.offices.map((o) => o.person);
  expect(new Set(people).size).toBe(people.length);
  expect(s.vacancies).toEqual([]);
}

describe("personsStart in the real 1995 world (pivot 5.8)", () => {
  const w = world1995(1);
  const s = w.persons;
  const start = dateTimeDate(w.clock);

  it("seats every office exactly once", () => {
    seatedOnce(w);
    const courts = w.politics.posts.reduce(
      (n, p) => (p.kind === "Supreme" || p.kind === "Appeals" || p.kind === "Trial" ? n + p.seats : n),
      0,
    );
    expect([
      count(w, "President"),
      count(w, "VicePresident"),
      count(w, "Cabinet"),
      count(w, "Senate"),
      count(w, "House"),
      count(w, "Governor"),
      count(w, "Judge"),
      count(w, "FedChair"),
    ]).toEqual([1, 1, 14, 100, 435, 50, courts, 1]);
    // One representative per district of the apportionment in force.
    w.politics.states.forEach((_, i) => {
      const state = ordinal<UsStateId>(i);
      const held = s.offices
        .filter((o) => o.seat.kind === "House" && o.seat.state === state)
        .map((o) => (o.seat.kind === "House" ? o.seat.district : 0));
      expect(held).toEqual([...Array(houseSeatsOf(w, state)).keys()].map((k) => k + 1));
    });
  });

  it("makes the POC's office holders the same people", () => {
    const year = start.year;
    for (const c of w.politics.politicians) {
      const matches = s.persons.filter((p) => p.name === c.name && p.born === year - c.age);
      expect(matches.length, c.name).toBe(1);
      const p = matches[0] as Person;
      expect({ skills: p.skills, traits: p.traits, party: p.party, ideology: p.ideology }).toEqual({
        skills: c.skills,
        traits: c.traits,
        party: c.party,
        ideology: c.ideology,
      });
      expect(p.status).toBe("InOffice");
      expect(p.career.at(-1)?.seat.kind).toBe(c.office.kind);
    }
    // The 1995 Congress keeps its real party split (1995-rework 7.2): 204 Democrats in the House.
    const dems = s.offices.filter(
      (o) => o.seat.kind === "House" && personGet(s, o.person)?.party === "Democrats",
    );
    expect(dems.length).toBe(w.era?.politics.states.reduce((n, x) => n + x.start_house_dem, 0));
  });

  it("gives every holder a home state, an ideology of their party, an age and a plausible record", () => {
    for (const o of s.offices) {
      const p = personGet(s, o.person) as Person;
      if (o.seat.kind === "House" || o.seat.kind === "Senate" || o.seat.kind === "Governor") {
        expect(p.home_state).toBe(o.seat.state);
      }
      expect(w.politics.states[p.home_state]?.senate_classes.length, p.name).toBeGreaterThan(0);
      const party = p.party ?? "Democrats";
      expect(PARTY_BLOCS[party].map(([i]) => i)).toContain(p.ideology);
      expect(p.integrity).toBeGreaterThanOrEqual(0);
      expect(p.integrity).toBeLessThanOrEqual(100);
      const last = p.career.at(-1);
      expect(last).toMatchObject({ how: "Start", to: null, exit: null });
      expect(seatKey(last?.seat as OfficeSeat)).toBe(seatKey(o.seat));
      expect(cmpDate(o.since, start)).toBeLessThanOrEqual(0);
      expect(o.since).toEqual(last?.from);
      // Old enough when each line began; earlier lines closed, in order.
      p.career.forEach((c, i) => {
        expect(c.from.year - p.born, p.name).toBeGreaterThanOrEqual(MIN_AGE.House);
        if (i < p.career.length - 1) {
          expect(c.to).not.toBeNull();
          expect(
            cmpDate(c.to as never, (p.career[i + 1] as Person["career"][number]).from),
          ).toBeLessThanOrEqual(0);
        }
      });
      if (o.term_ends !== null) expect(cmpDate(o.term_ends, start)).toBeGreaterThan(0);
    }
    // Some start holders held a lower office first.
    expect(s.persons.filter((p) => p.career.length > 1).length).toBeGreaterThan(50);
  });

  it("fills each state's bench with rising figures", () => {
    w.politics.states.forEach((st, i) => {
      const bench = s.benches[i] ?? [];
      expect(bench.length, st.name).toBe(st.senate_classes.length > 0 ? BENCH_PER_STATE : 0);
      for (const id of bench) {
        const p = personGet(s, id) as Person;
        expect(p.status).toBe("Bench");
        expect(p.home_state).toBe(i);
        expect(["Mayor", "StateLegislator", "Business", "Celebrity"]).toContain(p.origin);
        expect(p.career).toEqual([]);
      }
    });
    expect(s.platforms.map((p) => p.party)).toEqual(["Democrats", "Republicans"]);
    for (const p of s.platforms) expect(p.mix.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("is the same for the same seed and differs for another", () => {
    expect(world1995(1).persons).toEqual(s);
    expect(world1995(2).persons).not.toEqual(s);
  });
});

describe("personsStart in the frozen mini world (no era, no counties)", () => {
  it("seats every office once, the POC's holders included", () => {
    const w = worldMini(1);
    seatedOnce(w);
    expect(count(w, "Governor")).toBe(50);
    expect(count(w, "FedChair")).toBe(1);
    for (const c of w.politics.politicians) {
      expect(
        w.persons.persons.some((p) => p.name === c.name && p.skills.persuasion === c.skills.persuasion),
      ).toBe(true);
    }
  });
});
