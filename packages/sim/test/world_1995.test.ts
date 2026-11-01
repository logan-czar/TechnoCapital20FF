// The 1995 world (1995-rework 2, 3.2; D993): its manifest and data load, and a game runs on them.
// Proto data for now, so these check that it runs and starts right, not any economic target (the
// real tuning is on the real data, spec 10).

import { check, dataErrorToString } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { simNew, simWorld } from "../src/lib.ts";
import { dateTimeDate, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { data1995, macrotask } from "./common/index.ts";

const START = simDateYmd(1995, 1, 1);
const SHORT_RUN_END = simDateYmd(1997, 2, 1);
/** A year's ticks between yields, so the Vitest worker can answer its runner. */
const TICKS_PER_YIELD = 8760;

function new1995(seed: number) {
  const made = simNew(data1995(), seed);
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

describe("the 1995 world's data", () => {
  it("passes the load-time checks", () => {
    expect(check(data1995()).map(dataErrorToString)).toEqual([]);
  });

  it("is smaller than the 2020 world and has no fixed events", () => {
    const d = data1995();
    expect(d.manifest.id).toBe("1995");
    expect(d.manifest.start_date).toEqual(START);
    expect(d.countries.rows.length).toBeLessThan(211);
    expect(d.companies.rows.length).toBe(300);
    expect(d.startup_events.rows).toEqual([]);
    expect(d.politics_offices.rows.some((o) => o.id === "USO-HOMELAND")).toBe(false);
  });

  it("numbers its companies with no gaps, since a born company takes the next key", () => {
    const ids = data1995().companies.rows.map((c) => c.id);
    expect(ids).toEqual(ids.map((_, i) => `CO-${String(i + 1).padStart(4, "0")}`));
  });
});

describe("a 1995 game", () => {
  it("starts on the manifest's date with no AI boom and no Arrowhead", () => {
    const sim = new1995(1);
    const w = simWorld(sim);
    expect(dateTimeDate(sim.now())).toEqual(START);
    expect(w.companies.length).toBe(300);
    expect(w.profile.ai_boom).toBe(false);
    expect(w.companies[0]?.name).not.toBe("Arrowhead Drilling");
    expect(w.births.fixed).toEqual([]);
  });

  it("gives its CO-0001 the ordinary 7.1 loadout, not Arrowhead's", () => {
    const d = data1995();
    const asArrowhead = structuredClone(d);
    asArrowhead.manifest = { ...d.manifest, features: { ...d.manifest.features, arrowhead: true } };
    const plain = simNew(d, 1);
    const special = simNew(asArrowhead, 1);
    if (!plain.ok || !special.ok) throw new Error("did not load");
    const firstUnit = (s: typeof plain.value) => {
      const w = simWorld(s);
      return w.units[w.companies[0]?.units[0] as number];
    };
    expect(firstUnit(plain.value)).not.toEqual(firstUnit(special.value));
  });

  it("births companies on the next free key, votes and repeats itself", async () => {
    const end = dateTimeMidnight(SHORT_RUN_END);
    const run = async () => {
      const sim = new1995(7);
      let n = 0;
      while (sim.now() < end) {
        sim.step();
        if (++n % TICKS_PER_YIELD === 0) await macrotask();
      }
      return sim;
    };
    const a = await run();
    const w = simWorld(a);
    expect(w.politics.elections.length).toBe(1);
    expect(w.politics.elections[0]?.date).toEqual(simDateYmd(1996, 11, 5));
    const keys = w.companies.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(w.companies.length).toBeGreaterThan(300);
    expect((await run()).stateHash()).toBe(a.stateHash());
  }, 300_000);

  it.skipIf(!process.env.TC20FF_LONG)(
    "runs the 25 years to 2020",
    async () => {
      const sim = new1995(1);
      const end = dateTimeMidnight(simDateYmd(2020, 1, 1));
      let n = 0;
      while (sim.now() < end) {
        sim.step();
        if (++n % TICKS_PER_YIELD === 0) await macrotask();
      }
      expect(simWorld(sim).politics.elections.length).toBe(13);
    },
    1_200_000,
  );
});
