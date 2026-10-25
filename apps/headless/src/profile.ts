// `run --profile` (build-plan M10.6, D400): wall time per scheduler slot, per job and for the view
// refresh, summed over a run and printed as a table, slowest first. Ported from
// crates/headless/src/profile.rs.
//
// The timer lives here, in the runner: the sim tells a TickObserver when each part of a tick
// starts and finishes and never reads a clock itself (build-plan 4.3). The observer sees no
// state, so a profiled run makes the same world, draws and hashes as an unprofiled one.
//
// CONTRACT: Rust's `TickObserver`/`TickPart`/`Slot` live in the sim's time/ module and are not in
// SimApi; they are declared here (slots by name) until `stepObserved` is exposed (see ObservedSim
// in factory.ts).
import {
  cmpStr,
  type DateTime,
  roundHalfAway,
  tickFactsIsLockTick,
  tickFactsIsMidnight,
  tickFactsIsMonthStart,
  tickFactsIsPriceMoveTick,
  tickFactsIsQuarterStart,
  tickFactsIsReleaseTick,
  tickFactsNew,
} from "@tc20ff/sim/internal";

/** Rust `TickPart`. A slot is named by its Slot name (e.g. "Monthly 1"). */
export type TickPart =
  | { kind: "Slot"; slot: string }
  | { kind: "Job"; slot: string; name: string }
  | { kind: "Views" }
  | { kind: "View"; name: string };

/** Rust `TickObserver`: told when each part of a tick starts and finishes. */
export interface TickObserver {
  started(part: TickPart): void;
  finished(part: TickPart): void;
}

/** Jobs listed under the slot table. */
const TOP_JOBS = 15;

/** Time (ms) and calls of one part. */
interface Acc {
  ms: number;
  calls: number;
}

function newAcc(): Acc {
  return { ms: 0, calls: 0 };
}

function addTo(a: Acc, ms: number): void {
  a.ms += ms;
  a.calls += 1;
}

/** Rust `format!("{x:>w$.p$}")`. */
function fixed(x: number, width: number, places: number): string {
  return x.toFixed(places).padStart(width);
}

/** Slowest first; ties by name, so the table order is fixed. */
function slowestFirst(rows: [string, Acc][]): void {
  rows.sort((a, b) => b[1].ms - a[1].ms || cmpStr(a[0], b[0]));
}

function tableLine(total: number, name: string, a: Acc): string {
  const secs = a.ms / 1000;
  const perCallUs = a.calls > 0 ? (secs * 1e6) / a.calls : 0;
  return `${name.padEnd(48)} ${fixed(secs, 10, 3)} ${fixed((100 * secs) / total, 6, 1)}% ${String(a.calls).padStart(9)} ${fixed(perCallUs, 12, 1)}`;
}

function entry(m: Map<string, Acc>, key: string): Acc {
  let a = m.get(key);
  if (a === undefined) {
    a = newAcc();
    m.set(key, a);
  }
  return a;
}

/** Sums wall time per slot, per job and for the views over a run. */
export class Profiler implements TickObserver {
  private readonly slots = new Map<string, Acc>();
  private readonly jobs = new Map<string, Acc>();
  private readonly views = newAcc();
  /** Each view rebuilt, by field name. */
  private readonly view = new Map<string, Acc>();
  /** Whole `stepObserved` calls, timed by the runner. */
  private readonly steps = newAcc();
  /** Start times of the parts open now (a slot, then its job). */
  private readonly open: number[] = [];

  /** One whole step took `ms`. */
  addStep(ms: number): void {
    addTo(this.steps, ms);
  }

  started(_part: TickPart): void {
    this.open.push(performance.now());
  }

  finished(part: TickPart): void {
    const start = this.open.pop();
    if (start === undefined) return;
    const ms = performance.now() - start;
    switch (part.kind) {
      case "Slot":
        addTo(entry(this.slots, part.slot), ms);
        break;
      case "Job":
        addTo(entry(this.jobs, `${part.slot} ${part.name}`), ms);
        break;
      case "Views":
        addTo(this.views, ms);
        break;
      case "View":
        addTo(entry(this.view, `view ${part.name}`), ms);
        break;
    }
  }

  /**
   * The report: every slot that ran, slowest first, with its share of all step time; then the
   * view refresh, the rest of the step (clock, pauses, notices) and the slowest jobs.
   */
  table(): string {
    const total = Math.max(this.steps.ms / 1000, Number.MIN_VALUE);
    const lines: string[] = [];
    lines.push(
      `${"part".padEnd(48)} ${"seconds".padStart(10)} ${"share".padStart(7)} ${"calls".padStart(9)} ${"us per call".padStart(12)}`,
    );
    const rows: [string, Acc][] = [...this.slots.entries()].filter(([, a]) => a.calls > 0);
    const slotMs = rows.reduce((s, [, a]) => s + a.ms, 0);
    rows.push(["views (refresh after each tick)", this.views]);
    const rest = Math.max(this.steps.ms - (slotMs + this.views.ms), 0);
    rows.push(["rest of the step (clock, pauses, notices)", { ms: rest, calls: this.steps.calls }]);
    slowestFirst(rows);
    for (const [name, a] of rows) lines.push(tableLine(total, name, a));
    lines.push(tableLine(total, "all steps", this.steps));
    lines.push(`\nslowest ${TOP_JOBS} jobs`);
    const jobs = [...this.jobs.entries()];
    slowestFirst(jobs);
    for (const [name, a] of jobs.slice(0, TOP_JOBS)) lines.push(tableLine(total, name, a));
    lines.push("\nviews rebuilt (calls: ticks the view was due)");
    const views = [...this.view.entries()];
    slowestFirst(views);
    for (const [name, a] of views) lines.push(tableLine(total, name, a));
    return `${lines.join("\n")}\n`;
  }
}

/**
 * The kinds of tick `run --tick-costs` times apart (as the game's bridge does, D776): any hour
 * but midnight, a day, a month's start, and each of a quarter's events (spec 4.4).
 */
export const TICK_KINDS = [
  "hourly",
  "daily",
  "monthly",
  "quarter start",
  "release",
  "price move",
  "plan lock",
] as const;

/** Rust `tick_kind`: index into TICK_KINDS of the tick at `now`. */
export function tickKind(now: DateTime): number {
  const f = tickFactsNew(now);
  if (tickFactsIsQuarterStart(f)) return 3;
  if (tickFactsIsReleaseTick(f)) return 4;
  if (tickFactsIsPriceMoveTick(f)) return 5;
  if (tickFactsIsLockTick(f)) return 6;
  if (tickFactsIsMonthStart(f)) return 2;
  if (tickFactsIsMidnight(f)) return 1;
  return 0;
}

/**
 * `run --tick-costs` (D801): the wall time of each whole, unobserved `step` (jobs and view
 * refresh, as the game runs it), by the kind of tick, so the quarter's ticks can be priced
 * without a window. Timing never changes the run.
 */
export class TickCosts {
  private readonly byKind: number[][] = TICK_KINDS.map(() => []);

  /** The tick that ended at `now` took `ms`. */
  add(now: DateTime, ms: number): void {
    this.byKind[tickKind(now)]?.push(ms);
  }

  /** One line a kind: count, mean, p50, p99 and the longest, in ms. */
  table(): string {
    let out = `${"tick".padEnd(14)} ${"n".padStart(7)} ${"mean ms".padStart(9)} ${"p50 ms".padStart(9)} ${"p99 ms".padStart(9)} ${"max ms".padStart(9)}\n`;
    TICK_KINDS.forEach((name, k) => {
      const v = this.byKind[k] ?? [];
      if (v.length === 0) return;
      const ms = [...v].sort((a, b) => a - b);
      const pct = (p: number): number => ms[roundHalfAway((ms.length - 1) * p)] ?? 0;
      const mean = ms.reduce((s, x) => s + x, 0) / ms.length;
      out += `${name.padEnd(14)} ${String(ms.length).padStart(7)} ${fixed(mean, 9, 3)} ${fixed(pct(0.5), 9, 3)} ${fixed(pct(0.99), 9, 3)} ${fixed(ms[ms.length - 1] ?? 0, 9, 3)}\n`;
    });
    return out;
  }
}
