// Record and replay with player actions (pivot 16.1, D1027; lane P, D1042): a recorded game whose
// scripted trader opened the account and traded replays to the same state hashes on the real sim,
// and a dropped action fails the replay. On the frozen test world (no pre-history, so `record`'s
// `player` option opens the account). Three runs of a game year: about 10 s.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorldData } from "@tc20ff/sim-data";
import { loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { defaultFactory } from "../src/factory.ts";
import { record, replay } from "../src/replay.ts";

const MINI = join(import.meta.dirname, "..", "..", "..", "packages", "sim", "test", "fixtures", "world-mini");

function mini(): WorldData {
  const r = loadWorld(MINI);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe("record and replay a game with a trading player", () => {
  it("replays every hash line; a dropped action fails", () => {
    const data = mini();
    const dir = mkdtempSync(join(tmpdir(), "headless-replay-player-"));
    try {
      const log = join(dir, "run.log");
      const made = record(defaultFactory, data, 5, 1, log, { player: "Normal" });
      const text = readFileSync(log, "utf8");
      expect(text).toMatch(/^version 2\nseed 5\nyears 1\nplayer Normal\n/);
      const acts = text.split("\n").filter((l) => l.startsWith("act "));
      expect(acts.length).toBeGreaterThan(5);
      expect(acts.some((l) => l.includes('"PlaceOrder"'))).toBe(true);
      expect(made).toMatch(/^\d+ controls, \d+ actions, \d+ hash lines, end /);
      expect(replay(defaultFactory, data, log)).toBe(made);

      // Drop the first order: the account differs from the next hash line on.
      const first = acts.find((l) => l.includes('"PlaceOrder"')) as string;
      const bad = join(dir, "bad.log");
      writeFileSync(bad, text.replace(`${first}\n`, ""));
      expect(() => replay(defaultFactory, data, bad)).toThrow(/replay differs|act|unsent/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
