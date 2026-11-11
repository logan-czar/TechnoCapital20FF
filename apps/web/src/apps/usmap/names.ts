// Names and lookups the map's panes share (D1048): a district's title, a state's row, the people's
// party. Pure.

import {
  districtRefParts,
  type Party,
  type PeopleView,
  type PersonRow,
  type UsMapLayersView,
  type UsMapState,
} from "@tc20ff/sim";

export function stateRow(layers: UsMapLayersView | undefined, id: number): UsMapState | undefined {
  return layers?.states.find((s) => s.id === id);
}

/** "Iowa 3", or "Wyoming at large" for a state with one seat. */
export function districtTitle(layers: UsMapLayersView | undefined, refId: number): string {
  const { state, number } = districtRefParts(refId);
  const st = stateRow(layers, state);
  const name = st?.name ?? `State ${state}`;
  return st?.house_seats === 1 ? `${name} at large` : `${name} ${number}`;
}

/** People by id. */
export function peopleById(people: PeopleView | undefined): Map<number, PersonRow> {
  const out = new Map<number, PersonRow>();
  for (const p of people?.people ?? []) out.set(p.id, p);
  return out;
}

/** A person's party, undefined when the person is not known. */
export function partyOf(people: Map<number, PersonRow>, id: number | null): Party | null | undefined {
  if (id === null) return undefined;
  const p = people.get(id);
  return p === undefined ? undefined : p.party;
}

/** The counties of a state, in county order. */
export function countiesOfState(layers: UsMapLayersView, state: number): number[] {
  const out: number[] = [];
  layers.counties.state.forEach((s, i) => {
    if (s === state) out.push(i);
  });
  return out;
}
