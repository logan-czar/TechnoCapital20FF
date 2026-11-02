// A historical world's named characters (1995-rework 7.7, 7.8): each spawns in a seeded year, waits in
// a queue and controls the next startup that fits, and every controller ages, dies and leaves an
// heir. Controllers stay in `Company.start_control`, which everything that reads a controller reads.
// Every draw is on the Era stream.

import type { CharacterSpawn, WorldData } from "@tc20ff/sim-data";
import { companyFinanceStatus } from "../finance/state.ts";
import { eraHeadline, newsWireQueue } from "../news.ts";
import { nameBookDrawUnique, nameBooksGet } from "../people/names.ts";
import { CEO_TRAITS, drawBaseFields, type Range, rangeNew } from "../people/simple.ts";
import { pinnedDraws } from "../rng.ts";
import type { SimDate } from "../types/calendar.ts";
import type { DrawSource } from "../types/draws.ts";
import type { CompanyId } from "../types/ids.ts";
import type { EraCharacters, EraSpawn, EraState } from "../types/state/era.ts";
import type { BaseCharacter } from "../types/state/people.ts";
import type { Company, World } from "../types/world.ts";
import { controllerBook } from "../world/controllers.ts";

/** A founder's share of the seed investors' block (1995-rework 7.7, T). */
export const FOUNDER_STAKE = 0.5;
/** companies.csv `control_basis` for a founder (1995-rework 7.7). */
export const FOUNDER_BASIS = "majority";
/** Yearly chance of death at 60, doubling every 8 years (1995-rework 7.8, T). */
export const DEATH_CHANCE_AT_60 = 0.01;
export const DEATH_DOUBLING_YEARS = 8;
const DEATH_ANCHOR_AGE = 60;
/** An heir's age and skills (1995-rework 7.8, T). */
export const HEIR_AGE: Range = rangeNew(28, 60);
export const HEIR_SKILLS: Range = rangeNew(6, 16);

/** The chance a controller of `age` dies this year (1995-rework 7.8). */
export function deathChance(age: number): number {
  return Math.min(1.0, DEATH_CHANCE_AT_60 * 2.0 ** ((age - DEATH_ANCHOR_AGE) / DEATH_DOUBLING_YEARS));
}

/** The pool at load: each row's character and its spawn year, drawn on the Era stream in file order. */
export function startCharacters(data: WorldData, draws: DrawSource): EraCharacters {
  const book = controllerBook(data);
  const spawn = (r: CharacterSpawn): EraSpawn => {
    const character = book.get(r.id);
    if (character === undefined) throw new Error(`no character ${r.id}`);
    return {
      character,
      spawn_year: draws.intInclusive("Era", r.spawn_first, r.spawn_last),
      born_year: r.born_year,
      superregion: r.superregion,
      sector: r.sector,
    };
  };
  return { pool: data.character_spawns.rows.map(spawn), queue: [] };
}

/** Whether a startup in `company` is one this character founds (1995-rework 7.7); an empty sector fits any. */
function fits(world: World, s: EraSpawn, company: Company): boolean {
  const country = world.countries[company.hq_country] as World["countries"][number];
  if (country.superregion !== s.superregion) return false;
  return s.sector === "" || s.sector === world.industries[company.industry]?.sector;
}

/**
 * A new startup (1995-rework 7.7): the first in the queue who fits takes control of it, holding part
 * of the seed investors' block. Draws nothing.
 */
export function eraAssignFounder(world: World, date: SimDate, id: CompanyId): void {
  const era = world.era;
  if (era === undefined) return;
  const company = world.companies[id] as Company;
  const queue = era.characters.queue;
  const i = queue.findIndex((s) => fits(world, s, company));
  if (i < 0) return;
  const [s] = queue.splice(i, 1) as [EraSpawn];
  const character: BaseCharacter = { ...s.character, age: date.year - s.born_year };
  company.start_control = {
    controller: { kind: "Character", character },
    stake: FOUNDER_STAKE,
    basis: FOUNDER_BASIS,
  };
  era.history.founders.push({ year: date.year, name: character.name, company: id });
  newsWireQueue(world.news, eraHeadline(date, `${character.name} founds ${company.name}`));
}

/** 1 January: who is due joins the queue, in file order (1995-rework 7.7). */
function spawnDue(era: EraState, year: number): void {
  const c = era.characters;
  c.queue.push(...c.pool.filter((s) => s.spawn_year <= year));
  c.pool = c.pool.filter((s) => s.spawn_year > year);
}

/**
 * 1 January, in company id order (1995-rework 7.8): controllers of living companies age and roll for
 * death, and an heir from the HQ country's name book takes the same stake, with a headline.
 */
function ageControllers(world: World, era: EraState, date: SimDate, draws: DrawSource): void {
  const g = pinnedDraws(draws, "Era");
  const named = (): Set<string> => {
    const out = new Set<string>();
    for (const c of world.companies) {
      const r = c.start_control?.controller;
      if (r?.kind === "Character") out.add(r.character.name);
    }
    return out;
  };
  world.companies.forEach((c, id) => {
    const control = c.start_control;
    const r = control?.controller;
    if (r?.kind !== "Character") return;
    const status = companyFinanceStatus(c.finance);
    if (status === "Removed" || status === "Bankrupt") return;
    r.character.age += 1;
    if (!g.chance("Era", deathChance(r.character.age))) return;
    const names = nameBooksGet(world.name_books, c.hq_country);
    if (names === null) throw new Error("every country has a name book (checked at load)");
    const heir = drawBaseFields(g, names, HEIR_AGE, () => HEIR_SKILLS, CEO_TRAITS);
    const taken = named();
    if (taken.has(heir.name)) heir.name = nameBookDrawUnique(names, g, (n) => taken.has(n));
    era.history.successions.push({
      year: date.year,
      company: id as CompanyId,
      from: r.character.name,
      to: heir.name,
    });
    newsWireQueue(
      world.news,
      eraHeadline(date, `${r.character.name} of ${c.name} dies; ${heir.name} inherits the stake`),
    );
    r.character = { class: r.character.class, ...heir };
  });
}

/** 1 January (1995-rework 7.7, 7.8). */
export function eraCharactersYear(world: World, era: EraState, date: SimDate, draws: DrawSource): void {
  spawnDue(era, date.year);
  ageControllers(world, era, date, draws);
}
