//! Temporary; deleted when company views land (M9).
//!
//! Demo rows from the starting data (sim-data) for the table widget and the watchlist, until the
//! sim's company, quote and province views exist (D307): the 3,255 provinces for the home screen,
//! the 651 companies for Pdoomberg F2, and company names by ordinal for the watchlist and alert
//! payloads. This is the only UI file that reads sim-data.
//!
//! Information (spec 1): Pdoomberg shows published data only, so a private company's revenue,
//! estimated value and controller stake are "?" ([`DemoTables::companies`]). The true values are
//! in [`DemoTables::companies_true`], shown only while Omniscient is on (debug builds).

use std::sync::Arc;

use bevy::prelude::*;
use sim::world::CompanyId;

use crate::table::{Cell, Column, TableModel};

/// The demo tables.
#[derive(Resource, Clone)]
pub struct DemoTables {
    pub provinces: Arc<TableModel>,
    /// Companies as published: private companies' figures are "?".
    pub companies: Arc<TableModel>,
    /// Companies with every true value (Omniscient only).
    pub companies_true: Arc<TableModel>,
    /// Company names by ordinal (ascending CSV id, D4).
    pub company_names: Vec<String>,
}

impl Default for DemoTables {
    fn default() -> Self {
        let empty = Arc::new(TableModel::new(Vec::new(), Vec::new()));
        DemoTables {
            provinces: Arc::clone(&empty),
            companies: Arc::clone(&empty),
            companies_true: empty,
            company_names: Vec::new(),
        }
    }
}

impl DemoTables {
    /// A company's display name, or its ordinal when the name is not known.
    pub fn company_name(&self, id: CompanyId) -> String {
        self.company_names
            .get(id.0 as usize)
            .cloned()
            .unwrap_or_else(|| format!("Company #{}", id.0))
    }

    /// The company table for the current Omniscient setting.
    pub fn companies_for(&self, omniscient: bool) -> &Arc<TableModel> {
        if omniscient {
            &self.companies_true
        } else {
            &self.companies
        }
    }
}

/// Column of the company table that holds revenue (the first figure hidden for private
/// companies).
pub const COMPANY_REVENUE_COL: usize = 5;

/// Builds the demo tables from the starting data.
pub fn demo_tables(data: &sim_data::WorldData) -> DemoTables {
    let mut provinces: Vec<_> = data.all_provinces().map(|(_, _, p)| p).collect();
    provinces.sort_by(|a, b| a.id.cmp(&b.id));
    let world_dev: f64 = provinces
        .iter()
        .map(|p| f64::from(p.commerce + p.industry + p.population))
        .sum();
    let rows = provinces
        .iter()
        .map(|p| {
            let dev = p.commerce + p.industry + p.population;
            vec![
                Cell::Text(p.id.clone()),
                Cell::Text(p.name.clone()),
                Cell::Text(p.country.clone()),
                if p.metro.is_empty() {
                    Cell::Unknown
                } else {
                    Cell::Text(p.metro.clone())
                },
                Cell::Int(i64::from(p.commerce)),
                Cell::Int(i64::from(p.industry)),
                Cell::Int(i64::from(p.population)),
                Cell::Int(i64::from(dev)),
                Cell::Percent(f64::from(dev) / world_dev),
            ]
        })
        .collect();
    let provinces = TableModel::new(
        vec![
            Column::text("Id", 90.0),
            Column::text("Name", 240.0),
            Column::text("Country", 70.0),
            Column::text("Metro", 110.0).with_hint("? where the province is in no Metro"),
            Column::number("Commerce", 80.0),
            Column::number("Industry", 80.0),
            Column::number("Pop", 60.0),
            Column::number("Dev", 60.0).with_hint("Commerce + Industry + Population"),
            Column::number("World %", 70.0).with_hint("Share of the world's development"),
        ],
        rows,
    );

    // Ordinal order is ascending CSV id (D4), so a row's index is its CompanyId.
    let mut companies: Vec<_> = data.companies.iter().map(|(_, c)| c).collect();
    companies.sort_by(|a, b| a.id.cmp(&b.id));
    let company_names = companies.iter().map(|c| c.name.clone()).collect();
    let rows = |published: bool| -> Vec<Vec<Cell>> {
        companies
            .iter()
            .map(|c| {
                // Spec 1, Information: a private company publishes nothing.
                let shown = c.public || !published;
                let money = |v: f64| {
                    if shown {
                        Cell::Money(v * 1e6)
                    } else {
                        Cell::Unknown
                    }
                };
                vec![
                    Cell::Text(if c.ticker.is_empty() {
                        "-".into()
                    } else {
                        c.ticker.clone()
                    }),
                    Cell::Text(c.name.clone()),
                    Cell::Text(c.industry.clone()),
                    Cell::Text(c.hq_country.clone()),
                    Cell::Text(if c.public { "yes" } else { "no" }.into()),
                    money(c.revenue_usd_m),
                    money(c.est_value_usd_m),
                    match c.controller_stake_pct {
                        Some(p) if shown => Cell::Percent(p / 100.0),
                        _ => Cell::Unknown,
                    },
                ]
            })
            .collect()
    };
    let columns = vec![
        Column::text("Ticker", 70.0),
        Column::text("Name", 240.0),
        Column::text("Industry", 170.0),
        Column::text("HQ", 50.0),
        Column::text("Listed", 60.0),
        Column::number("Revenue", 90.0).with_hint("? for private companies: nothing published"),
        Column::number("Est. value", 100.0).with_hint("? for private companies"),
        Column::number("Ctrl stake", 90.0)
            .with_hint("? for private companies and unpublished stakes"),
    ];
    DemoTables {
        provinces: Arc::new(provinces),
        companies: Arc::new(TableModel::new(columns.clone(), rows(true))),
        companies_true: Arc::new(TableModel::new(columns, rows(false))),
        company_names,
    }
}
