//! The operations jobs on the World (build-plan M3.1, M3.4 to M3.7): 4.3 steps 4 (labor units,
//! seats, stations), 5 (productive compute, PC bonus, compute bill), 8 (data) and 10
//! (management score and productivity).
//!
//! The formulas are lane F's pure functions in this module's siblings; each job reads the World,
//! calls them in id order and writes the results back (the pure step contract, `world` docs).
//! None of them draws: the seats a recount opens get their characters at step 11
//! ([`crate::people::seating::new_seats_job`]).

use super::compute::compute_bill;
use super::data::{DataParams, conversion_capacity};
use super::labor::{fit_stations, labor_units, seat_changes};
use super::productivity::{ProductivityInputs, step_productivity};
use super::stations::{pc_bonus, productive_compute};
use crate::people::seating::{seat_index, set_management_scores};
use crate::time::JobCtx;
use crate::world::{IndustryParams, World};

/// The data settings of an industry (industries.csv `data_tb_per_musd`, `data_decay_base`).
pub fn data_params(p: &IndustryParams) -> DataParams {
    DataParams {
        tb_per_musd: p.data_tb_per_musd,
        decay_base: p.data_decay_base,
    }
}

/// 4.3 step 4 (spec 5.10, 3.7): labor units recounted from the units' gross assets at the main
/// industry's labor_value (D200); the seats the count closes lose their character (a simple one
/// is discarded; a full one stays in the world, unseated, C34) and the seats it opens wait for
/// step 11; the stations are fitted to the new count, dropping idle, research, enterprise, 50/50
/// and last productivity, or adding idle (D201). Until the M6 plan lock assigns a 6.4 split the
/// assignment is the 7.1 loadout's, fitted month by month.
pub fn labor_seats_job(world: &mut World, _: &mut JobCtx<'_>) {
    let World {
        companies,
        units,
        industries,
        ..
    } = world;
    for (_, c) in companies.iter_mut() {
        let gross: f64 = c.units.iter().map(|&u| units[u].gross_assets).sum();
        let labor = labor_units(gross, industries[c.industry].params.labor_value_usd);
        let changes = seat_changes(c.labor_units, labor);
        for &seat in &changes.closed {
            c.board[seat_index(seat)] = None;
        }
        c.seats_to_fill.retain(|s| !changes.closed.contains(s));
        c.seats_to_fill.extend(changes.opened);
        c.stations = fit_stations(c.stations, labor);
        c.labor_units = labor;
    }
}

/// 4.3 step 5 (spec 5.8, 3.8): productive compute from the stations at the main industry's
/// pc_modifier, the live PC bonus (from the first month on it replaces the load's two-pass
/// bonus, D106), and the month's compute and licence bill on the TB stored (held plus
/// unstructured, D209) before this month's data step.
pub fn compute_job(world: &mut World, _: &mut JobCtx<'_>) {
    let World {
        companies,
        industries,
        ..
    } = world;
    for (_, c) in companies.iter_mut() {
        c.pc = productive_compute(&c.stations, industries[c.industry].params.pc_modifier);
        c.pc_bonus = f64::from(pc_bonus(c.pc));
        let stored: f64 = c.data.iter().map(|d| d.book.stored_tb()).sum();
        c.compute = compute_bill(&c.stations, stored);
    }
}

/// 4.3 step 8 (spec 5.9): each company's data in each of its industries runs one month on the
/// revenue its units there made at step 7. The stations are pooled, so the whole conversion
/// capacity goes to the main industry's data (D117; one industry per company in the MVP).
pub fn data_job(world: &mut World, _: &mut JobCtx<'_>) {
    let World {
        companies,
        units,
        industries,
        ..
    } = world;
    for (_, c) in companies.iter_mut() {
        let capacity = conversion_capacity(&c.stations);
        for d in &mut c.data {
            let revenue: f64 = c
                .units
                .iter()
                .map(|&u| &units[u])
                .filter(|u| u.industry == d.industry)
                .map(|u| u.revenue_m)
                .sum();
            let cap = if d.industry == c.industry {
                capacity
            } else {
                0.0
            };
            d.book
                .month(revenue, data_params(&industries[d.industry].params), cap);
        }
    }
}

/// 4.3 step 10 (spec 5.6, 5.7): every management score from the seated board (D115), then each
/// unit's productivity: the R&D effect of `rd_plan + free R&D` against the norm, times the
/// management factor and the research multiplier, less the idle decay, clamped to 30 to 200.
/// `rd_plan` is the plan the unit runs: R&D at the norm until the M6 plan lock (D105,
/// [`crate::economy::assets::placeholder_plan`]).
pub fn productivity_job(world: &mut World, _: &mut JobCtx<'_>) {
    set_management_scores(world);
    let World {
        companies,
        units,
        industries,
        ..
    } = world;
    for (_, u) in units.iter_mut() {
        let c = &companies[u.company];
        let free_rd = c.data_in(u.industry).map_or(0.0, |b| b.free_rd_fraction());
        let inputs = ProductivityInputs::with_stations(
            u.rd_plan,
            free_rd,
            industries[u.industry].params.rd_norm,
            c.management_score,
            &c.stations,
        );
        u.productivity = step_productivity(u.productivity, &inputs);
    }
}
