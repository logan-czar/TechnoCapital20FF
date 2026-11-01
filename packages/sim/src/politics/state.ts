// The US politics state built from the data, and pure reads of it (D980, D982). No draws: the people
// come at the start of the game (politics/jobs.ts `politicsStart`).

import type { WorldData } from "@tc20ff/sim-data";
import { worldDataAllProvinces } from "@tc20ff/sim-data";
import type { CountryId, ProvinceId } from "../types/ids.ts";
import { cmpStr, totalCmp } from "../types/num.ts";
import type { District, Office, Party, Politician, PoliticsState } from "../types/state/politics.ts";

/** The one country of the POC. */
export const POLITICS_COUNTRY_KEY = "USA";

/**
 * `total` split in proportion to `weights` by largest remainder, ties to the lower index (D982).
 * Every weight is positive.
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((n, w) => n + w, 0);
  const quotas = weights.map((w) => (total * w) / sum);
  const seats = quotas.map((q) => Math.floor(q));
  const left = total - seats.reduce((n, s) => n + s, 0);
  const order = quotas
    .map((q, i) => [q - (seats[i] as number), i] as const)
    .sort((a, b) => totalCmp(b[0], a[0]) || a[1] - b[1]);
  for (let k = 0; k < left; k++) {
    const i = (order[k] as readonly [number, number])[1];
    seats[i] = (seats[i] as number) + 1;
  }
  return seats;
}

/** The static tables from the data, before any draw; null for data without the USA. */
export function politicsStateFromData(
  data: WorldData,
  countryIds: ReadonlyMap<string, CountryId>,
  provinceIds: ReadonlyMap<string, ProvinceId>,
): PoliticsState | null {
  const country = countryIds.get(POLITICS_COUNTRY_KEY);
  if (country === undefined) return null;
  const provinces = worldDataAllProvinces(data)
    .map(([, , p]) => p)
    .filter((p) => p.country === POLITICS_COUNTRY_KEY);
  const states = data.politics_states.rows.map((s) => ({
    name: s.state,
    house_seats: s.house_seats,
    senate_classes: s.senate_classes.map((c) => Number.parseInt(c, 10)),
    lean_pts: s.dem_margin_pts,
    weight: provinces.reduce((n, p) => (p.region === s.state ? n + p.population : n), 0),
  }));
  const posts = data.politics_offices.rows.map((o) => ({
    title: o.title,
    kind: o.kind,
    seats: o.seats,
    skill: o.skill,
  }));
  // D982: a state's districts sit in its provinces, by largest remainder of province population.
  const districts: District[] = [];
  states.forEach((s, si) => {
    if (s.house_seats === 0) return;
    const own = provinces.filter((p) => p.region === s.name).sort((a, b) => cmpStr(a.id, b.id));
    const seats = largestRemainder(
      own.map((p) => p.population),
      s.house_seats,
    );
    let number = 1;
    own.forEach((p, pi) => {
      const province = provinceIds.get(p.id) as ProvinceId;
      for (let k = 0; k < (seats[pi] as number); k++) {
        districts.push({ state: si, number, lean_pts: s.lean_pts, home_province: province });
        number++;
      }
    });
  });
  return {
    country,
    states,
    districts,
    posts,
    politicians: [],
    politicians_made: 0,
    president_terms: 0,
    pending: null,
    elections: [],
  };
}

/** The holders of one kind of office, in id order. */
export function officeHolders(p: PoliticsState, kind: Office["kind"]): Politician[] {
  return p.politicians.filter((c) => c.office.kind === kind);
}

/** Seats by party, Democrats then Republicans. */
export function partySeats(rows: readonly { party: Party }[]): [number, number] {
  let dem = 0;
  for (const r of rows) if (r.party === "Democrats") dem++;
  return [dem, rows.length - dem];
}
