import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { Detail } from "../src/detail.ts";
import {
  outputTexts,
  runSeeds,
  type SeedOutput,
  type SeedRunner,
  soak,
  splitFailures,
  TIMING_HEADER,
  workerRunner,
  writeDetail,
  writeOutputs,
} from "../src/soak.ts";

function output(seed: number, detail: Detail | null = null): SeedOutput {
  return {
    seed,
    years: `${seed},2020,a\n`,
    quarters: `${seed},2020,1\n`,
    ticks: 8784,
    wall_ms: 100 + seed,
    state_hash: "h",
    end: "2021-01-01 00:00",
    max_shares_out: 5,
    detail,
  };
}

const stubRunner: SeedRunner = async (t) => {
  // Later seeds finish first, so the order of the output must come from the seed, not the finish.
  await new Promise((r) => setTimeout(r, 30 - t.seed * 5));
  if (t.seed === 3) throw new Error("bang");
  return output(t.seed);
};

describe("soak orchestration", () => {
  it("failed seeds are all named and the rest kept in seed order", async () => {
    const lines: string[] = [];
    const results = await runSeeds(stubRunner, ".", [1, 5], 1, 3, false, (l) => lines.push(l));
    const [done, error] = splitFailures(results);
    expect(done.map((o) => o.seed)).toEqual([1, 2, 4, 5]);
    expect(error).toContain("1 of 5 seeds failed");
    expect(error).toContain("seed 3: bang");
    expect(lines).toHaveLength(4);
    expect(splitFailures([{ ok: true, value: output(1) }])[1]).toBeNull();
  });

  it("never runs more seeds at once than the jobs", async () => {
    let live = 0;
    let peak = 0;
    const run: SeedRunner = async (t) => {
      live += 1;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live -= 1;
      return output(t.seed);
    };
    await runSeeds(run, ".", [1, 9], 1, 2, false, () => {});
    expect(peak).toBe(2);
  });

  it("writes years, quarters and timing in seed order under the Rust headers", () => {
    const dir = mkdtempSync(join(tmpdir(), "headless-soak-"));
    try {
      writeOutputs(dir, [output(1), output(2)], 30);
      const [y, q, t] = outputTexts([output(1), output(2)], 30);
      expect(readFileSync(join(dir, "years.csv"), "utf8")).toBe(y);
      expect(readFileSync(join(dir, "quarters.csv"), "utf8")).toBe(q);
      expect(t).toBe(`${TIMING_HEADER}\n1,30,8784,101,3\n2,30,8784,102,3\n`);
      const ref = (name: string): string =>
        readFileSync(join(import.meta.dirname, "../../../test/fixtures/rust-reference", name), "utf8").split(
          /\r?\n/,
        )[0] as string;
      expect(y.split("\n")[0]).toBe(ref("years.csv"));
      expect(q.split("\n")[0]).toBe(ref("quarters.csv"));
      expect(t.split("\n")[0]).toBe(ref("timing.csv"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("joins the detail tables in seed order under their headers", () => {
    const dir = mkdtempSync(join(tmpdir(), "headless-detail-"));
    try {
      const d = (n: number): Detail => ({
        industries: `i${n}\n`,
        companies: `c${n}\n`,
        world: `w${n}\n`,
        zones: `z${n}\n`,
      });
      writeDetail(dir, [output(1, d(1)), output(2, d(2))]);
      expect(readFileSync(join(dir, "world.csv"), "utf8")).toMatch(/^seed,year,ai_stage,.*\nw1\nw2\n$/);
      expect(readFileSync(join(dir, "zones.csv"), "utf8")).toMatch(/^seed,year,exchange,.*\nz1\nz2\n$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("soak() writes the files, then throws for failed seeds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "headless-soak2-"));
    try {
      await expect(
        soak(stubRunner, ".", { years: 1, seeds: [2, 3], jobs: 2, out: dir, check: false, detail: false }),
      ).rejects.toThrow(/1 of 2 seeds failed/);
      expect(readFileSync(join(dir, "timing.csv"), "utf8")).toBe(`${TIMING_HEADER}\n2,1,8784,102,102\n`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("worker threads", () => {
  it("run a seed task in a Worker and report its output or error", async () => {
    const run = workerRunner(pathToFileURL(join(import.meta.dirname, "stub-task.ts")).href);
    const results = await runSeeds(run, ".", [12, 14], 1, 3, false, () => {});
    const [done, error] = splitFailures(results);
    expect(done.map((o) => [o.seed, o.state_hash])).toEqual([
      [12, "hash12"],
      [14, "hash14"],
    ]);
    expect(error).toContain("seed 13: boom");
  }, 30_000);
});
