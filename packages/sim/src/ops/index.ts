// Operations (build-plan M3): labor units, board seats opening and closing, stations, productive
// compute and the PC bonus, compute and licence costs, data (create, convert, decay, retention,
// free R&D) and productivity. Ported from crates/sim/src/ops/mod.rs.
//
// Spec sections: 3.6, 3.7, 3.8, 5.6, 5.8, 5.9, 5.10 (labor units and seats), 7.1; scheduled in
// 4.3 steps 4 (labor and seats), 5 (compute), 8 (data) and 10 (productivity) by `jobs`.

import { type Scheduler, schedulerRegister } from "../time/scheduler.ts";
import { computeJob, dataJob, laborSeatsJob, productivityJob } from "./jobs.ts";

export * as compute from "./compute.ts";
export * as data from "./data.ts";
export * as jobs from "./jobs.ts";
export * as labor from "./labor.ts";
export * as productivity from "./productivity.ts";
export * as stations from "./stations.ts";

/** Registers the operations jobs in their 4.3 slots. Called from jobs.ts's `registerJobs`. */
export function register(s: Scheduler): void {
  const r = schedulerRegister;
  r(s, "MonthlyLaborSeats", "ops.labor_seats", laborSeatsJob);
  r(s, "MonthlyCompute", "ops.compute", computeJob);
  r(s, "MonthlyData", "ops.data", dataJob);
  r(s, "MonthlyProductivity", "ops.productivity", productivityJob);
}
