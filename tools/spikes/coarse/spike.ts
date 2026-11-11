// SPIKE, throwaway: measures a 25-year "Coarse" pre-sim of the 1995 world in Node, with and
// without the view refresh, and with a synthetic political load (counties, people, elections).
// Nothing here is game code and none of it is registered in the real job registry: the political
// jobs are added to one Sim through the test hook `simRegisterTestJob`, and their state hangs off
// the world as `spike_pol` so the real save and hash code carries it. See README.md.
//
// Run from apps/headless (tsx is its dev dependency), one process at a time:
//   corepack pnpm@10.20.0 exec tsx ../../tools/spikes/coarse/spike.ts --mode noviews --politics --history --tag pol-hist
//
// Flags: --mode views|noviews (default noviews), --years N (25), --seed S (1), --politics,
// --history (keep every county's votes for every race of every election), --people N (target
// size of the people table at the end, default 10000), --no-measure (the run time only: no save,
// load or hash timing), --tag NAME (out/NAME.json).

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync as zlibGunzip, gzipSync as zlibGzip } from "node:zlib";
import { canonicalRevive, canonicalString } from "../../../packages/sim/src/canonical.ts";
import { hashOfCanonical } from "../../../packages/sim/src/hash.ts";
import {
  dateTimeDate,
  dateTimeMidnight,
  type JobCtx,
  type Notice,
  type Sim,
  simDateYmd,
  simLoadBytes,
  simNew,
  simRegisterTestJob,
  simSpikeRebuildViews,
  simSpikeStepNoViews,
  simWorld,
  type World,
} from "../../../packages/sim/src/internal.ts";
import { type RngStreams, rngStreamsNew, rngStreamsNormal, rngStreamsUniform } from "../../../packages/sim/src/rng.ts";
import { decode } from "../../../packages/sim/src/save.ts";
import { expF, logF } from "../../../packages/sim/src/types/libm.ts";
import { loadWorld, worldDataDir } from "../../../packages/sim-data/src/node.ts";

const here = dirname(fileURLToPath(import.meta.url));
const simRequire = createRequire(join(here, "../../../packages/sim/package.json"));
const fflate = simRequire("fflate") as {
  gzipSync(b: Uint8Array, o?: { level?: number; mtime?: number }): Uint8Array;
  gunzipSync(b: Uint8Array): Uint8Array;
};

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(`--${name}`);
const opt = (name: string, d: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : d;
};
const MODE = opt("mode", "noviews");
const YEARS = Number(opt("years", "25"));
const SEED = Number(opt("seed", "1"));
const POLITICS = flag("politics");
const HISTORY = flag("history");
const PEOPLE_TARGET = Number(opt("people", "10000"));
const TAG = opt("tag", `${MODE}${POLITICS ? "-pol" : ""}${HISTORY ? "-hist" : ""}`);

const ms = (t0: number): number => performance.now() - t0;
/** The median wall time of `n` calls of `f`, ms, and the last result. */
function timed<T>(n: number, f: () => T): [number, T] {
  const ts: number[] = [];
  let r!: T;
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    r = f();
    ts.push(ms(t));
  }
  ts.sort((a, b) => a - b);
  return [ts[Math.floor(ts.length / 2)] as number, r];
}
const r1 = (x: number): number => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- synthetic political state

const N_COUNTIES = 3100;
const N_STATES = 50;
const N_DISTRICTS = 435;
const START_PEOPLE = 2500;
const SKILLS = 6;
const TRAITS = [
  "ambitious", "cautious", "charismatic", "corrupt", "diligent", "dogmatic", "eloquent", "frugal",
  "gregarious", "honest", "idealist", "lazy", "loyal", "paranoid", "populist", "pragmatic",
  "ruthless", "stubborn", "technocrat", "vain",
];
const FIRST = ["James", "Mary", "Robert", "Linda", "Michael", "Barbara", "William", "Susan", "David", "Karen", "Jose", "Nancy", "Wei", "Aisha", "Tyrone", "Priya"];
const LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Nguyen", "Kim", "Okafor", "Cohen", "Kowalski", "Petrov"];

interface County {
  id: number;
  state: number;
  district: number;
  population: number;
  lean: number;
  elasticity: number;
  turnout: number;
}
interface CareerRow {
  office: string;
  unit: number;
  from_year: number;
  to_year: number | null;
  share: number;
}
interface Person {
  id: number;
  name: string;
  born_year: number;
  state: number;
  party: number;
  skills: number[];
  traits: string[];
  status: "bench" | "office" | "retired";
  career: CareerRow[];
}
interface RaceResult {
  kind: string;
  unit: number;
  d: number;
  r: number;
  winner: number;
  loser: number;
}
interface SpikePol {
  rng: RngStreams;
  counties: County[];
  people: Person[];
  house: number[];
  senate: number[];
  governor: number[];
  president: number;
  elections: { year: number; races: RaceResult[] }[];
  /** Only with --history: one row per county per race per election. */
  county_history: { year: number; county: number; kind: string; d: number; r: number }[];
}

const cost = { yearly_ms: 0, yearly_calls: 0, election_ms: 0, election_calls: 0, county_race_evals: 0, draws: 0 };

function normal(p: SpikePol): number {
  cost.draws += 1;
  return rngStreamsNormal(p.rng, "Politics");
}
function uniform(p: SpikePol): number {
  cost.draws += 1;
  return rngStreamsUniform(p.rng, "Politics");
}
function pick(p: SpikePol, n: number): number {
  return Math.min(n - 1, Math.floor(uniform(p) * n));
}

function newPerson(p: SpikePol, year: number, state: number): Person {
  const skills: number[] = [];
  for (let k = 0; k < SKILLS; k++) skills.push(pick(p, 21));
  const traits = [TRAITS[pick(p, 20)] as string, TRAITS[pick(p, 20)] as string, TRAITS[pick(p, 20)] as string];
  const person: Person = {
    id: p.people.length,
    name: `${FIRST[pick(p, 16)]} ${LAST[pick(p, 16)]}`,
    born_year: year - 30 - pick(p, 35),
    state,
    party: pick(p, 2),
    skills,
    traits,
    status: "bench",
    career: [],
  };
  p.people.push(person);
  return person;
}

function seat(p: SpikePol, person: Person, office: string, unit: number, year: number, share: number): void {
  person.status = "office";
  person.career.push({ office, unit, from_year: year, to_year: null, share });
}
function unseat(person: Person, year: number): void {
  const last = person.career[person.career.length - 1];
  if (last !== undefined && last.to_year === null) last.to_year = year;
  person.status = "retired";
}

/** Counties sorted by state then lean, cut into districts of about equal population per state. */
function redistrict(p: SpikePol): void {
  const total = p.counties.reduce((s, c) => s + c.population, 0);
  const order = [...p.counties].sort((a, b) => a.state - b.state || a.lean - b.lean || a.id - b.id);
  const per = total / N_DISTRICTS;
  let acc = 0;
  for (const c of order) {
    c.district = Math.min(N_DISTRICTS - 1, Math.floor(acc / per));
    acc += c.population;
  }
}

function spikeStart(seed: number, year: number): SpikePol {
  const p: SpikePol = {
    rng: rngStreamsNew(seed + 0x5eed),
    counties: [],
    people: [],
    house: [],
    senate: [],
    governor: [],
    president: 0,
    elections: [],
    county_history: [],
  };
  for (let i = 0; i < N_COUNTIES; i++) {
    p.counties.push({
      id: i,
      state: Math.floor((i * N_STATES) / N_COUNTIES),
      district: 0,
      population: Math.floor(expF(9.5 + 1.4 * normal(p))),
      lean: 0.6 * normal(p),
      elasticity: 0.5 + uniform(p),
      turnout: 0.35 + 0.3 * uniform(p),
    });
  }
  redistrict(p);
  for (let d = 0; d < N_DISTRICTS; d++) {
    const person = newPerson(p, year, Math.floor((d * N_STATES) / N_DISTRICTS));
    seat(p, person, "house", d, year, 0.5);
    p.house.push(person.id);
  }
  for (let s = 0; s < 2 * N_STATES; s++) {
    const person = newPerson(p, year, Math.floor(s / 2));
    seat(p, person, "senate", s, year, 0.5);
    p.senate.push(person.id);
  }
  for (let s = 0; s < N_STATES; s++) {
    const person = newPerson(p, year, s);
    seat(p, person, "governor", s, year, 0.5);
    p.governor.push(person.id);
  }
  const pres = newPerson(p, year, 0);
  seat(p, pres, "president", 0, year, 0.5);
  p.president = pres.id;
  while (p.people.length < START_PEOPLE) newPerson(p, year, pick(p, N_STATES));
  return p;
}

/** 1 January: every county drifts, every living person ages a year, the bench grows, and a census year redistricts. */
function yearlyJob(p: SpikePol, year: number, perYear: number): void {
  for (const c of p.counties) {
    c.population = Math.max(100, Math.floor(c.population * expF(0.008 + 0.01 * normal(p))));
    c.lean += 0.02 * normal(p);
    c.turnout = Math.min(0.9, Math.max(0.15, c.turnout + 0.01 * normal(p)));
    c.elasticity = Math.min(2, Math.max(0.2, c.elasticity + 0.01 * normal(p)));
  }
  for (const person of p.people) {
    if (person.status === "retired") continue;
    const k = pick(p, SKILLS);
    person.skills[k] = Math.min(20, Math.max(0, (person.skills[k] as number) + (uniform(p) < 0.5 ? 1 : -1)));
    if (person.status === "bench" && year - person.born_year > 75) person.status = "retired";
  }
  for (let i = 0; i < perYear; i++) newPerson(p, year, pick(p, N_STATES));
  if (year % 10 === 1) redistrict(p);
}

interface Race {
  kind: "house" | "senate" | "governor" | "president";
  unit: number;
  incumbent: number;
  challenger: number;
  /** Quality gap in logit units, the incumbent's side positive when the incumbent is party 0. */
  q: number;
  d: number;
  r: number;
}

function quality(person: Person): number {
  let s = 0;
  for (const x of person.skills) s += x;
  return s / (20 * SKILLS);
}

/** An even-year November: every county is counted for every race it is in. */
function electionJob(p: SpikePol, year: number, history: boolean): void {
  // The bench by state, in id order.
  const bench: number[][] = [];
  for (let s = 0; s < N_STATES; s++) bench.push([]);
  for (const person of p.people) if (person.status === "bench") (bench[person.state] as number[]).push(person.id);
  const challengerOf = (state: number): number => {
    const b = bench[state] as number[];
    if (b.length === 0) return newPerson(p, year, state).id;
    const i = pick(p, b.length);
    const id = b[i] as number;
    b[i] = b[b.length - 1] as number;
    b.pop();
    return id;
  };
  const race = (kind: Race["kind"], unit: number, incumbent: number, state: number): Race => {
    const challenger = challengerOf(state);
    const a = p.people[incumbent] as Person;
    const b = p.people[challenger] as Person;
    const gap = quality(a) - quality(b) + 0.1;
    return { kind, unit, incumbent, challenger, q: a.party === 0 ? gap : -gap, d: 0, r: 0 };
  };
  const cycle = (year / 2) % 3; // which third of the Senate is up
  const house: Race[] = p.house.map((id, d) => race("house", d, id, (p.people[id] as Person).state));
  const senate: (Race | null)[] = [];
  const governor: (Race | null)[] = [];
  for (let s = 0; s < N_STATES; s++) {
    // Seat 2s is in class s % 3, seat 2s+1 in class (s + 1) % 3: 33 or 34 seats a cycle.
    const seatIdx = s % 3 === cycle ? 2 * s : (s + 1) % 3 === cycle ? 2 * s + 1 : -1;
    senate.push(seatIdx < 0 ? null : race("senate", seatIdx, p.senate[seatIdx] as number, s));
    // 36 governors in a midterm year, 12 in a presidential year (2 are left out of both here).
    const govUp = year % 4 === 2 ? s < 36 : s >= 36 && s < 48;
    governor.push(govUp ? race("governor", s, p.governor[s] as number, s) : null);
  }
  const pres = year % 4 === 0 ? race("president", 0, p.president, 0) : null;
  const swing = 0.15 * normal(p);

  const count = (c: County, r: Race): void => {
    cost.county_race_evals += 1;
    const x = c.lean + c.elasticity * (swing + r.q) + 0.05 * normal(p);
    const share = 1 / (1 + expF(-x));
    const votes = c.population * expF(logF(c.turnout) + 0.1 * normal(p));
    const d = votes * share;
    const rr = votes - d;
    r.d += d;
    r.r += rr;
    if (history) p.county_history.push({ year, county: c.id, kind: r.kind, d, r: rr });
  };
  for (const c of p.counties) {
    count(c, house[c.district] as Race);
    const s = senate[c.state];
    if (s != null) count(c, s);
    const g = governor[c.state];
    if (g != null) count(c, g);
    if (pres !== null) count(c, pres);
  }

  const results: RaceResult[] = [];
  const settle = (r: Race | null): number => {
    if (r === null) return -1;
    const total = r.d + r.r;
    const inc = p.people[r.incumbent] as Person;
    const ch = p.people[r.challenger] as Person;
    const incShare = total > 0 ? (inc.party === 0 ? r.d : r.r) / total : 0.5;
    const incWins = incShare >= 0.5;
    const winner = incWins ? inc : ch;
    const loser = incWins ? ch : inc;
    if (incWins) {
      // The loser goes back to the bench; the incumbent's record keeps its open row.
      if (loser.status !== "retired") loser.status = "bench";
    } else {
      unseat(inc, year);
      seat(p, ch, r.kind, r.unit, year, 1 - incShare);
    }
    results.push({ kind: r.kind, unit: r.unit, d: r.d, r: r.r, winner: winner.id, loser: loser.id });
    return winner.id;
  };
  house.forEach((r, d) => {
    p.house[d] = settle(r);
  });
  senate.forEach((r) => {
    if (r !== null) p.senate[r.unit] = settle(r);
  });
  governor.forEach((r, s) => {
    if (r !== null) p.governor[s] = settle(r);
  });
  if (pres !== null) p.president = settle(pres);
  p.elections.push({ year, races: results });
}

function registerPolitics(sim: Sim, startYear: number): void {
  const world = simWorld(sim) as World & { spike_pol?: SpikePol };
  const state = spikeStart(SEED, startYear);
  // --off-world keeps the state out of the world (so out of the save and the hash): it tells the
  // cost of the jobs apart from the cost of hanging one more property on the World object.
  const off = flag("off-world");
  if (!off) world.spike_pol = state;
  const stateOf = (w: World): SpikePol => (off ? state : (w as World & { spike_pol: SpikePol }).spike_pol);
  const perYear = Math.ceil((PEOPLE_TARGET - START_PEOPLE) / YEARS);
  // The jobs read the state off the world they are given, so they still work after a load.
  simRegisterTestJob(sim, "YearlyArchive", "spike.politics_yearly", (w: World, ctx: JobCtx) => {
    const p = stateOf(w);
    const t = performance.now();
    yearlyJob(p, ctx.facts.date.year, perYear);
    cost.yearly_ms += ms(t);
    cost.yearly_calls += 1;
  });
  simRegisterTestJob(sim, "DailyPolitics", "spike.politics_election", (w: World, ctx: JobCtx) => {
    const d = ctx.facts.date;
    if (d.month !== 11 || d.day !== 5 || d.year % 2 !== 0) return;
    const p = stateOf(w);
    const t = performance.now();
    electionJob(p, d.year, HISTORY);
    cost.election_ms += ms(t);
    cost.election_calls += 1;
  });
}

// ---------------------------------------------------------------- measuring a state

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Raw canonical JSON bytes, gzipped bytes (fflate default, as save.ts) and the times, for one value. */
function sizeOf(value: unknown): { raw: number; gz: number; canon_ms: number; gzip_ms: number; hash_ms: number } {
  const [canon_ms, text] = timed(3, () => canonicalString(value));
  const bytes = utf8(text);
  const [gzip_ms, gz] = timed(1, () => fflate.gzipSync(bytes, { mtime: 0 }));
  const [hash_ms] = timed(3, () => hashOfCanonical(value, true));
  return { raw: bytes.length, gz: gz.length, canon_ms: r1(canon_ms), gzip_ms: r1(gzip_ms), hash_ms: r1(hash_ms) };
}

/** Other ways to hold the same political state, to compare size and time (estimates of a real layout). */
function layouts(p: SpikePol): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.counties_objects = sizeOf(p.counties);
  // One plain array per column (canonical JSON refuses typed arrays today).
  const cols = {
    state: p.counties.map((c) => c.state),
    district: p.counties.map((c) => c.district),
    population: p.counties.map((c) => c.population),
    lean: p.counties.map((c) => c.lean),
    elasticity: p.counties.map((c) => c.elasticity),
    turnout: p.counties.map((c) => c.turnout),
  };
  out.counties_columns = sizeOf(cols);
  // Columns with the floats held as whole numbers of 1/10,000.
  const q = (x: number): number => Math.round(x * 10000);
  out.counties_columns_quantized = sizeOf({
    state: cols.state,
    district: cols.district,
    population: cols.population,
    lean: cols.lean.map(q),
    elasticity: cols.elasticity.map(q),
    turnout: cols.turnout.map(q),
  });
  out.people_objects = sizeOf(p.people);
  const retired = p.people.filter((x) => x.status === "retired");
  const live = p.people.filter((x) => x.status !== "retired");
  out.people_counts = { all: p.people.length, retired: retired.length, live: live.length };
  out.people_live_objects = sizeOf(live);
  out.people_retired_objects = sizeOf(retired);
  // A retired person as one flat row: id, name, born, state, party, then the career as numbers.
  const OFFICE = ["house", "senate", "governor", "president"];
  out.people_retired_compact = sizeOf(
    retired.map((x) => [
      x.id,
      x.name,
      x.born_year,
      x.state,
      x.party,
      x.career.flatMap((c) => [OFFICE.indexOf(c.office), c.unit, c.from_year, c.to_year ?? -1, Math.round(c.share * 1000)]),
    ]),
  );
  // Everyone as flat rows with trait ids instead of strings.
  out.people_all_compact = sizeOf(
    p.people.map((x) => [
      x.id,
      x.name,
      x.born_year,
      x.state,
      x.party,
      x.status === "bench" ? 0 : x.status === "office" ? 1 : 2,
      x.skills,
      x.traits.map((t) => TRAITS.indexOf(t)),
      x.career.flatMap((c) => [OFFICE.indexOf(c.office), c.unit, c.from_year, c.to_year ?? -1, Math.round(c.share * 1000)]),
    ]),
  );
  out.elections_race_level = sizeOf(p.elections);
  if (p.county_history.length > 0) {
    out.county_history_rows = p.county_history.length;
    out.county_history_objects = sizeOf(p.county_history);
    out.county_history_columns_whole_votes = sizeOf({
      year: p.county_history.map((h) => h.year),
      county: p.county_history.map((h) => h.county),
      kind: p.county_history.map((h) => OFFICE.indexOf(h.kind)),
      d: p.county_history.map((h) => Math.round(h.d)),
      r: p.county_history.map((h) => Math.round(h.r)),
    });
  }
  return out;
}

function measureState(sim: Sim): Record<string, unknown> {
  const world = simWorld(sim) as World & { spike_pol?: SpikePol };
  const out: Record<string, unknown> = {};

  const [hash_ms, hash] = timed(3, () => sim.stateHash());
  out.hash = hash;
  out.hash_ms = r1(hash_ms);

  const [save_ms, bytes] = timed(3, () => sim.saveBytes());
  out.save_ms = r1(save_ms);
  out.save_gz_bytes = bytes.length;

  // The same steps apart (the world alone: the rng and controls are a few hundred bytes).
  const [canon_ms, text] = timed(3, () => canonicalString(world));
  const raw = utf8(text);
  out.save_raw_json_bytes = raw.length;
  out.save_canonical_string_ms = r1(canon_ms);
  out.save_utf8_encode_ms = r1(timed(3, () => utf8(text))[0]);
  const gz = (name: string, f: () => Uint8Array): void => {
    const [t, b] = timed(1, f);
    out[`gzip_${name}_ms`] = r1(t);
    out[`gzip_${name}_bytes`] = b.length;
  };
  gz("fflate_l6", () => fflate.gzipSync(raw, { mtime: 0 }));
  gz("fflate_l1", () => fflate.gzipSync(raw, { mtime: 0, level: 1 }));
  gz("zlib_l6", () => zlibGzip(raw, { level: 6 }));
  gz("zlib_l1", () => zlibGzip(raw, { level: 1 }));

  const [load_ms, loaded] = timed(3, () => decode(bytes));
  out.load_decode_ms = r1(load_ms);
  if (!loaded.ok) throw new Error("the save did not decode");
  const body = bytes.subarray(8);
  const [gunzip_ms, plain] = timed(3, () => fflate.gunzipSync(body));
  out.load_gunzip_fflate_ms = r1(gunzip_ms);
  out.load_gunzip_zlib_ms = r1(timed(3, () => zlibGunzip(body))[0]);
  const [dec_ms, json] = timed(3, () => new TextDecoder().decode(plain));
  out.load_utf8_decode_ms = r1(dec_ms);
  const [parse_ms, tree] = timed(3, () => JSON.parse(json) as { state: unknown });
  out.load_json_parse_ms = r1(parse_ms);
  out.load_revive_ms = r1(timed(1, () => canonicalRevive(tree.state))[0]);

  out.views_rebuild_ms = r1(timed(3, () => simSpikeRebuildViews(sim))[0]);
  // The whole Load control: decode, swap the state in, rebuild every view.
  const t = performance.now();
  const r = simLoadBytes(sim, bytes);
  out.sim_load_bytes_ms = r1(ms(t));
  if (!r.ok) throw new Error("simLoadBytes failed");
  out.hash_same_after_load = sim.stateHash() === hash;

  // Where the bytes are: each top-level table of the world, raw canonical JSON.
  const parts: [string, number][] = [];
  for (const k of Object.keys(world)) {
    const v = (world as unknown as Record<string, unknown>)[k];
    if (v === undefined) continue;
    parts.push([k, Buffer.byteLength(canonicalString(v))]);
  }
  parts.sort((a, b) => b[1] - a[1]);
  out.world_raw_bytes_by_table = Object.fromEntries(parts.slice(0, 15));
  // The market table is most of the save: its own fields, largest first.
  const market = (world as unknown as { market: Record<string, unknown> }).market;
  const mparts: [string, number][] = [];
  for (const k of Object.keys(market)) {
    if (market[k] !== undefined) mparts.push([k, Buffer.byteLength(canonicalString(market[k]))]);
  }
  mparts.sort((a, b) => b[1] - a[1]);
  out.market_raw_bytes_by_field = Object.fromEntries(mparts.slice(0, 8));

  const p = (simWorld(sim) as World & { spike_pol?: SpikePol }).spike_pol;
  if (p !== undefined) {
    out.spike_pol = sizeOf(p);
    out.spike_pol_layouts = layouts(p);
  }
  return out;
}

// ---------------------------------------------------------------- the run

function main(): void {
  const t0 = performance.now();
  const data = loadWorld(worldDataDir("1995"));
  if (!data.ok) throw new Error("the 1995 world did not load");
  const load_data_ms = ms(t0);
  const t1 = performance.now();
  const made = simNew(structuredClone(data.value), SEED);
  if (!made.ok) throw new Error("simNew failed");
  const sim = made.value;
  const sim_new_ms = ms(t1);
  const startYear = dateTimeDate(sim.now()).year;
  if (POLITICS) registerPolitics(sim, startYear);
  const end = dateTimeMidnight(simDateYmd(startYear + YEARS, 1, 1));

  const scratch: Notice[] = [];
  let ticks = 0;
  let nextMark = dateTimeMidnight(simDateYmd(startYear + 5, 1, 1));
  const marks: Record<string, number> = {};
  const t2 = performance.now();
  while (sim.now() < end) {
    ticks += 1;
    if (MODE === "views") sim.step();
    else simSpikeStepNoViews(sim, scratch);
    if (sim.now() >= nextMark) {
      const y = dateTimeDate(sim.now()).year;
      marks[`to_${y}_s`] = r1(ms(t2) / 100) / 10;
      nextMark = dateTimeMidnight(simDateYmd(y + 5, 1, 1));
    }
  }
  const run_ms = ms(t2);
  const mem = process.memoryUsage();
  const result: Record<string, unknown> = {
    tag: TAG,
    mode: MODE,
    politics: POLITICS,
    history: HISTORY,
    seed: SEED,
    years: YEARS,
    node: process.version,
    load_data_ms: r1(load_data_ms),
    sim_new_ms: r1(sim_new_ms),
    ticks,
    run_s: r1(run_ms / 100) / 10,
    us_per_tick: r1((run_ms * 1000) / ticks),
    marks,
    rss_mb_after_run: Math.round(mem.rss / 2 ** 20),
    heap_used_mb_after_run: Math.round(mem.heapUsed / 2 ** 20),
  };
  if (POLITICS) {
    const p = (simWorld(sim) as World & { spike_pol?: SpikePol }).spike_pol;
    result.politics_cost = {
      yearly_ms_total: r1(cost.yearly_ms),
      yearly_calls: cost.yearly_calls,
      election_ms_total: r1(cost.election_ms),
      election_calls: cost.election_calls,
      county_race_evals: cost.county_race_evals,
      draws: cost.draws,
      people: p?.people.length ?? null,
      county_history_rows: p?.county_history.length ?? null,
    };
  }
  if (!flag("no-measure")) Object.assign(result, measureState(sim));
  result.rss_mb_peak_end = Math.round(process.memoryUsage().rss / 2 ** 20);
  mkdirSync(join(here, "out"), { recursive: true });
  writeFileSync(join(here, "out", `${TAG}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main();
