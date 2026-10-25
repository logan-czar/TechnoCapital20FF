// The golden job-order trace for 2020 (build-plan M1.3): every tick from 2020-01-01 01:00 to
// 2021-01-01 00:00, with the slots it visited, must match test/golden/job-order-2020.txt (a copy
// of crates/sim/tests/golden/job-order-2020.txt), which was checked by hand against spec 4. Set
// `UPDATE_GOLDEN=1` to rewrite it after an intended change to the order. Ported from
// crates/sim/tests/job_order.rs.
//
// Runs on `testSim` (test_sim.ts): the real Sim, on the real data once every Step 2 start call is
// wired, on a minimal world before that (the trace is the slots visited, which no job changes).

import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simLastTrace, simNow, simSetTrace, simStep } from "../src/lib.ts";
import { dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { traceRecorderNew, traceRecorderPush, traceRecorderRender } from "../src/time/trace.ts";
import { testSim } from "./test_sim.ts";

const GOLDEN = new URL("./golden/job-order-2020.txt", import.meta.url);

describe("job order", () => {
  it("2020 matches the golden trace", () => {
    const sim = testSim(1);
    simSetTrace(sim, true);
    const end = dateTimeMidnight(simDateYmd(2021, 1, 1));
    const rec = traceRecorderNew();
    while (simNow(sim) < end) {
      simStep(sim);
      traceRecorderPush(rec, simNow(sim), simLastTrace(sim));
    }
    const got = traceRecorderRender(rec);
    if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, got);
    const want = readFileSync(GOLDEN, "utf8").replaceAll("\r\n", "\n");
    if (got !== want) {
      const g = got.split("\n");
      const w = want.split("\n");
      let line = g.findIndex((a, i) => a !== w[i]);
      if (line < 0) line = Math.min(g.length, w.length);
      expect.fail(
        `job order differs from the golden trace at line ${line + 1}:\n got: ${JSON.stringify(g[line])}\nwant: ${JSON.stringify(w[line])}`,
      );
    }
  });
});
