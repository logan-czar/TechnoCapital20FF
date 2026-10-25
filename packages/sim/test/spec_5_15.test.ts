// Port of crates/sim/tests/spec_5_15.rs: spec 5.15 earnings jump (21.2, 21.3.1, 3.3.6), the result
// tags (21.3.2) and the reaction week (4.2 step 3, 4.4): build-plan M5.5, jump and reversion as
// 5.15 and 21.3.1 give them; and the 4.2 step 1 buzz decay. Pure formulas, no RNG.
//
// Expects:
//   ../../src/market/daily.ts     decayBuzz(buzz), isReversionDay(date), revertTowardValue(p, v)
//   ../../src/market/earnings.ts  type SurpriseTag = "Beat" | "BigBeat" | "Miss" | "BigMiss",
//                                 surpriseTagFromSurprise(s) -> SurpriseTag | null
//                                 [SurpriseTag::from_surprise], surpriseTagName(tag)
//                                 [SurpriseTag::name], type ResultTags { surprise: SurpriseTag |
//                                 null, loss, record_quarter }, isRecordQuarter(revenue, history),
//                                 jumpedBuzz(buzz, s), jumpedPrice(price, s), resultTags(s,
//                                 net_income, revenue, history), surprise(actual, consensus)
//   ../../src/time/calendar.ts    simDateYmd
import { describe, expect, it } from "vitest";
import { decayBuzz, isReversionDay, revertTowardValue } from "../src/market/daily.ts";
import {
  isRecordQuarter,
  jumpedBuzz,
  jumpedPrice,
  type ResultTags,
  resultTags,
  surprise,
  surpriseTagFromSurprise,
  surpriseTagName,
} from "../src/market/earnings.ts";
import { simDateYmd } from "../src/time/calendar.ts";

function near(a: number, b: number): void {
  expect(Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b), 1.0), `${a} vs ${b}`).toBe(true);
}

const M = 1e6;

describe("spec 5.15 earnings jump", () => {
  it("surprise_against_consensus", () => {
    // s = (actual - consensus) / |consensus|.
    near(surprise(12.0 * M, 10.0 * M), 0.2);
    near(surprise(-5.0 * M, 10.0 * M), -1.5);
    // A smaller loss than expected is a beat.
    near(surprise(-5.0 * M, -10.0 * M), 0.5);
    // Consensus 0 is treated as 1 dollar.
    near(surprise(1.0, 0.0), 0.0);
    near(surprise(101.0, 0.0), 100.0);
  });

  it("the_jump_is_one_and_a_half_times_the_clamped_surprise", () => {
    // P x= 1 + 1.5 x clamp(0.5 x s, -25%, +25%).
    // s = 0.2: 0.5 x 0.2 = 10%, x 1.5 = +15%: 20 dollars to 23.
    near(jumpedPrice(20.0, 0.2), 23.0);
    // s = 2.0: clamped at 25%, x 1.5 = +37.5%: 20 dollars to 27.50.
    near(jumpedPrice(20.0, 2.0), 27.5);
    // s = -1.5: -25% x 1.5 = -37.5%: 20 dollars to 12.50.
    near(jumpedPrice(20.0, -1.5), 12.5);
    near(jumpedPrice(20.0, 0.0), 20.0);
    // buzz += clamp(20 x s, -30, +30), kept within +-100.
    near(jumpedBuzz(0.0, 0.2), 4.0);
    near(jumpedBuzz(0.0, 2.0), 30.0);
    near(jumpedBuzz(-10.0, -1.5), -40.0);
    near(jumpedBuzz(90.0, 2.0), 100.0);
  });

  it("result_tags_for_headlines", () => {
    // 21.3.2 (T): Beat above +5%, Big beat above +20%, Miss below -5%, Big miss below -20%; one
    // surprise tier per report (D249).
    expect(surpriseTagFromSurprise(0.05)).toBeNull();
    expect(surpriseTagFromSurprise(0.051)).toBe("Beat");
    expect(surpriseTagFromSurprise(0.2)).toBe("Beat");
    expect(surpriseTagFromSurprise(0.21)).toBe("BigBeat");
    expect(surpriseTagFromSurprise(-0.05)).toBeNull();
    expect(surpriseTagFromSurprise(-0.06)).toBe("Miss");
    expect(surpriseTagFromSurprise(-0.2)).toBe("Miss");
    expect(surpriseTagFromSurprise(-0.25)).toBe("BigMiss");
    expect(surpriseTagName("BigBeat")).toBe("Big beat");
    // Loss: net income under 0. Record quarter: best revenue in the company history, strictly
    // above every earlier archived quarter (D249).
    const history = [10.0 * M, 10.0 * M, 10.0 * M, 10.0 * M];
    expect(isRecordQuarter(11.0 * M, history)).toBe(true);
    expect(isRecordQuarter(10.0 * M, history), "a tie is no record").toBe(false);
    expect(isRecordQuarter(11.0 * M, []), "no history, no record").toBe(false);
    expect(isRecordQuarter(0.0, [-1.0])).toBe(false);
    const missed: ResultTags = { surprise: "BigMiss", loss: true, record_quarter: false };
    expect(resultTags(-1.5, -5.0 * M, 9.0 * M, history)).toEqual(missed);
    const beat: ResultTags = { surprise: "BigBeat", loss: false, record_quarter: true };
    expect(resultTags(0.3, 2.0 * M, 12.0 * M, history)).toEqual(beat);
    const none: ResultTags = { surprise: null, loss: false, record_quarter: false };
    expect(resultTags(0.0, 0.0, 10.0 * M, history)).toEqual(none);
  });

  it("reaction_week_reverts_twenty_percent_a_day_toward_v", () => {
    // 4.2 step 3, 21.3.1: on the 3rd to the 8th of a release month, close 20% of the gap between
    // P and V.
    for (const m of [1, 4, 7, 10]) {
      expect(isReversionDay(simDateYmd(2021, m, 2))).toBe(false);
      for (let d = 3; d <= 8; d++) {
        expect(isReversionDay(simDateYmd(2021, m, d)), `${m}/${d}`).toBe(true);
      }
      expect(isReversionDay(simDateYmd(2021, m, 9))).toBe(false);
    }
    expect(isReversionDay(simDateYmd(2021, 5, 4))).toBe(false);
    // A 20 dollar stock (P = V) beats big: 27.50 at 01:00 on the 2nd. V stays 20; six reversion
    // days leave 0.8^6 = 0.262144 of the 7.50 gap: 21.96608.
    const v = 20.0;
    let p = jumpedPrice(20.0, 2.0);
    near(revertTowardValue(p, v), 27.5 - 0.2 * 7.5);
    for (let d = 3; d <= 8; d++) {
      expect(isReversionDay(simDateYmd(2021, 4, d))).toBe(true);
      p = revertTowardValue(p, v);
    }
    near(p, 20.0 + 7.5 * 0.262_144);
  });

  it("buzz_decays_25_percent_a_day", () => {
    // 4.2 step 1, 3.10: buzz decays 25% a day: 30 to 22.5, and 30 x 0.75^4 = 9.4921875.
    near(decayBuzz(30.0), 22.5);
    let b = 30.0;
    for (let i = 0; i < 4; i++) {
      b = decayBuzz(b);
    }
    near(b, 9.492_187_5);
    near(decayBuzz(-40.0), -30.0);
    near(decayBuzz(0.0), 0.0);
  });
});
