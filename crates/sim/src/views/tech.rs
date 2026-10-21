//! v_tech: `get_company_tech` (spec 9.2), the Company screen's Tech tab (spec 8): labor split,
//! stations, PC and the next bonus step, compute, and per industry the data quests card
//! (progress to the next free R&D step, inflow against conversion and decay; 10.0.11.7).
//! Rebuilt monthly and on load (spec 9.4), and when Omniscient is toggled (D423). A private
//! company's or new listing's data figures are bands: held, unstructured and decayed TB would
//! together give its monthly revenue away through the 5.9 steps (D431), and its inflow is
//! worked out from its revenue band. The stations, conversion capacity, free R&D step and the
//! compute bill follow the published station counts and stay exact (D434).

use super::estimate::{ESTIMATE_FLOOR_TB, Figure, Kind, Subject};
use super::industry_rows::{estimated_industries, unit_banded};
use super::units::unit_revenue;
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
    pub unstructured_tb: Figure,
    pub buckets: usize,
    /// Structured held TB.
    pub held_tb: Figure,
    /// Free R&D percent in force, and whether a drop is waiting out its 1-month grace.
    pub free_rd_pct: u32,
    pub grace: bool,
    /// Held TB at which the next free R&D step starts (the progress bar's end).
    pub next_step_tb: f64,
    /// Unstructured TB a month from last month's revenue (5.9 step 2); from the estimated
    /// revenue when the company's figures are bands (D420).
    pub inflow_tb: Figure,
    /// TB a month the stations convert at most (5.9 step 3; the main industry's book).
    pub conversion_tb: f64,
    /// TB a month held data loses at its current level (5.9 step 4).
    pub decay_tb: Figure,
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
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let classes = estimated_industries(&est, w);
        let companies = w
            .companies
            .iter()
            .map(|(id, c)| {
                // Bands for a company that does not publish, and for a published one in an
                // estimated industry: its data book would give its monthly revenue, so M (D436).
                let banded = unit_banded(&est, w, &classes, id, c.industry);
                let capacity = conversion_capacity(&c.stations);
                let data = c
                    .data
                    .iter()
                    .map(|d| {
                        let p = &w.industries[d.industry].params;
                        // The inflow is the revenue band times the TB rate (D430).
                        let revenue = Figure::sum(
                            c.units
                                .iter()
                                .map(|&u| &w.units[u])
                                .filter(|u| u.industry == d.industry)
                                .map(|u| unit_revenue(&est, banded, u)),
                        );
                        let b = &d.book;
                        let tb = |kind, truth| {
                            est.current(banded, Subject::Company(id), kind, truth, ESTIMATE_FLOOR_TB)
                        };
                        TechData {
                            industry: d.industry,
                            unstructured_tb: tb(Kind::UnstructuredTb, b.unstructured_tb()),
                            buckets: b.unstructured.len(),
                            held_tb: tb(Kind::HeldTb, b.held),
                            free_rd_pct: b.free_rd_pct,
                            grace: b.grace,
                            next_step_tb: next_free_rd_tb(b.free_rd_pct),
                            inflow_tb: revenue
                                .map(|r| r / USD_PER_MILLION * p.data_tb_per_musd),
                            conversion_tb: if d.industry == c.industry {
                                capacity
                            } else {
                                0.0
                            },
                            decay_tb: tb(
                                Kind::DecayTb,
                                b.held * decay_rate(b.held, p.data_decay_base),
                            ),
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
    /// TB stored (held plus unstructured) over all industries, as 3.8's data compute counts it;
    /// a band when the parts are (D430).
    pub fn stored_tb(&self) -> Figure {
        Figure::sum(self.data.iter().flat_map(|d| [d.held_tb, d.unstructured_tb]))
    }
}
