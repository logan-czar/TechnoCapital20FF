//! v_units: `get_company_units` (spec 9.2), the Company screen's Units tab (spec 8): industry,
//! base province, assets, productivity, growth, R&D, revenue and expenses of every business
//! unit. Rebuilt monthly and on load (spec 9.4).

use super::{Cadence, ViewData, ViewInput};
use crate::world::{CompanyId, IndustryId, Ordinal, ProvinceId, UnitId};

/// One business unit (spec 3.6), its last month's figures in USD.
#[derive(Debug, Clone, PartialEq)]
pub struct UnitRow {
    pub id: UnitId,
    pub company: CompanyId,
    pub industry: IndustryId,
    pub base_province: ProvinceId,
    /// Business assets at cost and at book (spec 3.6).
    pub gross_assets: f64,
    pub asset_book: f64,
    /// Gross assets less the 20% shortfall of ramping tranches (spec 5.2).
    pub assets_eff: f64,
    /// 30 to 200 (spec 5.6).
    pub productivity: f64,
    /// `productivity + PC bonus + location bonus` (spec 5.2).
    pub p_pre: f64,
    /// The locked plan's annual growth rate and R&D share of revenue (spec 3.6).
    pub growth_plan: f64,
    pub rd_plan: f64,
    pub revenue_m: f64,
    pub variable_m: f64,
    pub fixed_m: f64,
    pub rd_m: f64,
    pub dep_m: f64,
    /// The 3.8 compute and licences, split by revenue share (spec 5.5).
    pub shared_m: f64,
    /// Revenue less every 5.5 line.
    pub ebit_m: f64,
    /// Asset purchases at cost (spec 5.10).
    pub capex_m: f64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct UnitsView {
    /// Every unit in unit id order.
    pub units: Vec<UnitRow>,
}

impl UnitsView {
    pub fn get(&self, id: UnitId) -> Option<&UnitRow> {
        self.units.get(id.index())
    }

    /// `get_company_units(id)`: the company's units in unit id order.
    pub fn of_company(&self, company: CompanyId) -> impl Iterator<Item = &UnitRow> {
        self.units.iter().filter(move |u| u.company == company)
    }
}

impl ViewData for UnitsView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let units = w
            .units
            .iter()
            .map(|(id, u)| {
                let c = &w.companies[u.company];
                UnitRow {
                    id,
                    company: u.company,
                    industry: u.industry,
                    base_province: u.base_province,
                    gross_assets: u.gross_assets,
                    asset_book: u.asset_book,
                    assets_eff: u.assets_eff(),
                    productivity: u.productivity,
                    p_pre: crate::economy::supply::p_pre(u, c),
                    growth_plan: u.growth_plan,
                    rd_plan: u.rd_plan,
                    revenue_m: u.revenue_m,
                    variable_m: u.variable_m,
                    fixed_m: u.fixed_m,
                    rd_m: u.rd_m,
                    dep_m: u.dep_m,
                    shared_m: u.shared_m,
                    ebit_m: u.ebit_m(),
                    capex_m: u.capex_m,
                }
            })
            .collect();
        UnitsView { units }
    }
}
