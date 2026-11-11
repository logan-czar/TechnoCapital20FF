// Careers (pivot 5.7 to 5.12; D1037): benches, on-demand challengers, executive crossovers, XP and
// levels, retirement, death and exit, the offices including Governor and the Fed chair. Owned by
// lane C from the M2 contracts change on. Every draw comes from the Politics stream
// (`politicsDraws`), so careers never move a stream the economy reads.
//
// The contracts change wrote the seams only: `registerCareerJobs` (jobs.ts calls it, in the
// `DailyCareers` slot), `personsStart` (lib.ts `START_DEPS` calls it after the POC's start) and
// `challengerFor` (lane E calls it when a race lacks a candidate). Their signatures are contracts.

import { nameBooksGet } from "../people/names.ts";
import { rangeDraw } from "../people/simple.ts";
import { dateTimeDate } from "../time/calendar.ts";
import type { Scheduler } from "../time/scheduler.ts";
import type { DrawSource } from "../types/draws.ts";
import type { UsStateId } from "../types/ids.ts";
import type { Person, PersonOrigin } from "../types/state/persons.ts";
import type { Party } from "../types/state/politics.ts";
import type { World } from "../types/world.ts";
import { drawPerson, JUDGE_INTEGRITY, type OfficeRanges, PARTY_BLOCS, politicsDraws } from "./generate.ts";
import { personAdd } from "./people.ts";

/**
 * Lane C's jobs (pivot 3.3: careers, XP and deaths run at both fidelities, so no tag). Registered in
 * the `DailyCareers` slot by jobs.ts; empty until lane C adds them here.
 */
export function registerCareerJobs(_s: Scheduler): void {}

/**
 * The persons and offices at a world's start (pivot 5.7, 5.8), after the POC's `politicsStart`:
 * nothing until lane C seats the start's office holders as persons. Politics stream only.
 */
export function personsStart(_world: World, _draws: DrawSource): void {}

/** What a race needs a candidate for (lane E's request). */
export interface ChallengerRequest {
  state: UsStateId;
  /** Null for an independent. */
  party: Party | null;
  /** The generation ranges of the office sought (politics/generate.ts). */
  ranges: OfficeRanges;
  origin: PersonOrigin;
}

/**
 * A new person to run where a race lacks a candidate (pivot 5.9 item 2): drawn on the Politics
 * stream, put on no bench, status `Candidate`, and added to `World.persons`. Lane C owns how they
 * are drawn; the signature is lane E's contract.
 */
export function challengerFor(world: World, draws: DrawSource, req: ChallengerRequest): Person {
  const g = politicsDraws(draws);
  const book = nameBooksGet(world.name_books, world.politics.country);
  if (book === null) throw new Error("no name book for the USA");
  const party = req.party ?? "Democrats";
  const d = drawPerson(g, { names: book, blocs: PARTY_BLOCS, taken: null }, req.ranges, "persuasion", party);
  const year = dateTimeDate(world.clock).year;
  const integrity = rangeDraw(JUDGE_INTEGRITY, g);
  return personAdd(world.persons, (id) => ({
    id,
    name: d.name,
    born: year - d.age,
    skills: d.skills,
    traits: d.traits,
    integrity,
    ideology: d.ideology,
    party: req.party,
    home_state: req.state,
    status: "Candidate",
    origin: req.origin,
    company: null,
    xp: 0,
    level: 0,
    career: [],
    left: null,
  }));
}
