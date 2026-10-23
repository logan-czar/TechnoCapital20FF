//! v_map_layers: `get_map_layer(mode, param)` (spec 9.2, 8 Map row): a value per province
//! ordinal plus a legend, which the map writes into the shader's per-province colour table
//! (M8). Rebuilt monthly, at the plan lock and on load like the company views it shows (spec
//! 9.4 "v_map_layers (industry assets, HQs)"; D159), and when Omniscient is toggled (D423).
//!
//! The modes (spec 8 Map row; D700): Political (country, contested provinces hatched),
//! Development (Commerce, Industry, Population or Total), Industry (the Industry track, or a
//! picked industry's business assets by province), Company HQs (pins sized by revenue and
//! coloured by sector, filtered by industry, country and listing) and Financial zones (each
//! province shaded by its zone's current effect, a pin on each hub city). The view keeps what
//! is its own (countries, the shown unit assets, the HQ list); the zone mode also reads v_cycle
//! and v_exchanges, so [`crate::SimViews::get_map_layer`] serves every mode and
//! [`crate::SimViews::map_layer_versions`] names the views a mode reads.
//!
//! **Bands (D420).** A unit's assets and a company's revenue TTM are the figures v_units and
//! v_company_row show: a band's estimate (`Figure::shown`) for a company that does not publish,
//! never its truth, so neither a province's heat nor a pin's size can give a private figure
//! away (D701).

use super::company_rows::revenue_ttm;
use super::cycle::CycleView;
use super::estimate::{Figure, Kind};
use super::exchanges::ExchangesView;
use super::industry_rows::{estimated_industries, unit_banded};
use super::{Cadence, ViewData, ViewInput};
use crate::finance::distress::CompanyStatus;
use crate::world::{CompanyId, CountryId, IndustryId, Ordinal, ProvinceId, ZoneId};

/// A development track (spec 3.3), or their sum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub enum DevTrack {
    Commerce,
    Industry,
    Population,
    #[default]
    Total,
}

impl DevTrack {
    pub const ALL: [DevTrack; 4] = [
        DevTrack::Commerce,
        DevTrack::Industry,
        DevTrack::Population,
        DevTrack::Total,
    ];

    pub fn name(self) -> &'static str {
        match self {
            DevTrack::Commerce => "Commerce",
            DevTrack::Industry => "Industry",
            DevTrack::Population => "Population",
            DevTrack::Total => "Total",
        }
    }

    /// The track's top value: 30 a track, 90 for the total (spec 3.3).
    pub fn max(self) -> f64 {
        match self {
            DevTrack::Total => 3.0 * TRACK_MAX,
            _ => TRACK_MAX,
        }
    }
}

/// A development track's top value (spec 3.3: 1 to 30).
pub const TRACK_MAX: f64 = 30.0;

/// The Company HQs filters (spec 8: by industry, country, listed); `None` lets every one in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub struct HqFilter {
    pub industry: Option<IndustryId>,
    pub country: Option<CountryId>,
    /// `Some(true)` listed companies only, `Some(false)` private ones only.
    pub listed: Option<bool>,
}

impl HqFilter {
    pub fn admits(&self, h: &HqRow) -> bool {
        self.industry.is_none_or(|i| i == h.industry)
            && self.country.is_none_or(|c| c == h.country)
            && self.listed.is_none_or(|l| l == h.listed)
    }
}

/// A map mode with its parameter (spec 8 Map row, 9.2 `get_map_layer(mode, param)`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub enum MapMode {
    /// Provinces coloured by country (the default).
    #[default]
    Political,
    /// A development track as a heat map.
    Development(DevTrack),
    /// `None`: the Industry track; `Some`: that industry's business assets by province.
    Industry(Option<IndustryId>),
    /// HQ pins sized by revenue and coloured by sector, over muted countries.
    CompanyHqs(HqFilter),
    /// Each province shaded by its zone's current effect, with a pin on each hub city.
    FinancialZones,
}

impl MapMode {
    /// The mode's name, without its parameter.
    pub fn name(self) -> &'static str {
        match self {
            MapMode::Political => "Political",
            MapMode::Development(_) => "Development",
            MapMode::Industry(_) => "Industry",
            MapMode::CompanyHqs(_) => "Company HQs",
            MapMode::FinancialZones => "Financial zones",
        }
    }
}

/// A layer's values by province ordinal (spec 9: `Vec<f32>` or `Vec<u32>`).
#[derive(Debug, Clone, PartialEq)]
pub enum LayerValues {
    /// A category per province (Political and Company HQs: the country ordinal).
    Categories(Vec<u32>),
    /// A number per province (the heat maps and the zone effect).
    Scalars(Vec<f32>),
}

/// How the map colours a layer's values.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayerStyle {
    /// A colour per category (country).
    Political,
    /// The countries' colours, dimmed under pins (Company HQs).
    Muted,
    /// A sequential ramp from the scale's low to its high end.
    Sequential,
    /// A ramp through zero: below in one hue, above in another (the zone effect).
    Diverging,
}

/// What a scalar layer's numbers are.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScaleUnit {
    /// Development points.
    Points,
    /// USD.
    Money,
    /// A yearly rate (the zone effect).
    Rate,
}

/// A scalar layer's scale: the values run from `low` to `high` (a diverging one is symmetric
/// about zero).
#[derive(Debug, Clone, PartialEq)]
pub struct LayerScale {
    pub low: f64,
    pub high: f64,
    pub unit: ScaleUnit,
    pub label: String,
}

/// One legend row: a category (or a scalar's stop) and its label.
#[derive(Debug, Clone, PartialEq)]
pub struct LegendEntry {
    pub value: u32,
    pub label: String,
}

/// What a pin stands for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PinTarget {
    /// A company's HQ.
    Company(CompanyId),
    /// A zone exchange's hub city.
    Exchange(ZoneId),
}

/// A pin at a province's label point.
#[derive(Debug, Clone, PartialEq)]
pub struct MapPin {
    pub province: ProvinceId,
    pub target: PinTarget,
    /// What sizes it: an HQ's revenue TTM as shown (an estimate for a company that does not
    /// publish, D701); 0 for a hub.
    pub size: f64,
    /// Its colour category: an HQ's sector (index into the legend), a hub's zone ordinal.
    pub category: u32,
    /// A hub's exchange code (empty for an HQ).
    pub code: String,
    /// A hub's headline index level (v_exchanges), if it has one.
    pub level: Option<f64>,
}

/// What `get_map_layer` returns.
#[derive(Debug, Clone, PartialEq)]
pub struct MapLayer {
    pub mode: MapMode,
    pub values: LayerValues,
    pub style: LayerStyle,
    /// A scalar layer's scale.
    pub scale: Option<LayerScale>,
    /// By province ordinal: drawn hatched (contested, decision C).
    pub hatched: Vec<bool>,
    /// The categories shown (Political: countries; Company HQs: sectors).
    pub legend: Vec<LegendEntry>,
    pub pins: Vec<MapPin>,
    /// Extra legend lines: a label and its value (the zone mode's global phase, g_t and
    /// quarters left).
    pub notes: Vec<(String, String)>,
}

/// The Political layer.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PoliticalLayer {
    /// By province ordinal.
    pub country: Vec<CountryId>,
    /// By province ordinal: the province has a `contested` tag.
    pub contested: Vec<bool>,
}

/// One company HQ, as the Company HQs mode pins it.
#[derive(Debug, Clone, PartialEq)]
pub struct HqRow {
    pub company: CompanyId,
    pub province: ProvinceId,
    pub industry: IndustryId,
    pub country: CountryId,
    /// Index into [`MapLayersView::sectors`].
    pub sector: u32,
    pub listed: bool,
    /// Revenue TTM as v_company_row shows it (D701).
    pub revenue: Figure,
}

/// One business unit's assets as v_units shows them (D701).
#[derive(Debug, Clone, PartialEq)]
pub struct UnitAssets {
    pub industry: IndustryId,
    pub province: ProvinceId,
    pub gross_assets: Figure,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MapLayersView {
    pub political: PoliticalLayer,
    /// Country names by ordinal, for the Political legend.
    country_names: Vec<String>,
    /// By province ordinal: its development tracks (spec 3.3).
    tracks: Vec<[u32; 3]>,
    /// By province ordinal: its country's financial zone (spec 3.2.1).
    pub zone: Vec<ZoneId>,
    /// Every unit of a company still in the game, in unit id order.
    pub unit_assets: Vec<UnitAssets>,
    /// Every company still in the game, in id order.
    pub hqs: Vec<HqRow>,
    /// The sector names, sorted.
    pub sectors: Vec<String>,
    /// Industry names by ordinal, for the Industry legend.
    industry_names: Vec<String>,
}

impl MapLayersView {
    /// A province's zone.
    pub fn zone_of(&self, p: ProvinceId) -> Option<ZoneId> {
        self.zone.get(p.index()).copied()
    }

    /// `get_map_layer(mode, param)` (spec 9.2) for the modes this view serves alone; the
    /// Financial zones mode needs v_cycle and v_exchanges ([`crate::SimViews::get_map_layer`])
    /// and here shows no effect.
    pub fn get_map_layer(&self, mode: MapMode) -> MapLayer {
        self.layer(mode, None)
    }

    fn base(&self, mode: MapMode, values: LayerValues, style: LayerStyle) -> MapLayer {
        MapLayer {
            mode,
            values,
            style,
            scale: None,
            hatched: self.political.contested.clone(),
            legend: Vec::new(),
            pins: Vec::new(),
            notes: Vec::new(),
        }
    }

    /// Every country that has a province, in ordinal order, named.
    fn country_legend(&self) -> Vec<LegendEntry> {
        let mut present: Vec<CountryId> = self.political.country.clone();
        present.sort_unstable();
        present.dedup();
        present
            .into_iter()
            .map(|c| LegendEntry {
                value: c.0,
                label: self.country_names.get(c.index()).cloned().unwrap_or_default(),
            })
            .collect()
    }

    fn countries(&self) -> LayerValues {
        LayerValues::Categories(self.political.country.iter().map(|c| c.0).collect())
    }

    pub(crate) fn layer(&self, mode: MapMode, zones: Option<(&CycleView, &ExchangesView)>) -> MapLayer {
        match mode {
            MapMode::Political => {
                let mut l = self.base(mode, self.countries(), LayerStyle::Political);
                l.legend = self.country_legend();
                l
            }
            MapMode::Development(t) => self.track_layer(mode, t),
            MapMode::Industry(None) => self.track_layer(mode, DevTrack::Industry),
            MapMode::Industry(Some(i)) => {
                // Spec 8: the industry's business assets by province, as shown (D701).
                let mut v = vec![0.0f64; self.political.country.len()];
                for u in self.unit_assets.iter().filter(|u| u.industry == i) {
                    if let Some(x) = v.get_mut(u.province.index()) {
                        *x += u.gross_assets.shown().max(0.0);
                    }
                }
                let high = v.iter().copied().fold(0.0, f64::max);
                let mut l = self.base(
                    mode,
                    LayerValues::Scalars(v.iter().map(|&x| x as f32).collect()),
                    LayerStyle::Sequential,
                );
                let name = self.industry_names.get(i.index()).cloned().unwrap_or_default();
                l.scale = Some(LayerScale {
                    low: 0.0,
                    high,
                    unit: ScaleUnit::Money,
                    label: format!("{name}: business assets by province"),
                });
                l
            }
            MapMode::CompanyHqs(f) => {
                let mut l = self.base(mode, self.countries(), LayerStyle::Muted);
                l.legend = self
                    .sectors
                    .iter()
                    .enumerate()
                    .map(|(i, s)| LegendEntry {
                        value: i as u32,
                        label: s.clone(),
                    })
                    .collect();
                l.pins = self
                    .hqs
                    .iter()
                    .filter(|h| f.admits(h))
                    .map(|h| MapPin {
                        province: h.province,
                        target: PinTarget::Company(h.company),
                        size: h.revenue.shown(),
                        category: h.sector,
                        code: String::new(),
                        level: None,
                    })
                    .collect();
                l
            }
            MapMode::FinancialZones => {
                let effects: Vec<f64> = zones.map_or_else(Vec::new, |(c, _)| {
                    let mut e = Vec::new();
                    for z in &c.zones {
                        let i = z.id.index();
                        if e.len() <= i {
                            e.resize(i + 1, 0.0);
                        }
                        e[i] = z.effect;
                    }
                    e
                });
                let v: Vec<f32> = self
                    .zone
                    .iter()
                    .map(|z| effects.get(z.index()).copied().unwrap_or(0.0) as f32)
                    .collect();
                let reach = effects.iter().fold(0.0f64, |m, e| m.max(e.abs()));
                let mut l = self.base(mode, LayerValues::Scalars(v), LayerStyle::Diverging);
                l.scale = Some(LayerScale {
                    low: -reach,
                    high: reach,
                    unit: ScaleUnit::Rate,
                    label: "Zone effect: intensity x g(t - lag), a year (5.1)".into(),
                });
                if let Some((c, x)) = zones {
                    l.notes = vec![
                        ("Global phase".into(), c.phase.name().to_owned()),
                        ("g_t".into(), format!("{:+.3}", c.g_t)),
                        ("Quarters left".into(), c.quarters_left.to_string()),
                    ];
                    l.pins = x
                        .exchanges
                        .iter()
                        .map(|e| MapPin {
                            province: e.hub_province,
                            target: PinTarget::Exchange(e.zone),
                            size: 0.0,
                            category: e.zone.0,
                            code: e.code.clone(),
                            level: e.level,
                        })
                        .collect();
                }
                l
            }
        }
    }

    fn track_layer(&self, mode: MapMode, t: DevTrack) -> MapLayer {
        let v = self
            .tracks
            .iter()
            .map(|&[c, i, p]| {
                (match t {
                    DevTrack::Commerce => c,
                    DevTrack::Industry => i,
                    DevTrack::Population => p,
                    DevTrack::Total => c + i + p,
                }) as f32
            })
            .collect();
        // The scale spans the tracks present (within 0 and the track's top), so the ramp uses
        // its whole range (D702).
        let present = || self.tracks.iter().zip(&v).filter(|(t, _)| t.iter().any(|&x| x > 0));
        let low = present().map(|(_, &x)| f64::from(x)).fold(t.max(), f64::min);
        let high = present().map(|(_, &x)| f64::from(x)).fold(0.0, f64::max);
        let (low, high) = if high > low { (low, high) } else { (0.0, t.max()) };
        let mut l = self.base(mode, LayerValues::Scalars(v), LayerStyle::Sequential);
        l.scale = Some(LayerScale {
            low,
            high,
            unit: ScaleUnit::Points,
            label: format!("{} development (3.3)", t.name()),
        });
        l
    }
}

impl ViewData for MapLayersView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let contested = (0..w.provinces.len())
            .map(|i| {
                input
                    .map
                    .provinces
                    .get(i)
                    .is_some_and(|s| s.contested.is_some())
            })
            .collect();
        let tracks = (0..w.provinces.len())
            .map(|i| {
                input
                    .map
                    .provinces
                    .get(i)
                    .map_or([0; 3], |s| [s.commerce, s.industry, s.population])
            })
            .collect();
        let removed = |c: CompanyId| w.companies[c].finance.status() == CompanyStatus::Removed;
        let classes = estimated_industries(&est, w);
        let unit_assets = w
            .units
            .iter()
            .filter(|(_, u)| !removed(u.company))
            .map(|(_, u)| {
                // As v_units shows it (D420, D436).
                let banded = unit_banded(&est, w, &classes, u.company, u.industry);
                UnitAssets {
                    industry: u.industry,
                    province: u.base_province,
                    gross_assets: est.company_now(
                        banded,
                        u.company,
                        Kind::GrossAssets,
                        u.gross_assets,
                    ),
                }
            })
            .collect();
        let mut sectors: Vec<String> = w.industries.iter().map(|(_, i)| i.sector.clone()).collect();
        sectors.sort_unstable();
        sectors.dedup();
        let hqs = w
            .companies
            .iter()
            .filter(|(_, c)| c.finance.in_game())
            .map(|(id, c)| HqRow {
                company: id,
                province: c.hq_province,
                industry: c.industry,
                country: c.hq_country,
                sector: sectors
                    .binary_search(&w.industries[c.industry].sector)
                    .map_or(0, |i| i as u32),
                listed: c.public,
                revenue: revenue_ttm(&est, w, id),
            })
            .collect();
        MapLayersView {
            political: PoliticalLayer {
                country: w.provinces.rows().iter().map(|p| p.country).collect(),
                contested,
            },
            country_names: w.countries.rows().iter().map(|c| c.name.clone()).collect(),
            tracks,
            zone: w
                .provinces
                .rows()
                .iter()
                .map(|p| w.countries[p.country].zone)
                .collect(),
            unit_assets,
            hqs,
            sectors,
            industry_names: w.industries.iter().map(|(_, i)| i.name.clone()).collect(),
        }
    }
}
