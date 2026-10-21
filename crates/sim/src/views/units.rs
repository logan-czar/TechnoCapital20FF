//! v_units: `get_company_units` (spec 9.2), the Company screen's Units tab (spec 8): industry,
//! base province, assets, productivity, growth, R&D, revenue and expenses of every business
//! unit. Rebuilt monthly, at the plan lock and on load (spec 9.4), and when Omniscient is
//! toggled (D423). A private company's or new listing's unit money figures are estimate bands
//! (D420); productivity, growth and R&D plans are operations, shown exactly.

use super::estimate::{Field, Figure};
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
    pub gross_assets: Figure,
    pub asset_book: Figure,
    /// Gross assets less the 20% shortfall of ramping tranches (spec 5.2).
    pub assets_eff: Figure,
    /// 30 to 200 (spec 5.6).
    pub productivity: f64,
    /// `productivity + PC bonus + location bonus` (spec 5.2).
    pub p_pre: f64,
    /// The locked plan's annual growth rate and R&D share of revenue (spec 3.6).
    pub growth_plan: f64,
    pub rd_plan: f64,
    pub revenue_m: Figure,
    pub variable_m: Figure,
    pub fixed_m: Figure,
    pub rd_m: Figure,
    pub dep_m: Figure,
    /// The 3.8 compute and licences, split by revenue share (spec 5.5).
    pub shared_m: Figure,
    /// Revenue less every 5.5 line.
    pub ebit_m: Figure,
    /// Asset purchases at cost (spec 5.10).
    pub capex_m: Figure,
    /// The figures are estimate bands (D420).
    pub estimated: bool,
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
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let units = w
            .units
            .iter()
            .map(|(id, u)| {
                let c = &w.companies[u.company];
                let banded = est.banded(w, u.company);
                let fig = |field, truth| est.current(banded, u.company, field, truth);
                UnitRow {
                    id,
                    company: u.company,
                    industry: u.industry,
                    base_province: u.base_province,
                    gross_assets: fig(Field::UnitGrossAssets, u.gross_assets),
                    asset_book: fig(Field::UnitAssetBook, u.asset_book),
                    assets_eff: fig(Field::UnitAssetsEff, u.assets_eff()),
                    productivity: u.productivity,
                    p_pre: crate::economy::supply::p_pre(u, c),
                    growth_plan: u.growth_plan,
                    rd_plan: u.rd_plan,
                    revenue_m: fig(Field::UnitRevenue, u.revenue_m),
                    variable_m: fig(Field::UnitVariable, u.variable_m),
                    fixed_m: fig(Field::UnitFixed, u.fixed_m),
                    rd_m: fig(Field::UnitRd, u.rd_m),
                    dep_m: fig(Field::UnitDepreciation, u.dep_m),
                    shared_m: fig(Field::UnitShared, u.shared_m),
                    ebit_m: fig(Field::UnitEbit, u.ebit_m()),
                    capex_m: fig(Field::UnitCapex, u.capex_m),
                    estimated: banded,
                }
            })
            .collect();
        UnitsView { units }
    }
}
