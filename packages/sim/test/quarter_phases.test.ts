// Quarter phases on the exact spec 4.4 dates, and daysToNextPhase on every day and hour of 2020
// to 2023 (build-plan M1.4), checked against the spec table written out by hand. Ported from
// crates/sim/tests/quarter_phases.rs (it needs no Sim).

import { describe, expect, it } from "vitest";
import {
  dateTimeAt,
  dateTimeDate,
  dateTimeFromHours,
  dateTimeHours,
  dateTimeMidnight,
  formatDateTime,
  simDateDaysSinceEpoch,
  simDateYmd,
} from "../src/time/calendar.ts";
import { nextPhaseStart, phaseAt, phaseInfoDaysToNextPhase } from "../src/time/quarter.ts";
import { DATETIME_START } from "../src/types/calendar.ts";
import type { QuarterPhase } from "../src/types/control.ts";

/** Spec 4.4, as written: (month, day, hour, phase) of every phase start in a year. */
const SPEC_TABLE: [number, number, number, QuarterPhase][] = [
  [1, 2, 0, "Release"],
  [1, 2, 1, "Reaction"],
  [1, 9, 0, "Locked"],
  [3, 26, 0, "PreQuarterEnd"],
  [4, 2, 0, "Release"],
  [4, 2, 1, "Reaction"],
  [4, 9, 0, "Locked"],
  [6, 25, 0, "PreQuarterEnd"],
  [7, 2, 0, "Release"],
  [7, 2, 1, "Reaction"],
  [7, 9, 0, "Locked"],
  [9, 25, 0, "PreQuarterEnd"],
  [10, 2, 0, "Release"],
  [10, 2, 1, "Reaction"],
  [10, 9, 0, "Locked"],
  [12, 26, 0, "PreQuarterEnd"],
];

/** Every phase start from 2019 to 2024 as (hours since epoch, may be negative; phase). */
function specStarts(): [number, QuarterPhase][] {
  const out: [number, QuarterPhase][] = [];
  for (let y = 2019; y <= 2024; y++) {
    for (const [m, d, h, p] of SPEC_TABLE) out.push([simDateDaysSinceEpoch(simDateYmd(y, m, d)) * 24 + h, p]);
  }
  return out;
}

describe("quarter phases", () => {
  it("phases and days to next on every hour 2020 to 2023", () => {
    const starts = specStarts();
    const end = dateTimeHours(dateTimeMidnight(simDateYmd(2024, 1, 1)));
    for (let h = 0; h < end; h++) {
      const t = dateTimeFromHours(h);
      let i = starts.length - 1;
      while (starts[i]![0] > h) i--;
      const [, wantPhase] = starts[i]!;
      const [nextHour, nextPhase] = starts[i + 1]!;
      const info = phaseAt(t);
      const wantDays = Math.floor(nextHour / 24) - Math.floor(h / 24);
      const days = phaseInfoDaysToNextPhase(info, dateTimeDate(t));
      // Plain checks, not expect(), so 35,064 hours stay fast; the first mismatch fails the test.
      if (info.phase !== wantPhase || info.next_phase !== nextPhase || days !== wantDays) {
        expect.fail(
          `${formatDateTime(t)}: got ${info.phase} -> ${info.next_phase} in ${days}, want ${wantPhase} -> ${nextPhase} in ${wantDays}`,
        );
      }
    }
  });

  it("spot checks", () => {
    const at = (y: number, m: number, d: number, h: number) => dateTimeAt(simDateYmd(y, m, d), h);
    // Game start: the Q4 2019 pre-quarter-end week, one day to the 2 Jan release.
    const start = phaseAt(DATETIME_START);
    expect(start.phase).toBe("PreQuarterEnd");
    expect(phaseInfoDaysToNextPhase(start, simDateYmd(2020, 1, 1))).toBe(1);
    // Release tick: the reaction week starts at 01:00 the same day.
    const rel = phaseAt(at(2020, 4, 2, 0));
    expect(rel.phase).toBe("Release");
    expect(phaseInfoDaysToNextPhase(rel, simDateYmd(2020, 4, 2))).toBe(0);
    // Plan lock to recap: 9 Apr to 25 Jun is 77 days.
    expect(phaseInfoDaysToNextPhase(phaseAt(at(2020, 4, 9, 0)), simDateYmd(2020, 4, 9))).toBe(77);
    // Q4 locked quarter ends 26 Dec, the Q1 one 26 Mar.
    expect(nextPhaseStart(at(2020, 10, 9, 0), "PreQuarterEnd")).toBe(at(2020, 12, 26, 0));
    expect(nextPhaseStart(at(2020, 12, 26, 0), "Release")).toBe(at(2021, 1, 2, 0));
  });
});
