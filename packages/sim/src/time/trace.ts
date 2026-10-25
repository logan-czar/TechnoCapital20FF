// The job-order trace (build-plan M1.3): which slots each tick visited, run-length collapsed so a
// year fits a reviewable golden file. Consecutive ticks that visited the same slots form one run.
// Ported from crates/sim/src/time/trace.rs.

import { type DateTime, dateEq } from "../types/calendar.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeNext,
  dateTimeWeekday,
  formatDateTime,
  formatSimDate,
  weekdayShortName,
} from "./calendar.ts";
import { GROUP_LABEL, type Slot, slotGroup, slotStep } from "./scheduler.ts";

/** One run of ticks with the same slots. */
interface Run {
  first: DateTime;
  last: DateTime;
  slots: Slot[];
}

/** Collects ticks and renders the trace. */
export interface TraceRecorder {
  readonly runs: Run[];
}

export function traceRecorderNew(): TraceRecorder {
  return { runs: [] };
}

function sameSlots(a: readonly Slot[], b: readonly Slot[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** Records that the tick at `now` visited `slots`. */
export function traceRecorderPush(rec: TraceRecorder, now: DateTime, slots: readonly Slot[]): void {
  const r = rec.runs[rec.runs.length - 1];
  if (r !== undefined && dateTimeNext(r.last) === now && sameSlots(r.slots, slots)) {
    r.last = now;
    return;
  }
  rec.runs.push({ first: now, last: now, slots: slots.slice() });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The trace as text: a header per run, then one line per group of consecutive slots. */
export function traceRecorderRender(rec: TraceRecorder): string {
  let out = "";
  for (const r of rec.runs) {
    const a = r.first;
    const b = r.last;
    if (a === b) {
      out += `${formatDateTime(a)} ${weekdayShortName(dateTimeWeekday(a))}\n`;
    } else if (dateEq(dateTimeDate(a), dateTimeDate(b))) {
      const n = b - a + 1;
      out += `${formatSimDate(dateTimeDate(a))} ${pad2(dateTimeHour(a))}:00..${pad2(dateTimeHour(b))}:00 ${weekdayShortName(dateTimeWeekday(a))} (${n} ticks)\n`;
    } else {
      const n = b - a + 1;
      out += `${formatDateTime(a)}..${formatDateTime(b)} (${n} ticks)\n`;
    }
    let i = 0;
    while (i < r.slots.length) {
      const g = slotGroup(r.slots[i]!);
      out += `  ${GROUP_LABEL[g]}:`;
      while (i < r.slots.length && slotGroup(r.slots[i]!) === g) {
        out += ` ${slotStep(r.slots[i]!)}`;
        i++;
      }
      out += "\n";
    }
  }
  return out;
}
