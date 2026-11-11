// Port of crates/sim/tests/m10_save_load.rs: M10.4 (build-plan 4.3 "Save at a random tick, load,
// continue: same hashes"; D404): a game is saved at ticks chosen by its seed, each save is loaded
// into another game, and play goes on from the loaded state; every monthly state hash, and the
// world at the end, must match an unbroken run of the same seed.
//
// The cuts cover the moments with the most state in flight: a seed-chosen tick at random, the
// plan lock tick itself and a tick mid-way through the locked quarter, a tick mid-way through a
// reaction week (5.15, 21.3.1), and the ticks right after a birth, a listing and a bankruptcy.
// Each category's tick is one of that category's events in the run, picked by the seed.
//
// The short check (2 years, one seed) always runs. The full check (30 years on two seeds, a few
// minutes) runs only with TC20FF_LONG=1 (Rust: #[ignore], cargo test --release -- --ignored).
//
// Expects:
//   ../src/lib.ts   simNew, simStep, simNow, simWorld, simStateHash, simSaveBytes(sim) ->
//                      Uint8Array, simLoadBytes(sim, bytes) -> Result<Notice[], SimError>
//   "@tc20ff/sim-data" type WorldData
//   ./common/index.ts  data, unwrap, numbersDiffer
//
// Changed from the Rust: none in the assertions. The picker is the test's own splitmix64 over
// BigInt (u64 wrapping), kept as is. The seeds now seed the new generator (D951), so which events
// the cuts land on differs from Rust; the "need" categories (lock, mid_lock, mid_reaction, birth,
// listing in the 2-year run) are events the run has whatever the draws, as in Rust. Sim.world()
// equality is numbersDiffer (Rust == on f64) instead of toEqual.
import type { WorldData } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import {
  type Sim,
  simLoadBytes,
  simNew,
  simNow,
  simSaveBytes,
  simStateHash,
  simStep,
  simWorld,
} from "../src/lib.ts";
import { dateTimeHours, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import type { StateHash } from "../src/types/sim-api.ts";
import { data, macrotask, numbersDiffer, unwrap } from "./common/index.ts";

/** Random cuts per run, besides one of each event category. */
const RANDOM_CUTS = 3;
/** Hours into the locked quarter for the mid-lock cut (about 3 weeks after the 9th, 00:00). */
const MID_LOCK_HOURS = 24 * 21 + 5;
/** Hours after the release tick (the 2nd, 00:00) for the mid-reaction-week cut: the 5th, 13:00. */
const MID_REACTION_HOURS = 24 * 3 + 13;
/** Salt for the cut picker's splitmix64 (the test's own numbers, not a sim stream). */
const CUT_SALT = 0x4d31_3034_4355_5453n;
const U64 = (1n << 64n) - 1n;

/** splitmix64. */
class Picker {
  constructor(private state: bigint) {}

  next(): bigint {
    this.state = (this.state + 0x9e37_79b9_7f4a_7c15n) & U64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & U64;
    z = ((z ^ (z >> 27n)) * 0x94d0_49bb_1331_11ebn) & U64;
    return z ^ (z >> 31n);
  }

  pick(from: readonly number[]): number | null {
    if (from.length === 0) return null;
    return from[Number(this.next() % BigInt(from.length))] as number;
  }
}

/** The ticks (hours since the start) where each kind of event happened in a run. */
interface Events {
  locks: number[];
  mid_locks: number[];
  mid_reactions: number[];
  births: number[];
  listings: number[];
  bankruptcies: number[];
}

function bankruptCount(sim: Sim): number {
  return simWorld(sim).companies.filter((c) => c.finance.distress.status === "Bankrupt").length;
}

/** Removes duplicates in a sorted run (Rust Vec::dedup keeps the first of equal neighbours). */
function dedup(v: number[]): number[] {
  return v.filter((x, i) => i === 0 || v[i - 1] !== x);
}

/** An unbroken run: the hash after every month close, the events seen, and the final game. */
async function straight(
  d: WorldData,
  seed: number,
  end: number,
): Promise<{ hashes: StateHash[]; ev: Events; sim: Sim }> {
  const sim = unwrap(simNew(structuredClone(d), seed), "Sim::new");
  const hashes: StateHash[] = [];
  const ev: Events = {
    locks: [],
    mid_locks: [],
    mid_reactions: [],
    births: [],
    listings: [],
    bankruptcies: [],
  };
  let bankrupt = bankruptCount(sim);
  while (dateTimeHours(simNow(sim)) < end) {
    const notices = simStep(sim);
    const t = dateTimeHours(simNow(sim));
    for (const n of notices) {
      switch (n.kind) {
        case "MonthDone": {
          hashes.push(simStateHash(sim));
          await macrotask();
          const now = bankruptCount(sim);
          if (now > bankrupt) ev.bankruptcies.push(t);
          bankrupt = now;
          break;
        }
        case "PlanLocked":
          ev.locks.push(t);
          ev.mid_locks.push(t + MID_LOCK_HOURS);
          break;
        case "EarningsReleased":
          ev.mid_reactions.push(t + MID_REACTION_HOURS);
          break;
        case "CompanyBorn":
          ev.births.push(t);
          break;
        case "CompanyListed":
          ev.listings.push(t);
          break;
        default:
          break;
      }
    }
  }
  for (const k of Object.keys(ev) as (keyof Events)[]) {
    ev[k] = dedup(ev[k].filter((t) => t < end));
  }
  return { hashes, ev, sim };
}

/** The seed's cuts: one tick of each event category and RANDOM_CUTS random ticks, sorted. */
function cuts(seed: number, ev: Events, end: number, need: readonly string[]): number[] {
  const p = new Picker(BigInt(seed) ^ CUT_SALT);
  const out: number[] = [];
  const cats: [string, number[]][] = [
    ["lock", ev.locks],
    ["mid_lock", ev.mid_locks],
    ["mid_reaction", ev.mid_reactions],
    ["birth", ev.births],
    ["listing", ev.listings],
    ["bankruptcy", ev.bankruptcies],
  ];
  for (const [name, from] of cats) {
    const t = p.pick(from);
    if (t !== null) out.push(t);
    else expect(need.includes(name), `seed ${seed}: no ${name} in the run`).toBe(false);
  }
  for (let i = 0; i < RANDOM_CUTS; i++) {
    out.push(1 + Number(p.next() % BigInt(end - 1)));
  }
  out.sort((a, b) => a - b);
  return dedup(out);
}

/** Plays `seed` to `end`, saving at each cut and going on in a new game loaded from the save. */
async function broken(
  d: WorldData,
  seed: number,
  end: number,
  cutTicks: readonly number[],
): Promise<{ hashes: StateHash[]; sim: Sim }> {
  let sim = unwrap(simNew(structuredClone(d), seed), "Sim::new");
  const hashes: StateHash[] = [];
  let next = 0;
  while (dateTimeHours(simNow(sim)) < end) {
    if (next < cutTicks.length && cutTicks[next] === dateTimeHours(simNow(sim))) {
      next += 1;
      const before = simStateHash(sim);
      const bytes = simSaveBytes(sim);
      // Another seed and clock, so the load has to replace everything.
      const loaded = unwrap(simNew(structuredClone(d), seed + 1), "Sim::new");
      simStep(loaded);
      unwrap(simLoadBytes(loaded, bytes), "load_bytes");
      expect(simStateHash(loaded), `seed ${seed} cut ${simNow(sim)}`).toBe(before);
      expect(numbersDiffer(simWorld(loaded), simWorld(sim)), `seed ${seed} cut ${simNow(sim)}`).toBeNull();
      sim = loaded;
    }
    if (simStep(sim).some((n) => n.kind === "MonthDone")) {
      hashes.push(simStateHash(sim));
      await macrotask();
    }
  }
  expect(next, "every cut was made").toBe(cutTicks.length);
  return { hashes, sim };
}

function hoursTo(year: number): number {
  return dateTimeHours(dateTimeMidnight(simDateYmd(year, 1, 1)));
}

async function check(seed: number, endYear: number, need: readonly string[]): Promise<void> {
  const d = data();
  const end = hoursTo(endYear);
  const want = await straight(d, seed, end);
  const cutTicks = cuts(seed, want.ev, end, need);
  expect(cutTicks.length >= RANDOM_CUTS + need.length - 1, `${cutTicks}`).toBe(true);
  const got = await broken(d, seed, end, cutTicks);
  expect(got.hashes.length).toBe(want.hashes.length);
  got.hashes.forEach((g, i) => {
    expect(g, `seed ${seed}: month ${i + 1} of the run differs`).toBe(want.hashes[i]);
  });
  expect(simStateHash(got.sim)).toBe(simStateHash(want.sim));
  expect(numbersDiffer(simWorld(got.sim), simWorld(want.sim))).toBeNull();
}

describe("m10 save and load", () => {
  it("save_load_mid_run_matches_an_unbroken_run", async () => {
    // Two years: plan locks, reaction weeks, births and listings happen; a bankruptcy may not.
    await check(3, 2022, ["lock", "mid_lock", "mid_reaction", "birth", "listing"]);
  }, 600_000);

  // Rust #[ignore]: 30 years on two seeds, a few minutes in release.
  it.skipIf(!process.env.TC20FF_LONG)(
    "save_load_mid_run_matches_an_unbroken_run_30_years",
    async () => {
      for (const seed of [1, 2]) {
        await check(seed, 2050, ["lock", "mid_lock", "mid_reaction", "birth", "listing", "bankruptcy"]);
      }
    },
    3_600_000,
  );
});
