// v_people (pivot 5.7, 5.11; D1041): public facts always, hidden stats only under Omniscient, and
// the chambers' make-up.

import { describe, expect, it } from "vitest";
import { personDie } from "../../src/politics/careers.ts";
import { officeHolderOf } from "../../src/politics/people.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { controlsDefault } from "../../src/time/control.ts";
import { ordinal, type UsStateId } from "../../src/types/ids.ts";
import type { World } from "../../src/types/world.ts";
import type { ViewInput } from "../../src/views/index.ts";
import { buildPeople, seatTitle } from "../../src/views/people.ts";
import { world1995 } from "./common.ts";

function input(world: World, omniscient: boolean): ViewInput {
  const controls = controlsDefault(true);
  controls.omniscient = omniscient;
  return { world, controls, seed: 1, map: {} as ViewInput["map"] };
}

describe("v_people", () => {
  const w = world1995(1);

  it("hides skills, traits, integrity, XP and level without Omniscient", () => {
    const v = buildPeople(input(w, false));
    expect(v.people.length).toBe(w.persons.persons.length);
    for (const r of v.people) {
      expect([r.skills, r.traits, r.integrity, r.xp, r.level]).toEqual([null, null, null, null, null]);
    }
    const json = JSON.stringify(v);
    expect(json).not.toContain("persuasion");
  });

  it("shows them under Omniscient, and the public facts either way", () => {
    const v = buildPeople(input(w, true));
    const hidden = buildPeople(input(w, false));
    v.people.forEach((r, i) => {
      const p = w.persons.persons[i];
      expect(r.skills).toEqual(p?.skills);
      expect(r.traits).toEqual(p?.traits);
      expect(r.integrity).toBe(p?.integrity);
      expect([r.xp, r.level]).toEqual([p?.xp, p?.level]);
      const pub = hidden.people[i];
      expect({ ...r, skills: null, traits: null, integrity: null, xp: null, level: null }).toEqual(pub);
    });
    const president = officeHolderOf(w.persons, { kind: "President" });
    const row = v.people.find((r) => r.id === president?.person);
    expect(row).toMatchObject({ office: "President of the United States", status: "InOffice" });
    expect(row?.age).toBe(1995 - (w.persons.persons[row?.id ?? 0]?.born ?? 0));
    expect(row?.career.at(-1)).toMatchObject({
      title: "President of the United States",
      how: "Start",
      to: null,
    });
  });

  it("titles seats as the records write them and shows how an office ended", () => {
    const tx = w.politics.states.findIndex((s) => s.name === "Texas");
    const seat = { kind: "House", state: ordinal<UsStateId>(tx), district: 12 } as const;
    expect(seatTitle(w.politics, seat)).toBe("Representative, Texas 12");
    expect(seatTitle(w.politics, { kind: "Governor", state: ordinal<UsStateId>(tx) })).toBe(
      "Governor of Texas",
    );
    const c = structuredClone(w);
    const holder = officeHolderOf(c.persons, seat);
    personDie(c, holder?.person as never, simDateYmd(1995, 6, 1));
    const v = buildPeople(input(c, false));
    const r = v.people.find((x) => x.id === holder?.person);
    expect(r).toMatchObject({ status: "Dead", office: null });
    expect(r?.career.at(-1)).toMatchObject({
      title: "Representative, Texas 12",
      exit: "Died",
      to: simDateYmd(1995, 6, 1),
    });
    const house = v.chambers.find((x) => x.chamber === "House");
    expect(house?.vacant).toBe(1);
  });

  it("counts the chambers by party, with the majority", () => {
    const v = buildPeople(input(w, false));
    expect(v.chambers.map((c) => c.chamber)).toEqual(["House", "Senate"]);
    const [house, senate] = v.chambers;
    expect((house?.parties ?? []).reduce((n, p) => n + p.seats, 0) + (house?.vacant ?? 0)).toBe(435);
    expect((senate?.parties ?? []).reduce((n, p) => n + p.seats, 0)).toBe(100);
    // The 104th Congress: Republicans hold both chambers.
    expect(house?.majority).toBe("Republicans");
    expect(senate?.majority).toBe("Republicans");
  });
});
