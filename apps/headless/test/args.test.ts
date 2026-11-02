import { defaultDataDir, worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { parseRecord, parseReplay, parseRun, parseSeeds, parseSoak, userPath } from "../src/args.ts";

describe("argument parsing", () => {
  it("seeds are A..B inclusive or a single A", () => {
    expect(parseSeeds("1..50")).toEqual([1, 50]);
    expect(parseSeeds("7")).toEqual([7, 7]);
    expect(parseSeeds("5..2")).toBeNull();
    expect(parseSeeds("a..2")).toBeNull();
    expect(parseSeeds("-1")).toBeNull();
    expect(parseSeeds(undefined)).toBeNull();
  });

  it("run needs years and seeds", () => {
    const a = parseRun(["--years", "2", "--seeds", "1..3", "--hash-monthly", "--profile", "--out", "m.csv"]);
    expect(a).toMatchObject({
      years: 2,
      seeds: [1, 3],
      hashMonthly: true,
      profile: true,
      tickCosts: false,
      out: userPath("m.csv"),
    });
    expect(parseRun(["--years", "2"])).toBeNull();
    expect(parseRun(["--years", "0", "--seeds", "1"])).toBeNull();
    expect(parseRun(["--years", "1", "--seeds", "1", "--bogus"])).toBeNull();
  });

  it("plays the 1995 world unless told otherwise", () => {
    expect(parseSoak(["--out", "d"])?.[1]).toBe(worldDataDir("1995"));
    expect(parseRun(["--years", "1", "--seeds", "1"])?.dir).toBe(worldDataDir("1995"));
    expect(parseRecord(["--years", "1", "--seed", "1", "--out", "l"])?.[3]).toBe(worldDataDir("1995"));
    expect(parseReplay(["l"])?.[1]).toBe(worldDataDir("1995"));
    expect(parseSoak(["--out", "d", "--world", "2020"])?.[1]).toBe(defaultDataDir());
  });

  it("soak defaults to seeds 1..50 and a full run, and needs --out", () => {
    expect(parseSoak(["--out", "d", "--world", "2020"])?.[0].years).toBe(30);
    expect(parseSoak(["--out", "d", "--years", "3"])?.[0].years).toBe(3);
    const [a] = parseSoak(["--out", "d"]) ?? [];
    expect(a).toMatchObject({
      years: 25,
      seeds: [1, 50],
      jobs: null,
      out: userPath("d"),
      check: false,
      detail: false,
    });
    expect(parseSoak([])).toBeNull();
    const [b, dir] = parseSoak(["--out", "d", "--jobs", "4", "--check", "--detail", "--data-dir", "x"]) ?? [];
    expect(b).toMatchObject({ jobs: 4, check: true, detail: true });
    expect(dir).toBe(userPath("x"));
    expect(parseSoak(["--out", "d", "--jobs", "0"])).toBeNull();
  });

  it("record and replay", () => {
    expect(parseRecord(["--years", "2", "--seed", "7", "--out", "l"])?.slice(0, 3)).toEqual([
      7,
      2,
      userPath("l"),
    ]);
    expect(parseRecord(["--years", "2", "--seed", "7"])).toBeNull();
    expect(parseReplay(["run.log"])?.[0]).toBe(userPath("run.log"));
    expect(parseReplay(["a.log", "b.log"])).toBeNull();
    expect(parseReplay(["--data-dir"])).toBeNull();
  });
});
