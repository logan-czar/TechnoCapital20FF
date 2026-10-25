// Save, load, continue gives the same hashes as a run with no save (build-plan M1.7, 4.3). The
// runs carry the test churn job, which draws from every RNG stream each tick and writes into the
// world, so a save that lost a table field, a stream position or a spare normal would fail.
// Ported from crates/sim/tests/save_load.rs, on `testSim` (test_sim.ts).

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type SaveFiles, type Sim, simWorld } from "../src/lib.ts";
import { dateTimeHours } from "../src/time/calendar.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { StateHash } from "../src/types/sim-api.ts";
import { alertLevelsGet } from "../src/world/notice.ts";
import { churningSim, testSim } from "./test_sim.ts";

/** Steps to `ticks` and returns the hash after every tick that closes a month. */
function monthlyHashes(sim: Sim, ticks: number): StateHash[] {
  const out: StateHash[] = [];
  while (dateTimeHours(sim.now()) < ticks) {
    if (sim.step().some((n) => n.kind === "MonthDone")) out.push(sim.stateHash());
  }
  return out;
}

/** node:fs for the Save and Load controls (the headless runner's `SimOptions.files`). */
const NODE_FILES: SaveFiles = {
  read: (path) => new Uint8Array(readFileSync(path)),
  write: (path, bytes) => writeFileSync(path, bytes),
};

describe("save and load", () => {
  it("save, load, continue matches an unbroken run", () => {
    const END = 24 * 400;
    const straight = churningSim(77);
    const want = monthlyHashes(straight, END);
    // The churn bites: the same seed without it ends in another state.
    const idle = testSim(77);
    expect(monthlyHashes(idle, END)).not.toEqual(want);
    expect(simWorld(idle)).not.toEqual(simWorld(straight));

    for (const cut of [1, 23, 24 * 31, 24 * 91 + 1, 5_555]) {
      const first = churningSim(77);
      const got = monthlyHashes(first, cut);
      // Every cut has draws behind it: the state differs from the same seed with no job.
      const idleAtCut = testSim(77);
      monthlyHashes(idleAtCut, cut);
      expect(first.stateHash(), `cut ${cut}`).not.toBe(idleAtCut.stateHash());
      const bytes = first.saveBytes();
      // Load into a game with another seed and clock, to show the save replaces everything.
      const second = churningSim(999);
      second.step();
      expect(second.loadBytes(bytes)).toEqual({
        ok: true,
        value: [{ kind: "Paused", reason: { kind: "Loaded" } }],
      });
      expect(second.stateHash(), `cut ${cut}`).toBe(first.stateHash());
      expect(second.now()).toBe(first.now());
      got.push(...monthlyHashes(second, END));
      expect(got, `cut ${cut}`).toEqual(want);
      expect(second.stateHash()).toBe(straight.stateHash());
    }
  });

  it("saves and loads controls through files", () => {
    const path = join(mkdtempSync(join(tmpdir(), "tc20ff-saves-")), "m1.sav");
    const a = testSim(4, { files: NODE_FILES });
    expect(a.apply({ kind: "SetAlert", alert_kind: "QuarterlyRecap", level: "Off" }).ok).toBe(true);
    expect(a.apply({ kind: "WatchlistAdd", company: 9 as CompanyId }).ok).toBe(true);
    for (let i = 0; i < 500; i++) a.step();
    expect(a.apply({ kind: "Save", path }).ok).toBe(true);

    const b = testSim(5, { files: NODE_FILES });
    expect(b.apply({ kind: "Resume" }).ok).toBe(true);
    expect(b.apply({ kind: "Load", path }).ok).toBe(true);
    expect(b.stateHash()).toBe(a.stateHash());
    expect(b.seed()).toBe(4);
    expect(b.controls().paused, "loading pauses (D13)").toBe(true);
    expect(alertLevelsGet(b.controls().alerts, "QuarterlyRecap")).toBe("Off");
    expect(b.controls().watchlist.has(9 as CompanyId)).toBe(true);
    expect(b.clock().now).toBe(a.now());

    writeFileSync(path, "not a save");
    expect(b.apply({ kind: "Load", path }).ok).toBe(false);
    expect(b.stateHash(), "a bad load changes nothing").toBe(a.stateHash());
  });

  // Rust `a_save_written_by_main_v8_is_refused` (D826) loads a postcard save of version 8. TS saves
  // are another format (D953): every Rust save, whatever its version, fails at the magic. A Rust
  // save's first bytes stand in for the fixture.
  it("a Rust save is refused and changes nothing", () => {
    const s = testSim(1);
    const before = s.stateHash();
    const rustSave = new TextEncoder().encode("TC20FFSV\u0008\u0000\u0000\u0000postcard");
    expect(s.loadBytes(rustSave)).toEqual({
      ok: false,
      error: { kind: "Save", error: { kind: "BadMagic" } },
    });
    expect(s.stateHash(), "a refused load changes nothing").toBe(before);
  });

  it("Save and Load without file access fail with an Io error", () => {
    const s = testSim(1);
    const r = s.apply({ kind: "Save", path: "x.sav" });
    expect(r.ok === false && r.error.kind === "Save" && r.error.error.kind).toBe("Io");
    expect(s.apply({ kind: "Load", path: "x.sav" }).ok).toBe(false);
  });
});
