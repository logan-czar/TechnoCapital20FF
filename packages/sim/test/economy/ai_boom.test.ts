import { describe, expect, it } from "vitest";
import { aiLabsLt, boomDate, boomYear, linkedLt, stageAt } from "../../src/economy/ai_boom.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import type { AiSchedule } from "../../src/types/world.ts";

function schedule(): AiSchedule {
  return {
    preboom_lt: 0.05,
    boom_lt: [1.0, 1.0, 0.9, 0.8, 0.6, 0.45, 0.35, 0.25, 0.2, 0.15, 0.12],
    bust_lt: -0.1,
    postcrash_lt: 0.08,
  };
}

describe("economy/ai_boom", () => {
  it("stages by date", () => {
    const b = boomDate();
    const p = simDateYmd(2040, 4, 1);
    expect(stageAt(simDateYmd(2029, 12, 1), b, p)).toEqual(["Preboom", 0]);
    expect(stageAt(simDateYmd(2030, 1, 1), b, p)).toEqual(["Boom", 0]);
    expect(stageAt(simDateYmd(2040, 1, 1), b, p)).toEqual(["Boom", 40]);
    expect(stageAt(simDateYmd(2040, 4, 1), b, p)).toEqual(["Bust", 0]);
    expect(stageAt(simDateYmd(2042, 3, 1), b, p)).toEqual(["Bust", 7]);
    expect(stageAt(simDateYmd(2042, 4, 1), b, p)).toEqual(["Postcrash", 0]);
    expect([0, 3, 4, 11, 40].map(boomYear)).toEqual([0, 0, 1, 2, 10]);
    const s = schedule();
    expect(aiLabsLt(s, "Boom", 9)).toBe(0.9);
    expect(aiLabsLt(s, "Boom", 40)).toBe(0.12);
    expect(aiLabsLt(s, "Boom", 80)).toBe(0.12);
  });

  it("linked rates in boom year zero and the bust", () => {
    // Spec 5.1.1: Data centers 29% (15% + 14 pp), Cloud 25%, Semiconductors 15% in boom year
    // 0; in the bust Data centers 13%, Cloud 19%, Semiconductors 3.5%.
    const close = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThan(1e-12);
    close(linkedLt(0.15, 0.15, 1.0, 0.05), 0.2925);
    close(linkedLt(0.2, 0.05, 1.0, 0.05), 0.2475);
    close(linkedLt(0.05, 0.1, 1.0, 0.05), 0.145);
    close(linkedLt(0.15, 0.15, -0.1, 0.05), 0.1275);
    close(linkedLt(0.2, 0.05, -0.1, 0.05), 0.1925);
    close(linkedLt(0.05, 0.1, -0.1, 0.05), 0.035);
  });
});
