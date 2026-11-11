// A historical world's named characters (1995-rework 7.7, 7.8): the spawn queue, a founder taking a
// startup, controllers aging and dying, and a founder's line on the cap table.
import { describe, expect, it } from "vitest";
import { deathChance, eraAssignFounder, eraCharactersYear, FOUNDER_STAKE } from "../src/era/characters.ts";
import { simNew, simStep, simViews, simWorld } from "../src/lib.ts";
import { rngStreamsDraws, rngStreamsNew } from "../src/rng.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { Company, World } from "../src/types/world.ts";
import { capLines } from "../src/views/cap_table.ts";
import { data, data1995, macrotask } from "./common/index.ts";

function start(seed: number): World {
  const made = simNew(data1995(), seed, { scenario: "stable" });
  if (!made.ok) throw new Error("did not load");
  return simWorld(made.value);
}

const date = (year: number) => simDateYmd(year, 1, 1);
const named = (w: World): Company[] =>
  w.companies.filter((c) => c.start_control?.controller.kind === "Character");

describe("the data", () => {
  it("has John Techno waiting and no named controller on two companies", () => {
    const w = start(1);
    const era = w.era;
    const john = era?.characters.pool.find((s) => s.character.name === "John Techno");
    expect(john?.sector).toBe("");
    expect(john?.superregion).toBe("North America");
    expect(john?.spawn_year).toBeGreaterThanOrEqual(2016);
    expect(named(w).some((c) => c.name.startsWith("Arrowhead"))).toBe(false);
    const names = named(w).map(
      (c) => (c.start_control?.controller as { character: { name: string } }).character.name,
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("has every starting controller of working age in 1995", () => {
    for (const c of named(start(1))) {
      const r = c.start_control?.controller;
      if (r?.kind === "Character") expect(r.character.age).toBeGreaterThanOrEqual(30);
    }
  });

  it("is absent from the 2020 world", () => {
    const made = simNew(data(), 1);
    if (!made.ok) throw new Error("did not load");
    expect(simWorld(made.value).era).toBeUndefined();
  });
});

describe("the queue (1995-rework 7.7)", () => {
  /** A world with a chosen character at the head of the queue, and the first company as if just born. */
  function queued(sector: string, superregion: string): { w: World; id: CompanyId; company: Company } {
    const w = start(2);
    const era = w.era;
    if (era === undefined) throw new Error("no era");
    const s = era.characters.pool[0];
    if (s === undefined) throw new Error("no pool");
    s.sector = sector;
    s.superregion = superregion;
    era.characters.queue = [s];
    const id = w.companies.findIndex((c) => c.start_control?.controller.kind === "None") as CompanyId;
    const company = w.companies[id] as Company;
    company.start_control = null;
    return { w, id, company };
  }

  it("moves who is due into the queue, in file order, each 1 January", () => {
    const w = start(3);
    const era = w.era;
    if (era === undefined) throw new Error("no era");
    const before = era.characters.pool.length;
    const draws = rngStreamsDraws(rngStreamsNew(9));
    eraCharactersYear(w, era, date(1999), draws);
    const due = before - era.characters.pool.length;
    expect(due).toBeGreaterThan(0);
    expect(era.characters.queue.length).toBe(due);
    expect(era.characters.queue.every((s) => s.spawn_year <= 1999)).toBe(true);
    expect(era.characters.pool.every((s) => s.spawn_year > 1999)).toBe(true);
  });

  it("gives a fitting startup a controller, and takes them off the queue", () => {
    const probe = queued("", "x");
    const country = probe.w.countries[probe.company.hq_country];
    const { w, id, company } = queued("", country?.superregion ?? "");
    const born = w.era?.characters.queue[0]?.born_year ?? 0;
    eraAssignFounder(w, date(2001), id);
    const r = company.start_control?.controller;
    expect(r?.kind).toBe("Character");
    expect(company.start_control?.stake).toBe(FOUNDER_STAKE);
    expect(w.era?.characters.queue.length).toBe(0);
    expect(w.era?.history.founders[0]?.company).toBe(id);
    if (r?.kind === "Character") expect(r.character.age).toBe(2001 - born);
  });

  it("leaves a startup in another region or sector alone", () => {
    const wrong = queued("", "nowhere");
    eraAssignFounder(wrong.w, date(2001), wrong.id);
    expect(wrong.company.start_control).toBeNull();
    expect(wrong.w.era?.characters.queue.length).toBe(1);
    const region = wrong.w.countries[wrong.company.hq_country]?.superregion ?? "";
    const other = queued("no such sector", region);
    eraAssignFounder(other.w, date(2001), other.id);
    expect(other.company.start_control).toBeNull();
  });

  it("splits a founder's stake out of the seed block on the cap table", () => {
    const probe = queued("", "x");
    const { w, id, company } = queued("", probe.w.countries[probe.company.hq_country]?.superregion ?? "");
    company.holders = [{ holder: { kind: "SeedInvestors" }, shares: 1000 }];
    company.shares_out = 1000;
    eraAssignFounder(w, date(2001), id);
    const lines = capLines(w, company);
    expect(lines.map((l) => [l.holder.kind, l.shares])).toEqual([
      ["Controller", 500],
      ["SeedInvestors", 500],
    ]);
  });
});

describe("aging and heirs (1995-rework 7.8)", () => {
  it("makes death likelier with age", () => {
    expect(deathChance(60)).toBeCloseTo(0.01);
    expect(deathChance(68)).toBeCloseTo(0.02);
    expect(deathChance(40)).toBeLessThan(deathChance(60));
    expect(deathChance(200)).toBe(1);
  });

  it("ages a controller a year", () => {
    const w = start(4);
    const c = named(w)[0];
    const r = c?.start_control?.controller;
    if (r?.kind !== "Character") throw new Error("no controller");
    r.character.age = 30;
    const era = w.era;
    if (era === undefined) throw new Error("no era");
    eraCharactersYear(w, era, date(1996), rngStreamsDraws(rngStreamsNew(1)));
    expect(c?.start_control?.controller).toMatchObject({ character: { age: 31 } });
  });

  it("passes a dead controller's stake to an heir from the home name book, with a headline", () => {
    const w = start(5);
    const c = named(w)[0] as Company;
    const r = c.start_control?.controller;
    if (r?.kind !== "Character") throw new Error("no controller");
    const was = r.character.name;
    const stake = c.start_control?.stake;
    r.character.age = 400;
    const era = w.era;
    if (era === undefined) throw new Error("no era");
    for (const o of named(w)) {
      const k = o.start_control?.controller;
      if (o !== c && k?.kind === "Character") k.character.age = 20;
    }
    eraCharactersYear(w, era, date(1996), rngStreamsDraws(rngStreamsNew(2)));
    const now = c.start_control?.controller;
    if (now?.kind !== "Character") throw new Error("no heir");
    expect(now.character.name).not.toBe(was);
    expect(now.character.age).toBeLessThan(61);
    expect(c.start_control?.stake).toBe(stake);
    expect(era.history.successions.at(-1)).toMatchObject({ from: was, to: now.character.name });
  });
});

describe("a run", () => {
  it("places characters as founders, and the same seed places the same ones", async () => {
    const run = async (): Promise<string[]> => {
      const made = simNew(data1995(), 6, { scenario: "stable" });
      if (!made.ok) throw new Error("did not load");
      const sim = made.value;
      const end = dateTimeMidnight(simDateYmd(2003, 1, 1));
      let n = 0;
      while (sim.now() < end) {
        simStep(sim);
        if (++n % 8760 === 0) await macrotask();
      }
      const w = simWorld(sim);
      const views = simViews(sim);
      const founded = w.era?.history.founders ?? [];
      const row = founded[0];
      if (row !== undefined) {
        const lines = views.cap_table.data.companies[row.company]?.lines ?? [];
        expect(lines[0]?.holder.kind).toBe("Controller");
        expect(lines[0]?.name).toBe(row.name);
      }
      return founded.map((f) => `${f.year} ${f.name} ${f.company}`);
    };
    const a = await run();
    expect(a.length).toBeGreaterThan(0);
    expect(await run()).toEqual(a);
  }, 300_000);
});
