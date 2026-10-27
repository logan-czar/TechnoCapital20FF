// The operations jobs on the World (build-plan M3.1, M3.4 to M3.7): 4.3 steps 4 (labor units,
// seats, stations), 5 (productive compute, PC bonus, compute bill), 8 (data) and 10 (management
// score and productivity). Ported from crates/sim/src/ops/jobs.rs.
//
// The formulas are lane F's pure functions in this module's siblings; each job reads the World,
// calls them in id order and writes the results back (the pure step contract, `world` docs). None
// of them draws: the seats a recount opens get their characters at step 11
// (people/seating.ts `newSeatsJob`).

import { companyIsFrozen } from "../economy/index.ts";
import { seatIndex, setManagementScores } from "../people/seating.ts";
import type { JobCtx } from "../time/scheduler.ts";
import type { IndustryParams, World } from "../types/world.ts";
import { companyDataIn } from "../world/entities.ts";
import { computeBill } from "./compute.ts";
import {
  conversionCapacity,
  type DataParams,
  dataBookFreeRdFraction,
  dataBookMonth,
  dataBookStoredTb,
} from "./data.ts";
import { fitStations, laborUnits, seatChanges } from "./labor.ts";
import { productivityInputsWithStations, stepProductivity } from "./productivity.ts";
import { pcBonus, productiveCompute } from "./stations.ts";

/** The data settings of an industry (industries.csv `data_tb_per_musd`, `data_decay_base`). */
export function dataParams(p: IndustryParams): DataParams {
  return { tb_per_musd: p.data_tb_per_musd, decay_base: p.data_decay_base };
}

/**
 * 4.3 step 4 (spec 5.10, 3.7): labor units recounted from the units' gross assets at the main
 * industry's labor_value (D200); the seats the count closes lose their character (a simple one is
 * discarded; a full one stays in the world, unseated, C34) and the seats it opens wait for step
 * 11; the stations are fitted to the new count, dropping idle, research, enterprise, 50/50 and
 * last productivity, or adding idle (D201). Until the M6 plan lock assigns a 6.4 split the
 * assignment is the 7.1 loadout's, fitted month by month.
 */
export function laborSeatsJob(world: World, _ctx: JobCtx): void {
  const { companies, units, industries } = world;
  for (const c of companies) {
    // A frozen company (Bankrupt or Removed) runs no monthly step (spec 5.12 step 2, D123).
    if (companyIsFrozen(c)) continue;
    let gross = 0.0;
    for (const u of c.units) gross += units[u]!.gross_assets;
    const labor = laborUnits(gross, industries[c.industry]!.params.labor_value_usd);
    const changes = seatChanges(c.labor_units, labor);
    for (const seat of changes.closed) {
      c.board[seatIndex(seat)] = null;
    }
    c.seats_to_fill = c.seats_to_fill.filter((s) => !changes.closed.includes(s));
    c.seats_to_fill.push(...changes.opened);
    c.stations = fitStations(c.stations, labor);
    c.labor_units = labor;
  }
}

/**
 * 4.3 step 5 (spec 5.8, 3.8): productive compute from the stations at the main industry's
 * pc_modifier, the live PC bonus (from the first month on it replaces the load's two-pass bonus,
 * D106), and the month's compute and licence bill on the TB stored (held plus unstructured, D209)
 * before this month's data step.
 */
export function computeJob(world: World, _ctx: JobCtx): void {
  const { companies, industries } = world;
  for (const c of companies) {
    // A frozen company (Bankrupt or Removed) runs no monthly step (spec 5.12 step 2, D123).
    if (companyIsFrozen(c)) continue;
    c.pc = productiveCompute(c.stations, industries[c.industry]!.params.pc_modifier);
    c.pc_bonus = pcBonus(c.pc);
    let stored = 0.0;
    for (const d of c.data) stored += dataBookStoredTb(d.book);
    c.compute = computeBill(c.stations, stored);
  }
}

/**
 * 4.3 step 8 (spec 5.9): each company's data in each of its industries runs one month on the
 * revenue its units there made at step 7. The stations are pooled, so the whole conversion
 * capacity goes to the main industry's data (D117; one industry per company in the MVP).
 */
export function dataJob(world: World, _ctx: JobCtx): void {
  const { companies, units, industries } = world;
  for (const c of companies) {
    // A frozen company (Bankrupt or Removed) runs no monthly step (spec 5.12 step 2, D123).
    if (companyIsFrozen(c)) continue;
    const capacity = conversionCapacity(c.stations);
    for (const d of c.data) {
      let revenue = 0.0;
      for (const uid of c.units) {
        const u = units[uid]!;
        if (u.industry === d.industry) revenue += u.revenue_m;
      }
      const cap = d.industry === c.industry ? capacity : 0.0;
      dataBookMonth(d.book, revenue, dataParams(industries[d.industry]!.params), cap);
    }
  }
}

/**
 * 4.3 step 10 (spec 5.6, 5.7): every management score from the seated board (D115), then each
 * unit's productivity: the R&D effect of `rd_plan + free R&D` against the norm, times the
 * management factor and the research multiplier, less the idle decay, clamped to 30 to 200.
 * `rd_plan` is the plan the unit runs: R&D at the norm until the M6 plan lock (D105,
 * `economy::assets::placeholder_plan` in the Rust).
 */
export function productivityJob(world: World, _ctx: JobCtx): void {
  setManagementScores(world);
  const { companies, industries } = world;
  for (const u of world.units) {
    const c = companies[u.company]!;
    // A frozen company (Bankrupt or Removed) runs no monthly step (spec 5.12 step 2, D123).
    if (companyIsFrozen(c)) continue;
    const book = companyDataIn(c, u.industry);
    const freeRd = book === null ? 0.0 : dataBookFreeRdFraction(book);
    const inputs = productivityInputsWithStations(
      u.rd_plan,
      freeRd,
      industries[u.industry]!.params.rd_norm,
      c.management_score,
      c.stations,
    );
    if (world.rd_diminishing_x !== undefined) inputs.rd_diminishing_x = world.rd_diminishing_x;
    u.productivity = stepProductivity(u.productivity, inputs);
  }
}
