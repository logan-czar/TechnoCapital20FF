// `bake` (pivot 3.5): its arguments, the start index it keeps, and one small bake end to end (a
// two-month pre-simulation of the 1995 world).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  presimAdvance,
  presimSim,
  presimStart,
  SAVE_VERSION,
  simDateYmd,
  simHydrate,
  simNew,
  simStateHash,
} from "@tc20ff/sim/internal";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { userPath } from "../src/args.ts";
import {
  bakeCommand,
  bakeStart,
  INDEX_FILE,
  INDEX_VERSION,
  indexWith,
  parseBake,
  readIndex,
  SCENARIO_HIDDEN,
  type StartEntry,
  type StartIndex,
} from "../src/bake.ts";
import { main } from "../src/cli.ts";

const entry = (id: string, seed: number): StartEntry => ({
  id,
  label: `Seed ${seed}`,
  seed,
  save_version: 6,
  hash: "00",
  scenario: "hidden",
  date: "2020-01-01",
  file: `${id}.tcsave`,
  bytes: 1,
});

describe("bake", () => {
  it("needs a seed and a folder", () => {
    expect(parseBake(["--seed", "7", "--out", "starts"])).toEqual({
      seed: 7,
      scenario: undefined,
      out: userPath("starts"),
      name: null,
      label: null,
      dir: worldDataDir("1995"),
    });
    expect(
      parseBake([
        "--seed",
        "7",
        "--out",
        "s",
        "--scenario",
        "stable",
        "--name",
        "calm",
        "--label",
        "A calm one",
      ]),
    ).toMatchObject({ scenario: "stable", name: "calm", label: "A calm one" });
    expect(parseBake(["--seed", "7"])).toBeNull();
    expect(parseBake(["--out", "s"])).toBeNull();
    expect(parseBake(["--seed", "x", "--out", "s"])).toBeNull();
    expect(parseBake(["--seed", "7", "--out", "s", "--name", "../up"])).toBeNull();
    expect(parseBake(["--seed", "7", "--out", "s", "--bogus", "1"])).toBeNull();
    expect(parseBake(["--seed", "7", "--out"])).toBeNull();
  });

  it("keeps the index in id order, one entry per id", () => {
    let index: StartIndex = { version: INDEX_VERSION, starts: [] };
    index = indexWith(index, entry("seed-2", 2));
    index = indexWith(index, entry("seed-1", 1));
    index = indexWith(index, { ...entry("seed-2", 2), hash: "ff" });
    expect(index.starts.map((s) => [s.id, s.hash])).toEqual([
      ["seed-1", "00"],
      ["seed-2", "ff"],
    ]);
  });

  it("an absent index is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "tc20ff-bake-"));
    try {
      expect(readIndex(dir)).toEqual({ version: INDEX_VERSION, starts: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an unknown scenario or bad arguments fail", async () => {
    expect(await main(["bake", "--seed", "1"])).toBe(2);
    const dir = mkdtempSync(join(tmpdir(), "tc20ff-bake-"));
    try {
      expect(await main(["bake", "--seed", "1", "--out", dir, "--scenario", "nope"])).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bakes what the stepper and the hydration give", async () => {
    const loaded = loadWorld(worldDataDir("1995"));
    if (!loaded.ok) throw new Error("the 1995 data did not load");
    // The stepper's own run, cut short of 2020: two months.
    const until = simDateYmd(1995, 3, 1);
    const started = presimStart(structuredClone(loaded.value), 9, { until });
    if (!started.ok) throw new Error("did not start");
    while (presimAdvance(started.value, 5000).kind === "Progress");
    const sim = presimSim(started.value);
    if (sim === null) throw new Error("not done");
    simHydrate(sim);

    // The bake of the same world with its reveal date moved there.
    const data = structuredClone(loaded.value);
    data.manifest.reveal_date = until;
    const seen: number[] = [];
    const baked = await bakeStart(data, 9, undefined, (p) => void seen.push(p.done), 500);
    if (baked === null) throw new Error("cancelled");
    expect(seen).toEqual([500, 1000]);
    expect(baked.ticks).toBe(59 * 24);
    expect(baked.hydrate.date).toEqual(until);
    expect(baked.bytes.length).toBeGreaterThan(1000);
    // Neither run reached a 1 January, so hydration ended both on the same day: one state.
    expect(baked.hydrate.ended_here).toBe(true);
    expect(baked.hash).toBe(simStateHash(sim));
    // A bake repeats exactly whatever the chunk size, and can be cancelled.
    const again = await bakeStart(structuredClone(data), 9, undefined, undefined, 77);
    expect(again?.hash).toBe(baked.hash);
    expect(await bakeStart(structuredClone(data), 9, undefined, () => false, 500)).toBeNull();
  }, 120_000);

  it("writes the save and the index, and bakes the same entry twice", async () => {
    const loaded = loadWorld(worldDataDir("1995"));
    if (!loaded.ok) throw new Error("the 1995 data did not load");
    const data = loaded.value;
    data.manifest.reveal_date = simDateYmd(1995, 2, 1);
    const dir = mkdtempSync(join(tmpdir(), "tc20ff-bake-"));
    const args = { seed: 4, scenario: undefined, out: dir, name: null, label: null, dir: "" };
    try {
      await bakeCommand(structuredClone(data), args);
      await bakeCommand(structuredClone(data), {
        ...args,
        seed: 3,
        scenario: "stable",
        name: "calm",
        label: "Calm",
      });
      const first = readFileSync(join(dir, INDEX_FILE), "utf8");
      const index = readIndex(dir);
      expect(index.starts.map((s) => [s.id, s.label, s.seed, s.scenario, s.date, s.file])).toEqual([
        ["calm", "Calm", 3, "stable", "1995-02-01", "calm.tcsave"],
        ["seed-4", "Seed 4", 4, SCENARIO_HIDDEN, "1995-02-01", "seed-4.tcsave"],
      ]);
      for (const s of index.starts) {
        expect(s.save_version).toBe(SAVE_VERSION);
        expect(s.hash).toMatch(/^[0-9a-f]+$/);
        const bytes = new Uint8Array(readFileSync(join(dir, s.file)));
        expect(bytes.length).toBe(s.bytes);
        // The save loads, into a game of any seed, with the index's hash.
        const sim = simNew(structuredClone(data), 1);
        if (!sim.ok) throw new Error("did not start");
        expect(sim.value.loadBytes(bytes).ok).toBe(true);
        expect(sim.value.stateHash()).toBe(s.hash);
      }
      // The index holds no wall time: the same bake writes the same file.
      await bakeCommand(structuredClone(data), {
        ...args,
        seed: 3,
        scenario: "stable",
        name: "calm",
        label: "Calm",
      });
      expect(readFileSync(join(dir, INDEX_FILE), "utf8")).toBe(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
