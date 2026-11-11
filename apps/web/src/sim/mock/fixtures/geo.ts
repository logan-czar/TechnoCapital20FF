// The mock's places (v_districts, v_usmap_layers; pivot 5.1 to 5.6): twelve real states with their
// real House seats (30 in all), a small invented county set for each, and a House plan of whole
// counties and shares of the big ones (pivot 5.4, D1028).
//
// The counties are invented: lane S1's real counties.csv was not in the tree when this was written.
// Everything is keyed by county index (`CountyId`, a place in FIPS order), so the real table can
// replace `genCounties` without touching the rest. The FIPS codes are well formed (state prefix,
// odd county codes) and the names are made up.

import {
  type CountyId,
  type CountyShare,
  type DistrictsView,
  districtRefId,
  type Party,
  type PersonId,
  type SimDate,
  type UsMapLayersView,
  type UsStateId,
} from "@tc20ff/sim";
import type { MockWorld } from "../mockWorld.ts";
import type { MockRng } from "./rng.ts";
import { ymd } from "./script.ts";

/** How a state counts (pivot 9.2): which votes it reports first. */
export type CountRule = "DayFirst" | "MailFirst";

/** name, postal code, FIPS prefix, House seats, lean in points toward party A, poll-closing hour, counting rule. */
const STATE_TABLE: readonly (readonly [string, string, string, number, number, number, CountRule])[] = [
  ["Arkansas", "AR", "05", 4, -22, 20, "DayFirst"],
  ["Delaware", "DE", "10", 1, 15, 20, "MailFirst"],
  ["Iowa", "IA", "19", 4, -1, 21, "DayFirst"],
  ["Kansas", "KS", "20", 4, -13, 21, "DayFirst"],
  ["Maine", "ME", "23", 2, 4, 20, "MailFirst"],
  ["Montana", "MT", "30", 1, -11, 22, "MailFirst"],
  ["Nebraska", "NE", "31", 3, -17, 21, "DayFirst"],
  ["Nevada", "NV", "32", 4, 1.5, 22, "MailFirst"],
  ["New Hampshire", "NH", "33", 2, 2.5, 19, "DayFirst"],
  ["New Mexico", "NM", "35", 3, 8, 21, "DayFirst"],
  ["Vermont", "VT", "50", 1, 26, 19, "DayFirst"],
  ["Wyoming", "WY", "56", 1, -38, 21, "DayFirst"],
];

// biome-ignore format: a name list reads better packed
const COUNTY_NAMES = [
  "Alder", "Ashby", "Barlow", "Birch", "Calder", "Cedar", "Corliss", "Dunmore", "Eastman", "Elkhorn",
  "Fairlight", "Garnet", "Granger", "Hale", "Harlan", "Ironwood", "Juniper", "Kestrel", "Lakota", "Larkin",
  "Marlowe", "Merritt", "Norwood", "Oakhurst", "Pell", "Prairie", "Quill", "Redfern", "Rowan", "Sable",
  "Sawyer", "Tamarack", "Thorne", "Union", "Vance", "Wexford", "Whitlock", "Yarrow", "Bexley", "Coldwater",
  "Drummond", "Fenwick", "Gilead", "Hollis", "Kirkwood", "Linden",
];

/** People per House seat in a state with more than one (about the 2010 figure). */
const DISTRICT_POP = 760_000;
/** Counties a state has: a base and some per seat. */
const COUNTIES_BASE = 6;
const COUNTIES_PER_SEAT = 3;
/** How much bluer than its state the biggest county runs, in points (pivot 5.1). */
const URBAN_LEAN = 22;
/** The census the mock's plans were drawn on, and when they took effect (pivot 5.3, 5.5). */
const PLAN_CENSUS = 2010;
const PLAN_SINCE: SimDate = { year: 2012, month: 1, day: 3 };

export interface MockState {
  /** Its place in `MockGeo.states`. */
  idx: number;
  id: UsStateId;
  name: string;
  abbr: string;
  fips: string;
  seats: number;
  electoral_votes: number;
  /** Points toward party A (pivot 5.1). Hidden truth. */
  lean: number;
  /** The hour its polls close on election day (one clock for the whole mock nation). */
  close_hour: number;
  count_rule: CountRule;
  population: number;
  /** Its counties, a run of ids. */
  counties: CountyId[];
  /** Set by the people fixture. */
  governor: Party;
  /** The party that drew its plan; null for a single-seat state. */
  drawn_by: Party | null;
  /** The plan's gerrymander strength (pivot 5.5). Hidden. */
  plan_strength: number;
  certify: SimDate;
}

export interface MockCounty {
  id: CountyId;
  fips: string;
  /** `MockState.idx`. */
  state: number;
  name: string;
  population: number;
  lean: number;
  spread: number;
  turnout: number;
}

export interface MockDistrict {
  /** Its place in `MockGeo.districts` (state order, then number). */
  idx: number;
  state: number;
  number: number;
  shares: CountyShare[];
  population: number;
  lean: number;
}

export interface MockGeo {
  states: MockState[];
  counties: MockCounty[];
  districts: MockDistrict[];
  /** Per county: the district number holding its largest share. */
  county_district: number[];
}

const pad3 = (n: number) => String(n).padStart(3, "0");

function shuffle<T>(items: T[], rng: MockRng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const t = items[i] as T;
    items[i] = items[j] as T;
    items[j] = t;
  }
  return items;
}

/** The mean lean of an interval of a county's people (pivot 5.4, D1028). */
export function shareLean(c: MockCounty, s: CountyShare): number {
  return c.lean + c.spread * (1 - s.from - s.to);
}

/** The invented county table. Replace this with the real counties when they exist. */
function genCounties(states: MockState[], rng: MockRng): MockCounty[] {
  const out: MockCounty[] = [];
  for (const st of states) {
    const n = COUNTIES_BASE + COUNTIES_PER_SEAT * st.seats;
    const weights: number[] = [];
    for (let i = 0; i < n; i++) weights.push(rng.range(0.8, 1.2) / (i + 1) ** 1.15);
    shuffle(weights, rng);
    const total = weights.reduce((a, b) => a + b, 0);
    const top = Math.max(...weights);
    const names = shuffle(COUNTY_NAMES.slice(), rng);
    const made: MockCounty[] = weights.map((w, k) => {
      const urban = w / top;
      return {
        id: (out.length + k) as CountyId,
        fips: st.fips + pad3(2 * k + 1),
        state: st.idx,
        name: `${names[k]} County`,
        population: Math.max(900, Math.floor((w / total) * st.population)),
        lean: st.lean + URBAN_LEAN * urban + 4 * rng.normal(),
        spread: 2 + 12 * urban,
        turnout: rng.range(0.4, 0.5),
      };
    });
    // Re-centre so the state's people lean as the state does.
    const pop = made.reduce((a, c) => a + c.population, 0);
    const mean = made.reduce((a, c) => a + c.lean * c.population, 0) / pop;
    for (const c of made) c.lean += st.lean - mean;
    st.population = pop;
    st.counties = made.map((c) => c.id);
    out.push(...made);
  }
  return out;
}

/** One state's plan (pivot 5.4): a sweep in county order, splitting a county that overflows a district. */
function drawState(st: MockState, counties: MockCounty[], first: number): MockDistrict[] {
  const target = st.population / st.seats;
  const made: MockDistrict[] = [];
  let shares: CountyShare[] = [];
  let room = target;
  const close = () => {
    let pop = 0;
    let lean = 0;
    for (const s of shares) {
      const c = counties[s.county] as MockCounty;
      const p = (s.to - s.from) * c.population;
      pop += p;
      lean += p * shareLean(c, s);
    }
    made.push({
      idx: first + made.length,
      state: st.idx,
      number: made.length + 1,
      shares,
      population: Math.floor(pop + 0.5),
      lean: lean / pop,
    });
    shares = [];
    room = target;
  };
  for (const id of st.counties) {
    const c = counties[id] as MockCounty;
    let from = 0;
    while (from < 1) {
      const last = made.length === st.seats - 1;
      const left = (1 - from) * c.population;
      if (last || left <= room * 1.0000001) {
        shares.push({ county: id, from, to: 1 });
        room -= left;
        from = 1;
      } else {
        const to = from + room / c.population;
        shares.push({ county: id, from, to });
        from = to;
        room = 0;
      }
      if (!last && room <= target * 1e-7) close();
    }
  }
  close();
  return made;
}

export function genGeo(base: MockWorld, rng: MockRng): MockGeo {
  const rows = base.data.politics_states.rows;
  const found = STATE_TABLE.map(([name]) => rows.findIndex((r) => r.state === name));
  const real = found.every((i) => i >= 0);
  const states: MockState[] = STATE_TABLE.map(
    ([name, abbr, fips, seats, lean, close_hour, count_rule], idx) => ({
      idx,
      id: (real ? found[idx] : idx) as UsStateId,
      name,
      abbr,
      fips,
      seats,
      electoral_votes: seats + 2,
      lean: lean + 1.5 * rng.normal(),
      close_hour,
      count_rule,
      population: Math.floor(
        seats > 1 ? seats * DISTRICT_POP * rng.range(0.97, 1.03) : rng.range(580_000, 1_050_000),
      ),
      counties: [],
      governor: "Democrats",
      drawn_by: seats > 1 ? (rng.chance(lean > 0 ? 0.7 : 0.3) ? "Democrats" : "Republicans") : null,
      plan_strength: seats > 1 ? rng.range(0.1, 0.8) : 0,
      certify: ymd(11, 9),
    }),
  );
  const counties = genCounties(states, rng);
  const districts: MockDistrict[] = [];
  for (const st of states) districts.push(...drawState(st, counties, districts.length));
  const county_district = counties.map((c) => {
    let best = 0;
    let size = -1;
    for (const d of districts) {
      if (d.state !== c.state) continue;
      for (const s of d.shares) {
        if (s.county === c.id && s.to - s.from > size) {
          size = s.to - s.from;
          best = d.number;
        }
      }
    }
    return best;
  });
  return { states, counties, districts, county_district };
}

/** v_districts. `members` is by `MockDistrict.idx`. */
export function districtsView(
  geo: MockGeo,
  members: (PersonId | null)[],
  omniscient: boolean,
): DistrictsView {
  return {
    plans: geo.states.map((st) => ({
      state: st.id,
      census_year: PLAN_CENSUS,
      since: PLAN_SINCE,
      drawn_by: st.drawn_by,
      struck: false,
      strength: omniscient ? st.plan_strength : null,
    })),
    districts: geo.districts.map((d) => ({
      id: districtRefId((geo.states[d.state] as MockState).id, d.number),
      state: (geo.states[d.state] as MockState).id,
      number: d.number,
      shares: d.shares,
      population: d.population,
      member: members[d.idx] ?? null,
      lean: omniscient ? d.lean : null,
    })),
  };
}

/** A county's last certified presidential result: who carried it and by how much. */
export interface CountyResult {
  winner: Party;
  /** Points toward party A. */
  margin: number;
  /** Votes cast. Whole number. */
  votes: number;
}

/** v_usmap_layers. `last` is by county id; null before a certified presidential vote. */
export function usMapLayersView(
  geo: MockGeo,
  last: (CountyResult | null)[],
  omniscient: boolean,
): UsMapLayersView {
  const cs = geo.counties;
  return {
    counties: {
      fips: cs.map((c) => c.fips),
      state: cs.map((c) => (geo.states[c.state] as MockState).id),
      name: cs.map((c) => c.name),
      population: cs.map((c) => c.population),
      district: geo.county_district,
      turnout: cs.map((c) => c.turnout),
      last_votes: cs.map((c) => last[c.id]?.votes ?? 0),
      last_winner: cs.map((c) => last[c.id]?.winner ?? null),
      last_margin: cs.map((c) => last[c.id]?.margin ?? null),
      lean: omniscient ? cs.map((c) => c.lean) : null,
    },
    states: geo.states.map((st, si) => {
      // The state's last result from its counties' (D1037): margins weighted by votes cast.
      let votes = 0;
      let lead = 0;
      for (const c of cs) {
        const r = last[c.id];
        if (c.state !== si || r === null || r === undefined) continue;
        votes += r.votes;
        lead += r.margin * r.votes;
      }
      const margin = votes > 0 ? Math.floor((lead / votes) * 10 + 0.5) / 10 : null;
      return {
        id: st.id,
        name: st.name,
        population: st.population,
        house_seats: st.seats,
        electoral_votes: st.electoral_votes,
        governor: st.governor,
        last_winner: margin === null ? null : margin >= 0 ? "Democrats" : "Republicans",
        last_margin: margin,
      };
    }),
  };
}
