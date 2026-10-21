//! Row types of the world tables (spec 3). Each milestone adds the fields its sections need (and
//! they are saved and hashed with no extra code, since every row derives serde). M2 adds the
//! economy core: zone cycle settings and spreads, industry parameters, demand, supply and labels,
//! and business units with their assets and monthly figures.

use serde::{Deserialize, Serialize};

use super::ids::{CharacterId, CompanyId, CountryId, IndustryId, ProvinceId, UnitId, ZoneId};
use crate::ops::compute::ComputeBill;
use crate::ops::data::DataBook;
use crate::ops::stations::Stations;
use crate::people::board::{LABOR_SEAT_COUNT, Seat, Skills};
use crate::people::simple::SimpleCharacter;
use crate::people::traits::Trait;
use crate::time::Quarter;

/// A financial zone (spec 3.2.1), static in the MVP except its effective spread and confidence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Zone {
    /// financial-zones.csv `zone_id`.
    pub key: String,
    /// Logan's zone number, 1 to 26.
    pub number: u32,
    pub name: String,
    pub exchange_code: String,
    /// How hard the global cycle hits the zone, North America 1.0 (spec 5.1).
    pub intensity: f64,
    /// Quarters the zone lags the global cycle (spec 5.1).
    pub lag_quarters: u32,
    /// Share of a member's crisis that spills to the others; loaded, never fires in the MVP (5.1).
    pub contagion: f64,
    /// Standard deviation of the zone-only shock added to the zone effect each quarter, in the
    /// zone effect's units (a yearly rate; D102). 0 for zones with no own dynamics (spec 5.1).
    pub own_shock_sd: f64,
    /// Sum of the members' GDP, USD (spec 3.2.1).
    pub gdp_usd: f64,
    /// The zone's share of world GDP: a weight of Z (spec 5.1).
    pub gdp_share: f64,
    /// Base credit spread as a fraction (CSV `credit_spread_bps`, spec 5.1.2).
    pub credit_spread_base: f64,
    /// Effective credit spread as a fraction, whole bps, recomputed each quarter (spec 5.1.2).
    pub credit_spread: f64,
    /// This quarter's zone-only shock (spec 5.1), 0 where `own_shock_sd` is 0.
    pub own_shock: f64,
    /// `intensity × g(t − lag) + own_shock`, a yearly rate (spec 5.1), set each quarter.
    pub effect: f64,
    /// Starting investor confidence, −100 to +100 (spec 5.1.2).
    pub confidence_start: f64,
    /// Investor confidence of the zone exchange, moved daily from M5 (spec 5.1.2).
    pub confidence: f64,
}

/// A country (spec 3.2), static.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Country {
    /// countries.csv `iso3`.
    pub key: String,
    pub name: String,
    /// country-economy.csv `financial_zone`.
    pub zone: ZoneId,
    /// GDP in USD (CSV `gdp_usd_bn`).
    pub gdp_usd: f64,
    /// Sovereign spread as a fraction (country-economy.csv `sovereign_spread_bps`, spec 5.1.2).
    pub sovereign_spread: f64,
}

/// A province (spec 3.3), static.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Province {
    /// provinces-*.csv `id`.
    pub key: String,
    pub name: String,
    pub country: CountryId,
}

/// The static industries.csv tuning values (spec 2.2), converted at load.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IndustryParams {
    /// The long-term growth rate a year before the AI boom (spec 5.1).
    pub trend_growth: f64,
    /// Multiplies the cycle term of the quarterly growth draw (spec 5.1).
    pub cycle_beta: f64,
    /// Standard deviation of the quarterly growth shock, per quarter (spec 5.1).
    pub volatility: f64,
    /// Share of the AI labs boom added to this industry's lt (spec 5.1.1).
    pub boom_uplift: f64,
    /// One-off demand cut at the pop (spec 5.1.1).
    pub crash_drop: f64,
    /// s of the rate term (spec 5.1).
    pub rate_sensitivity: f64,
    /// Margin before R&D at full use (spec 5.5).
    pub margin_full_use: f64,
    /// f, the fixed cost share of revenue (spec 5.5).
    pub fixed_cost_share: f64,
    /// v as given in the CSV; the engine uses `1 − margin_full_use − f` (spec 5.5).
    pub variable_cost_share: f64,
    pub capital_per_dollar: f64,
    /// Revenue per $1 of business assets a year at productivity 100 and M 1.0 (spec 5.2).
    pub asset_turnover: f64,
    /// Yearly decay rate on gross assets above the threshold (spec 5.10).
    pub asset_decay: f64,
    /// No decay on the first this many USD of a unit's gross assets (spec 5.10).
    pub asset_decay_threshold_usd: f64,
    pub rd_norm: f64,
    /// USD of gross assets per labor unit (spec 5.10).
    pub labor_value_usd: f64,
    pub pc_modifier: f64,
    pub data_tb_per_musd: f64,
    pub data_decay_base: f64,
    pub cash_burning: bool,
    pub earnings_multiple: f64,
}

/// Boom, Normal, Glut or Bust: a label read from q_growth and S, with no demand multiplier
/// (spec 5.1, C20).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum PhaseLabel {
    Boom,
    Normal,
    Glut,
    Bust,
}

impl PhaseLabel {
    pub fn name(self) -> &'static str {
        match self {
            PhaseLabel::Boom => "Boom",
            PhaseLabel::Normal => "Normal",
            PhaseLabel::Glut => "Glut",
            PhaseLabel::Bust => "Bust",
        }
    }
}

/// One closed quarter of an industry, for the industry screen's 20-quarter chart (spec 8, 9.2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IndustryQuarter {
    pub quarter: Quarter,
    /// Effective demand at the quarter's end, USD a year.
    pub demand: f64,
    /// Supply at the quarter's end, USD a year.
    pub supply: f64,
    /// The quarter's growth, per quarter.
    pub q_growth: f64,
    /// The quarter's long-term rate, a year.
    pub lt: f64,
}

/// An industry (spec 3.4).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Industry {
    /// industries.csv `id` (a slug).
    pub key: String,
    pub name: String,
    /// Tech, Finance, Energy, Industry, Consumer, Health or Services (spec 2.2).
    pub sector: String,
    /// Flavor label of the business assets (spec 2.2).
    pub asset_label: String,
    /// World demand in 2020, USD a year (CSV `world_size_2020_usd_bn`).
    pub world_size_2020_usd: f64,
    pub params: IndustryParams,
    /// This quarter's long-term rate a year: trend_growth plus the boom term (spec 5.1.1).
    pub lt: f64,
    /// Last quarter's lt (spec 5.1.1), read when the month closed on a quarter's first day
    /// belongs to the quarter before (D100).
    pub prev_lt: f64,
    /// Yearly demand on the long-term rate alone (spec 5.1), USD.
    pub trend_demand: f64,
    /// Yearly demand moved by the quarterly growth draws (spec 5.1), USD.
    pub demand_core: f64,
    /// Effective yearly demand after the rate term (spec 5.1), USD.
    pub demand: f64,
    /// This quarter's demand growth, per quarter (spec 5.1).
    pub q_growth: f64,
    /// Last quarter's demand growth, per quarter (spec 5.1).
    pub prev_q_growth: f64,
    /// Set by the boom and the pop: the next draw carries over from lt_q instead of last quarter's
    /// growth (spec 5.1.1 "sets prev_q_growth to its new lt_q"; D103).
    pub carry_reset: bool,
    pub phase_label: PhaseLabel,
    /// Fringe pool business assets (spec 5.3), USD at cost.
    pub fringe_assets: f64,
    /// Supply, USD a year (spec 5.2).
    pub supply: f64,
    /// S = supply ÷ demand (spec 5.2).
    pub supply_ratio: f64,
    /// M = clamp((1 ÷ S)^0.5, 0.7, 1.3) (spec 5.2).
    pub market_factor: f64,
    /// Last month's fringe revenue, USD (spec 5.3).
    pub fringe_revenue_m: f64,
    /// The last 20 closed quarters, oldest first (spec 8 Industries detail chart).
    pub history: Vec<IndustryQuarter>,
}

/// A corporation (spec 3.5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Company {
    /// companies.csv `id`.
    pub key: String,
    pub name: String,
    /// Empty for private companies.
    pub ticker: String,
    pub industry: IndustryId,
    pub hq_country: CountryId,
    pub hq_province: ProvinceId,
    pub public: bool,
    /// Starting revenue, USD a year (CSV `revenue_usd_m`).
    pub revenue_usd: f64,
    /// Shares outstanding (company-start.csv `shares`; u64, D3).
    pub shares_out: u64,
    /// Business units (spec 3.5; one in the MVP).
    pub units: Vec<UnitId>,
    /// The named controller when it is a full character (companies.csv `controller` holds a
    /// CH- id; spec 3.5, 6 "traits"); None for companies, states and the widely held.
    pub controller: Option<CharacterId>,
    /// Labor units L (spec 3.5, 5.10), recounted at 4.3 step 4.
    pub labor_units: u64,
    /// `labor_assignment` (spec 3.5): one station per labor unit, fitted to L at 4.3 step 4.
    pub stations: Stations,
    /// Productive compute (spec 5.8), set at 4.3 step 5.
    pub pc: f64,
    /// The stepped productive compute bonus (spec 5.8), corporation-wide. Set at load by the 7.1
    /// two-pass rule (D106); the monthly compute step (4.3 step 5) recounts it from the stations
    /// from the first month on.
    pub pc_bonus: f64,
    /// Extra base compute, data compute and licences with the month's bill (spec 3.5, 3.8), set
    /// at 4.3 step 5; the bill is the month's shared costs (5.5).
    pub compute: ComputeBill,
    /// Data per industry the company has units in (spec 3.5 `data`, 5.9), in industry id order.
    pub data: Vec<CompanyData>,
    /// The five labor seats in [`Seat::LABOR`] order (spec 3.7): None while closed (fewer labor
    /// units) or open and waiting for its character (4.3 step 11).
    pub board: [Option<SeatHolder>; LABOR_SEAT_COUNT],
    /// Seats opened by this month's recount (4.3 step 4) that get a simple character at step 11
    /// (spec 3.7.1, 5.10), in opening order.
    pub seats_to_fill: Vec<Seat>,
    /// 0 to 100 (spec 5.7), from the seated board each month (D115).
    pub management_score: f64,
    /// Cash, USD (company-start.csv `cash_usd`; settled monthly from M4, 4.3 step 13).
    pub cash_usd: f64,
    /// Credit line drawn, USD (company-start.csv `credit_drawn_usd`, spec 5.12).
    pub line_drawn_usd: f64,
}

/// New assets ramping at 80% (spec 5.10, 10.0.4).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tranche {
    /// USD at cost still ramping.
    pub amount: f64,
    /// Month closes left at 80%.
    pub months_left: u32,
}

/// A business unit (spec 3.6).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BusinessUnit {
    pub company: CompanyId,
    pub industry: IndustryId,
    pub base_province: ProvinceId,
    /// Business assets at cost (spec 3.6), USD.
    pub gross_assets: f64,
    pub ramping: Vec<Tranche>,
    /// Book value of the business assets, USD (spec 3.6).
    pub asset_book: f64,
    /// 30 to 200, starts 100 (spec 3.6, 5.6).
    pub productivity: f64,
    /// Fit and resource points (spec 5.4); 0 in the MVP while industries use the defaults.
    pub location_bonus: f64,
    /// Fixed cash cost per $1 of gross assets a year, set at load (spec 5.5, 7.1).
    pub fixed_cost_rate: f64,
    /// Annual net growth rate g from the locked plan (spec 5.10, 6.2).
    pub growth_plan: f64,
    /// R&D spend as a share of revenue from the locked plan (spec 5.5, 6.3).
    pub rd_plan: f64,
    /// Last month's revenue, USD (spec 5.4).
    pub revenue_m: f64,
    /// Last month's variable cost, USD (spec 5.5).
    pub variable_m: f64,
    /// Last month's fixed cash cost, USD (spec 5.5).
    pub fixed_m: f64,
    /// Last month's R&D spend, USD (spec 5.5).
    pub rd_m: f64,
    /// Last month's depreciation, USD (spec 5.5).
    pub dep_m: f64,
    /// Last month's shared costs, USD (spec 5.5; 0 until M3 adds the 3.8 compute costs).
    pub shared_m: f64,
    /// Last month's asset purchases at cost, USD (spec 5.10); paid at the cash settle (4.3 step 13).
    pub capex_m: f64,
    /// Last month's cash from asset sales, USD (spec 5.10).
    pub sale_proceeds_m: f64,
    /// Last month's gain (or loss, below 0) on asset sales, USD (spec 5.10).
    pub sale_gain_m: f64,
}

impl BusinessUnit {
    /// `assets_eff = gross_assets − 0.2 × ramping`: new assets work at 80% (spec 5.2, 10.0.4).
    pub fn assets_eff(&self) -> f64 {
        let ramping: f64 = self.ramping.iter().map(|t| t.amount).sum();
        self.gross_assets - crate::economy::assets::RAMP_SHORTFALL * ramping
    }

    /// Operating costs: variable plus fixed cash (spec 3.6 `opex_m`).
    pub fn opex_m(&self) -> f64 {
        self.variable_m + self.fixed_m
    }

    /// Last month's EBIT: revenue less every 5.5 line.
    pub fn ebit_m(&self) -> f64 {
        self.revenue_m - self.variable_m - self.fixed_m - self.rd_m - self.dep_m - self.shared_m
    }
}

impl Company {
    /// The holder of a labor seat, if the seat is open and filled.
    pub fn seat(&self, seat: Seat) -> Option<&SeatHolder> {
        let i = Seat::LABOR.iter().position(|&s| s == seat)?;
        self.board[i].as_ref()
    }

    /// The data of one industry, if the company has units in it.
    pub fn data_in(&self, industry: IndustryId) -> Option<&DataBook> {
        self.data
            .iter()
            .find(|d| d.industry == industry)
            .map(|d| &d.book)
    }
}

/// One corporation's data in one industry (spec 3.5 `data`, 5.9).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompanyData {
    pub industry: IndustryId,
    pub book: DataBook,
}

/// A simple character seated on a board (spec 3.7.1), with its id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SimpleSeat {
    /// Spec 3.7.1 `id`: the order it was generated in, from 0 (`World::simple_characters_made`).
    pub id: u32,
    pub character: SimpleCharacter,
}

/// Who holds a labor seat (spec 3.7): a simple character (3.7.1), or a full character a startup
/// event seated (3.7.2, 5.19.4; from M6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SeatHolder {
    Simple(SimpleSeat),
    Full(CharacterId),
}

/// A full character (spec 3.7.2): the 296 of characters.csv (D11) and, from M6, those made in
/// play. The MVP keeps what it reads: skills and traits for the management score, rolls and the
/// Lite AI's trait nudges.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Character {
    /// characters.csv `id`.
    pub key: String,
    pub name: String,
    /// player, rival or holder from characters.csv; generated for those made in play (3.7.2).
    pub tier: String,
    pub age: u8,
    pub skills: Skills,
    /// Traits of the 12 pairs (1-corporate-core 1.1.2). characters.csv's unique traits and perks
    /// outside the pairs (such as "Operational Excellence") are dropped at load (D113).
    pub traits: Vec<Trait>,
    /// characters.csv `origin_province` (spec 3.7.2 home province).
    pub home_province: ProvinceId,
    pub cash_usd: f64,
}
