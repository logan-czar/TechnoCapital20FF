//! v_units: `get_company_units` (spec 9.2), the Company screen's Units tab (spec 8): industry,
//! base province, assets, productivity, growth, R&D, revenue and expenses of every business
//! unit. Rebuilt monthly, at the plan lock and on load (spec 9.4), and when Omniscient is
//! toggled (D423). A private company's or new listing's unit money figures and productivity are
//! estimate bands (D420, D436), and so are a published company's in an estimated industry
//! (D432): its monthly revenue over its capacity would give the industry's M, and from it the
//! private companies' revenue (spec 1 publishes listed companies' quarterly statements, not
//! their units). Growth and R&D plans are shown exactly.

use super::estimate::{ESTIMATE_FLOOR_POINTS, Figure, Kind, StatementLine as L, Subject};
use super::industry_rows::{estimated_industries, unit_banded};
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
    /// 30 to 200 (spec 5.6); a band with the money figures (D436).
    pub productivity: Figure,
    /// `productivity + PC bonus + location bonus` (spec 5.2): the productivity band moved by
    /// the published bonuses (D430).
    pub p_pre: Figure,
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

/// A unit's last-month revenue as every view shows it (v_units, v_industry_detail, v_tech's
/// inflow, v_industry_row's total; D429): one estimate of the figure.
pub fn unit_revenue(
    est: &super::estimate::Estimator,
    banded: bool,
    u: &crate::world::BusinessUnit,
) -> Figure {
    revenue_figure(est, banded, u.company, u.revenue_m)
}

/// A company's last-month revenue `revenue_m` as shown (D429).
pub fn revenue_figure(
    est: &super::estimate::Estimator,
    banded: bool,
    company: CompanyId,
    revenue_m: f64,
) -> Figure {
    est.company_now(banded, company, Kind::Line(L::Revenue), revenue_m)
}

impl ViewData for UnitsView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let classes = estimated_industries(&est, w);
        let units = w
            .units
            .iter()
            .map(|(id, u)| {
                let c = &w.companies[u.company];
                let banded = unit_banded(&est, w, &classes, u.company, u.industry);
                let productivity = est.current(
                    banded,
                    Subject::Company(u.company),
                    Kind::Productivity,
                    u.productivity,
                    ESTIMATE_FLOOR_POINTS,
                );
                let bonuses = crate::economy::supply::p_pre(u, c) - u.productivity;
                let fig = |kind, truth| est.company_now(banded, u.company, kind, truth);
                UnitRow {
                    id,
                    company: u.company,
                    industry: u.industry,
                    base_province: u.base_province,
                    gross_assets: fig(Kind::GrossAssets, u.gross_assets),
                    asset_book: fig(Kind::Line(L::AssetBook), u.asset_book),
                    assets_eff: fig(Kind::AssetsEff, u.assets_eff()),
                    productivity,
                    p_pre: match productivity {
                        Figure::Exact(_) => Figure::Exact(crate::economy::supply::p_pre(u, c)),
                        Figure::Band(_) => productivity.map(|p| p + bonuses),
                    },
                    growth_plan: u.growth_plan,
                    rd_plan: u.rd_plan,
                    revenue_m: unit_revenue(&est, banded, u),
                    variable_m: fig(Kind::Line(L::Variable), u.variable_m),
                    fixed_m: fig(Kind::Line(L::FixedCash), u.fixed_m),
                    rd_m: fig(Kind::Line(L::Rd), u.rd_m),
                    dep_m: fig(Kind::Line(L::Depreciation), u.dep_m),
                    // The compute bill follows the published station counts (D434).
                    shared_m: Figure::Exact(u.shared_m),
                    ebit_m: fig(Kind::Line(L::Ebit), u.ebit_m()),
                    capex_m: fig(Kind::Line(L::AssetPurchases), u.capex_m),
                    estimated: banded,
                }
            })
            .collect();
        UnitsView { units }
    }
}
