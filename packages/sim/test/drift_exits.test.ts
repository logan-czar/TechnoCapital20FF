// D1022: the drift plan's lane X. The era worlds' exit rule (D996) runs in the 2020 world under a
// profile with `exits` (`mature`), and `legacy` keeps spec 5.12, so its results do not move.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { PROFILES, profileById } from "../src/economy/profiles.ts";
import { EXIT_LOSS_QUARTERS } from "../src/finance/distress.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";

function newSim(profile: string) {
  const r = loadWorld(defaultDataDir());
  if (!r.ok) throw new Error("data");
  const made = simNew(structuredClone(r.value), 3, { profile });
  if (!made.ok) throw new Error("sim");
  return made.value;
}

/** A company that has another open firm in its industry, given a losing streak long enough to exit. */
function loser(sim: ReturnType<typeof newSim>): number {
  const w = simWorld(sim);
  const id = w.companies.findIndex((c) => w.companies.some((o) => o !== c && o.industry === c.industry));
  (w.companies[id] as (typeof w.companies)[number]).loss_quarters = EXIT_LOSS_QUARTERS;
  return id;
}

/** Steps past the 1 February settle (4.3 step 13); no quarter closes, so the streak stands. */
function runPastSettle(sim: ReturnType<typeof newSim>): void {
  const end = dateTimeMidnight(simDateYmd(2020, 2, 2));
  while (sim.now() < end) sim.step();
}

describe("the exit rule in the 2020 world (D1022)", () => {
  it("is on in mature and off in every other baseline profile", () => {
    for (const p of PROFILES) expect(p.exits, p.id).toBe(p.id === "mature");
    expect(profileById("mature+slow+vol-high")?.exits).toBe(true);
  });

  it("mature removes a firm on a long losing streak; legacy keeps it", () => {
    const mature = newSim("mature");
    const legacy = newSim("legacy");
    const a = loser(mature);
    const b = loser(legacy);
    runPastSettle(mature);
    runPastSettle(legacy);
    expect(simWorld(mature).companies[a]?.finance.distress.status).toBe("Bankrupt");
    expect(simWorld(legacy).companies[b]?.finance.distress.status).toBe("Active");
  }, 120_000);
});
