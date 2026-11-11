// A full cycle on the real 1995 county data (pivot 6.1, 6.2, 6.6, 6.7, 9.1, 9.4; D1040): the 1996
// races open, file, hold primaries, are counted at the first midnight after the polls close,
// certified, and seated in January; the votes add up county to district to state to the college.

import { beforeAll, describe, expect, it } from "vitest";
import {
  electionDay,
  handoverDate,
  SPECIAL_LEAD_DAYS,
  tuesdayOnOrAfter,
} from "../../src/elections/calendar.ts";
import { MIDTERM_TURNOUT_RATIO } from "../../src/elections/count.ts";
import { countiesByState, DC_ELECTORS, shareSize } from "../../src/elections/geography.ts";
import { raceUnits } from "../../src/elections/jobs.ts";
import { raceSeat } from "../../src/elections/races.ts";
import { officeHolderOf, officeLeave, personGet, seatKey } from "../../src/politics/people.ts";
import { dateTimeDate, simDateAddDays, simDateYmd } from "../../src/time/calendar.ts";
import { type CountyId, ordinal, type UsStateId } from "../../src/types/ids.ts";
import { roundHalfAway } from "../../src/types/num.ts";
import type { Race } from "../../src/types/state/elections.ts";
import type { World } from "../../src/types/world.ts";
import { runDays, runDraws, start1995 } from "./harness.ts";

const SEED = 4;

function stateId(w: World, name: string): UsStateId {
  return ordinal<UsStateId>(w.politics.states.findIndex((s) => s.name === name));
}

describe("the start (pivot 6.1)", () => {
  it("seats the 1995 Congress and a governor in every state but DC as persons", () => {
    const w = start1995(SEED);
    const kinds = (k: string) => w.persons.offices.filter((o) => o.seat.kind === k).length;
    expect(kinds("President")).toBe(1);
    expect(kinds("Senate")).toBe(100);
    expect(kinds("House")).toBe(435);
    expect(kinds("Governor")).toBe(50);
    expect(w.elections.calendar.governor_cycle.filter((c) => c === null)).toHaveLength(1);
    // 1995's three governor races are open; the 1996 cycle is not yet.
    expect(w.elections.races.map((r) => r.office)).toEqual(["Governor", "Governor", "Governor"]);
    expect(w.elections.calendar.next_general).toEqual(electionDay(1996));
  });
});

describe("the 1996 cycle on the real counties", () => {
  let w: World;
  let races: Race[];
  let midYear: World;
  // The year's end, before 1 January's county drift moves the people the count was made on.
  let counted: World;

  beforeAll(() => {
    w = start1995(SEED);
    const draws = runDraws(SEED);
    runDays(w, draws, simDateYmd(1995, 1, 1), simDateYmd(1996, 7, 1));
    midYear = structuredClone(w);
    runDays(w, draws, simDateYmd(1996, 7, 2), simDateYmd(1996, 12, 31));
    counted = structuredClone(w);
    runDays(w, draws, simDateYmd(1997, 1, 1), simDateYmd(1997, 1, 21));
    races = w.elections.races.filter((r) => r.cycle === 1996);
  });

  it("opens the presidency, 33 Senate seats, 435 House seats and 11 governors", () => {
    const count = (o: string) => races.filter((r) => r.office === o && !r.special).length;
    expect(count("President")).toBe(1);
    expect(count("Senate")).toBe(33);
    expect(count("House")).toBe(435);
    expect(count("Governor")).toBe(11);
    expect(races.map((r) => r.id)).toEqual(races.map((r) => r.id).sort((a, b) => a - b));
  });

  it("files candidates, holds each party's primary, and puts the nominees on the ballot", () => {
    const mid = midYear.elections.races.filter((r) => r.cycle === 1996);
    expect(mid.some((r) => r.status === "General")).toBe(true);
    expect(mid.some((r) => r.status !== "General")).toBe(true);
    for (const r of races) {
      expect(r.primaries.map((p) => p.party)).toEqual(["Democrats", "Republicans"]);
      expect(r.ballot).toHaveLength(2);
      r.primaries.forEach((p, i) => {
        expect(p.result?.winner).toBe(r.ballot[i]);
        expect(p.ballot).toEqual(r.candidacies.filter((c) => c.party === p.party).map((c) => c.person));
      });
      const nominees = r.candidacies.filter((c) => c.status === "Won" || c.status === "Lost");
      expect(nominees.map((c) => c.person).sort()).toEqual(r.ballot.slice().sort());
    }
  });

  it("counts every race once, after the polls close, and certifies it", () => {
    for (const r of races) {
      expect(r.status).toBe("Certified");
      expect(r.result?.certified).toEqual(simDateYmd(1996, 12, 3));
      expect(dateTimeDate(r.polls_close)).toEqual(r.general);
    }
  });

  it("splits every county's turnout into whole votes that add up race by race", () => {
    const byState = countiesByState(counted);
    for (const cr of counted.elections.county_results) {
      const r = counted.elections.races[cr.race] as Race;
      const sums = cr.votes.map((col) => col.reduce((a, b) => a + b, 0));
      expect(sums).toEqual(r.result?.votes);
      expect(sums.reduce((a, b) => a + b, 0)).toBe(r.result?.turnout);
      // Each unit's turnout is the county's turnout times its people, whole.
      const units = raceUnits(counted, r, byState);
      expect(units.map((u) => u.county)).toEqual(cr.counties);
      units.forEach((u, k) => {
        const c = counted.geo.counties[u.county] as World["geo"]["counties"][number];
        const cast = cr.votes.reduce((n, col) => n + (col[k] as number), 0);
        expect(cast).toBe(roundHalfAway(shareSize(c, u) * c.turnout));
      });
    }
    expect(MIDTERM_TURNOUT_RATIO).toBeLessThan(1);
  });

  it("sums districts to the state and states to the nation", () => {
    const pres = races.find((r) => r.office === "President") as Race;
    const all = w.elections.county_results.find((c) => c.race === pres.id);
    expect(all?.counties).toHaveLength(w.geo.counties.length);
    const presTurnout = new Map<number, number>();
    all?.counties.forEach((county, k) => {
      const s = (w.geo.counties[county] as { state: number }).state;
      presTurnout.set(s, (presTurnout.get(s) ?? 0) + (all.votes[0]?.[k] ?? 0) + (all.votes[1]?.[k] ?? 0));
    });
    w.politics.states.forEach((s, si) => {
      if (s.house_seats === 0) return;
      const house = races.filter((r) => r.office === "House" && r.state === si);
      const turnout = house.reduce((n, r) => n + (r.result?.turnout ?? 0), 0);
      // Shares of split counties round apart: at most one vote each way per split.
      const splits = house.length - 1;
      expect(Math.abs(turnout - (presTurnout.get(si) ?? 0))).toBeLessThanOrEqual(2 * splits);
    });
  });

  it("decides the presidency by an Electoral College of 538, DC's 3 included", () => {
    const college = w.elections.colleges.at(-1);
    expect(college).toBeDefined();
    expect(college?.totals.reduce((a, b) => a + b, 0)).toBe(538);
    expect(college?.states).toHaveLength(51);
    const dc = college?.states.find((t) => t.state === stateId(w, "District of Columbia"));
    expect(dc?.electoral_votes).toBe(DC_ELECTORS);
    const ca = college?.states.find((t) => t.state === stateId(w, "California"));
    expect(ca?.electoral_votes).toBe(54);
    const pres = races.find((r) => r.office === "President") as Race;
    expect(pres.result?.winner).toBe(college?.winner);
  });

  it("seats the winners in January and keeps the POC's mirror in step", () => {
    for (const r of races) {
      const seat =
        r.office === "President"
          ? { kind: "President" as const }
          : r.office === "Senate"
            ? { kind: "Senate" as const, state: r.state as UsStateId, senate_class: r.senate_class as number }
            : r.office === "Governor"
              ? { kind: "Governor" as const, state: r.state as UsStateId }
              : { kind: "House" as const, state: r.state as UsStateId, district: r.district as number };
      // The winner took the seat at the handover (a member named to the new cabinet by lane C the
      // same day has left it again, D1052).
      // The winner holds the seat (re-elected, or seated by a special since: the same line, a new
      // term), or took it at the handover and has left it again the same day.
      const holder = officeHolderOf(w.persons, seat)?.person;
      if (holder === r.result?.winner) continue;
      // A winner who died before the handover leaves the seat to a special (or an appointment).
      if (personGet(w.persons, r.result?.winner as never)?.status === "Dead") continue;
      const line = personGet(w.persons, r.result?.winner as never)?.career.find(
        (c) => seatKey(c.seat) === seatKey(seat) && c.how === "Elected",
      );
      expect(line?.from, seatKey(seat)).toEqual(handoverDate(r.office, 1996));
      expect(line?.to, seatKey(seat)).toEqual(handoverDate(r.office, 1996));
    }
    const p = w.politics;
    const last = p.elections.at(-1);
    expect(last?.date).toEqual(electionDay(1996));
    expect((last?.house[0] ?? 0) + (last?.house[1] ?? 0)).toBe(435);
    // The mirror is the offices table, seat for seat (D1052).
    const mirrorHouse = p.politicians.filter((c) => c.office.kind === "House");
    const house = w.persons.offices.filter((o) => o.seat.kind === "House");
    expect(mirrorHouse).toHaveLength(house.length);
    expect(mirrorHouse.filter((c) => c.party === "Democrats").length).toBe(
      house.filter((o) => personGet(w.persons, o.person)?.party === "Democrats").length,
    );
    const president = p.politicians.find((c) => c.office.kind === "President");
    const winner = personGet(
      w.persons,
      (races.find((r) => r.office === "President") as Race).result?.winner as never,
    );
    expect(president?.name).toBe(winner?.name);
    expect(p.politicians.filter((c) => c.office.kind === "Cabinet")).toHaveLength(14);
  });

  it("is the same for the same seed and differs by seed", () => {
    const again = start1995(SEED);
    runDays(again, runDraws(SEED), simDateYmd(1995, 1, 1), simDateYmd(1997, 1, 21));
    expect(again.elections).toEqual(w.elections);
    expect(again.persons).toEqual(w.persons);
    const other = start1995(SEED + 1);
    runDays(other, runDraws(SEED + 1), simDateYmd(1995, 1, 1), simDateYmd(1997, 1, 21));
    expect(other.elections.races.map((r) => r.result?.votes)).not.toEqual(races.map((r) => r.result?.votes));
  });
});

describe("special elections (pivot 6.1)", () => {
  it("fills a House seat left vacant with a special, seated at certification", () => {
    const w = start1995(SEED);
    const draws = runDraws(SEED);
    runDays(w, draws, simDateYmd(1995, 1, 1), simDateYmd(1995, 3, 1));
    const seat = { kind: "House" as const, state: stateId(w, "Ohio"), district: 3 };
    const left = officeLeave(w.persons, seat, "Died", simDateYmd(1995, 3, 1));
    expect(left).not.toBeNull();
    const key = seatKey(seat);
    expect(w.persons.vacancies.filter((v) => seatKey(v.seat) === key).map((v) => v.fill)).toEqual([
      "Special",
    ]);
    runDays(w, draws, simDateYmd(1995, 3, 2), simDateYmd(1995, 9, 30));
    const special = w.elections.races.find((r) => r.special && seatKey(raceSeat(r)) === key);
    expect(special?.office).toBe("House");
    expect(special?.general).toEqual(
      tuesdayOnOrAfter(simDateAddDays(simDateYmd(1995, 3, 1), SPECIAL_LEAD_DAYS)),
    );
    expect(special?.status).toBe("Certified");
    const holder = officeHolderOf(w.persons, seat);
    expect(holder?.person).toBe(special?.result?.winner);
    const line = personGet(w.persons, holder?.person as never)?.career.at(-1);
    expect(line?.how).toBe("Special");
    expect(holder?.term_ends).toEqual(simDateYmd(1997, 1, 3));
    expect(w.persons.vacancies.filter((v) => seatKey(v.seat) === key)).toEqual([]);
  });

  it("sends a vacant Senate seat to the next even-year general", () => {
    const w = start1995(SEED);
    const draws = runDraws(SEED);
    // Texas's class 1 seat is up in 2000, not 1996: a special falls on 1996's general day.
    const seat = { kind: "Senate" as const, state: stateId(w, "Texas"), senate_class: 1 };
    officeLeave(w.persons, seat, "Resigned", simDateYmd(1995, 1, 1));
    runDays(w, draws, simDateYmd(1995, 1, 1), simDateYmd(1995, 1, 2));
    // Lane C's governor appoints a senator the day the seat opens; the special replaces them.
    const holder = officeHolderOf(w.persons, seat);
    expect(personGet(w.persons, holder?.person as never)?.career.at(-1)?.how).toBe("Appointed");
    const special = w.elections.races.find((r) => r.special && seatKey(raceSeat(r)) === seatKey(seat));
    expect(special?.office).toBe("Senate");
    expect(special?.general).toEqual(electionDay(1996));
  });
});

describe("a world without counties (the frozen fixture)", () => {
  it("keeps the POC's vote and leaves the elections empty", async () => {
    const { simNew, simWorld } = await import("../../src/lib.ts");
    const { data } = await import("../common/index.ts");
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    const world = simWorld(made.value);
    runDays(world, runDraws(1), simDateYmd(2020, 1, 1), simDateYmd(2021, 1, 21));
    expect(world.elections.races).toEqual([]);
    expect(world.politics.elections).toHaveLength(1);
  });
});

describe("the districts (D1052)", () => {
  it("are lane G's plans in force, one per state with seats, matching its seats", () => {
    const w = start1995(SEED);
    const byState = countiesByState(w);
    w.politics.states.forEach((_, si) => {
      const seats = w.geo.seats[si] ?? 0;
      if (seats === 0) return;
      const plan = w.geo.plans.find((p) => p.state === si);
      expect(plan?.districts.length, `state ${si}`).toBe(seats);
      const units = raceUnits(
        w,
        { office: "House", state: si, district: seats } as Race,
        byState as CountyId[][],
      );
      expect(units).toEqual(seats === 1 ? units : plan?.districts[seats - 1]?.shares);
    });
  });
});
