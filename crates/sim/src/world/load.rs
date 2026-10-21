//! Builds the [`World`] tables from the loaded CSV rows (spec 7, build-plan 2.3). This is the one
//! place CSV units become sim units ([`super::units`]). Rows are sorted by their CSV id so
//! ordinals are in id order (D4); references between tables become ordinal ids.

use std::collections::BTreeMap;

use sim_data::WorldData;
use thiserror::Error;

use super::World;
use super::economy::{AiBoom, AiSchedule, AiStage, GlobalCycle};
use super::entities::{
    BusinessUnit, Character, Company, CompanyData, Country, Industry, IndustryParams, PhaseLabel,
    Province, Zone,
};
use super::ids::{CharacterId, CompanyId, IndustryId, Ordinal, ProvinceId, UnitId};
use super::table::Table;
use super::units::{fraction_from_bps, shares_from_csv, usd_from_billions, usd_from_millions};
use crate::ai::archetype::Archetype;
use crate::economy::ai_boom::{POP_BASE_YEAR, boom_date};
use crate::economy::assets::placeholder_plan;
use crate::economy::cycle::{START_PHASE, z_avg};
use crate::economy::start::{
    START_PRODUCTIVITY, enterprise_share, fixed_cost_rate_at_load, shared_costs_at_load_hook,
    start_loadout,
};
use crate::economy::supply::fringe_assets_at_load;
use crate::finance::rating::Rating;
use crate::finance::state::CompanyFinance;
use crate::market::state::{MarketState, Stock};
use crate::ops::compute::compute_bill;
use crate::ops::data::{DataBook, DataParams, conversion_capacity};
use crate::ops::labor::{fit_stations, labor_units};
use crate::ops::stations::productive_compute;
use crate::people::board::Skills;
use crate::people::names::NameBooks;
use crate::people::traits::Trait;
use crate::time::{Date, DateTime};

/// A row that cannot be turned into sim state. `sim_data::check` catches all of these first on
/// good data; this guards a `Sim` built from unchecked rows.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum LoadError {
    #[error("{table}: id `{key}` appears twice")]
    Duplicate { table: &'static str, key: String },
    #[error("{table} `{key}`: {field} `{value}` is not a known {target}")]
    MissingRef {
        table: &'static str,
        key: String,
        field: &'static str,
        value: String,
        target: &'static str,
    },
    #[error("{table} `{key}`: {message}")]
    BadValue {
        table: &'static str,
        key: String,
        message: String,
    },
}

/// Id lookup used only while loading (never iterated).
struct Keys<I>(BTreeMap<String, I>);

impl<I: Ordinal> Keys<I> {
    fn new<'a>(
        table: &'static str,
        keys: impl Iterator<Item = &'a str>,
    ) -> Result<Self, LoadError> {
        let mut map = BTreeMap::new();
        for (i, k) in keys.enumerate() {
            if map.insert(k.to_owned(), I::from_index(i)).is_some() {
                return Err(LoadError::Duplicate {
                    table,
                    key: k.to_owned(),
                });
            }
        }
        Ok(Self(map))
    }

    fn get(
        &self,
        table: &'static str,
        key: &str,
        field: &'static str,
        value: &str,
        target: &'static str,
    ) -> Result<I, LoadError> {
        self.0
            .get(value)
            .copied()
            .ok_or_else(|| LoadError::MissingRef {
                table,
                key: key.to_owned(),
                field,
                value: value.to_owned(),
                target,
            })
    }
}

/// Rows sorted by their id (D4).
fn sorted_by<'a, T>(rows: impl Iterator<Item = &'a T>, key: impl Fn(&T) -> &str) -> Vec<&'a T> {
    let mut v: Vec<&T> = rows.collect();
    v.sort_by(|a, b| key(a).cmp(key(b)));
    v
}

/// The start state's tables (spec 7) with the clock at 2020-01-01 00:00 (spec 3.1, 7.3).
pub fn build_world(data: &WorldData) -> Result<World, LoadError> {
    // Zones (spec 3.2.1).
    let zone_rows = sorted_by(data.financial_zones.rows.iter(), |z| &z.zone_id);
    let zone_keys = Keys::new(
        "financial-zones",
        zone_rows.iter().map(|z| z.zone_id.as_str()),
    )?;
    let mut zones: Table<_, Zone> = Table::from_rows(
        zone_rows
            .iter()
            .map(|z| Zone {
                key: z.zone_id.clone(),
                number: z.number,
                name: z.name.clone(),
                exchange_code: z.exchange_code.clone(),
                exchange_name: z.exchange.clone(),
                headline_index: z.headline_index.clone(),
                hub_city: z.hub_city.clone(),
                // Set once the provinces are loaded, below.
                hub_province: ProvinceId::from_index(0),
                intensity: z.intensity,
                lag_quarters: z.lag_quarters,
                contagion: z.contagion,
                own_shock_sd: z.own_shock_sd,
                gdp_usd: 0.0,
                gdp_share: 0.0,
                credit_spread_base: fraction_from_bps(z.credit_spread_bps),
                credit_spread: fraction_from_bps(z.credit_spread_bps),
                own_shock: 0.0,
                effect: 0.0,
                confidence_start: z.confidence_start,
                confidence: z.confidence_start,
            })
            .collect(),
    );

    // Countries (spec 3.2), joined with country-economy.csv.
    let economy: BTreeMap<&str, &sim_data::CountryEconomy> = data
        .country_economy
        .rows
        .iter()
        .map(|e| (e.iso3.as_str(), e))
        .collect();
    let country_rows = sorted_by(data.countries.rows.iter(), |c| &c.iso3);
    let country_keys = Keys::new("countries", country_rows.iter().map(|c| c.iso3.as_str()))?;
    let mut countries = Vec::with_capacity(country_rows.len());
    for c in &country_rows {
        let econ = economy
            .get(c.iso3.as_str())
            .ok_or_else(|| LoadError::BadValue {
                table: "countries",
                key: c.iso3.clone(),
                message: "no country-economy.csv row".into(),
            })?;
        countries.push(Country {
            key: c.iso3.clone(),
            name: c.name.clone(),
            zone: zone_keys.get(
                "country-economy",
                &c.iso3,
                "financial_zone",
                &econ.financial_zone,
                "zone",
            )?,
            gdp_usd: usd_from_billions(c.gdp_usd_bn),
            sovereign_spread: fraction_from_bps(econ.sovereign_spread_bps),
            corp_tax_rate: econ.corp_tax_rate,
            sovereign_rating: Rating::parse(&econ.sovereign_rating).ok_or_else(|| {
                LoadError::BadValue {
                    table: "country-economy",
                    key: c.iso3.clone(),
                    message: format!(
                        "sovereign_rating `{}` is not on the AAA to CC scale",
                        econ.sovereign_rating
                    ),
                }
            })?,
        });
    }

    // Zone GDP aggregates and Z (spec 3.2.1, 5.1), summed over the members in id order.
    for c in &countries {
        zones[c.zone].gdp_usd += c.gdp_usd;
    }
    let world_gdp: f64 = countries.iter().map(|c| c.gdp_usd).sum();
    for (_, z) in zones.iter_mut() {
        z.gdp_share = if world_gdp > 0.0 {
            z.gdp_usd / world_gdp
        } else {
            0.0
        };
    }
    let z_avg = z_avg(
        countries
            .iter()
            .map(|c| (c.gdp_usd, zones[c.zone].intensity)),
    );
    let max_lag = zones.iter().map(|(_, z)| z.lag_quarters).max().unwrap_or(0);

    // Provinces (spec 3.3), all 8 files.
    let province_rows = sorted_by(data.all_provinces().map(|(_, _, p)| p), |p| &p.id);
    let province_keys = Keys::new("provinces", province_rows.iter().map(|p| p.id.as_str()))?;
    let mut provinces = Vec::with_capacity(province_rows.len());
    for p in &province_rows {
        provinces.push(Province {
            key: p.id.clone(),
            name: p.name.clone(),
            country: country_keys.get("provinces", &p.id, "country", &p.country, "country")?,
        });
    }

    // Each exchange's hub province (financial-zones.csv `hub_province`).
    for (z, row) in zones.iter_mut().zip(&zone_rows) {
        z.1.hub_province = province_keys.get(
            "financial-zones",
            &row.zone_id,
            "hub_province",
            &row.hub_province,
            "province",
        )?;
    }

    // Industries (spec 3.4). companies.csv names its industry by name, not slug.
    let industry_rows = sorted_by(data.industries.rows.iter(), |i| &i.id);
    Keys::<crate::world::IndustryId>::new(
        "industries",
        industry_rows.iter().map(|i| i.id.as_str()),
    )?;
    let industry_by_name = Keys::new("industries", industry_rows.iter().map(|i| i.name.as_str()))?;
    let mut industries: Table<IndustryId, Industry> = Table::from_rows(
        industry_rows
            .iter()
            .map(|i| {
                let world_size = usd_from_billions(i.world_size_2020_usd_bn);
                Industry {
                    key: i.id.clone(),
                    name: i.name.clone(),
                    sector: i.sector.clone(),
                    asset_label: i.asset_label.clone(),
                    world_size_2020_usd: world_size,
                    params: industry_params(i),
                    lt: i.trend_growth,
                    prev_lt: i.trend_growth,
                    // Demand starts at the 2020 world size (spec 7.3).
                    trend_demand: world_size,
                    demand_core: world_size,
                    demand: world_size,
                    q_growth: 0.0,
                    prev_q_growth: 0.0,
                    carry_reset: false,
                    phase_label: PhaseLabel::Normal,
                    fringe_assets: 0.0,
                    supply: 0.0,
                    supply_ratio: 1.0,
                    market_factor: 1.0,
                    fringe_revenue_m: 0.0,
                    history: Vec::new(),
                }
            })
            .collect(),
    );

    // Full characters (spec 3.7.2): all 296 (decision D11), with the skills, traits, age, cash
    // and home province the MVP reads. Traits outside the 12 pairs are dropped (D113).
    let character_rows = sorted_by(data.characters.rows.iter(), |c| &c.id);
    let character_keys =
        Keys::<CharacterId>::new("characters", character_rows.iter().map(|c| c.id.as_str()))?;
    let mut characters = Vec::with_capacity(character_rows.len());
    for c in &character_rows {
        characters.push(Character {
            key: c.id.clone(),
            name: c.name.clone(),
            tier: c.tier.clone(),
            age: c.age,
            skills: Skills {
                finance: c.finance,
                operations: c.operations,
                persuasion: c.persuasion,
                intrigue: c.intrigue,
                tech: c.tech,
                hustle: c.hustle,
            },
            traits: c
                .traits
                .iter()
                .filter_map(|t| Trait::from_name(t.trim()))
                .collect(),
            home_province: province_keys.get(
                "characters",
                &c.id,
                "origin_province",
                &c.origin_province,
                "province",
            )?,
            cash_usd: c.cash_usd,
        });
    }
    let characters = Table::from_rows(characters);

    // Name books per country, in country id order (spec 3.7.1; D203), built once here.
    let name_books =
        NameBooks::build(data, country_rows.iter().map(|c| c.iso3.as_str())).map_err(|e| {
            LoadError::BadValue {
                table: "names",
                key: e.0,
                message: "no name list for the country's culture".into(),
            }
        })?;

    // Companies (spec 3.5), joined with company-start.csv.
    let starts: BTreeMap<&str, &sim_data::CompanyStart> = data
        .company_start
        .rows
        .iter()
        .map(|s| (s.id.as_str(), s))
        .collect();
    let company_rows = sorted_by(data.companies.rows.iter(), |c| &c.id);
    Keys::<crate::world::CompanyId>::new("companies", company_rows.iter().map(|c| c.id.as_str()))?;
    let mut companies = Vec::with_capacity(company_rows.len());
    let mut stocks = Vec::with_capacity(company_rows.len());
    let mut units = Vec::with_capacity(company_rows.len());
    let mut named_revenue = vec![0.0; industries.len()];
    for c in &company_rows {
        let bad = |message: String| LoadError::BadValue {
            table: "companies",
            key: c.id.clone(),
            message,
        };
        let start = starts
            .get(c.id.as_str())
            .ok_or_else(|| bad("no company-start.csv row".into()))?;
        let industry: IndustryId =
            industry_by_name.get("companies", &c.id, "industry", &c.industry, "industry")?;
        let hq_province = province_keys.get(
            "companies",
            &c.id,
            "hq_province",
            &c.hq_province,
            "province",
        )?;
        let revenue = usd_from_millions(c.revenue_usd_m);
        named_revenue[industry.index()] += revenue;
        let params = &industries[industry].params;
        // The unit (spec 3.6, 7.1): gross assets and book from company-start.csv, productivity
        // 100, no ramping, location bonus 0 (the MVP defaults have no fit or resource tags, 5.4).
        let location_bonus = 0.0;
        let gross = start.gross_assets_usd;
        let (growth_plan, rd_plan) = placeholder_plan(params);
        // The 7.1 loadout (lane F's one implementation): labor units from the loaded gross
        // assets, the loadout's stations fitted to them (a no-op on today's data, D208), the
        // starting data (5.9) and the compute bill (3.8) that the fixed cost rate leaves room for.
        let loadout = start_loadout(&c.id, revenue, location_bonus, params);
        let labor = labor_units(gross, params.labor_value_usd);
        let stations = fit_stations(loadout.stations, labor);
        let book = DataBook::at_load(
            revenue,
            DataParams {
                tb_per_musd: params.data_tb_per_musd,
                decay_base: params.data_decay_base,
            },
            conversion_capacity(&stations),
            enterprise_share(&c.id),
        );
        let compute = compute_bill(&stations, book.stored_tb());
        let unit_id = UnitId::from_index(units.len());
        units.push(BusinessUnit {
            company: CompanyId::from_index(companies.len()),
            industry,
            base_province: hq_province,
            gross_assets: gross,
            ramping: Vec::new(),
            asset_book: start.asset_book_usd,
            productivity: START_PRODUCTIVITY,
            location_bonus,
            fixed_cost_rate: fixed_cost_rate_at_load(
                gross,
                shared_costs_at_load_hook(&compute),
                params,
            ),
            growth_plan,
            rd_plan,
            revenue_m: 0.0,
            variable_m: 0.0,
            fixed_m: 0.0,
            rd_m: 0.0,
            dep_m: 0.0,
            shared_m: 0.0,
            capex_m: 0.0,
            sale_proceeds_m: 0.0,
            sale_gain_m: 0.0,
        });
        let controller = character_keys.0.get(c.controller.as_str()).copied();
        let archetype = Archetype::at_load(
            &c.control_basis,
            revenue,
            &industries[industry].sector,
            controller.map_or(&[][..], |ch| &characters[ch].traits[..]),
        );
        let hq_country =
            country_keys.get("companies", &c.id, "hq_country", &c.hq_country, "country")?;
        // A listed company lists on its HQ country's zone exchange at company-start.csv's
        // open_price (spec 5.14, 7.1; D145); `market::start` sets its value.
        let exchange = c.public.then_some(countries[hq_country.index()].zone);
        let shares_out = shares_from_csv(start.shares).map_err(bad)?;
        stocks.push(Stock::at_load(
            exchange,
            if c.public { start.open_price } else { 0.0 },
            shares_out,
        ));
        companies.push(Company {
            key: c.id.clone(),
            name: c.name.clone(),
            ticker: c.ticker.clone(),
            industry,
            hq_country,
            hq_province,
            public: c.public,
            revenue_usd: revenue,
            shares_out,
            units: vec![unit_id],
            controller,
            labor_units: labor,
            stations,
            pc: productive_compute(&stations, params.pc_modifier),
            pc_bonus: f64::from(loadout.load_bonus()),
            compute,
            data: vec![CompanyData { industry, book }],
            // Seated by `people::seating::start`, which draws (spec 3.7.1, 7.1).
            board: Default::default(),
            seats_to_fill: Vec::new(),
            management_score: 0.0,
            archetype,
            // Cash, line and starting rating as company-start.csv has them (spec 7.1, D241);
            // the limit and history are set by `finance::start` once the load month exists.
            cash_usd: start.cash_usd,
            finance: CompanyFinance::at_load(
                start.credit_drawn_usd,
                Rating::parse(&start.start_rating).ok_or_else(|| {
                    bad(format!(
                        "start_rating `{}` is not on the AAA to CC scale",
                        start.start_rating
                    ))
                })?,
            ),
        });
    }
    // Fringe pools (spec 5.3, 7.2): what named revenue leaves of the 2020 world size.
    for (id, ind) in industries.iter_mut() {
        ind.fringe_assets = fringe_assets_at_load(
            ind.world_size_2020_usd,
            named_revenue[id.index()],
            ind.params.asset_turnover,
        );
    }

    let schedule = ai_schedule(data)?;
    Ok(World {
        clock: DateTime::START,
        zones,
        countries: Table::from_rows(countries),
        provinces: Table::from_rows(provinces),
        industries,
        companies: Table::from_rows(companies),
        characters,
        units: Table::from_rows(units),
        base_rate: BASE_RATE,
        neutral_rate: NEUTRAL_RATE,
        // `economy::start` makes the cycle's draws (spec 7.3); until then g is 0.
        cycle: GlobalCycle {
            phase: START_PHASE,
            quarters_left: 0,
            g_t: 0.0,
            g_history: vec![0.0; max_lag as usize + 1],
            z_avg,
        },
        ai: AiBoom {
            stage: AiStage::Preboom,
            boom_date: boom_date(),
            // Rolled by `economy::start` (spec 5.1.1).
            pop_date: Date::ymd(POP_BASE_YEAR, 1, 1),
            ai_labs_lt: schedule.preboom_lt,
            schedule,
        },
        name_books,
        simple_characters_made: 0,
        books_check: Default::default(),
        market: MarketState {
            stocks: Table::from_rows(stocks),
            // Set by `market::start` at the listed caps (spec 5.14).
            indices: Table::default(),
        },
    })
}

/// World base rate, fixed in the MVP (spec 3.1, T).
pub const BASE_RATE: f64 = 0.03;
/// Neutral rate (spec 3.1, T).
pub const NEUTRAL_RATE: f64 = 0.03;

/// The industries.csv tuning columns (spec 2.2).
fn industry_params(i: &sim_data::Industry) -> IndustryParams {
    IndustryParams {
        trend_growth: i.trend_growth,
        cycle_beta: i.cycle_beta,
        volatility: i.volatility,
        boom_uplift: i.boom_uplift,
        crash_drop: i.crash_drop,
        rate_sensitivity: i.rate_sensitivity,
        margin_full_use: i.margin_full_use,
        fixed_cost_share: i.fixed_cost_share,
        variable_cost_share: i.variable_cost_share,
        capital_per_dollar: i.capital_per_dollar,
        asset_turnover: i.asset_turnover,
        asset_decay: i.asset_decay,
        asset_decay_threshold_usd: i.asset_decay_threshold_usd,
        rd_norm: i.rd_norm,
        labor_value_usd: i.labor_value_usd,
        pc_modifier: i.pc_modifier,
        data_tb_per_musd: i.data_tb_per_musd,
        data_decay_base: i.data_decay_base,
        cash_burning: i.cash_burning,
        earnings_multiple: i.earnings_multiple,
    }
}

/// AI labs' long-term rate by stage from ai-boom.csv (spec 5.1.1): one preboom, bust and
/// postcrash row each, and the boom rows by boom year 0, 1, 2... with no gap.
fn ai_schedule(data: &WorldData) -> Result<AiSchedule, LoadError> {
    let bad = |key: &str, message: &str| LoadError::BadValue {
        table: "ai-boom",
        key: key.to_owned(),
        message: message.to_owned(),
    };
    let rate = |stage: &str| -> Result<f64, LoadError> {
        let mut rows = data.ai_boom.rows.iter().filter(|r| r.stage == stage);
        let row = rows.next().ok_or_else(|| bad(stage, "no row"))?;
        if rows.next().is_some() {
            return Err(bad(stage, "more than one row"));
        }
        row.ai_labs_lt.ok_or_else(|| bad(stage, "no ai_labs_lt"))
    };
    let mut boom: Vec<(u32, f64)> = Vec::new();
    for r in data.ai_boom.rows.iter().filter(|r| r.stage == "boom") {
        let year = r
            .boom_year
            .ok_or_else(|| bad("boom", "a boom row has no boom_year"))?;
        let lt = r
            .ai_labs_lt
            .ok_or_else(|| bad("boom", "a boom row has no ai_labs_lt"))?;
        boom.push((year, lt));
    }
    boom.sort_by_key(|&(y, _)| y);
    if boom.is_empty() || boom.iter().enumerate().any(|(i, &(y, _))| y as usize != i) {
        return Err(bad("boom", "boom years must run 0, 1, 2... with no gap"));
    }
    Ok(AiSchedule {
        preboom_lt: rate("preboom")?,
        boom_lt: boom.into_iter().map(|(_, lt)| lt).collect(),
        bust_lt: rate("bust")?,
        postcrash_lt: rate("postcrash")?,
    })
}
