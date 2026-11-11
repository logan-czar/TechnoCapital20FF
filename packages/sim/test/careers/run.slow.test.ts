// 25 years of careers (pivot 5.7 to 5.10; D1041, D1052) from the 1995 world: the politics days as
// the game runs them (the era's drift, lane G's geo, lane C's careers and lane E's real elections;
// elections/harness.ts), with no economy. The Person table must stay bounded and consistent; the test
// prints its size, the living, retired and dead, and the save bytes it adds.

import { describe, expect, it } from "vitest";
import { liveRaces } from "../../src/elections/races.ts";
import { officeSeats } from "../../src/politics/careers.ts";
import { personGet, personsStateEmpty, seatKey } from "../../src/politics/people.ts";
import { rngStreamsNew } from "../../src/rng.ts";
import { encode } from "../../src/save.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { controlsDefault } from "../../src/time/control.ts";
import type { World } from "../../src/types/world.ts";
import { runDays, runDraws } from "../elections/harness.ts";
import { world1995 } from "./common.ts";

/** Gzipped save bytes the persons table adds to `w`. */
function personsBytes(w: World): number {
  const rng = rngStreamsNew(1);
  const controls = controlsDefault(true);
  const full = encode(w, rng, controls).length;
  const empty = encode({ ...w, persons: personsStateEmpty() }, rng, controls).length;
  return full - empty;
}

function run(seed: number, lastYear: number): World {
  const w = world1995(seed);
  runDays(w, runDraws(seed), simDateYmd(1995, 1, 2), simDateYmd(lastYear, 12, 31));
  return w;
}

describe("25 years of careers", () => {
  it("keeps the Person table bounded and every office accounted for", () => {
    const t0 = performance.now();
    const startBytes = personsBytes(world1995(1));
    const w = run(1, 2019);
    const ms = performance.now() - t0;
    const s = w.persons;
    const by = (st: string) => s.persons.filter((p) => p.status === st).length;
    const counts = {
      persons: s.persons.length,
      bench: by("Bench"),
      candidate: by("Candidate"),
      in_office: by("InOffice"),
      retired: by("Retired"),
      dead: by("Dead"),
    };
    const endBytes = personsBytes(w);
    const raw = JSON.stringify(s).length;
    console.log(
      `careers 1995-2020: ${JSON.stringify(counts)}; persons save bytes (gzip) ${startBytes} at start, ${endBytes} at 2020; raw JSON ${raw}; ${ms.toFixed(0)} ms`,
    );
    expect(counts.persons).toBeLessThan(8000);
    // A candidate is running in a race not yet seated (2019's governors-elect take office in January).
    const running = new Set(liveRaces(w, 2019).flatMap((r) => r.candidacies.map((c) => c.person)));
    for (const p of s.persons) if (p.status === "Candidate") expect(running.has(p.id), p.name).toBe(true);
    // Every seat held once, but House seats waiting for a special election (lane E's).
    const seats = officeSeats(w).map(seatKey);
    const held = s.offices.map((o) => seatKey(o.seat));
    expect(new Set(held).size).toBe(held.length);
    const vacant = seats.filter((k) => !held.includes(k));
    expect(vacant.every((k) => k.startsWith("House/"))).toBe(true);
    expect(s.vacancies.map((v) => seatKey(v.seat)).sort()).toEqual([...vacant].sort());
    // Status agrees with the offices table.
    const holders = new Set(s.offices.map((o) => o.person));
    for (const p of s.persons) {
      expect(p.status === "InOffice", p.name).toBe(holders.has(p.id));
      if (p.status === "Dead" || p.status === "Retired") expect(p.left).not.toBeNull();
      const open = p.career.filter((c) => c.to === null).length;
      expect(open, p.name).toBe(s.offices.filter((o) => o.person === p.id).length);
    }
    // Benches are their size and hold no officeholder.
    for (const bench of s.benches) for (const id of bench) expect(holders.has(id)).toBe(false);
    // Careers went somewhere: people climbed, levelled and left.
    const climbed = s.persons.filter((p) => new Set(p.career.map((c) => c.seat.kind)).size > 1).length;
    expect(climbed).toBeGreaterThan(30);
    expect(s.persons.some((p) => p.level >= 2)).toBe(true);
    expect(counts.dead).toBeGreaterThan(100);
    const president = s.offices.find((o) => o.seat.kind === "President");
    expect(personGet(s, president?.person ?? (-1 as never))?.career.at(-1)?.how).not.toBe("Start");
  });

  it("is the same for the same seed", () => {
    expect(run(2, 1999).persons).toEqual(run(2, 1999).persons);
  });
});
