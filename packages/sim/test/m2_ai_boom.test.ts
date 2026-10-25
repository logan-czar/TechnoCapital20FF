// Port of crates/sim/tests/m2_ai_boom.rs: M2.4: the AI boom and the pop from ai-boom.csv (spec
// 5.1.1). Done when the noise-off AI labs demand matches validate.py's boom run year by year.
//
// Expects:
//   ../src/economy/ai_boom.ts  rollPopDate(draws) -> SimDate        [roll_pop_date]
//   ../src/economy/start.ts    start(world, draws)                  [economy::start]
//   ../src/world/load.ts       worldFromData
//   ../src/lib.ts              simNew, simWorld
//   ./common/economy.ts           economyScheduler, industry, monthStarts, rel, runMonth
//   ./common/rng.ts               newRng, newNoNoise
// The fixture is packages/sim/test/fixtures/validate-boom-calm.csv.
// Notice::Alert { kind: WorldEvent } is { kind: "Alert", alert_kind: "WorldEvent", ... }.
//
// Changed from the Rust: RngStreams::new(seed) is the new generator (D951), so the pop-date test
// keeps its range, quarter-start and coverage checks (400 seeds over 20 quarters, which any sound
// generator covers) and its "equals a fresh roll with the same seed" check, which only needs the
// load roll to be the first Gen draw (spec 7.3). The noise-off run uses NoNoise and is unchanged.
import { describe, expect, it } from "vitest";
import { rollPopDate } from "../src/economy/ai_boom.ts";
import { start } from "../src/economy/start.ts";
import { simNew, simWorld } from "../src/lib.ts";
import { formatSimDate, simDateYmd } from "../src/time/calendar.ts";
import type { AiStage, Notice } from "../src/types/world.ts";
import { worldFromData } from "../src/world/load.ts";
import { economyScheduler, industry, monthStarts, rel, runMonth } from "./common/economy.ts";
import { fixtureText, lines } from "./common/fixtures.ts";
import { data, unwrap } from "./common/index.ts";
import { newNoNoise, newRng } from "./common/rng.ts";

/** validate-boom-calm.csv: "industry key,year" to (lt, year-end demand in $bn). */
function calmRun(): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const rows = lines(fixtureText("validate-boom-calm.csv"))
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  for (const line of rows) {
    const p = line.split(",");
    expect(p[0]).toBe("demand");
    out.set(`${p[1]},${p[2]}`, [Number(p[3]), Number(p[4])]);
  }
  return out;
}

function hasWorldEvent(notices: Notice[]): boolean {
  return notices.some((n) => n.kind === "Alert" && n.alert_kind === "WorldEvent");
}

describe("m2 ai boom", () => {
  it("noise_off_boom_run_matches_validate_py_year_by_year", () => {
    const want = calmRun();
    const w = unwrap(worldFromData(data()), "World::from_data");
    // validate.py's noise-free run drops the cycle term as well as the shocks (`cycle = ... if
    // noise else 0.0`); Z = 0 does the same here, and NoNoise makes every z 0.
    w.cycle.z_avg = 0.0;
    const draws = newNoNoise();
    start(w, draws);
    // validate.py's run pops on 1 January 2040.
    w.ai.pop_date = simDateYmd(2040, 1, 1);
    const s = economyScheduler();
    const ai = industry(w, "ai_labs");
    let compared = 0;
    for (const date of monthStarts(simDateYmd(2020, 2, 1), simDateYmd(2046, 1, 1))) {
      const notices = runMonth(s, w, draws, date);
      const boomOrPop = date.month === 1 && (date.year === 2030 || date.year === 2040);
      expect(hasWorldEvent(notices), formatSimDate(date)).toBe(boomOrPop);
      if (date.month !== 1) continue;
      // The 1 January job closes December, so the year just ended is complete (D100). On the
      // pop day the same job has already cut demand by crash_drop (4.3 step 1a), which
      // validate.py applies after its 2039 year-end row.
      const year = date.year - 1;
      for (const ind of w.industries) {
        const [lt, demandBn] = want.get(`${ind.key},${year}`) as [number, number];
        const cut = date.year === 2040 ? 1.0 - ind.params.crash_drop : 1.0;
        const wantUsd = demandBn * 1e9 * cut;
        expect(
          rel(ind.demand_core, wantUsd) < 1e-9,
          `${ind.key} ${year}: ${ind.demand_core} vs validate.py ${wantUsd}`,
        ).toBe(true);
        expect(Math.abs(ind.prev_lt - lt) < 1e-12, `${ind.key} ${year} lt`).toBe(true);
        compared += 1;
      }
      // Labels (5.1.1): linked industries read Boom for the boom's first 4 quarters and Bust
      // for the 8 bust quarters, whatever the gap.
      const label = (w.industries[ai] as (typeof w.industries)[number]).phase_label;
      if (date.year === 2030) expect(label).toBe("Boom");
      else if (date.year === 2031) expect(label, "the forced Boom is over").not.toBe("Boom");
      else if (date.year === 2040 || date.year === 2041) expect(label).toBe("Bust");
      const wantStage: AiStage =
        date.year < 2030 ? "Preboom" : date.year < 2040 ? "Boom" : date.year < 2042 ? "Bust" : "Postcrash";
      expect(w.ai.stage, formatSimDate(date)).toBe(wantStage);
    }
    expect(compared).toBe(26 * 42);

    // The spec 5.1.1 table, from the same run: AI labs $8B at the end of 2029, about doubling in
    // 2030, $692B in 2039 and $311B at the end of 2040.
    const aiBn = (y: number): number => (want.get(`ai_labs,${y}`) as [number, number])[1];
    expect(Math.abs(aiBn(2029) - 8.1) < 0.1).toBe(true);
    expect(Math.abs(aiBn(2030) - 16.3) < 0.1).toBe(true);
    expect(Math.abs(aiBn(2039) - 691.5) < 0.1).toBe(true);
    expect(Math.abs(aiBn(2040) - 311.2) < 0.1).toBe(true);
    // Linked industries' lt in boom year 0: Data centers 29% (spec 4.1 test table).
    expect(Math.abs((want.get("data_centers,2030") as [number, number])[0] - 0.2925) < 1e-12).toBe(true);
  });

  it("the_pop_date_rolls_2038_to_2042_on_a_quarter_start", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const d = rollPopDate(newRng(seed));
      expect(d.year >= 2038 && d.year <= 2042, formatSimDate(d)).toBe(true);
      expect([1, 4, 7, 10].includes(d.month) && d.day === 1, formatSimDate(d)).toBe(true);
      seen.add(`${d.year},${d.month}`);
    }
    expect(seen.size, "every year and quarter comes up").toBe(20);

    // A new game rolls it at load and starts in Preboom (spec 7.3).
    const sim = unwrap(simNew(data(), 9), "Sim::new");
    const ai = simWorld(sim).ai;
    expect(ai.stage).toBe("Preboom");
    expect(ai.boom_date).toEqual(simDateYmd(2030, 1, 1));
    expect(ai.pop_date).toEqual(rollPopDate(newRng(9)));
  });
});
