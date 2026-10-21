//! v_tech: `get_company_tech` (spec 9.2), the Company screen's Tech tab (spec 8): labor split,
//! stations, PC and the next bonus step, compute, and per industry the data quests card
//! (progress to the next free R&D step, inflow against conversion and decay; 10.0.11.7).
//! Rebuilt monthly and on load (spec 9.4).

use super::{Cadence, ViewData, ViewInput};
use crate::ops::compute::ComputeBill;
use crate::ops::data::{conversion_capacity, decay_rate, next_free_rd_tb};
use crate::ops::stations::{Stations, next_bonus_pc};
use crate::world::units::USD_PER_MILLION;
use crate::world::{CompanyId, IndustryId, Ordinal};

/// One company's data in one industry (spec 3.5 `data`, 5.9).
#[derive(Debug, Clone, PartialEq)]
pub struct TechData {
    pub industry: IndustryId,
    /// Unstructured TB not yet converted, and how many monthly buckets hold it (at most 12).
    pub unstructured_tb: f64,
    pub buckets: usize,
    /// Structured held TB.
    pub held_tb: f64,
    /// Free R&D percent in force, and whether a drop is waiting out its 1-month grace.
    pub free_rd_pct: u32,
    pub grace: bool,
    /// Held TB at which the next free R&D step starts (the progress bar's end).
    pub next_step_tb: f64,
    /// Unstructured TB a month from last month's revenue (5.9 step 2).
    pub inflow_tb: f64,
    /// TB a month the stations convert at most (5.9 step 3; the main industry's book).
    pub conversion_tb: f64,
    /// TB a month held data loses at its current level (5.9 step 4).
    pub decay_tb: f64,
}

/// One company's Tech tab.
#[derive(Debug, Clone, PartialEq)]
pub struct TechRow {
    pub company: CompanyId,
    pub labor_units: u64,
    /// The labor split: productivity, enterprise, 50/50, research, idle (spec 3.5).
    pub stations: Stations,
    /// Productive compute and its bonus (spec 5.8), and the PC at which the next step starts.
    pub pc: f64,
    pub pc_bonus: f64,
    pub next_bonus_pc: f64,
    /// Extra base compute, data compute, licences and the month's bill (spec 3.8).
    pub compute: ComputeBill,
    pub data: Vec<TechData>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct TechView {
    /// Every company in company id order.
    pub companies: Vec<TechRow>,
}

impl TechView {
    /// `get_company_tech(id)`.
    pub fn get(&self, id: CompanyId) -> Option<&TechRow> {
        self.companies.get(id.index())
    }
}

impl ViewData for TechView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let companies = w
            .companies
            .iter()
            .map(|(id, c)| {
                let capacity = conversion_capacity(&c.stations);
                let data = c
                    .data
                    .iter()
                    .map(|d| {
                        let p = &w.industries[d.industry].params;
                        let revenue: f64 = c
                            .units
                            .iter()
                            .map(|&u| &w.units[u])
                            .filter(|u| u.industry == d.industry)
                            .map(|u| u.revenue_m)
                            .sum();
                        let b = &d.book;
                        TechData {
                            industry: d.industry,
                            unstructured_tb: b.unstructured_tb(),
                            buckets: b.unstructured.len(),
                            held_tb: b.held,
                            free_rd_pct: b.free_rd_pct,
                            grace: b.grace,
                            next_step_tb: next_free_rd_tb(b.free_rd_pct),
                            inflow_tb: revenue / USD_PER_MILLION * p.data_tb_per_musd,
                            conversion_tb: if d.industry == c.industry {
                                capacity
                            } else {
                                0.0
                            },
                            decay_tb: b.held * decay_rate(b.held, p.data_decay_base),
                        }
                    })
                    .collect();
                TechRow {
                    company: id,
                    labor_units: c.labor_units,
                    stations: c.stations,
                    pc: c.pc,
                    pc_bonus: c.pc_bonus,
                    next_bonus_pc: next_bonus_pc(c.pc_bonus as u32),
                    compute: c.compute,
                    data,
                }
            })
            .collect();
        TechView { companies }
    }
}

impl TechRow {
    /// TB stored (held plus unstructured) over all industries, as 3.8's data compute counts it.
    pub fn stored_tb(&self) -> f64 {
        self.data.iter().map(|d| d.held_tb + d.unstructured_tb).sum()
    }
}
