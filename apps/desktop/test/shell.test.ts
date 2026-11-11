// The shell's pure parts: the command-line flags (src/main/flags.ts) and what the app:// scheme
// serves (src/main/serve.ts).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseFlags, RUN_YEARS, SMOKE_FRAMES, SMOKE_SEED } from "../src/main/flags.ts";
import { fileFor, type ServeDirs, serve } from "../src/main/serve.ts";

describe("parseFlags", () => {
  it("is all off for a bare launch", () => {
    expect(parseFlags(["."])).toEqual({
      mock: false,
      save: null,
      paused: false,
      windowSize: null,
      userDataDir: null,
      world: null,
      smoke: null,
      smokeFrames: SMOKE_FRAMES,
      smokeSaveSlot: null,
      seed: SMOKE_SEED,
      scenario: null,
      run: null,
      years: RUN_YEARS,
      testHooks: false,
      devServer: null,
      hidden: false,
      background: false,
    });
  });

  it("reads the flags tests and agents use", () => {
    const f = parseFlags([
      ".",
      "--mock",
      "--paused",
      "--save=D:\\saves\\a b.tcsave",
      "--window-size=1280x720",
      "--user-data-dir=D:/tmp/ud",
      "--world=2020",
    ]);
    expect(f).toMatchObject({
      mock: true,
      paused: true,
      save: "D:\\saves\\a b.tcsave",
      windowSize: { width: 1280, height: 720 },
      userDataDir: "D:/tmp/ud",
      world: "2020",
    });
  });

  it("reads the smoke and run flags, and turns the test hooks on for a smoke run", () => {
    const f = parseFlags(["--smoke=out.json", "--smoke-frames=0", "--smoke-save-slot=one", "--seed=7"]);
    expect(f).toMatchObject({
      smoke: "out.json",
      smokeFrames: 0,
      smokeSaveSlot: "one",
      seed: 7,
      testHooks: true,
    });
    expect(parseFlags(["--test-hooks"]).testHooks).toBe(true);
    expect(parseFlags(["--run=r.json", "--years=3", "--scenario=boom"])).toMatchObject({
      run: "r.json",
      years: 3,
      scenario: "boom",
    });
  });

  it("falls back on what it cannot read", () => {
    const f = parseFlags(["--world=../secrets", "--window-size=big", "--seed=-4", "--years=0", "--save="]);
    expect(f.world).toBeNull();
    expect(f.windowSize).toBeNull();
    expect(f.seed).toBe(SMOKE_SEED);
    expect(f.years).toBe(1);
    expect(f.save).toBeNull();
    expect(parseFlags(["--world=1995"]).world).toBe("1995");
    expect(parseFlags(["--window-size=800,600"]).windowSize).toEqual({ width: 800, height: 600 });
  });
});

describe("the app:// scheme", () => {
  // Scratch stays on D:, beside the app (node_modules is git-ignored).
  const root = join(import.meta.dirname, "..", "node_modules", ".test-tmp");
  let tmp: string;
  let dirs: ServeDirs;
  beforeAll(() => {
    mkdirSync(root, { recursive: true });
    tmp = mkdtempSync(join(root, "serve-"));
    dirs = {
      renderer: join(tmp, "renderer"),
      worlds: join(tmp, "worlds"),
      design: join(tmp, "design"),
      map: join(tmp, "map"),
    };
    for (const d of [
      join(dirs.renderer, "assets"),
      join(dirs.renderer, "data", "map"),
      join(dirs.worlds, "1995"),
      dirs.design,
      dirs.map,
    ]) {
      mkdirSync(d, { recursive: true });
    }
    writeFileSync(join(dirs.renderer, "index.html"), "<!doctype html>");
    writeFileSync(join(dirs.renderer, "assets", "index-abc.js"), "export {}");
    writeFileSync(join(dirs.renderer, "data", "map", "provinces.topo.json"), "{}");
    writeFileSync(join(dirs.worlds, "1995", "countries.csv"), "id\n");
    writeFileSync(join(dirs.design, "countries.csv"), "id\n");
    writeFileSync(join(tmp, "secret.txt"), "no");
  });
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("serves the renderer at / and the data folders at /data", () => {
    expect(fileFor("/", dirs)).toBe(join(dirs.renderer, "index.html"));
    expect(fileFor("/assets/index-abc.js", dirs)).toBe(join(dirs.renderer, "assets", "index-abc.js"));
    expect(fileFor("/data/worlds/1995/countries.csv", dirs)).toBe(join(dirs.worlds, "1995", "countries.csv"));
    expect(fileFor("/data/design/countries.csv", dirs)).toBe(join(dirs.design, "countries.csv"));
    // A data file only the build has (the folder has none) comes from the build.
    expect(fileFor("/data/map/provinces.topo.json", dirs)).toBe(
      join(dirs.renderer, "data", "map", "provinces.topo.json"),
    );
  });

  it("answers 404 for what is not there, never the index page", async () => {
    expect(fileFor("/data/map/map-meta.toml", dirs)).toBeNull();
    expect(fileFor("/company/12", dirs)).toBeNull();
    const missing = serve("app://game/data/map/map-meta.toml", "game", dirs);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).not.toContain("text/html");
    expect(serve("app://elsewhere/", "game", dirs).status).toBe(404);
    const index = serve("app://game/", "game", dirs);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("text/html");
    expect(await index.text()).toBe("<!doctype html>");
    expect(serve("app://game/assets/index-abc.js", "game", dirs).headers.get("content-type")).toContain(
      "text/javascript",
    );
    expect(
      serve("app://game/data/design/countries.csv?x=1", "game", dirs).headers.get("content-type"),
    ).toContain("text/csv");
  });

  it("never leaves its folders", () => {
    for (const path of [
      "/../secret.txt",
      "/%2e%2e/secret.txt",
      "/data/worlds/../../secret.txt",
      "/data/worlds/..%2f..%2fsecret.txt",
      "/data/design/..\\secret.txt",
      "/%E0%A4%A",
    ]) {
      expect(fileFor(path, dirs)).toBeNull();
    }
  });
});
